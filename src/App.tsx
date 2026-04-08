import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
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
import ProducaoPage from "./pages/medicoes/Producao";
import MedicaoPage from "./pages/medicoes/Medicao";
import FaturamentoPage from "./pages/medicoes/Faturamento";
import RelatoriosPage from "./pages/medicoes/Relatorios";
import EscopoPage from "./pages/medicoes/Escopo";
import AcompanhamentoMedicoesPage from "./pages/medicoes/AcompanhamentoMedicoes";
import DiarioObraPage from "./pages/medicoes/DiarioObra";
import RecursosPage from "./pages/medicoes/Recursos";
import AnaliseObraPage from "./pages/medicoes/AnaliseObra";
import IntegracaoErpPage from "./pages/medicoes/IntegracaoErp";
import RdoPage from "./pages/medicoes/Rdo";
import GerenciarUsuariosPage from "./pages/medicoes/GerenciarUsuarios";
import MeuPerfilPage from "./pages/medicoes/MeuPerfil";
import PlanejamentoObraPage from "./pages/medicoes/PlanejamentoObra";
import SupplyChainPage from "./pages/medicoes/SupplyChain";
import DiarioCampoPage from "./pages/medicoes/DiarioCampo";

const queryClient = new QueryClient();

const RootRedirect = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const hasContaAzulCallback = searchParams.has("code") || searchParams.has("error");

  if (hasContaAzulCallback) {
    return <Navigate to={`/medicoes/integracao-erp${location.search}`} replace />;
  }

  return <Navigate to="/medicoes/dashboard" replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
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
              <Route path="diario" element={<DiarioObraPage />} />
              <Route path="diario-campo" element={<DiarioCampoPage />} />
              <Route path="analise" element={<AnaliseObraPage />} />
              <Route path="producao" element={<ProducaoPage />} />
              <Route path="medicao" element={<MedicaoPage />} />
              <Route path="faturamento" element={<FaturamentoPage />} />
              <Route path="acompanhamento" element={<AcompanhamentoMedicoesPage />} />
              <Route path="recursos" element={<RecursosPage />} />
              <Route path="relatorios" element={<RelatoriosPage />} />
              <Route path="integracao-erp" element={<IntegracaoErpPage />} />
              <Route path="rdo" element={<RdoPage />} />
              <Route path="usuarios" element={<GerenciarUsuariosPage />} />
              <Route path="planejamento" element={<PlanejamentoObraPage />} />
              <Route path="supply-chain" element={<SupplyChainPage />} />
              
              <Route path="perfil" element={<MeuPerfilPage />} />
            </Route>

            {/* Extrator de PDF */}
            <Route path="/extrator" element={<Index />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
