import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { escapeSearchTerm } from "@/utils/sgsstSearch";
import { RISCOS_PADRAO } from "@/utils/sgsstRiscosDefaults";
import type { TecnicaAvaliacao } from "@/utils/sgsstRiscoLimite";

export type CategoriaRisco = "Físico" | "Químico" | "Biológico" | "Ergonômico" | "Acidente" | "Outros";

// Reexportado porque o tipo nasce em sgsstRiscoLimite (junto das funcoes que o
// usam), mas quem consome o catalogo importa tudo pelo hook.
export type { TecnicaAvaliacao };

export interface SgsstRisco {
  id: string;
  empresa_id: string;
  codigo?: string | null;
  nome: string;
  categoria: CategoriaRisco;
  descricao?: string | null;
  agente?: string | null;
  fonte_geradora?: string | null;
  consequencia?: string | null;
  /**
   * Limite de tolerancia numerico, para comparar com a medicao. Nulo quando o
   * limite depende da substancia ou do tempo de exposicao — nesses casos a
   * base_legal aponta o anexo aplicavel.
   */
  limite_tolerancia?: number | null;
  /** dB(A), mg/m3, ppm, m/s2, IBUTG. Numero sem unidade nao significa nada. */
  unidade_medida?: string | null;
  tecnica_avaliacao?: TecnicaAvaliacao | null;
  base_legal?: string | null;
  status: "ativo" | "inativo";
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type SgsstRiscoInput = Omit<SgsstRisco, "id" | "empresa_id" | "created_at" | "updated_at">;

/**
 * Teto para o uso como lista de apoio (selects de PGR, APR, PT e Inspecoes).
 * Sem limite explicito o PostgREST corta em `max-rows` sem avisar e o catalogo
 * chega incompleto nos selects.
 */
export const RISCOS_CATALOGO_LIMITE = 1000;

export interface SgsstRiscosParams {
  page?: number;
  pageSize?: number;
  search?: string;
  categoria?: string;
  status?: string;
  /** QUALITATIVA | QUANTITATIVA | "pendente" (quantitativo sem limite). */
  tecnica?: string;
}

/**
 * Sem `params`, devolve o catalogo inteiro (uso como lista de apoio).
 * Com `params`, pagina e filtra no servidor (uso na tela de Riscos).
 */
export function useSgsstRiscos(params?: SgsstRiscosParams) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const paginado = !!params;
  const page = params?.page ?? 0;
  const pageSize = params?.pageSize ?? 25;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      "sgsst_riscos",
      empresaId,
      paginado ? page : "all",
      paginado ? pageSize : "all",
      params?.search ?? "",
      params?.categoria ?? "",
      params?.status ?? "",
      params?.tecnica ?? "",
    ],
    enabled: !!empresaId,
    queryFn: async () => {
      let query = supabase
        .from("sgsst_riscos_catalogo" as any)
        .select("*", { count: "exact" })
        .order("categoria", { ascending: true })
        .order("nome", { ascending: true });

      if (params?.search) {
        const term = escapeSearchTerm(params.search);
        if (term) {
          // Mesmos campos que a tela buscava no cliente, para nao perder alcance
          // ao mover o filtro para o servidor.
          query = query.or(
            `nome.ilike.%${term}%,codigo.ilike.%${term}%,agente.ilike.%${term}%,fonte_geradora.ilike.%${term}%`
          );
        }
      }

      if (params?.categoria && params.categoria !== "todos") {
        query = query.eq("categoria", params.categoria);
      }

      if (params?.status && params.status !== "todos") {
        query = query.eq("status", params.status);
      }

      if (params?.tecnica && params.tecnica !== "todos") {
        if (params.tecnica === "pendente") {
          // A pendencia acionavel do catalogo: exige medicao instrumental mas
          // nao tem limite contra o qual comparar o resultado.
          query = query
            .eq("tecnica_avaliacao", "QUANTITATIVA")
            .is("limite_tolerancia", null);
        } else if (params.tecnica === "sem_tecnica") {
          query = query.is("tecnica_avaliacao", null);
        } else {
          query = query.eq("tecnica_avaliacao", params.tecnica);
        }
      }

      query = paginado
        ? query.range(page * pageSize, page * pageSize + pageSize - 1)
        : query.limit(RISCOS_CATALOGO_LIMITE);

      const { data, error, count } = await (query as any);
      if (error) throw error;

      const rows = (data as SgsstRisco[]) || [];
      return {
        rows,
        total: count ?? rows.length,
        truncado: !paginado && rows.length >= RISCOS_CATALOGO_LIMITE,
      };
    },
  });

  const riscos = data?.rows ?? [];

  const createRisco = useMutation({
    mutationFn: async (input: SgsstRiscoInput) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data, error } = await (supabase
        .from("sgsst_riscos_catalogo" as any)
        .insert({
          ...input,
          empresa_id: empresaId,
          created_by: profile?.id,
          updated_by: profile?.id,
        })
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstRisco;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_riscos"] });
      toast.success("Risco cadastrado com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao cadastrar risco: ${err.message || err}`);
    },
  });

  const updateRisco = useMutation({
    mutationFn: async ({ id, ...input }: Partial<SgsstRiscoInput> & { id: string }) => {
      const { data, error } = await (supabase
        .from("sgsst_riscos_catalogo" as any)
        .update({
          ...input,
          updated_by: profile?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstRisco;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_riscos"] });
      toast.success("Risco atualizado com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar risco: ${err.message || err}`);
    },
  });

  /**
   * Popula o catálogo com os riscos recorrentes de obra.
   *
   * Deliberadamente não é um seed de migration: `empresa_id` é por tenant e
   * inserir cadastro de negócio para todas as empresas sem pedir seria invasivo.
   * Aqui é uma ação explícita, e os códigos já existentes são preservados — a
   * operação pode ser repetida sem duplicar nem sobrescrever edições.
   */
  const popularCatalogoPadrao = useMutation({
    mutationFn: async () => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data: existentes, error: readError } = await supabase
        .from("sgsst_riscos_catalogo")
        .select("codigo")
        .not("codigo", "is", null);

      if (readError) throw readError;

      const jaCadastrados = new Set(
        (existentes ?? [])
          .map((r) => r.codigo)
          .filter((c): c is string => !!c)
      );

      const novos = RISCOS_PADRAO.filter((r) => !jaCadastrados.has(r.codigo));

      if (novos.length === 0) {
        return { inseridos: 0, ignorados: RISCOS_PADRAO.length };
      }

      const { error } = await supabase.from("sgsst_riscos_catalogo").insert(
        novos.map((r) => ({
          ...r,
          empresa_id: empresaId,
          status: "ativo",
          created_by: profile?.id,
          updated_by: profile?.id,
        }))
      );

      if (error) throw error;

      return { inseridos: novos.length, ignorados: RISCOS_PADRAO.length - novos.length };
    },
    onSuccess: ({ inseridos, ignorados }) => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_riscos"] });
      if (inseridos === 0) {
        toast.info("O catálogo padrão já estava cadastrado.");
      } else {
        toast.success(
          `${inseridos} ${inseridos === 1 ? "risco" : "riscos"} adicionados ao catálogo.` +
            (ignorados > 0 ? ` ${ignorados} já existiam e foram mantidos.` : "")
        );
      }
    },
    onError: (err: unknown) => {
      const detalhe = err instanceof Error ? err.message : String(err);
      toast.error(`Erro ao popular catálogo: ${detalhe}`);
    },
  });

  const removeRisco = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_riscos_catalogo" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_riscos"] });
      toast.success("Risco removido com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover risco: ${err.message || err}`);
    },
  });

  return {
    riscos,
    total: data?.total ?? 0,
    /** True quando o catálogo bateu o teto e a lista veio incompleta. */
    truncado: data?.truncado ?? false,
    isLoading,
    error,
    refetch,
    createRisco,
    updateRisco,
    removeRisco,
    popularCatalogoPadrao,
  };
}
