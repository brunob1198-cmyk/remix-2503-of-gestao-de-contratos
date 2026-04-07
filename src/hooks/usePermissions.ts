import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
  { id: "supply-chain", label: "Supply Chain" },
] as const;

export function usePermissions() {
  const { user, role } = useAuth();
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPermissions([]);
      setLoading(false);
      return;
    }

    // Admin has all permissions
    if (role === "admin") {
      setPermissions(
        TELAS.map((t) => ({ tela: t.id, pode_visualizar: true, pode_editar: true }))
      );
      setLoading(false);
      return;
    }

    const fetch = async () => {
      const { data } = await supabase
        .from("user_permissions")
        .select("tela, pode_visualizar, pode_editar")
        .eq("user_id", user.id);
      setPermissions((data as UserPermission[]) || []);
      setLoading(false);
    };
    fetch();
  }, [user, role]);

  const canView = (tela: string) => {
    if (role === "admin") return true;
    return permissions.some((p) => p.tela === tela && p.pode_visualizar);
  };

  const canEdit = (tela: string) => {
    if (role === "admin") return true;
    return permissions.some((p) => p.tela === tela && p.pode_editar);
  };

  return { permissions, loading, canView, canEdit };
}
