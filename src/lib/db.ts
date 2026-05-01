import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'medicao_storage';
const STORE_NAME = 'pdf_chunks';
const PARTIAL_PDF_STORE = 'partial_pdfs';
const UPLOAD_STORE = 'upload_queue';
const EXPORT_STATE_STORE = 'export_state';
const PHOTO_CACHE_STORE = 'photo_cache';

export interface PDFChunk {
  id: string; // medicaoId_chunkIndex
  medicaoId: string;
  index: number;
  data: ArrayBuffer;
  timestamp: number;
}

export interface UploadItem {
  id: string;
  diarioId: string;
  file: File;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  error?: string;
  path?: string;
  url?: string;
}

export async function initDB() {
  return openDB(DB_NAME, 4, {
    upgrade(db, oldVersion, newVersion) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(UPLOAD_STORE)) {
        db.createObjectStore(UPLOAD_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(EXPORT_STATE_STORE)) {
        db.createObjectStore(EXPORT_STATE_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(PHOTO_CACHE_STORE)) {
        db.createObjectStore(PHOTO_CACHE_STORE, { keyPath: 'id' });
      }
    },
  });
}

export async function savePhotoToCache(id: string, data: Blob) {
  const db = await initDB();
  return db.put(PHOTO_CACHE_STORE, { id, data, timestamp: Date.now() });
}

export async function getPhotoFromCache(id: string): Promise<Blob | null> {
  const db = await initDB();
  const entry = await db.get(PHOTO_CACHE_STORE, id);
  return entry ? entry.data : null;
}

export async function clearPhotoCache() {
  const db = await initDB();
  return db.clear(PHOTO_CACHE_STORE);
}

export async function saveExportState(medicaoId: string, state: any) {
  const db = await initDB();
  return db.put(EXPORT_STATE_STORE, { id: medicaoId, state, timestamp: Date.now() });
}

export async function getExportState(medicaoId: string) {
  const db = await initDB();
  return db.get(EXPORT_STATE_STORE, medicaoId);
}

export async function clearExportState(medicaoId: string) {
  const db = await initDB();
  return db.delete(EXPORT_STATE_STORE, medicaoId);
}

export async function savePDFChunk(chunk: PDFChunk) {
  const db = await initDB();
  return db.put(STORE_NAME, chunk);
}

export async function getPDFChunks(medicaoId: string): Promise<PDFChunk[]> {
  const db = await initDB();
  const all = await db.getAll(STORE_NAME);
  return all
    .filter((c: PDFChunk) => c.medicaoId === medicaoId)
    .sort((a, b) => a.index - b.index);
}

export async function clearPDFChunks(medicaoId: string) {
  const db = await initDB();
  const chunks = await getPDFChunks(medicaoId);
  const tx = db.transaction(STORE_NAME, 'readwrite');
  for (const chunk of chunks) {
    await tx.store.delete(chunk.id);
  }
  await tx.done;
}

export async function addToUploadQueue(item: UploadItem) {
  const db = await initDB();
  return db.put(UPLOAD_STORE, item);
}

export async function getUploadQueue(diarioId?: string): Promise<UploadItem[]> {
  const db = await initDB();
  const all = await db.getAll(UPLOAD_STORE);
  if (diarioId) {
    return all.filter((i: UploadItem) => i.diarioId === diarioId);
  }
  return all;
}

export async function updateUploadStatus(id: string, status: UploadItem['status'], data?: Partial<UploadItem>) {
  const db = await initDB();
  const item = await db.get(UPLOAD_STORE, id);
  if (item) {
    await db.put(UPLOAD_STORE, { ...item, status, ...data });
  }
}

export async function removeFromUploadQueue(id: string) {
  const db = await initDB();
  return db.delete(UPLOAD_STORE, id);
}

export async function clearCompletedUploads() {
  const db = await initDB();
  const all = await db.getAll(UPLOAD_STORE);
  const tx = db.transaction(UPLOAD_STORE, 'readwrite');
  for (const item of all) {
    if (item.status === 'completed') {
      await tx.store.delete(item.id);
    }
  }
  await tx.done;
}
