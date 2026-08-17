import { openDB, DBSchema, IDBPDatabase } from "idb";

export interface OfflineModelStore {
  id: string;
  empresa_id: string;
  offline_model_version: number;
  model_data: any;
  synced_at: string;
}

export interface OfflineApplicationStore {
  local_application_id: string;
  empresa_id: string;
  user_id: string;
  modelo_id: string;
  modelo_nome: string;
  respostas: Record<string, any>;
  observacoes_gerais?: string;
  geo_start?: any;
  geo_finish?: any;
  sync_status: "LOCAL" | "PENDENTE_SINCRONIZACAO" | "SINCRONIZANDO" | "SINCRONIZADO" | "ERRO_SINCRONIZACAO";
  signature_status: "PENDENTE" | "AGUARDANDO_SINCRONIZACAO" | "ASSINADO";
  auto_saved_at: string;
  synced_at?: string;
  error_message?: string;
  origem_execucao: "ONLINE" | "OFFLINE";
}

export interface SyncQueueStore {
  id: string;
  operation: "CREATE_APPLICATION" | "UPDATE_APPLICATION" | "UPLOAD_PHOTO" | "FINALIZE_APPLICATION" | "SYNC_GEOLOCATION";
  local_id: string;
  payload: any;
  retries: number;
  status: "PENDENTE" | "PROCESSANDO" | "SUCESSO" | "ERRO";
  error?: string;
  created_at: string;
  updated_at: string;
}

export interface OfflinePhotoStore {
  id: string;
  local_application_id: string;
  item_id: string;
  data_url: string;
  file_name: string;
  synced_url?: string;
  status: "PENDENTE" | "ENVIADO" | "ERRO";
  created_at: string;
}

interface ChecklistsOfflineDBSchema extends DBSchema {
  offline_models: {
    key: string;
    value: OfflineModelStore;
    indexes: { "by-empresa": string };
  };
  offline_applications: {
    key: string;
    value: OfflineApplicationStore;
    indexes: { "by-empresa": string; "by-status": string };
  };
  sync_queue: {
    key: string;
    value: SyncQueueStore;
    indexes: { "by-status": string };
  };
  offline_photos: {
    key: string;
    value: OfflinePhotoStore;
    indexes: { "by-app": string; "by-status": string };
  };
}

const DB_NAME = "checklists_offline_db";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<ChecklistsOfflineDBSchema>> | null = null;

export function getOfflineDB(): Promise<IDBPDatabase<ChecklistsOfflineDBSchema>> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.reject(new Error("IndexedDB não suportado no ambiente atual."));
  }

  if (!dbPromise) {
    dbPromise = openDB<ChecklistsOfflineDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Store 1: Models
        if (!db.objectStoreNames.contains("offline_models")) {
          const modelStore = db.createObjectStore("offline_models", { keyPath: "id" });
          modelStore.createIndex("by-empresa", "empresa_id");
        }

        // Store 2: Applications
        if (!db.objectStoreNames.contains("offline_applications")) {
          const appStore = db.createObjectStore("offline_applications", { keyPath: "local_application_id" });
          appStore.createIndex("by-empresa", "empresa_id");
          appStore.createIndex("by-status", "sync_status");
        }

        // Store 3: Sync Queue
        if (!db.objectStoreNames.contains("sync_queue")) {
          const queueStore = db.createObjectStore("sync_queue", { keyPath: "id" });
          queueStore.createIndex("by-status", "status");
        }

        // Store 4: Photos
        if (!db.objectStoreNames.contains("offline_photos")) {
          const photoStore = db.createObjectStore("offline_photos", { keyPath: "id" });
          photoStore.createIndex("by-app", "local_application_id");
          photoStore.createIndex("by-status", "status");
        }
      },
    });
  }

  return dbPromise;
}

/**
 * Operações Utilitárias IndexedDB
 */

export async function saveOfflineModel(model: OfflineModelStore): Promise<void> {
  const db = await getOfflineDB();
  await db.put("offline_models", model);
}

export async function getOfflineModels(empresaId: string): Promise<OfflineModelStore[]> {
  const db = await getOfflineDB();
  return db.getAllFromIndex("offline_models", "by-empresa", empresaId);
}

export async function deleteOfflineModel(modelId: string): Promise<void> {
  const db = await getOfflineDB();
  await db.delete("offline_models", modelId);
}

export async function saveOfflineApplication(app: OfflineApplicationStore): Promise<void> {
  const db = await getOfflineDB();
  await db.put("offline_applications", app);
}

export async function getOfflineApplications(empresaId: string): Promise<OfflineApplicationStore[]> {
  const db = await getOfflineDB();
  return db.getAllFromIndex("offline_applications", "by-empresa", empresaId);
}

export async function getOfflineApplicationById(localId: string): Promise<OfflineApplicationStore | undefined> {
  const db = await getOfflineDB();
  return db.get("offline_applications", localId);
}

export async function saveSyncQueueItem(item: SyncQueueStore): Promise<void> {
  const db = await getOfflineDB();
  await db.put("sync_queue", item);
}

export async function getPendingSyncQueue(): Promise<SyncQueueStore[]> {
  const db = await getOfflineDB();
  return db.getAllFromIndex("sync_queue", "by-status", "PENDENTE");
}

export async function deleteSyncQueueItem(id: string): Promise<void> {
  const db = await getOfflineDB();
  await db.delete("sync_queue", id);
}

export async function saveOfflinePhoto(photo: OfflinePhotoStore): Promise<void> {
  const db = await getOfflineDB();
  await db.put("offline_photos", photo);
}

export async function getOfflinePhotosByApp(localAppId: string): Promise<OfflinePhotoStore[]> {
  const db = await getOfflineDB();
  return db.getAllFromIndex("offline_photos", "by-app", localAppId);
}
