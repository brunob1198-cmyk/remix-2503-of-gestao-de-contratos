import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { escapeSearchTerm } from "@/utils/sgsstSearch";

export type TipoCat = "INICIAL" | "REABERTURA" | "COMUNICACAO_OBITO";

export const TIPO_CAT_LABEL: Record<TipoCat, string> = {
  INICIAL: "Inicial",
  REABERTURA: "Reabertura",
  COMUNICACAO_OBITO: "Comunicação de óbito",
};

export interface SgsstCat {
  id: string;
  empresa_id: string;
  numero_cat?: string | null;
  tipo_cat: TipoCat;
  colaborador_id?: string | null;
  incidente_id?: string | null;
  projeto_id?: string | null;
  area_id?: string | null;
  data_acidente: string;
  data_emissao: string;
  cid?: string | null;
  descricao?: string | null;
  dias_afastamento?: number | null;
  houve_obito: boolean;
  observacoes?: string | null;
  created_at?: string;
  updated_at?: string;
  // Joined
  colaborador?: {
    id: string;
    cpf: string | null;
    /** Nome cadastrado direto no colaborador, usado quando ele não tem profile nem recurso vinculado. */
    nome?: string | null;
    profile?: { id: string; nome: string } | null;
    recurso?: { id: string; nome: string } | null;
    funcao?: { id: string; nome: string } | null;
  } | null;
  area?: { id: string; nome: string } | null;
  projeto?: { id: string; codigo: string; nome: string } | null;
  incidente?: { id: string; codigo: string | null; titulo: string } | null;
}

export type SgsstCatInput = Omit<
  SgsstCat,
  "id" | "empresa_id" | "created_at" | "updated_at" | "colaborador" | "area" | "projeto" | "incidente"
>;

export interface SgsstCatsParams {
  page?: number;
  pageSize?: number;
  /** Busca no número da CAT, no CID e na descrição. */
  search?: string;
  tipo?: string;
  /** Ano do acidente. O relatório analítico é anual. */
  ano?: number;
}

/**
 * Cadastro de CAT — Comunicação de Acidente de Trabalho.
 *
 * Existe porque o relatório analítico do PCMSO (NR-07 7.6.2) precisa dos dados
 * das CATs emitidas, e não havia onde registrá-las. Era o único dos seis itens do
 * relatório que exigia cadastro novo.
 */
export function useSgsstCats(params?: SgsstCatsParams) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const page = params?.page ?? 0;
  const pageSize = params?.pageSize ?? 25;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      "sgsst_cats",
      empresaId,
      page,
      pageSize,
      params?.search ?? "",
      params?.tipo ?? "",
      params?.ano ?? "",
    ],
    enabled: !!empresaId,
    queryFn: async () => {
      let query = supabase
        .from("sgsst_cats" as never)
        .select(
          `
          *,
          colaborador:sgsst_colaborador_dados(
            id, cpf, nome,
            profile:profiles(id, nome),
            recurso:recursos(id, nome),
            funcao:sgsst_funcoes(id, nome)
          ),
          area:areas(id, nome),
          projeto:projetos(id, codigo, nome),
          incidente:sgsst_incidentes(id, codigo, titulo)
        `,
          { count: "exact" }
        )
        .order("data_acidente", { ascending: false });

      if (params?.search) {
        const term = escapeSearchTerm(params.search);
        if (term) {
          query = query.or(
            `numero_cat.ilike.%${term}%,cid.ilike.%${term}%,descricao.ilike.%${term}%`
          );
        }
      }

      if (params?.tipo && params.tipo !== "todos") {
        query = query.eq("tipo_cat", params.tipo);
      }

      if (params?.ano) {
        query = query
          .gte("data_acidente", `${params.ano}-01-01`)
          .lte("data_acidente", `${params.ano}-12-31`);
      }

      query = query.range(page * pageSize, page * pageSize + pageSize - 1);

      const { data, error, count } = await (query as never as Promise<{
        data: SgsstCat[] | null;
        error: { message?: string } | null;
        count: number | null;
      }>);

      if (error) throw error;
      const rows = data ?? [];
      return { rows, total: count ?? rows.length };
    },
  });

  const createCat = useMutation({
    mutationFn: async (input: SgsstCatInput) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data, error } = await (supabase
        .from("sgsst_cats" as never)
        .insert({
          ...input,
          empresa_id: empresaId,
          created_by: profile?.id,
          updated_by: profile?.id,
        } as never)
        .select()
        .single() as never as Promise<{ data: SgsstCat; error: { message?: string } | null }>);

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_cats"] });
      // O relatório analítico conta CATs; precisa recalcular.
      queryClient.invalidateQueries({ queryKey: ["sgsst_relatorio_analitico"] });
      toast.success("CAT registrada.");
    },
    onError: (err: unknown) => {
      const detalhe = err instanceof Error ? err.message : String(err);
      toast.error(`Erro ao registrar CAT: ${detalhe}`);
    },
  });

  const updateCat = useMutation({
    mutationFn: async ({ id, ...input }: Partial<SgsstCatInput> & { id: string }) => {
      const { data, error } = await (supabase
        .from("sgsst_cats" as never)
        .update({
          ...input,
          updated_by: profile?.id,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", id)
        .select()
        .single() as never as Promise<{ data: SgsstCat; error: { message?: string } | null }>);

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_cats"] });
      queryClient.invalidateQueries({ queryKey: ["sgsst_relatorio_analitico"] });
      toast.success("CAT atualizada.");
    },
    onError: (err: unknown) => {
      const detalhe = err instanceof Error ? err.message : String(err);
      toast.error(`Erro ao atualizar CAT: ${detalhe}`);
    },
  });

  const removeCat = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_cats" as never)
        .delete()
        .eq("id", id) as never as Promise<{ error: { message?: string } | null }>);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_cats"] });
      queryClient.invalidateQueries({ queryKey: ["sgsst_relatorio_analitico"] });
      toast.success("CAT removida.");
    },
    onError: (err: unknown) => {
      const detalhe = err instanceof Error ? err.message : String(err);
      toast.error(`Erro ao remover CAT: ${detalhe}`);
    },
  });

  return {
    cats: data?.rows ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    refetch,
    createCat,
    updateCat,
    removeCat,
  };
}
