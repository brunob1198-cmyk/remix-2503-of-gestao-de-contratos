import React, { Suspense, useEffect } from "react";
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
import { registerChecklistsServiceWorker } from "@/utils/pwaRegister";
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
import ForecastPublicPage from "./pages/ForecastPublic";

// Lazy Loaded Pages
const RecursosPage = React.lazy(() => import("./pages/medicoes/Recursos"));
const AnaliseObraPage = React.lazy(() => import("./pages/medicoes/AnaliseObra"));
const IntegracaoPage = React.lazy(() => import("./pages/medicoes/Integracao"));
const RdoPage = React.lazy(() => import("./pages/medicoes/Rdo"));
const PlanejamentoObraPage = React.lazy(() => import("./pages/medicoes/PlanejamentoObra"));
const PowerBIPage = React.lazy(() => import("./pages/medicoes/PowerBI"));
const MkpParametrosPage = React.lazy(() => import("./pages/configuracoes/MkpParametros"));
const ConfigImpostosPage = React.lazy(() => import("./pages/configuracoes/ConfigImpostos"));
const SgsstFuncoesPage = React.lazy(() => import("./pages/sgsst/Funcoes"));
const SgsstColaboradoresPage = React.lazy(() => import("./pages/sgsst/Colaboradores"));
const SgsstRiscosPage = React.lazy(() => import("./pages/sgsst/Riscos"));
const SgsstIndicadoresPage = React.lazy(() => import("./pages/sgsst/Indicadores"));
const SgsstPgrListPage = React.lazy(() => import("./pages/sgsst/PgrList"));
const SgsstPgrDetailPage = React.lazy(() => import("./pages/sgsst/PgrDetail"));
const SgsstAprListPage = React.lazy(() => import("./pages/sgsst/AprList"));
const SgsstAprDetailPage = React.lazy(() => import("./pages/sgsst/AprDetail"));
const SgsstPtListPage = React.lazy(() => import("./pages/sgsst/PtList"));
const SgsstPtDetailPage = React.lazy(() => import("./pages/sgsst/PtDetail"));
const SgsstInspecoesListPage = React.lazy(() => import("./pages/sgsst/InspecoesList"));
const SgsstInspecoesDetailPage = React.lazy(() => import("./pages/sgsst/InspecoesDetail"));
const SgsstIncidentesListPage = React.lazy(() => import("./pages/sgsst/IncidentesList"));
const SgsstIncidentesDetailPage = React.lazy(() => import("./pages/sgsst/IncidentesDetail"));
const SgsstNaoConformidadesListPage = React.lazy(() => import("./pages/sgsst/NaoConformidadesList"));
const SgsstNaoConformidadesDetailPage = React.lazy(() => import("./pages/sgsst/NaoConformidadesDetail"));
const SgsstPcmsoListPage = React.lazy(() => import("./pages/sgsst/PcmsoList"));
const SgsstPcmsoDetailPage = React.lazy(() => import("./pages/sgsst/PcmsoDetail"));
const SgsstTreinamentosListPage = React.lazy(() => import("./pages/sgsst/TreinamentosList"));
const SgsstEpisListPage = React.lazy(() => import("./pages/sgsst/EpisList"));
const SgsstDocumentosListPage = React.lazy(() => import("./pages/sgsst/DocumentosList"));
const SgsstDashboardGeralPage = React.lazy(() => import("./pages/sgsst/DashboardGeral"));
const SgsstRelatoriosListPage = React.lazy(() => import("./pages/sgsst/RelatoriosList"));
const ChecklistsListPage = React.lazy(() => import("./pages/checklists/ChecklistsList"));
const VerificarAssinaturaPage = React.lazy(() => import("./pages/VerificarAssinatura"));
const IniciarChecklistQRPage = React.lazy(() => import("./pages/checklists/IniciarChecklistQR"));

// Paginas de diagnostico: seguem acessiveis, mas fora do bundle principal.
const UploadTestPage = React.lazy(() => import("./pages/debug/UploadTest"));
const StorageMigrationPage = React.lazy(() => import("./pages/medicoes/StorageMigration"));

const queryClient = createConfiguredQueryClient();

const RootRedirect = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const hasContaAzulCallback = searchParams.has("code") || searchParams.has("error");

  return <Navigate to="/medicoes/dashboard" replace />;
};

const App = () => {
  useAppUpdate();
  useEffect(() => {
    registerChecklistsServiceWorker();
  }, []);

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
                <Route path="dashboard" element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />

                <Route path="cadastros" element={<CadastrosPage />} />
                <Route path="projetos" element={<Navigate to="/medicoes/cadastros" replace />} />
                <Route path="sites" element={<Navigate to="/medicoes/cadastros" replace />} />
                <Route path="sites/:siteId/escopo" element={<EscopoPage />} />
                <Route path="lpu" element={<Navigate to="/medicoes/cadastros" replace />} />
                <Route path="diario" element={<ErrorBoundary><DiarioObraPage /></ErrorBoundary>} />
                <Route path="diario-campo" element={<DiarioCampoPage />} />
                <Route path="analise" element={<AnaliseObraPage />} />
                <Route path="producao" element={<Navigate to="/medicoes/acompanhamento" replace />} />
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
                <Route path="sgsst/funcoes" element={<SgsstFuncoesPage />} />
                <Route path="sgsst/colaboradores" element={<SgsstColaboradoresPage />} />
                <Route path="sgsst/riscos" element={<SgsstRiscosPage />} />
                <Route path="sgsst/indicadores" element={<SgsstIndicadoresPage />} />
                <Route path="sgsst/pgr" element={<SgsstPgrListPage />} />
                <Route path="sgsst/pgr/:pgrId" element={<SgsstPgrDetailPage />} />
                <Route path="sgsst/apr" element={<SgsstAprListPage />} />
                <Route path="sgsst/apr/:aprId" element={<SgsstAprDetailPage />} />
                <Route path="sgsst/pt" element={<SgsstPtListPage />} />
                <Route path="sgsst/pt/:ptId" element={<SgsstPtDetailPage />} />
                <Route path="sgsst/inspecoes" element={<SgsstInspecoesListPage />} />
                <Route path="sgsst/inspecoes/:inspecaoId" element={<SgsstInspecoesDetailPage />} />
                <Route path="sgsst/incidentes" element={<SgsstIncidentesListPage />} />
                <Route path="sgsst/incidentes/:incidenteId" element={<SgsstIncidentesDetailPage />} />
                <Route path="sgsst/nao-conformidades" element={<SgsstNaoConformidadesListPage />} />
                <Route path="sgsst/nao-conformidades/:ncId" element={<SgsstNaoConformidadesDetailPage />} />
                <Route path="sgsst/pcmso" element={<SgsstPcmsoListPage />} />
                <Route path="sgsst/pcmso/:pcmsoId" element={<SgsstPcmsoDetailPage />} />
                <Route path="sgsst/treinamentos" element={<SgsstTreinamentosListPage />} />
                <Route path="sgsst/epis" element={<SgsstEpisListPage />} />
                <Route path="sgsst/documentos" element={<SgsstDocumentosListPage />} />
                <Route path="sgsst/dashboard" element={<SgsstDashboardGeralPage />} />
                <Route path="sgsst/relatorios" element={<SgsstRelatoriosListPage />} />
                <Route path="checklists" element={<ChecklistsListPage />} />
                
                <Route path="power-bi" element={<PowerBIPage />} />
                <Route path="mkp-parametros" element={<Navigate to="/medicoes/cadastros?tab=mkp" replace />} />
                <Route path="config-impostos" element={<Navigate to="/medicoes/cadastros?tab=impostos" replace />} />
                <Route path="perfil" element={<MeuPerfilPage />} />
                <Route path="debug-upload" element={<UploadTestPage />} />
                <Route path="migracao-storage" element={<StorageMigrationPage />} />
              </Route>

              {/* Extrator de PDF & Public Signature Verification & QR Code Mobile Start */}
              <Route path="/extrator" element={<Index />} />
              <Route path="/forecast-public" element={<ForecastPublicPage />} />
              <Route path="/verificar-assinatura" element={<VerificarAssinaturaPage />} />
              <Route path="/verificar-assinatura/:id" element={<VerificarAssinaturaPage />} />
              <Route path="/checklists/iniciar/:token" element={<IniciarChecklistQRPage />} />


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
