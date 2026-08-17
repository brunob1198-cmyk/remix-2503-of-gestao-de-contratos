import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { QUERY_DEFAULTS } from "@/lib/queryClient";
import {
  saveOfflineModel,
  getOfflineModels,
  deleteOfflineModel,
  getOfflineApplications,
  getPendingSyncQueue,
  saveOfflineApplication,
  saveSyncQueueItem,
  OfflineModelStore,
  OfflineApplicationStore,
} from "@/lib/checklistsOfflineDb";
import { ChecklistsSyncManager } from "@/services/checklistsSyncManager";
import { SyncStats } from "@/types/checklistsOffline";
import { toast } from "sonner";

export function useChecklistsOffline() {
  const { profile, user } = useAuth();
  const empresaId = profile?.empresa_id;
  const queryClient = useQueryClient();

  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<string | null>(null);

  // 1. Modelos armazenados localmente no IndexedDB
  const { data: offlineModels = [], isLoading: loadingOfflineModels } = useQuery({
    queryKey: ["offline_models", empresaId],
    enabled: !!empresaId,
    ...QUERY_DEFAULTS,
    queryFn: async () => {
      return getOfflineModels(empresaId!);
    },
  });

  // 2. Aplicações locais salvas no IndexedDB
  const { data: offlineApplications = [], isLoading: loadingOfflineApps } = useQuery({
    queryKey: ["offline_applications", empresaId],
    enabled: !!empresaId,
    ...QUERY_DEFAULTS,
    queryFn: async () => {
      return getOfflineApplications(empresaId!);
    },
  });

  // 3. Fila de Sincronização Pendente
  const { data: pendingQueue = [] } = useQuery({
    queryKey: ["sync_queue_pending"],
    ...QUERY_DEFAULTS,
    queryFn: async () => {
      return getPendingSyncQueue();
    },
  });

  // Alternar Modelo "Disponível Offline"
  const toggleModelOfflineAvailability = useMutation({
    mutationFn: async (modelo: any) => {
      const existing = offlineModels.find((m) => m.id === modelo.id);
      if (existing) {
        await deleteOfflineModel(modelo.id);
        toast.info(`Modelo "${modelo.nome}" removido do armazenamento offline.`);
      } else {
        const storeObj: OfflineModelStore = {
          id: modelo.id,
          empresa_id: empresaId!,
          offline_model_version: 1,
          model_data: modelo,
          synced_at: new Date().toISOString(),
        };
        await saveOfflineModel(storeObj);
        toast.success(`Modelo "${modelo.nome}" disponibilizado offline no dispositivo!`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offline_models"] });
    },
  });

  // AutoSave progressivo de rascunho de aplicação no IndexedDB
  const autoSaveLocalApplication = async (input: {
    localAppId: string;
    modeloId: string;
    modeloNome: string;
    respostas: Record<string, any>;
    observacoesGerais?: string;
    geoStart?: any;
    geoFinish?: any;
    isFinalizing?: boolean;
  }) => {
    if (!empresaId || !user) return;

    const { localAppId, modeloId, modeloNome, respostas, observacoesGerais, geoStart, geoFinish, isFinalizing } = input;
    const nowIso = new Date().toISOString();

    const appStore: OfflineApplicationStore = {
      local_application_id: localAppId,
      empresa_id: empresaId,
      user_id: user.id,
      modelo_id: modeloId,
      modelo_nome: modeloNome,
      respostas,
      observacoes_gerais: observacoesGerais,
      geo_start: geoStart,
      geo_finish: geoFinish,
      sync_status: isFinalizing ? "PENDENTE_SINCRONIZACAO" : "LOCAL",
      signature_status: isFinalizing ? "AGUARDANDO_SINCRONIZACAO" : "PENDENTE",
      auto_saved_at: nowIso,
      origem_execucao: typeof navigator !== "undefined" && !navigator.onLine ? "OFFLINE" : "ONLINE",
    };

    await saveOfflineApplication(appStore);
    setLastAutoSaveTime(nowIso);

    // Se estiver finalizando offline: Adicionar item na fila sync_queue
    if (isFinalizing) {
      await saveSyncQueueItem({
        id: `sync_${localAppId}_${Date.now()}`,
        operation: "FINALIZE_APPLICATION",
        local_id: localAppId,
        payload: appStore,
        retries: 0,
        status: "PENDENTE",
        created_at: nowIso,
        updated_at: nowIso,
      });

      toast.info("Checklist finalizado offline e salvo na fila de sincronização!");
      queryClient.invalidateQueries({ queryKey: ["sync_queue_pending"] });
      queryClient.invalidateQueries({ queryKey: ["offline_applications"] });

      // Se houver internet no momento: Tentar processar fila imediatamente
      if (typeof navigator !== "undefined" && navigator.onLine) {
        ChecklistsSyncManager.processSyncQueue();
      }
    }
  };

  // Forçar Sincronização Manual da Fila
  const triggerManualSync = async () => {
    toast.loading("Iniciando sincronização da fila offline...");
    const res = await ChecklistsSyncManager.processSyncQueue();
    queryClient.invalidateQueries({ queryKey: ["sync_queue_pending"] });
    queryClient.invalidateQueries({ queryKey: ["offline_applications"] });
    queryClient.invalidateQueries({ queryKey: ["checklist_aplicacoes"] });
  };

  // Estatísticas do painel de Sincronização
  const stats: SyncStats = {
    pendingCount: pendingQueue.length,
    syncedCount: offlineApplications.filter((a) => a.sync_status === "SINCRONIZADO").length,
    errorCount: pendingQueue.filter((q) => q.status === "ERRO").length,
    localModelsCount: offlineModels.length,
  };

  return {
    offlineModels,
    offlineApplications,
    pendingQueue,
    stats,
    lastAutoSaveTime,
    toggleModelOfflineAvailability,
    autoSaveLocalApplication,
    triggerManualSync,
    loadingOfflineModels,
    loadingOfflineApps,
  };
}
