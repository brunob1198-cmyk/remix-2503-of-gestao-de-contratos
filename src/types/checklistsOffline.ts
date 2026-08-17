export type SyncStatus =
  | "LOCAL"
  | "PENDENTE_SINCRONIZACAO"
  | "SINCRONIZANDO"
  | "SINCRONIZADO"
  | "ERRO_SINCRONIZACAO";

export type SyncOperationType =
  | "CREATE_APPLICATION"
  | "UPDATE_APPLICATION"
  | "UPLOAD_PHOTO"
  | "FINALIZE_APPLICATION"
  | "SYNC_GEOLOCATION";

export interface SyncStats {
  pendingCount: number;
  syncedCount: number;
  errorCount: number;
  localModelsCount: number;
}
