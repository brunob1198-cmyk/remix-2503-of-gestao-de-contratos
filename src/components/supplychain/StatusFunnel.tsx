import { useSupplyChainFunnelCounts } from "@/hooks/useSupplyChain";
import { DIAS_COTACAO_ATRASADA } from "@/lib/cotacaoAtraso";
import { AlertCircle } from "lucide-react";

export function StatusFunnel({ onNavigate }: { onNavigate?: (tab: string, filter?: string) => void }) {
  const { data: funnel, isLoading } = useSupplyChainFunnelCounts();

  if (isLoading || !funnel) {
    return (
      <div className="w-full h-24 bg-muted/20 animate-pulse rounded-lg border border-border mt-6"></div>
    );
  }

  return (
    <div className="flex flex-col gap-3 mt-6">
      {/* Funnel Blocks */}
      <div className="flex flex-col md:flex-row gap-1 w-full bg-border/40 p-[1px] rounded-xl overflow-hidden">
        
        {/* Estágio 1 */}
        <div 
          onClick={() => onNavigate && onNavigate("cotacoes")}
          className="flex-1 bg-background hover:bg-muted/30 transition-all duration-200 cursor-pointer p-4 flex flex-col justify-center border-b md:border-b-0 md:border-r border-border md:rounded-l-xl hover:-translate-y-[2px]"
        >
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-semibold ${funnel.stage1.count > 0 ? "text-yellow-600" : "text-muted-foreground"}`}>
              {funnel.stage1.count}
            </span>
          </div>
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mt-1">Aguardando cotação</span>
          {funnel.stage1.count > 0 && (
            <span className="text-[10px] text-muted-foreground/70 truncate mt-1" title={funnel.stage1.items}>
              {funnel.stage1.items}
            </span>
          )}
        </div>

        {/* Estágio 2 */}
        <div 
          onClick={() => onNavigate && onNavigate("cotacoes")}
          className="flex-1 bg-background hover:bg-muted/30 transition-all duration-200 cursor-pointer p-4 flex flex-col justify-center border-b md:border-b-0 md:border-r border-border hover:-translate-y-[2px]"
        >
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-semibold ${funnel.stage2.count > 0 ? "text-blue-600" : "text-muted-foreground"}`}>
              {funnel.stage2.count}
            </span>
          </div>
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mt-1">Em cotação</span>
          {funnel.stage2.count > 0 && (
            <span className="text-[10px] text-muted-foreground/70 truncate mt-1">
              {funnel.stage2.quotesCount} cotação(ões) registrada(s)
            </span>
          )}
          {(funnel.stage2.atrasadasCount ?? 0) > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onNavigate && onNavigate("cotacoes", "cotacoes_atrasadas"); }}
              className="mt-2 inline-flex items-center gap-1 self-start rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700 hover:bg-red-100 transition-colors"
              title="Cotações pendentes sem resposta do fornecedor"
            >
              <AlertCircle className="h-3 w-3" />
              {funnel.stage2.atrasadasCount} sem resposta há +{DIAS_COTACAO_ATRASADA}d
            </button>
          )}
        </div>

        {/* Estágio 3 */}
        <div 
          onClick={() => onNavigate && onNavigate("comparativo")}
          className="flex-1 bg-background hover:bg-muted/30 transition-all duration-200 cursor-pointer p-4 flex flex-col justify-center border-b md:border-b-0 md:border-r border-border hover:-translate-y-[2px]"
        >
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-semibold ${funnel.stage3.count > 0 ? "text-yellow-600" : "text-muted-foreground"}`}>
              {funnel.stage3.count}
            </span>
          </div>
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mt-1">Em aprovação</span>
          {funnel.stage3.count > 0 && (
            <span className="text-[10px] text-muted-foreground/70 truncate mt-1">
              comparativo pendente
            </span>
          )}
        </div>

        {/* Estágio 4 */}
        <div 
          onClick={() => onNavigate && onNavigate("pedidos", "para_receber")}
          className="flex-1 bg-background hover:bg-muted/30 transition-all duration-200 cursor-pointer p-4 flex flex-col justify-center border-b md:border-b-0 md:border-r border-border hover:-translate-y-[2px]"
        >
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-semibold ${funnel.stage4.count > 0 ? "text-blue-600" : "text-muted-foreground"}`}>
              {funnel.stage4.count}
            </span>
          </div>
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mt-1">Pedido emitido</span>
          {funnel.stage4.count > 0 && (
            <span className="text-[10px] text-muted-foreground/70 truncate mt-1">
              aguardando entrega
            </span>
          )}
        </div>

        {/* Estágio 5 */}
        <div 
          onClick={() => onNavigate && onNavigate("pedidos", "entregues")}
          className="flex-1 bg-background hover:bg-muted/30 transition-all duration-200 cursor-pointer p-4 flex flex-col justify-center md:rounded-r-xl hover:-translate-y-[2px]"
        >
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-semibold ${funnel.stage5.count > 0 ? "text-green-600" : "text-muted-foreground"}`}>
              {funnel.stage5.count}
            </span>
          </div>
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mt-1">Recebido</span>
          {funnel.stage5.count > 0 && (
            <span className="text-[10px] text-muted-foreground/70 truncate mt-1">
              ciclo concluído
            </span>
          )}
        </div>

      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-4 px-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-yellow-500"></div>
          <span className="text-[11px] text-muted-foreground">Aguardando ação do comprador</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-blue-500"></div>
          <span className="text-[11px] text-muted-foreground">Em andamento</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-slate-300"></div>
          <span className="text-[11px] text-muted-foreground">Sem pendências</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-green-500"></div>
          <span className="text-[11px] text-muted-foreground">Concluído</span>
        </div>
      </div>

      {/* Alerta Condicional */}
      {funnel.alert.count > 0 && (
        <div 
          onClick={() => onNavigate && onNavigate("cotacoes", "prioridade_alta")}
          className="flex items-center gap-2 mt-1 p-2 px-3 bg-red-50 border border-red-200 rounded-md cursor-pointer hover:bg-red-100 transition-colors"
        >
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <span className="text-[11px] font-medium text-red-800">
            {funnel.alert.count} {funnel.alert.count === 1 ? "requisição de alta prioridade aguardando cotação há mais de 3 dias" : "requisições de alta prioridade aguardando cotação há mais de 3 dias"}
          </span>
        </div>
      )}
    </div>
  );
}
