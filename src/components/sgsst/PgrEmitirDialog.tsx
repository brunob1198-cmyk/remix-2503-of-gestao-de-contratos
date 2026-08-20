import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileDown, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  useSgsstPgrInventario,
  useSgsstPgrInventarioFuncoes,
  type SgsstPgr,
  type SgsstPgrMedidaControle,
} from "@/hooks/sgsst/useSgsstPgr";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { gerarPdfPgr, pendenciasPgr, type PgrDocumentoDados } from "@/lib/pgrDocumento";

/**
 * Emissão do PGR em PDF.
 *
 * Mostra as pendências antes de gerar, para o usuário decidir com informação em
 * vez de descobrir o furo depois de entregar o documento ao auditor. Emitir com
 * pendência é permitido de propósito — o programa em elaboração também precisa
 * ser impresso, e o próprio PDF marca o que falta.
 */

interface PgrEmitirDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pgr: SgsstPgr;
}

export function PgrEmitirDialog({ open, onOpenChange, pgr }: PgrEmitirDialogProps) {
  const { profile } = useAuth();
  const [gerando, setGerando] = useState(false);

  const { inventario } = useSgsstPgrInventario(open ? pgr.id : undefined);
  const { funcoesDoItem } = useSgsstPgrInventarioFuncoes(open ? pgr.id : undefined);

  // As medidas de todos os itens de uma vez. O hook por item serve à tela, que
  // mostra um item por vez; o documento precisa do plano de ação inteiro.
  const { data: medidas = [], isLoading: carregandoMedidas } = useQuery({
    queryKey: ["sgsst_pgr_medidas_controle", "todas", pgr.id],
    enabled: open && inventario.length > 0,
    queryFn: async () => {
      const ids = inventario.map((i) => i.id);
      const { data, error } = await (supabase
        .from("sgsst_pgr_medidas_controle" as never)
        .select(
          "*, responsavel:profiles!sgsst_pgr_medidas_controle_responsavel_id_fkey(id, nome), verificador:profiles!sgsst_pgr_medidas_controle_verificador_id_fkey(id, nome)"
        )
        .in("inventario_id", ids) as never as Promise<{
        data: SgsstPgrMedidaControle[] | null;
        error: { message?: string } | null;
      }>);

      if (error) throw error;
      return data ?? [];
    },
  });

  const dados: PgrDocumentoDados = useMemo(() => {
    const medidasPorItem: Record<string, SgsstPgrMedidaControle[]> = {};
    for (const m of medidas) {
      (medidasPorItem[m.inventario_id] ??= []).push(m);
    }

    const funcoesPorItem: Record<string, ReturnType<typeof funcoesDoItem>> = {};
    for (const item of inventario) {
      funcoesPorItem[item.id] = funcoesDoItem(item.id);
    }

    return {
      pgr,
      inventario,
      medidasPorItem,
      funcoesPorItem,
      geradoPor: profile?.nome ?? null,
    };
  }, [pgr, inventario, medidas, funcoesDoItem, profile?.nome]);

  const pendencias = useMemo(() => pendenciasPgr(dados), [dados]);

  const emitir = async () => {
    setGerando(true);
    try {
      await gerarPdfPgr(dados);
      toast.success("PGR gerado.");
      onOpenChange(false);
    } catch (err) {
      const detalhe = err instanceof Error ? err.message : String(err);
      toast.error(`Erro ao gerar o PDF: ${detalhe}`);
    } finally {
      setGerando(false);
    }
  };

  const carregando = carregandoMedidas && inventario.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5 text-primary" />
            Emitir PGR em PDF
          </DialogTitle>
          <DialogDescription>
            {pgr.titulo} · versão {pgr.versao ?? 1} · {inventario.length} item(ns) no inventário
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {carregando ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Conferindo o programa...
            </p>
          ) : pendencias.length === 0 ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/40">
              <p className="flex items-start gap-2 text-sm text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  Nenhuma pendência encontrada. O programa atende aos itens que o sistema sabe
                  verificar — o conteúdo técnico continua sendo responsabilidade de quem assina.
                </span>
              </p>
            </div>
          ) : (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                {pendencias.length} pendência(s) antes de emitir
              </p>
              <ul className="mt-2 space-y-1">
                {pendencias.map((p) => (
                  <li
                    key={p}
                    className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-400"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    {p}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-500">
                Dá para emitir assim — programa em elaboração também precisa ser impresso. O PDF
                marca cada campo faltante em vez de sair em branco.
              </p>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            A NR-01 1.5.7.3.3 exige a guarda do PGR e do seu histórico de atualizações por 20
            anos.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={emitir} disabled={gerando || carregando} className="gap-2">
            {gerando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Gerando...
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4" /> Gerar PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
