import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FinanceiroRow {
  id: string;
  projeto_id: string | null;
  projeto_codigo: string | null;
  projeto_nome: string | null;
  categoria: string;
  valor: number;
  status: string;
  data_competencia: string | null;
  ano: number | null;
  mes: number | null;
}

export interface ProducaoRow {
  id: string;
  site_id: string;
  site_codigo: string;
  projeto_id: string;
  projeto_codigo: string;
  projeto_nome: string;
  item_codigo: string;
  item_descricao: string;
  item_unidade: string;
  preco_unitario: number;
  quantidade: number;
  valor_produzido: number;
  data_producao: string;
  ano: number;
  mes: number;
}

export interface ContratoRow {
  id: string;
  numero_contrato: string | null;
  valor_total: number | null;
  prazo_inicio: string | null;
  prazo_fim: string | null;
  status: string | null;
  total_projetos: number;
  valor_projetos: number;
  percentual_prazo: number | null;
}

export function useDashboardBI() {
  const financeiro = useQuery({
    queryKey: ["bi_financeiro"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("view_financeiro")
        .select("*");
      if (error) throw error;
      return (data || []) as FinanceiroRow[];
    },
  });

  const producao = useQuery({
    queryKey: ["bi_producao_diario"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("view_producao_diario")
        .select("*");
      if (error) throw error;
      return (data || []) as ProducaoRow[];
    },
  });

  const contratos = useQuery({
    queryKey: ["bi_contratos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("view_contratos")
        .select("*");
      if (error) throw error;
      return (data || []) as ContratoRow[];
    },
  });

  return {
    financeiro: financeiro.data || [],
    producao: producao.data || [],
    contratos: contratos.data || [],
    isLoading: financeiro.isLoading || producao.isLoading || contratos.isLoading,
  };
}
