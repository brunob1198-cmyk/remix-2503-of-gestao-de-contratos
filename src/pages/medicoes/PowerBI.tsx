import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BarChart3, ExternalLink, Settings, Eye, EyeOff, Plus, Trash2, Save, RefreshCw } from "lucide-react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { toast } from "sonner";

interface DashboardConfig {
  id: string;
  nome: string;
  embedUrl: string;
  categoria: "financeiro" | "producao" | "contratos" | "custom";
}

const categoriaLabels: Record<string, string> = {
  financeiro: "Financeiro",
  producao: "Produção",
  contratos: "Contratos",
  custom: "Personalizado",
};

const categoriaColors: Record<string, string> = {
  financeiro: "bg-blue-100 text-blue-800",
  producao: "bg-green-100 text-green-800",
  contratos: "bg-amber-100 text-amber-800",
  custom: "bg-purple-100 text-purple-800",
};

export default function PowerBIPage() {
  const [dashboards, setDashboards] = usePersistedState<DashboardConfig[]>("powerbi-dashboards", []);
  const [showConfig, setShowConfig] = useState(dashboards.length === 0);
  const [novoDash, setNovoDash] = useState<Partial<DashboardConfig>>({ categoria: "financeiro" });
  const [activeDash, setActiveDash] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
    toast.success("Dashboard atualizado");
  };

  const addDashboard = () => {
    if (!novoDash.nome || !novoDash.embedUrl) {
      toast.error("Preencha nome e URL do embed");
      return;
    }
    const dash: DashboardConfig = {
      id: crypto.randomUUID(),
      nome: novoDash.nome,
      embedUrl: novoDash.embedUrl,
      categoria: (novoDash.categoria as DashboardConfig["categoria"]) || "custom",
    };
    const updated = [...dashboards, dash];
    setDashboards(updated);
    setNovoDash({ categoria: "financeiro" });
    setActiveDash(dash.id);
    setShowConfig(false);
    toast.success("Dashboard adicionado");
  };

  const removeDashboard = (id: string) => {
    setDashboards(dashboards.filter((d) => d.id !== id));
    if (activeDash === id) setActiveDash(dashboards[0]?.id || null);
    toast.success("Dashboard removido");
  };

  const active = dashboards.find((d) => d.id === activeDash) || dashboards[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Power BI</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowConfig(!showConfig)}
        >
          {showConfig ? <EyeOff className="h-4 w-4 mr-2" /> : <Settings className="h-4 w-4 mr-2" />}
          {showConfig ? "Ocultar Config" : "Configurar"}
        </Button>
      </div>

      {showConfig && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configurar Dashboards</CardTitle>
            <CardDescription>
              Adicione URLs de embed do Power BI. Obtenha a URL em: Relatório → Arquivo → Inserir relatório → Site ou portal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                placeholder="Nome do dashboard"
                value={novoDash.nome || ""}
                onChange={(e) => setNovoDash({ ...novoDash, nome: e.target.value })}
              />
              <Input
                placeholder="URL de Embed do Power BI"
                value={novoDash.embedUrl || ""}
                onChange={(e) => setNovoDash({ ...novoDash, embedUrl: e.target.value })}
              />
              <div className="flex gap-2">
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={novoDash.categoria || "financeiro"}
                  onChange={(e) => setNovoDash({ ...novoDash, categoria: e.target.value as DashboardConfig["categoria"] })}
                >
                  <option value="financeiro">Financeiro</option>
                  <option value="producao">Produção</option>
                  <option value="contratos">Contratos</option>
                  <option value="custom">Personalizado</option>
                </select>
                <Button onClick={addDashboard}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar
                </Button>
              </div>
            </div>

            {dashboards.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium text-sm text-muted-foreground">Dashboards configurados</h3>
                {dashboards.map((d) => (
                  <div key={d.id} className="flex items-center justify-between border rounded-md p-3">
                    <div className="flex items-center gap-3">
                      <Badge className={categoriaColors[d.categoria]}>{categoriaLabels[d.categoria]}</Badge>
                      <span className="font-medium">{d.nome}</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[300px]">{d.embedUrl}</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeDashboard(d.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <h4 className="font-medium mb-2">📊 Views disponíveis para Power BI</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Conecte o Power BI ao banco de dados usando DirectQuery e utilize as views abaixo:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div className="border rounded p-2 bg-background">
                    <code className="text-primary">view_bi_financeiro</code>
                    <p className="text-xs text-muted-foreground">Custos ERP por projeto, categoria e competência</p>
                  </div>
                  <div className="border rounded p-2 bg-background">
                    <code className="text-primary">view_bi_producao</code>
                    <p className="text-xs text-muted-foreground">Produção diária por site, item e projeto</p>
                  </div>
                  <div className="border rounded p-2 bg-background">
                    <code className="text-primary">view_bi_contratos</code>
                    <p className="text-xs text-muted-foreground">Contratos com métricas de execução e prazo</p>
                  </div>
                  <div className="border rounded p-2 bg-background">
                    <code className="text-primary">view_bi_dim_tempo</code>
                    <p className="text-xs text-muted-foreground">Dimensão de tempo (ano, mês, trimestre)</p>
                  </div>
                  <div className="border rounded p-2 bg-background">
                    <code className="text-primary">view_bi_dim_categoria</code>
                    <p className="text-xs text-muted-foreground">Dimensão de categorias ERP</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      )}

      {dashboards.length === 0 && !showConfig ? (
        <Card className="py-16 text-center">
          <CardContent className="flex flex-col items-center gap-4">
            <BarChart3 className="h-16 w-16 text-muted-foreground/40" />
            <div>
              <h3 className="text-lg font-semibold">Nenhum dashboard configurado</h3>
              <p className="text-muted-foreground">Clique em "Configurar" para adicionar seus dashboards Power BI</p>
            </div>
            <Button onClick={() => setShowConfig(true)}>
              <Settings className="h-4 w-4 mr-2" /> Configurar Dashboards
            </Button>
          </CardContent>
        </Card>
      ) : dashboards.length > 0 && (
        <div className="space-y-4">
          {dashboards.length > 1 && (
            <Tabs value={active?.id} onValueChange={setActiveDash}>
              <TabsList>
                {dashboards.map((d) => (
                  <TabsTrigger key={d.id} value={d.id} className="gap-2">
                    <Badge variant="outline" className={`text-xs ${categoriaColors[d.categoria]}`}>
                      {categoriaLabels[d.categoria]}
                    </Badge>
                    {d.nome}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}

          {active && (
            <Card className="overflow-hidden">
              <CardHeader className="py-3 flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className={categoriaColors[active.categoria]}>{categoriaLabels[active.categoria]}</Badge>
                  <CardTitle className="text-base">{active.nome}</CardTitle>
                </div>
                <a href={active.embedUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="sm">
                    <ExternalLink className="h-4 w-4 mr-1" /> Abrir no Power BI
                  </Button>
                </a>
              </CardHeader>
              <CardContent className="p-0">
                <iframe
                  title={active.nome}
                  src={active.embedUrl}
                  className="w-full border-0"
                  style={{ height: "calc(100vh - 280px)", minHeight: "500px" }}
                  allowFullScreen
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
