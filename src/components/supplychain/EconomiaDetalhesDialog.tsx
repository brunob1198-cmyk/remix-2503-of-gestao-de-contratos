import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { EconomiaRequisicaoDetalhe } from "@/hooks/useSupplyChain";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dias: number;
  economiaTotal: number;
  detalhes: EconomiaRequisicaoDetalhe[];
}

export function EconomiaDetalhesDialog({ open, onOpenChange, dias, economiaTotal, detalhes }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Economia gerada — últimos {dias} dias</DialogTitle>
          <DialogDescription>
            Total: <strong className="text-emerald-600 dark:text-emerald-400">{fmtBRL(economiaTotal)}</strong>{" "}
            em {detalhes.length} requisi{detalhes.length === 1 ? "ção" : "ções"} com mais de uma cotação.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-3">
          {detalhes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhuma requisição com economia calculável no período.
            </p>
          ) : (
            <div className="space-y-3">
              {detalhes.map((d) => (
                <div key={d.requisicao_id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-semibold text-sm">{d.requisicao_numero ?? d.requisicao_id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">
                        Vencedora: {d.fornecedor_vencedor ?? "—"} · {fmtBRL(d.valor_vencedora)}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="border-emerald-500/50 text-emerald-600 dark:text-emerald-400">
                        {fmtBRL(d.economia)} ({d.percentual.toFixed(1)}%)
                      </Badge>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Média perdedoras: {fmtBRL(d.media_perdedoras)}
                      </p>
                    </div>
                  </div>

                  <div className="border-t pt-2">
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Cotações perdedoras ({d.perdedoras.length})
                    </p>
                    <ul className="text-xs space-y-0.5">
                      {d.perdedoras.map((p) => (
                        <li key={p.id} className="flex justify-between gap-2">
                          <span className="truncate">{p.fornecedor ?? "—"}</span>
                          <span className="tabular-nums text-muted-foreground">{fmtBRL(p.valor_total)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
