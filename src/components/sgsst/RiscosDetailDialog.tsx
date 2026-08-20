import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SgsstRisco } from "@/hooks/sgsst/useSgsstRiscos";
import { AlertTriangle, CheckCircle2, XCircle, Ruler, Gavel } from "lucide-react";
import { formatarLimite, limitePendente, TECNICA_LABEL } from "@/utils/sgsstRiscoLimite";

interface RiscosDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  risco: SgsstRisco | null;
}

export function RiscosDetailDialog({
  open,
  onOpenChange,
  risco,
}: RiscosDetailDialogProps) {
  if (!risco) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <DialogTitle className="text-lg">Detalhes do Perigo / Risco</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-3 text-sm">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <span className="text-xs text-muted-foreground block">Código / Nome</span>
              <span className="font-semibold text-base">{risco.codigo ? `[${risco.codigo}] ` : ""}{risco.nome}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-medium">
                {risco.categoria}
              </Badge>
              {risco.status === "ativo" ? (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Ativo
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-muted text-muted-foreground flex items-center gap-1">
                  <XCircle className="h-3 w-3" /> Inativo
                </Badge>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-muted-foreground block font-medium">Agente Nocivo</span>
              <span className="text-foreground">{risco.agente || "Não informado"}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block font-medium">Fonte Geradora</span>
              <span className="text-foreground">{risco.fonte_geradora || "Não informada"}</span>
            </div>
          </div>

          <div>
            <span className="text-xs text-muted-foreground block font-medium">Consequências / Danos à Saúde</span>
            <span className="text-foreground">{risco.consequencia || "Não informadas"}</span>
          </div>

          {/* Avaliação e limite */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2.5">
            <span className="text-xs font-semibold flex items-center gap-1.5">
              <Ruler className="h-3.5 w-3.5 text-primary" />
              Avaliação e limite de tolerância
            </span>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-muted-foreground block font-medium">Técnica</span>
                {risco.tecnica_avaliacao ? (
                  <Badge variant="outline" className="mt-0.5 text-xs">
                    {TECNICA_LABEL[risco.tecnica_avaliacao]}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">Não definida</span>
                )}
              </div>
              <div>
                <span className="text-xs text-muted-foreground block font-medium">
                  Limite de tolerância
                </span>
                <span className="text-foreground font-medium tabular-nums">
                  {formatarLimite(risco.limite_tolerancia, risco.unidade_medida) ??
                    (risco.unidade_medida ? `— (${risco.unidade_medida})` : "Não informado")}
                </span>
              </div>
            </div>

            {limitePendente(risco) && (
              <p className="text-xs text-amber-700 dark:text-amber-500">
                Este risco exige medição instrumental, mas não tem limite cadastrado. Sem
                limite não há como concluir se a exposição medida está conforme.
              </p>
            )}

            <div>
              <span className="text-xs text-muted-foreground block font-medium flex items-center gap-1">
                <Gavel className="h-3 w-3" /> Base legal
              </span>
              <span className="text-foreground">{risco.base_legal || "Não informada"}</span>
            </div>
          </div>

          <div>
            <span className="text-xs text-muted-foreground block font-medium">Descrição Detalhada</span>
            <p className="text-foreground whitespace-pre-wrap bg-muted/30 p-3 rounded-md border mt-1 text-xs">
              {risco.descricao || "Sem descrição cadastrada."}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
