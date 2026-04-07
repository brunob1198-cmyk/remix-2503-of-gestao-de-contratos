import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, ShoppingCart, FileText, ClipboardCheck, Truck } from "lucide-react";
import { FornecedoresTab } from "@/components/supplychain/FornecedoresTab";
import { ItensTab } from "@/components/supplychain/ItensTab";
import { RequisicoesTab } from "@/components/supplychain/RequisicoesTab";
import { CotacoesTab } from "@/components/supplychain/CotacoesTab";
import { PedidosTab } from "@/components/supplychain/PedidosTab";

export default function SupplyChainPage() {
  const [tab, setTab] = useState("requisicoes");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Supply Chain — Compras</h1>
        <p className="text-muted-foreground">Gestão completa do fluxo de compras: requisição → cotação → pedido</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto gap-1">
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

        <TabsContent value="requisicoes"><RequisicoesTab /></TabsContent>
        <TabsContent value="cotacoes"><CotacoesTab /></TabsContent>
        <TabsContent value="pedidos"><PedidosTab /></TabsContent>
        <TabsContent value="fornecedores"><FornecedoresTab /></TabsContent>
        <TabsContent value="itens"><ItensTab /></TabsContent>
      </Tabs>
    </div>
  );
}
