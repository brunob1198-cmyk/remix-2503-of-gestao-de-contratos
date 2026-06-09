import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, ShoppingCart, FileText, ClipboardCheck, Truck, LayoutList } from "lucide-react";
import { FornecedoresTab } from "@/components/supplychain/FornecedoresTab";
import { ItensTab } from "@/components/supplychain/ItensTab";
import { RequisicoesTab } from "@/components/supplychain/RequisicoesTab";
import { CotacoesTab } from "@/components/supplychain/CotacoesTab";
import { PedidosTab } from "@/components/supplychain/PedidosTab";
import { MinhaFilaTab } from "@/components/supplychain/MinhaFilaTab";
import { SupplyChainDashboard } from "@/components/supplychain/Dashboard";

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

      <Tabs value={tab} onValueChange={(v) => { setTab(v); setFilter(undefined); }}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="minha-fila" className="gap-2 text-primary font-semibold">
            <LayoutList className="h-4 w-4" /> Minha Fila
          </TabsTrigger>
          <TabsTrigger value="requisicoes" className="gap-2">
            <FileText className="h-4 w-4" /> Requisições
          </TabsTrigger>
          <TabsTrigger value="cotacoes" className="gap-2">
            <ClipboardCheck className="h-4 w-4" /> Cotações
          </TabsTrigger>
          <TabsTrigger value="pedidos" className="gap-2">
            <Truck className="h-4 w-4" /> Pedidos
          </TabsTrigger>
          <TabsTrigger value="fornecedores" className="gap-2">
            <ShoppingCart className="h-4 w-4" /> Fornecedores
          </TabsTrigger>
          <TabsTrigger value="itens" className="gap-2">
            <Package className="h-4 w-4" /> Itens
          </TabsTrigger>
        </TabsList>

        <TabsContent value="minha-fila"><MinhaFilaTab /></TabsContent>
        <TabsContent value="requisicoes"><RequisicoesTab filter={filter} /></TabsContent>
        <TabsContent value="cotacoes"><CotacoesTab filter={filter} /></TabsContent>
        <TabsContent value="pedidos"><PedidosTab filter={filter} /></TabsContent>
        <TabsContent value="fornecedores"><FornecedoresTab /></TabsContent>
        <TabsContent value="itens"><ItensTab /></TabsContent>
      </Tabs>
    </div>
  );
}
