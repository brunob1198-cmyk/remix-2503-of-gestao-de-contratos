import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProjetosPage from "./Projetos";
import SitesPage from "./Sites";
import LpuPage from "./Lpu";
import ClientesPage from "./Clientes";
import { usePermissions } from "@/hooks/usePermissions";
import { FolderKanban, MapPin, FileSpreadsheet, Building2 } from "lucide-react";

export default function CadastrosPage() {
  const { canView } = usePermissions();
  
  const showProjetos = canView("projetos");
  const showSites = canView("sites");
  const showLpu = canView("lpu");
  const showClientes = true; // Todo: add strict permission later

  const defaultValue = showClientes ? "clientes" : showProjetos ? "projetos" : showSites ? "sites" : showLpu ? "lpu" : "";

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

      <Tabs defaultValue={defaultValue} className="space-y-4">
        <TabsList>
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
          {showLpu && (
            <TabsTrigger value="lpu" className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" /> LPU
            </TabsTrigger>
          )}
        </TabsList>

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
        {showLpu && (
          <TabsContent value="lpu" className="m-0 border rounded-lg p-6 bg-card text-card-foreground shadow-sm">
            <LpuPage />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
