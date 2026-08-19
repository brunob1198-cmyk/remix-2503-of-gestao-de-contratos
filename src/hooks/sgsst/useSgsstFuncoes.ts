import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { escapeSearchTerm } from "@/utils/sgsstSearch";

export interface SgsstFuncao {
  id: string;
  empresa_id: string;
  nome: string;
  cbo?: string | null;
  descricao?: string | null;
  requisitos_minimos?: string | null;
  status: "ativo" | "inativo";
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type SgsstFuncaoInput = Omit<SgsstFuncao, "id" | "empresa_id" | "created_at" | "updated_at">;

/**
 * Teto para o uso como lista de apoio (selects de dialogos). Sem um limite
 * explicito o PostgREST corta na configuracao `max-rows` do servidor e a lista
 * chega truncada sem nenhum sinal — o consumidor acha que o catalogo acabou.
 */
export const FUNCOES_CATALOGO_LIMITE = 1000;

export interface SgsstFuncoesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}

/**
 * Sem `params`, devolve o catalogo inteiro (uso como lista de apoio).
 * Com `params`, pagina e filtra no servidor (uso na tela de Funcoes).
 */
export function useSgsstFuncoes(params?: SgsstFuncoesParams) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const paginado = !!params;
  const page = params?.page ?? 0;
  const pageSize = params?.pageSize ?? 25;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      "sgsst_funcoes",
      empresaId,
      paginado ? page : "all",
      paginado ? pageSize : "all",
      params?.search ?? "",
      params?.status ?? "",
    ],
    enabled: !!empresaId,
    queryFn: async () => {
      let query = supabase
        .from("sgsst_funcoes" as any)
        .select("*", { count: "exact" })
        .order("nome", { ascending: true });

      if (params?.search) {
        const term = escapeSearchTerm(params.search);
        if (term) {
          query = query.or(`nome.ilike.%${term}%,cbo.ilike.%${term}%`);
        }
      }

      if (params?.status && params.status !== "todos") {
        query = query.eq("status", params.status);
      }

      query = paginado
        ? query.range(page * pageSize, page * pageSize + pageSize - 1)
        : query.limit(FUNCOES_CATALOGO_LIMITE);

      const { data, error, count } = await (query as any);
      if (error) throw error;

      const rows = (data as SgsstFuncao[]) || [];
      return {
        rows,
        total: count ?? rows.length,
        truncado: !paginado && rows.length >= FUNCOES_CATALOGO_LIMITE,
      };
    },
  });

  const funcoes = data?.rows ?? [];

  const createFuncao = useMutation({
    mutationFn: async (input: SgsstFuncaoInput) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data, error } = await (supabase
        .from("sgsst_funcoes" as any)
        .insert({
          ...input,
          empresa_id: empresaId,
          created_by: profile?.id,
        })
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstFuncao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_funcoes"] });
      toast.success("Função cadastrada com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao cadastrar função: ${err.message || err}`);
    },
  });

  const updateFuncao = useMutation({
    mutationFn: async ({ id, ...input }: Partial<SgsstFuncaoInput> & { id: string }) => {
      const { data, error } = await (supabase
        .from("sgsst_funcoes" as any)
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstFuncao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_funcoes"] });
      toast.success("Função atualizada com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar função: ${err.message || err}`);
    },
  });

  const removeFuncao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_funcoes" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_funcoes"] });
      toast.success("Função removida com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover função: ${err.message || err}`);
    },
  });

  return {
    funcoes,
    total: data?.total ?? 0,
    /** True quando o catálogo bateu o teto e a lista veio incompleta. */
    truncado: data?.truncado ?? false,
    isLoading,
    error,
    refetch,
    createFuncao,
    updateFuncao,
    removeFuncao,
  };
}
