import { AtividadePlanejamento } from "@/hooks/usePlanejamento";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  adiantado: { label: "Adiantado", variant: "default" },
  no_prazo: { label: "No Prazo", variant: "secondary" },
  atrasado: { label: "Atrasado", variant: "destructive" },
  nao_iniciado: { label: "Não Iniciado", variant: "outline" },
  concluido: { label: "Concluído", variant: "default" },
};

interface Props {
  atividade: AtividadePlanejamento | null;
  onClose: () => void;
  allAtividades: AtividadePlanejamento[];
}

export function AtividadeDetailSheet({ atividade, onClose, allAtividades }: Props) {
  if (!atividade) return null;

  const statusInfo = STATUS_MAP[atividade.status || "nao_iniciado"];
  const predecessorasNomes = (atividade.predecessoras || []).map((pId) => {
    const p = allAtividades.find((a) => a.id === pId);
    return p?.nome || pId;
  });

  return (
    <Sheet open={!!atividade} onOpenChange={() => onClose()}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-lg">{atividade.nome}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          </div>

          <div>
            <span className="text-sm text-muted-foreground">Progresso</span>
            <div className="flex items-center gap-3 mt-1">
              <Progress value={atividade.percentual_executado || 0} className="flex-1" />
              <span className="text-sm font-semibold">{atividade.percentual_executado?.toFixed(1)}%</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Frente</span>
              <p className="font-medium">{atividade.frente_nome}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Duração</span>
              <p className="font-medium">{atividade.duracao_dias} dias</p>
            </div>
            <div>
              <span className="text-muted-foreground">Qtd. Total</span>
              <p className="font-medium">{atividade.quantidade_total}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Qtd. Produzida</span>
              <p className="font-medium">{atividade.qtd_produzida}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Produção Diária Prevista</span>
              <p className="font-medium">{atividade.producao_diaria_prevista}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Início</span>
              <p className="font-medium">
                {atividade.data_inicio ? format(new Date(atividade.data_inicio), "dd/MM/yyyy") : "—"}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Fim Previsto</span>
              <p className="font-medium">
                {atividade.data_fim_prevista ? format(new Date(atividade.data_fim_prevista), "dd/MM/yyyy") : "—"}
              </p>
            </div>
          </div>

          {predecessorasNomes.length > 0 && (
            <div>
              <span className="text-sm text-muted-foreground">Predecessoras</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {predecessorasNomes.map((n, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {n}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
