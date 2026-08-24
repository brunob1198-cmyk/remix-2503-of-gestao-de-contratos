import { supabase } from "@/integrations/supabase/client";
import { uploadImage } from "@/services/uploadImage";
import { SignatureService } from "@/services/SignatureService";
import {
  getPendingSyncQueue,
  getOfflineApplicationById,
  saveOfflineApplication,
  deleteSyncQueueItem,
  getOfflinePhotosByApp,
  saveOfflinePhoto,
} from "@/lib/checklistsOfflineDb";
import { toast } from "sonner";

export class ChecklistsSyncManager {
  private static isSyncing = false;

  /**
   * Processa a fila de sincronização offline
   */
  static async processSyncQueue(): Promise<{ processed: number; errors: number }> {
    if (this.isSyncing) {
      return { processed: 0, errors: 0 };
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      console.log("[SyncManager] Dispositivo offline. Sincronização ignorada.");
      return { processed: 0, errors: 0 };
    }

    this.isSyncing = true;
    let processedCount = 0;
    let errorCount = 0;

    try {
      const queue = await getPendingSyncQueue();
      if (queue.length === 0) {
        this.isSyncing = false;
        return { processed: 0, errors: 0 };
      }

      console.log(`[SyncManager] Iniciando sincronização de ${queue.length} itens da fila...`);

      for (const item of queue) {
        try {
          if (item.operation === "CREATE_APPLICATION" || item.operation === "FINALIZE_APPLICATION") {
            await this.syncApplicationItem(item);
            await deleteSyncQueueItem(item.id);
            processedCount++;
          }
        } catch (err: any) {
          console.error(`[SyncManager] Erro ao sincronizar item ${item.id}:`, err);
          errorCount++;
          item.retries = (item.retries || 0) + 1;
          item.status = item.retries >= 3 ? "ERRO" : "PENDENTE";
          item.error = err.message || String(err);
        }
      }

      if (processedCount > 0) {
        toast.success(`${processedCount} checklist(s) sincronizado(s) com sucesso no servidor!`);
      }
    } catch (err) {
      console.error("[SyncManager] Erro geral ao processar fila:", err);
    } finally {
      this.isSyncing = false;
    }

    return { processed: processedCount, errors: errorCount };
  }

  /**
   * Sincroniza uma aplicação criada offline com o Supabase e R2
   */
  private static async syncApplicationItem(queueItem: any): Promise<void> {
    const localApp = await getOfflineApplicationById(queueItem.local_id);
    if (!localApp) return;

    // Atualizar status local para SINCRONIZANDO
    localApp.sync_status = "SINCRONIZANDO";
    await saveOfflineApplication(localApp);

    const { empresa_id, user_id, modelo_id, respostas, observacoes_gerais, geo_start, geo_finish, modelo_nome } = localApp;

    // 1. Processar upload de Fotos locais pendentes no IndexedDB para Cloudflare R2
    const offlinePhotos = await getOfflinePhotosByApp(localApp.local_application_id);
    const photoUrlMap: Record<string, string[]> = {};

    for (const photo of offlinePhotos) {
      if (photo.data_url && photo.status !== "ENVIADO") {
        try {
          // Converter DataURL para File Blob
          const res = await fetch(photo.data_url);
          const blob = await res.blob();
          const file = new File([blob], photo.file_name || `foto_offline_${Date.now()}.jpg`, { type: "image/jpeg" });

          // Upload R2 via infraestrutura existente uploadImage()
          const r2Url = await uploadImage(file);
          photo.synced_url = r2Url;
          photo.status = "ENVIADO";
          await saveOfflinePhoto(photo);

          if (!photoUrlMap[photo.item_id]) {
            photoUrlMap[photo.item_id] = [];
          }
          photoUrlMap[photo.item_id].push(r2Url);
        } catch (photoErr) {
          console.warn("[SyncManager] Erro no upload R2 de foto offline:", photoErr);
        }
      }
    }

    // 2. Inserir Aplicação no Supabase (Idempotência via local_application_id)
    const { data: existingApp } = await supabase
      .from("checklist_aplicacoes" as any)
      .select("id")
      .eq("id", localApp.local_application_id)
      .maybeSingle();

    let remoteAppId = (existingApp as any)?.id;

    if (!remoteAppId) {
      const { data: newApp, error: appErr } = await supabase
        .from("checklist_aplicacoes" as any)
        .insert({
          id: localApp.local_application_id, // Preservar UUID gerado localmente para idempotência
          empresa_id,
          modelo_id,
          aplicador_id: user_id,
          status: "concluido",
          data_aplicacao: localApp.auto_saved_at || new Date().toISOString(),
          observacoes_gerais: observacoes_gerais || null,
          origem_execucao: "OFFLINE",
          synced_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (appErr && !appErr.message.includes("duplicate")) {
        throw new Error(`Erro ao salvar aplicação remota: ${appErr.message}`);
      }
      remoteAppId = (newApp as any)?.id || localApp.local_application_id;
    }

    // 3. Inserir Respostas e Planos de Ação 5W2H
    const listRespostas = Object.values(respostas || {});
    let totalConforme = 0;
    let totalNaoConforme = 0;
    let totalNa = 0;

    for (const r of listRespostas) {
      if (r.resposta_valor === "Conforme" || r.resposta_valor === "Sim" || r.resposta_valor === "OK") {
        totalConforme++;
      } else if (r.is_nao_conforme) {
        totalNaoConforme++;
      } else {
        totalNa++;
      }

      // Anexar URLs das fotos enviadas para o R2
      // Aceita as duas formas: a nova (`evidencias`, com coordenada por foto) e a
      // antiga (`evidencias_urls`). Itens ja enfileirados em algum celular foram
      // gravados na forma antiga, e trocar sem aceitar deixaria esses checklists
      // sem sincronizar para sempre.
      const urlsDoDraft: string[] = Array.isArray(r.evidencias)
        ? r.evidencias.map((ev: { url: string }) => ev.url).filter(Boolean)
        : r.evidencias_urls || [];

      const evidencias = [...urlsDoDraft, ...(photoUrlMap[r.item_id] || [])];

      await supabase.from("checklist_respostas" as any).insert({
        empresa_id,
        aplicacao_id: remoteAppId,
        item_id: r.item_id,
        resposta_valor: r.resposta_valor,
        comentario: r.comentario || null,
        is_nao_conforme: !!r.is_nao_conforme,
        evidencias_urls: evidencias,
      });

      // Gerar Plano de Ação 5W2H no banco se houver desvio
      if (r.is_nao_conforme && r.plano_acao && r.plano_acao.o_que_fazer) {
        await supabase.from("checklist_planos_acao" as any).insert({
          empresa_id,
          aplicacao_id: remoteAppId,
          item_id: r.item_id,
          o_que_fazer: r.plano_acao.o_que_fazer,
          por_que: r.plano_acao.por_que || null,
          onde: r.plano_acao.onde || null,
          quando_prazo: r.plano_acao.quando_prazo,
          quem_responsavel_id: r.plano_acao.quem_responsavel_id || user_id,
          como_fazer: r.plano_acao.como_fazer || null,
          quanto_custo: r.plano_acao.quanto_custo || 0,
          prioridade: r.plano_acao.prioridade || "Media",
          status: "Aberto",
        });
      }
    }

    // Atualizar percentual de conformidade
    const totalItens = totalConforme + totalNaoConforme;
    const percentual = totalItens > 0 ? Math.round((totalConforme / totalItens) * 100) : 100;

    await supabase
      .from("checklist_aplicacoes" as any)
      .update({
        percentual_conformidade: percentual,
        total_conforme: totalConforme,
        total_nao_conforme: totalNaoConforme,
        total_na: totalNa,
      })
      .eq("id", remoteAppId);

    // 4. Sincronizar registros de Geolocalização
    if (geo_start) {
      await supabase.from("checklist_geolocalizacoes" as any).insert({
        empresa_id,
        aplicacao_id: remoteAppId,
        momento: "inicio",
        latitude: geo_start.latitude,
        longitude: geo_start.longitude,
        precisao: geo_start.accuracy || null,
      });
    }

    if (geo_finish) {
      await supabase.from("checklist_geolocalizacoes" as any).insert({
        empresa_id,
        aplicacao_id: remoteAppId,
        momento: "conclusao",
        latitude: geo_finish.latitude,
        longitude: geo_finish.longitude,
        precisao: geo_finish.accuracy || null,
      });
    }

    // 5. Acionar SignatureService para assinatura eletrônica final
    try {
      const sigReq = await SignatureService.createRequest({
        empresa_id,
        documento_id: remoteAppId,
        modulo_origem: "CHECKLISTS",
        entidade_tipo: "checklist_aplicacao",
        entidade_id: remoteAppId,
        metodo: "ASSINATURA_ELETRONICA_INTERNA",
      });

      await SignatureService.sign({
        signature_request_id: sigReq.id,
        user_id,
        nome: "Usuário Autenticado (Sync Offline)",
        empresa_nome: "Empresa Cadastrada",
        documento_titulo: `Checklist Sincronizado - ${modelo_nome || "Campo"}`,
        conteudo_resumo: `Checklist sincronizado automaticamente do dispositivo móvel com ${percentual}% de conformidade.`,
        metodo: "ASSINATURA_ELETRONICA_INTERNA",
      });
    } catch (sigErr) {
      console.warn("[SyncManager] Erro ao assinar documento remeto:", sigErr);
    }

    // Atualizar status local no IndexedDB
    localApp.sync_status = "SINCRONIZADO";
    localApp.signature_status = "ASSINADO";
    localApp.synced_at = new Date().toISOString();
    await saveOfflineApplication(localApp);
  }
}
