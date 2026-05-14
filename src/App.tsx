import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createConfiguredQueryClient, indexedDBPersister } from "@/lib/queryClient";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Loader2 } from "lucide-react";
import { useAppUpdate } from "@/hooks/useAppUpdate";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AuthPage from "./pages/Auth";
import ForgotPasswordPage from "./pages/ForgotPassword";
import ResetPasswordPage from "./pages/ResetPassword";
import EmpresaSetupPage from "./pages/EmpresaSetup";
import PendingApprovalPage from "./pages/PendingApproval";

// Medicoes Portal
import MedicoesLayout from "./pages/medicoes/Layout";
import DashboardPage from "./pages/medicoes/Dashboard";
import CadastrosPage from "./pages/medicoes/Cadastros";
import MedicaoPage from "./pages/medicoes/Medicao";
import FaturamentoPage from "./pages/medicoes/Faturamento";
import RelatoriosPage from "./pages/medicoes/Relatorios";
import EscopoPage from "./pages/medicoes/Escopo";
import AcompanhamentoMedicoesPage from "./pages/medicoes/AcompanhamentoMedicoes";
import DiarioObraPage from "./pages/medicoes/DiarioObra";
import GerenciarUsuariosPage from "./pages/medicoes/GerenciarUsuarios";
import MeuPerfilPage from "./pages/medicoes/MeuPerfil";
import SupplyChainPage from "./pages/medicoes/SupplyChain";
import DiarioCampoPage from "./pages/medicoes/DiarioCampo";
import AuditLogPage from "./pages/medicoes/AuditLog";
const MonitoringPage = React.lazy(() => import("./pages/medicoes/Monitoramento"));

// Lazy Loaded Pages
const RecursosPage = React.lazy(() => import("./pages/medicoes/Recursos"));
const AnaliseObraPage = React.lazy(() => import("./pages/medicoes/AnaliseObra"));
const IntegracaoPage = React.lazy(() => import("./pages/medicoes/Integracao"));
const RdoPage = React.lazy(() => import("./pages/medicoes/Rdo"));
const PlanejamentoObraPage = React.lazy(() => import("./pages/medicoes/PlanejamentoObra"));
const PowerBIPage = React.lazy(() => import("./pages/medicoes/PowerBI"));
const MkpParametrosPage = React.lazy(() => import("./pages/configuracoes/MkpParametros"));
const ConfigImpostosPage = React.lazy(() => import("./pages/configuracoes/ConfigImpostos"));

const queryClient = createConfiguredQueryClient();

const RootRedirect = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const hasContaAzulCallback = searchParams.has("code") || searchParams.has("error");

  if (hasContaAzulCallback) {
    return <Navigate to={`/medicoes/integracao?tab=erp${location.search.replace('?', '&')}`} replace />;
  }

  return <Navigate to="/medicoes/dashboard" replace />;
};

const App = () => {
  useAppUpdate();
  return (
  <PersistQueryClientProvider 
    client={queryClient} 
    persistOptions={{ persister: indexedDBPersister }}
  >
    <ThemeProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          }>
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/empresa-setup" element={<EmpresaSetupPage />} />
              <Route path="/pending-approval" element={<PendingApprovalPage />} />

              {/* Gestão de Contratos - Protected */}
              <Route path="/medicoes" element={<ProtectedRoute><MedicoesLayout /></ProtectedRoute>}>
                <Route index element={<Navigate to="/medicoes/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="cadastros" element={<CadastrosPage />} />
                <Route path="projetos" element={<Navigate to="/medicoes/cadastros" replace />} />
                <Route path="sites" element={<Navigate to="/medicoes/cadastros" replace />} />
                <Route path="sites/:siteId/escopo" element={<EscopoPage />} />
                <Route path="lpu" element={<Navigate to="/medicoes/cadastros" replace />} />
                <Route path="diario" element={<ErrorBoundary><DiarioObraPage /></ErrorBoundary>} />
                <Route path="diario-campo" element={<DiarioCampoPage />} />
                <Route path="analise" element={<AnaliseObraPage />} />
                <Route path="producao" element={<Navigate to="/medicoes/dashboard" replace />} />
                <Route path="medicao" element={<ErrorBoundary><MedicaoPage /></ErrorBoundary>} />
                <Route path="faturamento" element={<ErrorBoundary><FaturamentoPage /></ErrorBoundary>} />
                <Route path="acompanhamento" element={<ErrorBoundary><AcompanhamentoMedicoesPage /></ErrorBoundary>} />
                <Route path="recursos" element={<RecursosPage />} />
                <Route path="relatorios" element={<RelatoriosPage />} />
                <Route path="integracao" element={<IntegracaoPage />} />
                <Route path="integracao-erp" element={<Navigate to="/medicoes/integracao?tab=erp" replace />} />
                <Route path="integracao-flash" element={<Navigate to="/medicoes/integracao?tab=flash" replace />} />
                <Route path="normalizacao-flash" element={<Navigate to="/medicoes/integracao?tab=normalizacao" replace />} />
                <Route path="rdo" element={<RdoPage />} />
                <Route path="usuarios" element={<GerenciarUsuariosPage />} />
                <Route path="planejamento" element={<PlanejamentoObraPage />} />
                <Route path="supply-chain" element={<SupplyChainPage />} />
                
                <Route path="audit-log" element={<AuditLogPage />} />
                <Route path="monitoramento" element={<MonitoringPage />} />
                <Route path="power-bi" element={<PowerBIPage />} />
                <Route path="mkp-parametros" element={<Navigate to="/medicoes/cadastros?tab=mkp" replace />} />
                <Route path="config-impostos" element={<Navigate to="/medicoes/cadastros?tab=impostos" replace />} />
                <Route path="perfil" element={<MeuPerfilPage />} />
              </Route>

              {/* Extrator de PDF */}
              <Route path="/extrator" element={<Index />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </PersistQueryClientProvider>
  );
};

export default App;
