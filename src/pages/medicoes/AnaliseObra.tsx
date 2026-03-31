import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, Calculator, ClipboardList, Brain } from "lucide-react";
import { VisaoExecutiva } from "@/components/analise/VisaoExecutiva";
import { CalculoCustos } from "@/components/analise/CalculoCustos";
import { AnaliseCustos } from "@/components/analise/AnaliseCustos";
import { CustosErp } from "@/components/analise/CustosErp";
import { AnaliseIA } from "@/components/analise/AnaliseIA";
import { usePersistedState } from "@/hooks/usePersistedState";

export default function AnaliseObraPage() {
  const [projetoId, setProjetoId] = usePersistedState<string>("analise_projeto_id", "");
  const [siteId, setSiteId] = usePersistedState<string>("analise_site_id", "");

  const { data: projetos = [] } = useQuery({
    queryKey: ["projetos_analise"],
    queryFn: async () => {
      const { data } = await supabase.from("projetos").select("id, codigo, nome").order("nome");
      return data || [];
    },
  });

  const { data: sites = [] } = useQuery({
    queryKey: ["sites_analise", projetoId],
    queryFn: async () => {
      if (!projetoId) return [];
      const { data } = await supabase.from("sites").select("id, codigo, nome").eq("projeto_id", projetoId).order("nome");
      return data || [];
    },
    enabled: !!projetoId,
  });

  const selectedSite = sites.find(s => s.id === siteId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">📊 Análise de Obras</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão completa de desempenho financeiro e físico</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={projetoId} onValueChange={(v) => { setProjetoId(v); setSiteId(""); }}>
          <SelectTrigger className="w-[260px]">
            <SelectValue placeholder="Selecione o projeto" />
          </SelectTrigger>
          <SelectContent>
            {projetos.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.codigo} - {p.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={siteId} onValueChange={setSiteId} disabled={!projetoId}>
          <SelectTrigger className="w-[260px]">
            <SelectValue placeholder="Selecione o site/obra" />
          </SelectTrigger>
          <SelectContent>
            {sites.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.codigo} - {s.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!siteId ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Selecione um projeto e um site para ver a análise
        </div>
      ) : (
        <Tabs defaultValue="executiva" className="space-y-4">
          <TabsList>
            <TabsTrigger value="executiva" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Visão Executiva
            </TabsTrigger>
            <TabsTrigger value="custos-erp" className="gap-2">
              <Calculator className="h-4 w-4" />
              Análise de Custos
            </TabsTrigger>
            <TabsTrigger value="auditoria-erp" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              Auditoria ERP
            </TabsTrigger>
            <TabsTrigger value="ia" className="gap-2">
              <Brain className="h-4 w-4" />
              Análise IA
            </TabsTrigger>
          </TabsList>

          <TabsContent value="executiva">
            <VisaoExecutiva siteId={siteId} siteName={selectedSite?.nome || ""} />
          </TabsContent>

          <TabsContent value="custos-erp">
            <AnaliseCustos projetoId={projetoId} siteId={siteId} />
          </TabsContent>

          <TabsContent value="auditoria-erp">
            <CustosErp projetoId={projetoId} siteId={siteId} />
          </TabsContent>

          <TabsContent value="ia">
            <AnaliseIA siteId={siteId} siteName={selectedSite?.nome || ""} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
