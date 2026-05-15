import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchParams } from "react-router-dom";
import { useEffect, Suspense } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useAuth } from "@/contexts/AuthContext";
import { Webhook, Zap, Wand2, Loader2 } from "lucide-react";
import React from "react";

const IntegracaoErpPage = React.lazy(() => import("./IntegracaoErp"));
const IntegracaoFlashPage = React.lazy(() => import("./IntegracaoFlash"));
const NormalizacaoFlashPage = React.lazy(() => import("./NormalizacaoFlash"));

export default function IntegracaoPage() {
  const { role, loading } = useAuth();
  const isAdmin = role === "admin";

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = usePersistedState<string>("integracao:activeTab", "erp");

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
      searchParams.delete("tab");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, activeTab, setActiveTab, setSearchParams]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Você não tem permissão para visualizar as integrações.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Integrações</h1>
        <p className="text-muted-foreground">Gerencie as integrações com ERP e sistemas externos.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="erp" className="flex items-center gap-2">
            <Webhook className="h-4 w-4" /> Integração ERP
          </TabsTrigger>
          <TabsTrigger value="flash" className="flex items-center gap-2">
            <Zap className="h-4 w-4" /> Integração Flash
          </TabsTrigger>
          <TabsTrigger value="normalizacao" className="flex items-center gap-2">
            <Wand2 className="h-4 w-4" /> Normalização Flash
          </TabsTrigger>
        </TabsList>

        <Suspense fallback={
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }>
          <TabsContent value="erp" className="m-0 border rounded-lg p-6 bg-card text-card-foreground shadow-sm">
            <IntegracaoErpPage />
          </TabsContent>
          <TabsContent value="flash" className="m-0 border rounded-lg p-6 bg-card text-card-foreground shadow-sm">
            <IntegracaoFlashPage />
          </TabsContent>
          <TabsContent value="normalizacao" className="m-0 border rounded-lg p-6 bg-card text-card-foreground shadow-sm">
            <NormalizacaoFlashPage />
          </TabsContent>
        </Suspense>
      </Tabs>
    </div>
  );
}
