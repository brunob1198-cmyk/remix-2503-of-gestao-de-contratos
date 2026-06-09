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
  { id: "diario-campo", label: "Diário de Campo" },
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

  const hasActionPermission = (action: "pode_aprovar_compra" | "pode_rejeitar_compra" | "pode_receber_compra") => {
    if (role === "admin") return true;
    return !!profile?.[action];
  };

  return { 
    permissions, 
    loading: loadingPermissions || loadingProfile, 
    canView, 
    canEdit,
    hasActionPermission,
    profile 
  };
}
