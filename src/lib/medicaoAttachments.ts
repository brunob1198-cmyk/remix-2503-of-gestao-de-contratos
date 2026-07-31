import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "medicao_attachments";
const STORE = "files";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

export interface StoredAttachment {
  name: string;
  type: string;
  blob: Blob;
}

interface AttachmentEntry {
  id: string; // chave da medição (ex: numero da medição)
  files: StoredAttachment[];
  timestamp: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

const toFile = (a: StoredAttachment) => new File([a.blob], a.name, { type: a.type });

/** Salva os arquivos anexados a uma medição (substitui o conteúdo anterior da chave). */
export async function saveMedicaoAttachments(key: string, files: File[]) {
  if (!key) return;
  try {
    const db = await getDb();
    if (files.length === 0) {
      await db.delete(STORE, key);
      return;
    }
    const entry: AttachmentEntry = {
      id: key,
      files: files.map(f => ({ name: f.name, type: f.type, blob: f })),
      timestamp: Date.now(),
    };
    await db.put(STORE, entry);
  } catch {
    /* best-effort: quota cheia não deve quebrar o fluxo */
  }
}

/** Recupera os arquivos anexados previamente a uma medição. */
export async function loadMedicaoAttachments(key: string): Promise<File[]> {
  if (!key) return [];
  try {
    const db = await getDb();
    const entry = (await db.get(STORE, key)) as AttachmentEntry | undefined;
    if (!entry) return [];
    if (Date.now() - entry.timestamp > TTL_MS) {
      await db.delete(STORE, key);
      return [];
    }
    return entry.files.map(toFile);
  } catch {
    return [];
  }
}

/** Remove os anexos locais de uma medição (após envio bem-sucedido). */
export async function clearMedicaoAttachments(key: string) {
  if (!key) return;
  try {
    const db = await getDb();
    await db.delete(STORE, key);
  } catch {
    /* noop */
  }
}

/** Lista as chaves de medições que possuem anexos guardados localmente. */
export async function listMedicoesComAnexos(): Promise<string[]> {
  try {
    const db = await getDb();
    const all = (await db.getAll(STORE)) as AttachmentEntry[];
    const now = Date.now();
    const expired = all.filter(e => now - e.timestamp > TTL_MS);
    await Promise.all(expired.map(e => db.delete(STORE, e.id)));
    return all.filter(e => now - e.timestamp <= TTL_MS).map(e => e.id);
  } catch {
    return [];
  }
}
