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
  useSgsstPgrMedidasDoPgr,
  type SgsstPgr,
  type SgsstPgrMedidaControle,
} from "@/hooks/sgsst/useSgsstPgr";
import {
  periodoDoPgr,
  hhtDoPeriodo,
  type IncidenteDoPgr,
  type RegistroHht,
} from "@/utils/sgsstPgrAcidentes";
import { hojeIso } from "@/utils/dataLocal";
import { useSgsstGhe } from "@/hooks/sgsst/useSgsstGhe";
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

  // O quadro inteiro de medidas do PGR, agora por hook compartilhado: a mesma
  // consulta alimenta o documento e a checagem de completude da tela.
  const { medidasPorItem, isLoading: carregandoMedidas } = useSgsstPgrMedidasDoPgr(
    inventario.map((i) => i.id),
    { enabled: open }
  );

  // NR-01 1.5.5.5: a analise de acidentes alimenta o gerenciamento de riscos. O
  // periodo vai do inicio do programa a data de apuracao, que e a emissao.
  const periodo = periodoDoPgr(pgr.data_inicio, hojeIso());

  const { data: incidentes = [], isLoading: carregandoIncidentes } = useQuery({
    queryKey: ["sgsst_incidentes", "do_pgr", pgr.projeto_id, periodo.de, periodo.ate],
    enabled: open && !!pgr.projeto_id,
    queryFn: async () => {
      // Do PROJETO, e nao so os ligados a este PGR: ocorrencia que ninguem
      // vinculou e justamente a que interessa conferir.
      const { data, error } = await (supabase
        .from("sgsst_incidentes" as never)
        .select(
          "id, titulo, tipo, gravidade, data_ocorrencia, dias_perdidos, dias_debitados, cat_emitida, local_ocorrencia, pgr_id, projeto_id"
        )
        .eq("projeto_id", pgr.projeto_id)
        .gte("data_ocorrencia", periodo.de)
        .lte("data_ocorrencia", periodo.ate)
        .order("data_ocorrencia", { ascending: false }) as never as Promise<{
        data: IncidenteDoPgr[] | null;
        error: { message?: string } | null;
      }>);

      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: registrosHht = [] } = useQuery({
    queryKey: ["sgsst_hht", "do_pgr", pgr.projeto_id, periodo.de, periodo.ate],
    enabled: open && !!pgr.projeto_id,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_hht" as never)
        .select("projeto_id, ano, mes, horas")
        .eq("projeto_id", pgr.projeto_id) as never as Promise<{
        data: RegistroHht[] | null;
        error: { message?: string } | null;
      }>);

      if (error) throw error;
      return data ?? [];
    },
  });

  const hht = hhtDoPeriodo(registrosHht, periodo, pgr.projeto_id);

  const { ghes } = useSgsstGhe();

  const dados: PgrDocumentoDados = useMemo(() => {
    const funcoesPorItem: Record<string, ReturnType<typeof funcoesDoItem>> = {};
    for (const item of inventario) {
      funcoesPorItem[item.id] = funcoesDoItem(item.id);
    }

    // Só os GHEs referenciados pelo inventário: um mapa com todos os grupos da
    // empresa não erraria nada, mas carregaria no documento grupo que este PGR
    // não menciona.
    const ghesPorId = new Map(ghes.map((g) => [g.id, `${g.codigo} — ${g.nome}`]));

    return {
      pgr,
      inventario,
      medidasPorItem,
      funcoesPorItem,
      ghesPorId,
      incidentes,
      hht,
      geradoPor: profile?.nome ?? null,
    };
  }, [pgr, inventario, medidasPorItem, funcoesDoItem, ghes, incidentes, hht, profile?.nome]);

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
