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
import { lazyWithRetry } from "@/lib/lazyWithRetry";
// Lazy Loaded Pages
const Index = lazyWithRetry(() => import("./pages/Index"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const AuthPage = lazyWithRetry(() => import("./pages/Auth"));
const ForgotPasswordPage = lazyWithRetry(() => import("./pages/ForgotPassword"));
const ResetPasswordPage = lazyWithRetry(() => import("./pages/ResetPassword"));
const EmpresaSetupPage = lazyWithRetry(() => import("./pages/EmpresaSetup"));
const PendingApprovalPage = lazyWithRetry(() => import("./pages/PendingApproval"));

// Medicoes Portal
const MedicoesLayout = lazyWithRetry(() => import("./pages/medicoes/Layout"));
const DashboardPage = lazyWithRetry(() => import("./pages/medicoes/Dashboard"));
const CadastrosPage = lazyWithRetry(() => import("./pages/medicoes/Cadastros"));
const MedicaoPage = lazyWithRetry(() => import("./pages/medicoes/Medicao"));
const FaturamentoPage = lazyWithRetry(() => import("./pages/medicoes/Faturamento"));
const RelatoriosPage = lazyWithRetry(() => import("./pages/medicoes/Relatorios"));
const EscopoPage = lazyWithRetry(() => import("./pages/medicoes/Escopo"));
const AcompanhamentoMedicoesPage = lazyWithRetry(() => import("./pages/medicoes/AcompanhamentoMedicoes"));
const DiarioObraPage = lazyWithRetry(() => import("./pages/medicoes/DiarioObra"));
const GerenciarUsuariosPage = lazyWithRetry(() => import("./pages/medicoes/GerenciarUsuarios"));
const MeuPerfilPage = lazyWithRetry(() => import("./pages/medicoes/MeuPerfil"));
const SupplyChainPage = lazyWithRetry(() => import("./pages/medicoes/SupplyChain"));
const ForecastPublicPage = lazyWithRetry(() => import("./pages/ForecastPublic"));

// Lazy Loaded Pages
const RecursosPage = lazyWithRetry(() => import("./pages/medicoes/Recursos"));
const AnaliseObraPage = lazyWithRetry(() => import("./pages/medicoes/AnaliseObra"));
const IntegracaoPage = lazyWithRetry(() => import("./pages/medicoes/Integracao"));
const RdoPage = lazyWithRetry(() => import("./pages/medicoes/Rdo"));
const PlanejamentoObraPage = lazyWithRetry(() => import("./pages/medicoes/PlanejamentoObra"));
const PowerBIPage = lazyWithRetry(() => import("./pages/medicoes/PowerBI"));
const MkpParametrosPage = lazyWithRetry(() => import("./pages/configuracoes/MkpParametros"));
const ConfigImpostosPage = lazyWithRetry(() => import("./pages/configuracoes/ConfigImpostos"));
const SgsstFuncoesPage = lazyWithRetry(() => import("./pages/sgsst/Funcoes"));
const SgsstColaboradoresPage = lazyWithRetry(() => import("./pages/sgsst/Colaboradores"));
const SgsstRiscosPage = lazyWithRetry(() => import("./pages/sgsst/Riscos"));
const SgsstIndicadoresPage = lazyWithRetry(() => import("./pages/sgsst/Indicadores"));
const SgsstPgrListPage = lazyWithRetry(() => import("./pages/sgsst/PgrList"));
const SgsstPgrDetailPage = lazyWithRetry(() => import("./pages/sgsst/PgrDetail"));
const SgsstAprListPage = lazyWithRetry(() => import("./pages/sgsst/AprList"));
const SgsstAprDetailPage = lazyWithRetry(() => import("./pages/sgsst/AprDetail"));
const SgsstPtListPage = lazyWithRetry(() => import("./pages/sgsst/PtList"));
const SgsstPtDetailPage = lazyWithRetry(() => import("./pages/sgsst/PtDetail"));
const SgsstInspecoesListPage = lazyWithRetry(() => import("./pages/sgsst/InspecoesList"));
const SgsstInspecoesDetailPage = lazyWithRetry(() => import("./pages/sgsst/InspecoesDetail"));
const SgsstIncidentesListPage = lazyWithRetry(() => import("./pages/sgsst/IncidentesList"));
const SgsstIncidentesDetailPage = lazyWithRetry(() => import("./pages/sgsst/IncidentesDetail"));
const SgsstNaoConformidadesListPage = lazyWithRetry(() => import("./pages/sgsst/NaoConformidadesList"));
const SgsstNaoConformidadesDetailPage = lazyWithRetry(() => import("./pages/sgsst/NaoConformidadesDetail"));
const SgsstPcmsoListPage = lazyWithRetry(() => import("./pages/sgsst/PcmsoList"));
const SgsstPcmsoDetailPage = lazyWithRetry(() => import("./pages/sgsst/PcmsoDetail"));
const SgsstTreinamentosListPage = lazyWithRetry(() => import("./pages/sgsst/TreinamentosList"));
const SgsstEpisListPage = lazyWithRetry(() => import("./pages/sgsst/EpisList"));
const SgsstDocumentosListPage = lazyWithRetry(() => import("./pages/sgsst/DocumentosList"));
const SgsstDashboardGeralPage = lazyWithRetry(() => import("./pages/sgsst/DashboardGeral"));
const SgsstRelatoriosListPage = lazyWithRetry(() => import("./pages/sgsst/RelatoriosList"));
const ChecklistsListPage = lazyWithRetry(() => import("./pages/checklists/ChecklistsList"));
const VerificarAssinaturaPage = lazyWithRetry(() => import("./pages/VerificarAssinatura"));
const IniciarChecklistQRPage = lazyWithRetry(() => import("./pages/checklists/IniciarChecklistQR"));

// Paginas de diagnostico: seguem acessiveis, mas fora do bundle principal.
const UploadTestPage = lazyWithRetry(() => import("./pages/debug/UploadTest"));
const StorageMigrationPage = lazyWithRetry(() => import("./pages/medicoes/StorageMigration"));

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
                
                <Route path="audit-log" element={<Navigate to="/medicoes/usuarios?tab=audit-log" replace />} />
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
