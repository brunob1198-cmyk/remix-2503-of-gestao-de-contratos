import { useHistorico, type ScEntidadeTipo } from "@/hooks/useSupplyChain";
import { CheckCircle2, Circle, Clock, MessageSquare, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface RequisitionTimelineProps {
  /** Legacy prop — same as `entidadeId`, mantido para compatibilidade */
  requisicaoId?: string;
  entidadeId?: string;
  entidadeTipo?: ScEntidadeTipo;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Criação",
  SUBMITTED: "Envio para Compras",
  QUOTING: "Em Cotação",
  QUOTE_COMPLETED: "Cotação Finalizada",
  PENDING_APPROVAL: "Aguardando Aprovação",
  APPROVED: "Aprovada",
  REJECTED: "Rejeitada",
  PURCHASE_ORDER_CREATED: "Pedido Gerado",
  PURCHASED: "Comprado",
  RECEIVED: "Recebimento",
  CLOSED: "Finalizado",
};

export function RequisitionTimeline({ requisicaoId, entidadeId, entidadeTipo = "requisicao" }: RequisitionTimelineProps) {
  const id = entidadeId ?? requisicaoId;
  const { data: historico, isLoading } = useHistorico(entidadeTipo, id);

  if (isLoading) return <div className="py-4 text-center text-sm text-muted-foreground">Carregando histórico...</div>;
  if (!historico || historico.length === 0) return <div className="py-4 text-center text-sm text-muted-foreground">Nenhum histórico encontrado.</div>;

  // Historico is ordered by created_at DESC (newest first)
  // We want to show the timeline from oldest to newest or newest to oldest?
  // Usually, a timeline for audit shows newest at top.
  
  return (
    <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-primary/20 before:via-primary/20 before:to-transparent">
      {historico.map((item: any, idx: number) => {
        const isLast = idx === historico.length - 1;
        const statusLabel = STATUS_LABELS[item.status_novo] || item.status_novo;
        const date = new Date(item.created_at);
        
        return (
          <div key={item.id} className="relative flex items-start gap-4 pl-10">
            {/* The dot */}
            <div className={`absolute left-0 w-10 h-10 flex items-center justify-center rounded-full border-4 border-background bg-muted z-10 ${idx === 0 ? 'text-primary ring-2 ring-primary/20' : 'text-muted-foreground'}`}>
              {idx === 0 ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <Circle className="h-2 w-2 fill-current" />
              )}
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-foreground">{statusLabel}</h4>
                  <Badge variant={idx === 0 ? "default" : "outline"} className="text-[10px] h-4">
                    {item.status_novo}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {format(date, "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                </div>
              </div>

              <div className="bg-muted/30 rounded-lg p-3 border border-muted-foreground/10 text-sm space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                  <span className="font-medium text-foreground/80">{item.profiles?.nome || "Sistema"}</span>
                </div>
                
                {item.observacoes && (
                  <div className="flex items-start gap-2 bg-background/50 p-2 rounded border border-dashed text-xs italic text-muted-foreground">
                    <MessageSquare className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <p className="whitespace-pre-wrap">{item.observacoes}</p>
                  </div>
                )}
                
                <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                  <span>Transição:</span>
                  <span className="font-mono">{item.status_anterior || "N/A"}</span>
                  <span>→</span>
                  <span className="font-mono">{item.status_novo}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
