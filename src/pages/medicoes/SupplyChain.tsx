import { useState } from "react";
import { Package, ShoppingCart, FileText, ClipboardCheck, Truck, LayoutList, Scale, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FornecedoresTab } from "@/components/supplychain/FornecedoresTab";
import { ItensTab } from "@/components/supplychain/ItensTab";
import { RequisicoesTab } from "@/components/supplychain/RequisicoesTab";
import { CotacoesTab } from "@/components/supplychain/CotacoesTab";
import { PedidosTab } from "@/components/supplychain/PedidosTab";
import { MinhaFilaTab } from "@/components/supplychain/MinhaFilaTab";
import { SupplyChainDashboard } from "@/components/supplychain/Dashboard";
import { StatusFunnel } from "@/components/supplychain/StatusFunnel";
import { ComparativoTab } from "@/components/supplychain/ComparativoTab";

const PIPELINE_STEPS = [
  { id: "requisicoes", label: "Requisição", icon: FileText },
  { id: "cotacoes", label: "Cotação", icon: ClipboardCheck },
  { id: "comparativo", label: "Aprovação", icon: Scale },
  { id: "pedidos", label: "Pedido / Recebimento", icon: Truck },
];

export default function SupplyChainPage() {
  const [tab, setTab] = useState("minha-fila");
  const [filter, setFilter] = useState<string | undefined>();

  const handleFilterChange = (newTab: string, newFilter?: string) => {
    // Se clicar no mesmo filtro que já está ativo, remove o filtro
    if (tab === newTab && filter === newFilter) {
      setFilter(undefined);
    } else {
      setTab(newTab);
      setFilter(newFilter);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Supply Chain — Compras</h1>
          <p className="text-muted-foreground">Gestão completa do fluxo de compras: requisição → cotação → pedido</p>
        </div>
      </div>

      <SupplyChainDashboard 
        onFilterChange={handleFilterChange} 
        activeFilter={{ tab, filter }} 
      />

      <StatusFunnel onNavigate={handleFilterChange} />

      {/* Main Flow Pipeline */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center gap-4 bg-muted/30 p-3 rounded-lg border overflow-x-auto hide-scrollbar">
        <Button 
          variant={tab === "minha-fila" ? "default" : "outline"} 
          className={`gap-2 shrink-0 ${tab === "minha-fila" ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90" : "bg-background"}`}
          onClick={() => { setTab("minha-fila"); setFilter(undefined); }}
        >
          <LayoutList className={`h-4 w-4 ${tab === "minha-fila" ? "text-primary-foreground" : "text-primary"}`} /> 
          <span className="font-semibold">Minha Fila</span>
        </Button>

        <div className="hidden xl:block h-8 w-px bg-border mx-2"></div>

        <div className="flex items-center gap-2 flex-nowrap w-full overflow-x-auto pb-1 xl:pb-0 hide-scrollbar">
          {PIPELINE_STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = tab === step.id;
            return (
              <div key={step.id} className="flex items-center shrink-0">
                <Button
                  variant={isActive ? "default" : "outline"}
                  className={`gap-2 rounded-full ${isActive ? "shadow-md" : "bg-background hover:bg-muted"}`}
                  onClick={() => { setTab(step.id); setFilter(undefined); }}
                >
                  <Icon className="h-4 w-4" />
                  {step.label}
                </Button>
                {index < PIPELINE_STEPS.length - 1 && (
                  <ChevronRight className="h-5 w-5 mx-1 md:mx-3 text-muted-foreground/50 shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        <div className="hidden xl:block h-8 w-px bg-border mx-2"></div>

        <div className="flex items-center gap-2 shrink-0 pt-2 xl:pt-0 border-t xl:border-t-0 border-border w-full xl:w-auto">
          <Button 
            variant={tab === "fornecedores" ? "default" : "ghost"} 
            size="sm" 
            onClick={() => { setTab("fornecedores"); setFilter(undefined); }}
          >
            <ShoppingCart className="h-4 w-4 mr-2" /> Fornecedores
          </Button>
          <Button 
            variant={tab === "itens" ? "default" : "ghost"} 
            size="sm" 
            onClick={() => { setTab("itens"); setFilter(undefined); }}
          >
            <Package className="h-4 w-4 mr-2" /> Itens
          </Button>
        </div>
      </div>

      {/* Render Active View */}
      <div className="mt-6">
        {tab === "minha-fila" && <MinhaFilaTab />}
        {tab === "requisicoes" && <RequisicoesTab filter={filter} />}
        {tab === "cotacoes" && <CotacoesTab filter={filter} onNavigate={(t, f) => { setTab(t); setFilter(f); }} />}
        {tab === "comparativo" && <ComparativoTab onNavigate={(t, f) => { setTab(t); setFilter(f); }} />}
        {tab === "pedidos" && <PedidosTab filter={filter} />}
        {tab === "fornecedores" && <FornecedoresTab />}
        {tab === "itens" && <ItensTab />}
      </div>
    </div>
  );
}
