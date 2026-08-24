import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  getOfflineModels,
  saveOfflineModel,
  deleteOfflineModel,
  type OfflineModelStore,
} from "@/lib/checklistsOfflineDb";
import type { ChecklistModelo } from "@/hooks/checklists/useChecklists";

/**
 * Cache automático dos modelos de checklist para uso offline.
 *
 * Antes, cada modelo tinha de ser marcado à mão como "disponível offline", um por
 * um, antes de sair para o campo. Isso transfere para a pessoa uma decisão que ela
 * só descobre ter errado quando já está sem sinal na obra — e o custo do erro é não
 * conseguir aplicar o checklist.
 *
 * Agora todo modelo **ativo** é guardado automaticamente enquanto há conexão. Três
 * razões para isso ser seguro:
 *
 * 1. Modelo é texto: seções, itens e configurações. Um modelo grande tem alguns
 *    quilobytes, e o IndexedDB comporta a ordem de centenas de megabytes.
 * 2. O custo de guardar um modelo que não vai ser usado é irrisório; o custo de não
 *    ter o modelo que vai ser usado é a inspeção não acontecer.
 * 3. Modelo inativo ou apagado é REMOVIDO do cache na mesma passagem. Sem isso o
 *    dispositivo aplicaria para sempre a versão antiga de um modelo que a matriz já
 *    corrigiu — pior que não ter cache.
 *
 * A marcação manual continua existindo para quem quiser fixar um modelo inativo,
 * mas deixou de ser o que faz o offline funcionar.
 */

/** Teto de modelos guardados. Evita encher o dispositivo em base muito grande. */
export const CACHE_MAXIMO_MODELOS = 200;

export function useChecklistsCacheAutomatico(modelos: readonly ChecklistModelo[]) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const queryClient = useQueryClient();

  // A última assinatura processada. Sem isto o efeito reescreveria o IndexedDB a
  // cada render em que a lista chega por referência nova.
  const ultimaAssinatura = useRef<string>("");

  useEffect(() => {
    if (!empresaId || modelos.length === 0) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    const ativos = modelos
      .filter((m) => m.status === "ativo")
      .slice(0, CACHE_MAXIMO_MODELOS);

    // `updated_at` entra na assinatura: modelo editado na matriz tem de descer para
    // o dispositivo, e comparar só os ids deixaria a versão velha em cache.
    const assinatura = ativos
      .map((m) => `${m.id}:${m.updated_at ?? ""}`)
      .sort()
      .join("|");

    if (assinatura === ultimaAssinatura.current) return;

    let cancelado = false;

    const sincronizarCache = async () => {
      try {
        const guardados = await getOfflineModels(empresaId);
        if (cancelado) return;

        const guardadosPorId = new Map(guardados.map((g) => [g.id, g]));
        const idsAtivos = new Set(ativos.map((m) => m.id));

        for (const modelo of ativos) {
          const guardado = guardadosPorId.get(modelo.id);
          const versaoLocal = guardado?.model_data?.updated_at ?? null;

          // Só grava o que mudou: reescrever tudo a cada passagem gastaria escrita
          // no dispositivo sem ganho nenhum.
          if (guardado && versaoLocal === (modelo.updated_at ?? null)) continue;

          const registro: OfflineModelStore = {
            id: modelo.id,
            empresa_id: empresaId,
            offline_model_version: (guardado?.offline_model_version ?? 0) + 1,
            model_data: modelo,
            synced_at: new Date().toISOString(),
          };

          await saveOfflineModel(registro);
          if (cancelado) return;
        }

        // Modelo que saiu de "ativo" ou foi apagado sai do cache. Manter faria o
        // dispositivo aplicar para sempre uma versão que a matriz já corrigiu.
        for (const guardado of guardados) {
          if (!idsAtivos.has(guardado.id)) {
            await deleteOfflineModel(guardado.id);
            if (cancelado) return;
          }
        }

        ultimaAssinatura.current = assinatura;
        queryClient.invalidateQueries({ queryKey: ["offline_models"] });
      } catch (e) {
        // Falha no cache não pode atrapalhar a tela: sem cache o app segue
        // funcionando online, e a próxima passagem tenta de novo.
        console.warn("[CacheOffline] Falha ao guardar modelos:", e);
      }
    };

    void sincronizarCache();

    return () => {
      cancelado = true;
    };
  }, [empresaId, modelos, queryClient]);
}
