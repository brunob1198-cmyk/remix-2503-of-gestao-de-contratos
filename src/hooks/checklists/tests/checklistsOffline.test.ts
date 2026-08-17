// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import {
  saveOfflineModel,
  getOfflineModels,
  saveOfflineApplication,
  getOfflineApplications,
  saveSyncQueueItem,
  getPendingSyncQueue,
  saveOfflinePhoto,
  getOfflinePhotosByApp,
} from "@/lib/checklistsOfflineDb";

describe("PROMPT 021 - Funcionamento Offline do Módulo Checklists - Unit Tests", () => {
  const testEmpresaId = "empresa_test_123";
  const testAppId = `local_app_${Date.now()}`;

  it("deve armazenar e recuperar modelos de checklist para uso offline", async () => {
    const mockModel = {
      id: "modelo_chk_001",
      empresa_id: testEmpresaId,
      offline_model_version: 1,
      model_data: {
        nome: "Inspeção de Andaimes Offline",
        categoria: "Segurança do Trabalho",
        secoes: [],
      },
      synced_at: new Date().toISOString(),
    };

    await saveOfflineModel(mockModel);

    const models = await getOfflineModels(testEmpresaId);
    expect(models.length).toBeGreaterThan(0);
    const found = models.find((m) => m.id === "modelo_chk_001");
    expect(found).toBeDefined();
    expect(found?.model_data.nome).toBe("Inspeção de Andaimes Offline");
  });

  it("deve realizar o AutoSave de aplicações de checklist no IndexedDB local", async () => {
    const mockApp = {
      local_application_id: testAppId,
      empresa_id: testEmpresaId,
      user_id: "user_test_456",
      modelo_id: "modelo_chk_001",
      modelo_nome: "Inspeção de Andaimes Offline",
      respostas: {
        item_1: { resposta_valor: "Conforme", comentario: "Tudo em ordem" },
      },
      sync_status: "LOCAL" as const,
      signature_status: "PENDENTE" as const,
      auto_saved_at: new Date().toISOString(),
      origem_execucao: "OFFLINE" as const,
    };

    await saveOfflineApplication(mockApp);

    const apps = await getOfflineApplications(testEmpresaId);
    const found = apps.find((a) => a.local_application_id === testAppId);

    expect(found).toBeDefined();
    expect(found?.sync_status).toBe("LOCAL");
    expect(found?.respostas.item_1.resposta_valor).toBe("Conforme");
  });

  it("deve criar e enfileirar fotos offline para upload posterior no Cloudflare R2", async () => {
    const mockPhoto = {
      id: `photo_${Date.now()}`,
      local_application_id: testAppId,
      item_id: "item_1",
      data_url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      file_name: "evidencia_campo.png",
      status: "PENDENTE" as const,
      created_at: new Date().toISOString(),
    };

    await saveOfflinePhoto(mockPhoto);

    const photos = await getOfflinePhotosByApp(testAppId);
    expect(photos.length).toBeGreaterThan(0);
    expect(photos[0].status).toBe("PENDENTE");
    expect(photos[0].file_name).toBe("evidencia_campo.png");
  });

  it("deve adicionar item idempotente na fila de sincronização (sync_queue)", async () => {
    const queueItem = {
      id: `sync_${testAppId}`,
      operation: "FINALIZE_APPLICATION" as const,
      local_id: testAppId,
      payload: { app_id: testAppId },
      retries: 0,
      status: "PENDENTE" as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await saveSyncQueueItem(queueItem);

    const pending = await getPendingSyncQueue();
    expect(pending.length).toBeGreaterThan(0);
    const found = pending.find((p) => p.id === `sync_${testAppId}`);
    expect(found).toBeDefined();
    expect(found?.operation).toBe("FINALIZE_APPLICATION");
  });
});
