import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { escapeSearchTerm } from "@/utils/sgsstSearch";

export type StatusClinica = "ATIVA" | "INATIVA";

export interface SgsstClinica {
  id: string;
  empresa_id: string;
  nome: string;
  cnpj?: string | null;
  responsavel_tecnico?: string | null;
  crm_responsavel?: string | null;
  telefone?: string | null;
  email?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  uf?: string | null;
  exames_realizados?: string | null;
  observacoes?: string | null;
  status: StatusClinica;
  created_at?: string;
  updated_at?: string;
}

export type SgsstClinicaInput = Omit<
  SgsstClinica,
  "id" | "empresa_id" | "created_at" | "updated_at"
>;

export interface SgsstClinicasParams {
  page?: number;
  pageSize?: number;
  /** Busca no nome, cidade e responsável técnico. */
  search?: string;
  status?: string;
}

/** Teto para o uso como lista de apoio (select de agendamento). */
export const CLINICAS_LISTA_LIMITE = 500;

/**
 * Clínicas credenciadas.
 *
 * Antes o nome da clínica era digitado à mão em cada exame, o que impedia
 * filtrar por prestador e obrigava a redigitar contato e endereço.
 *
 * Sem `params`, devolve a lista inteira (uso como lista de apoio no agendamento).
 * Com `params`, pagina e filtra no servidor.
 */
export function useSgsstClinicas(params?: SgsstClinicasParams) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const paginado = !!params;
  const page = params?.page ?? 0;
  const pageSize = params?.pageSize ?? 25;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      "sgsst_clinicas",
      empresaId,
      paginado ? page : "all",
      paginado ? pageSize : "all",
      params?.search ?? "",
      params?.status ?? "",
    ],
    enabled: !!empresaId,
    queryFn: async () => {
      let query = supabase
        .from("sgsst_clinicas" as never)
        .select("*", { count: "exact" })
        .order("nome", { ascending: true });

      if (params?.search) {
        const term = escapeSearchTerm(params.search);
        if (term) {
          query = query.or(
            `nome.ilike.%${term}%,cidade.ilike.%${term}%,responsavel_tecnico.ilike.%${term}%`
          );
        }
      }

      if (params?.status && params.status !== "todos") {
        query = query.eq("status", params.status);
      }

      query = paginado
        ? query.range(page * pageSize, page * pageSize + pageSize - 1)
        : query.limit(CLINICAS_LISTA_LIMITE);

      const { data, error, count } = await (query as never as Promise<{
        data: SgsstClinica[] | null;
        error: { message?: string } | null;
        count: number | null;
      }>);

      if (error) throw error;
      const rows = data ?? [];
      return { rows, total: count ?? rows.length };
    },
  });

  const createClinica = useMutation({
    mutationFn: async (input: SgsstClinicaInput) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data, error } = await (supabase
        .from("sgsst_clinicas" as never)
        .insert({
          ...input,
          empresa_id: empresaId,
          created_by: profile?.id,
          updated_by: profile?.id,
        } as never)
        .select()
        .single() as never as Promise<{
        data: SgsstClinica;
        error: { message?: string; code?: string } | null;
      }>);

      if (error) {
        // 23505 = violação do UNIQUE parcial de CNPJ por empresa.
        if (error.code === "23505") {
          throw new Error("Já existe uma clínica cadastrada com este CNPJ.");
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_clinicas"] });
      toast.success("Clínica cadastrada.");
    },
    onError: (err: unknown) => {
      const detalhe = err instanceof Error ? err.message : String(err);
      toast.error(`Erro ao cadastrar clínica: ${detalhe}`);
    },
  });

  const updateClinica = useMutation({
    mutationFn: async ({ id, ...input }: Partial<SgsstClinicaInput> & { id: string }) => {
      const { data, error } = await (supabase
        .from("sgsst_clinicas" as never)
        .update({
          ...input,
          updated_by: profile?.id,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", id)
        .select()
        .single() as never as Promise<{
        data: SgsstClinica;
        error: { message?: string } | null;
      }>);

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_clinicas"] });
      toast.success("Clínica atualizada.");
    },
    onError: (err: unknown) => {
      const detalhe = err instanceof Error ? err.message : String(err);
      toast.error(`Erro ao atualizar clínica: ${detalhe}`);
    },
  });

  const removeClinica = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_clinicas" as never)
        .delete()
        .eq("id", id) as never as Promise<{ error: { message?: string; code?: string } | null }>);

      if (error) {
        // 23503 = há exame apontando para esta clínica (ON DELETE SET NULL cobre,
        // mas mantemos a mensagem clara caso a FK mude para RESTRICT).
        if (error.code === "23503") {
          throw new Error(
            "Há exames vinculados a esta clínica. Marque-a como inativa em vez de excluir."
          );
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_clinicas"] });
      toast.success("Clínica removida.");
    },
    onError: (err: unknown) => {
      const detalhe = err instanceof Error ? err.message : String(err);
      toast.error(`Erro ao remover clínica: ${detalhe}`);
    },
  });

  return {
    clinicas: data?.rows ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    refetch,
    createClinica,
    updateClinica,
    removeClinica,
  };
}
