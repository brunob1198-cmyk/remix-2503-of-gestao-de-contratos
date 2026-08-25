import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Clock, AlertTriangle } from "lucide-react";
import { useAvaliacoesDoFornecedor } from "@/hooks/useSupplyChain";
import {
  CRITERIOS_AVALIACAO,
  scoreDaAvaliacao,
  textoDaForca,
  textoDoPrazo,
} from "@/lib/avaliacaoFornecedor";

/**
 * O histórico de avaliações de um fornecedor.
 *
 * As avaliações eram gravadas e **nunca lidas de volta por tela nenhuma**. Dava para
 * ver que um fornecedor tinha score 42 e não havia como saber por quê — nem quem
 * avaliou, nem em qual pedido, nem o que escreveu.
 *
 * Score sem o histórico atrás é um número sem argumento, e é com ele que se decide
 * para quem vai o próximo pedido. Aqui aparece a nota de cada critério, o atraso
 * medido daquela entrega e a observação de quem avaliou.
 */

interface HistoricoAvaliacoesDialogProps {
  fornecedor: { id: string; razao_social?: string | null; avaliacoes_total?: number | null } | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const dataBr = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

export function HistoricoAvaliacoesDialog({
  fornecedor,
  open,
  onOpenChange,
}: HistoricoAvaliacoesDialogProps) {
  const { data: avaliacoes = [], isLoading } = useAvaliacoesDoFornecedor(
    open ? fornecedor?.id : undefined
  );

  const estrelas = (nota?: number | null) => {
    const n = Number(nota ?? 0);
    return (
      <span className="inline-flex items-center gap-0.5" title={`${n} de 5`}>
        {[1, 2, 3, 4, 5].map((e) => (
          <Star
            key={e}
            className={`h-3 w-3 ${
              e <= n ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/25"
            }`}
          />
        ))}
      </span>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Avaliações de {fornecedor?.razao_social ?? "fornecedor"}</DialogTitle>
          <DialogDescription>{textoDaForca(fornecedor?.avaliacoes_total)}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Carregando avaliações...
          </p>
        ) : avaliacoes.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma avaliação registrada. O fornecedor é avaliado ao fim de cada pedido
            entregue, na aba de Pedidos.
          </p>
        ) : (
          <div className="space-y-3">
            {avaliacoes.map((a: Record<string, unknown>) => {
              const pedido = a.pedido as
                | { numero?: string; data_emissao?: string; data_entrega_real?: string }
                | null;

              const notas = {
                PRAZO: Number(a.nota_prazo ?? 0),
                PRECO: Number(a.nota_preco ?? 0),
                QUALIDADE: Number(a.nota_qualidade ?? 0),
                RESPONSIVIDADE: Number(a.nota_responsividade ?? 0),
              };

              const atraso = a.atraso_dias === null || a.atraso_dias === undefined
                ? null
                : Number(a.atraso_dias);

              return (
                <div key={String(a.id)} className="rounded-md border p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">{pedido?.numero ?? "pedido removido"}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {scoreDaAvaliacao(notas).toFixed(1)} de 100
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      avaliado em {dataBr(a.created_at as string)}
                      {(a.avaliador as { nome?: string } | null)?.nome
                        ? ` por ${(a.avaliador as { nome?: string }).nome}`
                        : ""}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                    {CRITERIOS_AVALIACAO.map((c) => (
                      <div key={c.criterio} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {c.titulo}{" "}
                          <span className="text-[10px]">({Math.round(c.peso * 100)}%)</span>
                        </span>
                        {estrelas(notas[c.criterio])}
                      </div>
                    ))}
                  </div>

                  {/* O atraso medido daquela entrega, ao lado das notas. É o fato que
                      permite julgar se a nota de prazo foi generosa. */}
                  {(atraso !== null || a.dias_prometidos || a.dias_entregues) && (
                    <p
                      className={`flex items-start gap-1.5 text-xs ${
                        atraso !== null && atraso > 0 ? "text-amber-700" : "text-muted-foreground"
                      }`}
                    >
                      {atraso !== null && atraso > 0 ? (
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                      ) : (
                        <Clock className="mt-0.5 h-3 w-3 shrink-0" />
                      )}
                      {textoDoPrazo({
                        diasPrometidos: (a.dias_prometidos as number) ?? null,
                        diasEntregues: (a.dias_entregues as number) ?? null,
                        atrasoDias: atraso,
                      })}
                    </p>
                  )}

                  {!!a.observacao && (
                    <p className="border-t pt-2 text-xs">{String(a.observacao)}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
