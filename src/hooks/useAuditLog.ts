import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AuditLogEntry {
  id: string;
  tabela: string;
  operacao: string;
  registro_id: string;
  dados_anteriores: any;
  dados_novos: any;
  campos_alterados: string[] | null;
  user_id: string | null;
  user_email: string | null;
  created_at: string;
}

const TABELA_LABELS: Record<string, string> = {
  sites: "Sites",
  projetos: "Projetos",
  lancamentos_producao: "Lançamentos Produção",
  lancamentos_medicao: "Lançamentos Medição",
  lancamentos_faturamento: "Lançamentos Faturamento",
  diarios_obra: "Diário de Obra",
  diarios_campo: "Diário de Campo",
  escopo_itens: "Escopo",
  itens_lpu: "Itens LPU",
  contratos: "Contratos",
  clientes: "Clientes",
  recursos: "Recursos",
  diario_producao: "Produção (Diário)",
  diario_equipe: "Equipe (Diário)",
  diario_equipamentos: "Equipamentos (Diário)",
  diario_veiculos: "Veículos (Diário)",
  faturamentos: "Faturamentos",
  faturamento_itens: "Itens Faturamento",
};

const OPERACAO_LABELS: Record<string, string> = {
  INSERT: "Criação",
  UPDATE: "Alteração",
  DELETE: "Exclusão",
};

export const getTabelaLabel = (tabela: string) => TABELA_LABELS[tabela] || tabela;
export const getOperacaoLabel = (op: string) => OPERACAO_LABELS[op] || op;

export function useAuditLog(filters?: { tabela?: string; limit?: number }) {
  const limit = filters?.limit || 100;

  return useQuery({
    queryKey: ["audit_log", filters?.tabela, limit],
    queryFn: async () => {
      let query = supabase
        .from("audit_log")
        .select("id, tabela, operacao, registro_id, campos_alterados, user_email, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (filters?.tabela) {
        query = query.eq("tabela", filters.tabela);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AuditLogEntry[];
    },
  });
}
