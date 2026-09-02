import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { QUERY_DEFAULTS } from "@/lib/queryClient";

export interface UserPermission {
  tela: string;
  pode_visualizar: boolean;
  pode_editar: boolean;
}

// All screens in the system
export const TELAS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "acompanhamento", label: "Acompanhamento Medições" },
  { id: "projetos", label: "Projetos" },
  { id: "sites", label: "Sites" },
  { id: "lpu", label: "Lista de Preços (LPU)" },
  { id: "diario", label: "Diário de Obra" },
  { id: "rdo", label: "RDO" },
  { id: "analise", label: "Análise de Obras" },
  { id: "recursos", label: "Recursos" },
  { id: "planejamento", label: "Planejamento de Obra" },
  { id: "producao", label: "Lançar Produção" },
  { id: "medicao", label: "Lançar Medição" },
  { id: "faturamento", label: "Portal de Faturamento" },
  { id: "relatorios", label: "Relatórios" },
  { id: "integracao-erp", label: "Integração ERP" },
  { id: "integracao-flash", label: "Integração Flash" },
  { id: "normalizacao-flash", label: "Normalização Flash" },
  { id: "supply-chain", label: "Supply Chain" },
  { id: "power-bi", label: "Power BI" },
  { id: "audit-log", label: "Logs de Auditoria" },
  { id: "sgsst-funcoes", label: "SGSST - Funções" },
  { id: "sgsst-colaboradores", label: "SGSST - Colaboradores" },
  { id: "sgsst-riscos", label: "SGSST - Catálogo de Riscos" },
  { id: "sgsst-pgr", label: "SGSST - PGR / Inventário de Riscos" },
  { id: "sgsst-apr", label: "SGSST - APR (Análise Preliminar de Riscos)" },
  { id: "sgsst-pt", label: "SGSST - Permissão de Trabalho (PT)" },
  { id: "sgsst-inspecoes", label: "SGSST - Inspeções de Segurança" },
  { id: "sgsst-incidentes", label: "SGSST - Incidentes e Acidentes" },
  { id: "sgsst-nao-conformidades", label: "SGSST - Não Conformidades" },
  { id: "sgsst-pcmso", label: "SGSST - Saúde Ocupacional (PCMSO)" },
  { id: "sgsst-treinamentos", label: "SGSST - Treinamentos e Capacitações" },
  { id: "sgsst-epis", label: "SGSST - Equipamentos de Proteção Individual (EPI)" },
  { id: "sgsst-documentos", label: "SGSST - Gestão de Documentos (R2)" },
  { id: "sgsst-dashboard", label: "SGSST - Dashboard Geral" },
  { id: "sgsst-relatorios", label: "SGSST - Relatórios Executivos" },
  { id: "checklists", label: "Checklists Inteligentes" },
  { id: "assinaturas", label: "Serviço Central de Assinaturas Digital" },
] as const;

export function usePermissions() {
  const { user, role } = useAuth();

  const { data: profile = null, isLoading: loadingProfile } = useQuery({
    queryKey: ["user_profile", user?.id],
    ...QUERY_DEFAULTS,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: permissions = [], isLoading: loadingPermissions } = useQuery({
    queryKey: ["user_permissions", user?.id],
    ...QUERY_DEFAULTS,
    staleTime: 0,
    refetchOnWindowFocus: true,
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];

      // Admin has all permissions
      if (role === "admin") {
        return TELAS.map((t) => ({ 
          tela: t.id, 
          pode_visualizar: true, 
          pode_editar: true 
        }));
      }

      const { data, error } = await supabase
        .from("user_permissions")
        .select("tela, pode_visualizar, pode_editar")
        .eq("user_id", user.id);
      
      if (error) throw error;
      return (data as UserPermission[]) || [];
    },
  });

  const canView = (tela: string) => {
    if (role === "admin") return true;
    return permissions.some((p) => p.tela === tela && p.pode_visualizar);
  };

  const canEdit = (tela: string) => {
    if (role === "admin") return true;
    return permissions.some((p) => p.tela === tela && p.pode_editar);
  };

  const hasActionPermission = (action: "pode_aprovar_compra" | "pode_rejeitar_compra" | "pode_receber_compra" | "pode_criar_cotacao" | "pode_criar_pedido") => {
    if (role === "admin") return true;
    return !!profile?.[action];
  };

  const canSignatureAction = (action: "visualizar_assinatura" | "solicitar_assinatura" | "assinar" | "cancelar_assinatura" | "visualizar_auditoria" | "verificar_assinatura" | "baixar_documento_assinado") => {
    if (role === "admin") return true;
    return canView("assinaturas") || canEdit("checklists");
  };

  const canChecklistEvolutionAction = (action: "visualizar_qrcode" | "criar_qrcode" | "editar_qrcode" | "desativar_qrcode" | "visualizar_agendamentos" | "criar_agendamento" | "editar_agendamento" | "pausar_agendamento" | "visualizar_notificacoes") => {
    if (role === "admin") return true;
    return canView("checklists") || canEdit("checklists");
  };

  return { 
    permissions, 
    loading: loadingPermissions || loadingProfile, 
    canView, 
    canEdit,
    hasActionPermission,
    canSignatureAction,
    canChecklistEvolutionAction,
    profile 
  };
}
