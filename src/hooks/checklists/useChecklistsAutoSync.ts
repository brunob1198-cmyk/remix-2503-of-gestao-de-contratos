import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChecklistsSyncManager } from "@/services/checklistsSyncManager";
import { getPendingSyncQueue } from "@/lib/checklistsOfflineDb";
import { toast } from "sonner";

/**
 * Sincronização automática da fila offline.
 *
 * A infraestrutura offline já existia inteira — IndexedDB, fila, gerenciador de
 * sincronização — e **nada a disparava sozinha**. `useConnectionStatus` detectava a
 * volta da conexão e não fazia nada com a informação; o único caminho era o usuário
 * abrir o Centro de Sincronização e clicar em "sincronizar".
 *
 * Na prática isso significa que o checklist preenchido na obra ficava no celular
 * até alguém lembrar de mandar. Quem preencheu acha que enviou — a tela disse
 * "salvo na fila" — e o gestor não vê o desvio.
 *
 * Este hook fecha a lacuna em três gatilhos:
 *
 * 1. **Ao voltar a conexão** (evento `online`), com um atraso curto: o evento
 *    dispara no instante em que o rádio reconecta, e a primeira requisição nesse
 *    instante costuma falhar. Alguns segundos evitam gastar uma tentativa.
 *
 * 2. **Ao montar**, se já houver fila pendente e conexão: cobre o caso de o
 *    aplicativo ter sido fechado offline e reaberto em área com sinal, em que o
 *    evento `online` nunca ocorre.
 *
 * 3. **De tempo em tempo**, enquanto houver fila: conexão de obra oscila sem
 *    disparar `online`/`offline` de forma confiável, e uma tentativa periódica é o
 *    que evita a fila envelhecer em silêncio.
 *
 * O aviso ao usuário só aparece quando algo foi de fato sincronizado. Anunciar cada
 * varredura vazia treinaria a ignorar o aviso.
 */

/** Espera após o evento `online` antes da primeira tentativa. */
const ATRASO_APOS_RECONEXAO_MS = 3_000;

/** Intervalo da tentativa periódica enquanto houver fila. */
const INTERVALO_TENTATIVA_MS = 60_000;

export function useChecklistsAutoSync() {
  const queryClient = useQueryClient();

  // Evita duas varreduras simultâneas do lado do hook. O gerenciador também tem a
  // própria trava; esta poupa a ida ao IndexedDB.
  const sincronizando = useRef(false);

  useEffect(() => {
    let cancelado = false;
    let timeoutReconexao: ReturnType<typeof setTimeout> | undefined;

    const sincronizar = async (motivo: string) => {
      if (cancelado || sincronizando.current) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;

      sincronizando.current = true;
      try {
        const fila = await getPendingSyncQueue();
        if (fila.length === 0) return;

        const resultado = await ChecklistsSyncManager.processSyncQueue();

        if (resultado.processed > 0) {
          toast.success(
            `${resultado.processed} checklist(s) sincronizado(s) automaticamente.`,
            { description: `Disparado por: ${motivo}.` }
          );
        }

        // Erro na fila é dito: sem isso o item fica tentando para sempre sem que
        // ninguém saiba que existe um problema.
        if (resultado.errors > 0) {
          toast.warning(
            `${resultado.errors} item(ns) da fila não sincronizaram. Abra o Centro de Sincronização para ver o motivo.`,
            { duration: 10_000 }
          );
        }

        if (resultado.processed > 0 || resultado.errors > 0) {
          queryClient.invalidateQueries({ queryKey: ["sync_queue_pending"] });
          queryClient.invalidateQueries({ queryKey: ["offline_applications"] });
          queryClient.invalidateQueries({ queryKey: ["checklist_aplicacoes"] });
        }
      } catch (e) {
        // Falha na varredura não pode derrubar a tela: a fila continua no
        // dispositivo e a próxima tentativa acontece no gatilho seguinte.
        console.warn("[AutoSync] Falha ao processar a fila:", e);
      } finally {
        sincronizando.current = false;
      }
    };

    const aoVoltarConexao = () => {
      clearTimeout(timeoutReconexao);
      timeoutReconexao = setTimeout(
        () => void sincronizar("volta da conexão"),
        ATRASO_APOS_RECONEXAO_MS
      );
    };

    if (typeof window !== "undefined") {
      window.addEventListener("online", aoVoltarConexao);
    }

    // Gatilho de montagem: cobre o app fechado offline e reaberto com sinal, em que
    // o evento `online` nunca dispara.
    void sincronizar("abertura do aplicativo");

    const intervalo = setInterval(
      () => void sincronizar("tentativa periódica"),
      INTERVALO_TENTATIVA_MS
    );

    return () => {
      cancelado = true;
      clearTimeout(timeoutReconexao);
      clearInterval(intervalo);
      if (typeof window !== "undefined") {
        window.removeEventListener("online", aoVoltarConexao);
      }
    };
  }, [queryClient]);
}
