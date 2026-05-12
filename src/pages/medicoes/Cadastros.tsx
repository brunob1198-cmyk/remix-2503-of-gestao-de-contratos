import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchParams } from "react-router-dom";
import { useEffect, Suspense } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import ProjetosPage from "./Projetos";
import SitesPage from "./Sites";
import LpuPage from "./Lpu";
import ClientesPage from "./Clientes";
import ContratosPage from "./Contratos";
import AreasPage from "./Areas";
import { usePermissions } from "@/hooks/usePermissions";
import { FolderKanban, MapPin, FileSpreadsheet, Building2, ScrollText, Percent, Receipt, Loader2 } from "lucide-react";
import React from "react";

const MkpParametrosPage = React.lazy(() => import("../configuracoes/MkpParametros"));
const ConfigImpostosPage = React.lazy(() => import("../configuracoes/ConfigImpostos"));

export default function CadastrosPage() {
  const { canView } = usePermissions();
  
  const showProjetos = canView("projetos");
  const showSites = canView("sites");
  const showLpu = canView("lpu");
  const showClientes = true; 
  const showContratos = true;
  const showAreas = true;
  const showMkp = true;
  const showImpostos = true;

  const defaultValue = showContratos ? "contratos" : showAreas ? "areas" : showClientes ? "clientes" : showProjetos ? "projetos" : showSites ? "sites" : showLpu ? "lpu" : "";

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = usePersistedState<string>("cadastros:activeTab", defaultValue);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
      searchParams.delete("tab");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, activeTab, setActiveTab, setSearchParams]);

  if (!defaultValue) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Você não tem permissão para visualizar nenhum cadastro.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Cadastros</h1>
        <p className="text-muted-foreground">Gerencie projetos, sites e listas de preços unitária (LPU).</p>
      </div>

      <Tabs value={activeTab || defaultValue} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          {showContratos && (
            <TabsTrigger value="contratos" className="flex items-center gap-2">
              <ScrollText className="h-4 w-4" /> Contratos e Aditivos
            </TabsTrigger>
          )}
          {showClientes && (
            <TabsTrigger value="clientes" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Clientes
            </TabsTrigger>
          )}
          {showProjetos && (
            <TabsTrigger value="projetos" className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4" /> Projetos
            </TabsTrigger>
          )}
          {showSites && (
            <TabsTrigger value="sites" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Sites
            </TabsTrigger>
          )}
          {showAreas && (
            <TabsTrigger value="areas" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Áreas Centros Custo
            </TabsTrigger>
          )}
          {showLpu && (
            <TabsTrigger value="lpu" className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" /> LPU
            </TabsTrigger>
          )}
          {showMkp && (
            <TabsTrigger value="mkp" className="flex items-center gap-2">
              <Percent className="h-4 w-4" /> Parâmetros MKP
            </TabsTrigger>
          )}
          {showImpostos && (
            <TabsTrigger value="impostos" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" /> Alíquotas de Imposto
            </TabsTrigger>
          )}
        </TabsList>

        <Suspense fallback={
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }>

        {showContratos && (
          <TabsContent value="contratos" className="m-0 border rounded-lg p-6 bg-card text-card-foreground shadow-sm">
            <ContratosPage />
          </TabsContent>
        )}
        {showClientes && (
          <TabsContent value="clientes" className="m-0 border rounded-lg p-6 bg-card text-card-foreground shadow-sm">
            <ClientesPage />
          </TabsContent>
        )}
        {showProjetos && (
          <TabsContent value="projetos" className="m-0 border rounded-lg p-6 bg-card text-card-foreground shadow-sm">
            <ProjetosPage />
          </TabsContent>
        )}
        {showSites && (
          <TabsContent value="sites" className="m-0 border rounded-lg p-6 bg-card text-card-foreground shadow-sm">
            <SitesPage />
          </TabsContent>
        )}
        {showAreas && (
          <TabsContent value="areas" className="m-0 border rounded-lg p-6 bg-card text-card-foreground shadow-sm">
            <AreasPage />
          </TabsContent>
        )}
        {showLpu && (
          <TabsContent value="lpu" className="m-0 border rounded-lg p-6 bg-card text-card-foreground shadow-sm">
            <LpuPage />
          </TabsContent>
        )}
        {showMkp && (
          <TabsContent value="mkp" className="m-0 border rounded-lg p-6 bg-card text-card-foreground shadow-sm">
            <MkpParametrosPage />
          </TabsContent>
        )}
        {showImpostos && (
          <TabsContent value="impostos" className="m-0 border rounded-lg p-6 bg-card text-card-foreground shadow-sm">
            <ConfigImpostosPage />
          </TabsContent>
        )}
      </Suspense>
    </Tabs>
    </div>
  );
}
