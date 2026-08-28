import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { escapeSearchTerm } from "@/utils/sgsstSearch";

export type StatusPcmso = "RASCUNHO" | "ATIVO" | "EM_REVISAO" | "ENCERRADO" | "CANCELADO";

export type TipoExamePcmso =
  | "Admissional"
  | "Periódico"
  | "Retorno ao Trabalho"
  | "Mudança de Risco/Função"
  | "Demissional"
  | "Outros";

/** Faixas de idade da NR-07 7.5.4.2, que mudam a periodicidade do exame clínico. */
export type FaixaEtariaPcmso = "TODAS" | "MENOR_18" | "ENTRE_18_45" | "MAIOR_45";

export const FAIXA_ETARIA_LABEL: Record<FaixaEtariaPcmso, string> = {
  TODAS: "Todas as idades",
  MENOR_18: "Menores de 18 anos",
  ENTRE_18_45: "Entre 18 e 45 anos",
  MAIOR_45: "Acima de 45 anos",
};

export interface SgsstPcmso {
  id: string;
  empresa_id: string;
  projeto_id?: string | null;
  codigo?: string | null;
  titulo: string;
  responsavel?: string | null;
  medico_responsavel?: string | null;
  crm_medico?: string | null;
  data_inicio: string;
  data_revisao?: string | null;
  status: StatusPcmso;
  objetivo?: string | null;
  observacoes?: string | null;
  /** NR-07 7.5: agravos à saúde relacionados aos riscos identificados. */
  agravos_saude?: string | null;
  /** NR-07 7.5: critérios de interpretação dos achados e condutas. */
  criterios_conduta?: string | null;
  /** Exercício a que o programa se refere; base do relatório analítico anual. */
  ano_referencia?: number | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
  // Joined Data
  projeto?: { id: string; codigo: string; nome: string } | null;
}

export type SgsstPcmsoInput = Omit<
  SgsstPcmso,
  "id" | "empresa_id" | "created_at" | "updated_at" | "projeto"
>;

export interface SgsstPcmsoExame {
  id: string;
  empresa_id: string;
  pcmso_id: string;
  nome_exame: string;
  tipo_exame: TipoExamePcmso;
  periodicidade_meses: number;
  funcao_id?: string | null;
  /** @deprecated Texto livre mantido por compatibilidade. Use `risco_catalogo_id`. */
  grupo_risco?: string | null;
  observacoes?: string | null;
  /** Correlação risco → exame, exigida na defesa técnica do programa. */
  justificativa_tecnica?: string | null;
  /** Ex.: "NR-07 Anexo I", "NR-15 Anexo 11". */
  base_legal?: string | null;
  /** Faixa a que esta periodicidade se aplica (NR-07 7.5.4.2). */
  faixa_etaria?: FaixaEtariaPcmso | null;
  /** Vínculo ao mesmo catálogo de riscos usado por PGR, APR e PT. */
  risco_catalogo_id?: string | null;
  created_at?: string;
  funcao?: { id: string; nome: string } | null;
  risco?: { id: string; codigo: string | null; nome: string; categoria: string } | null;
}

export interface SgsstPcmsoHistorico {
  id: string;
  empresa_id: string;
  pcmso_id: string;
  usuario_id?: string | null;
  status_anterior?: string | null;
  novo_status: string;
  observacao?: string | null;
  created_at: string;
  usuario?: { id: string; nome: string | null } | null;
}

export function useSgsstPcmsoDetail(pcmsoId?: string) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  return useQuery({
    queryKey: ["sgsst_pcmso", "detail", pcmsoId],
    enabled: !!empresaId && !!pcmsoId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_pcmso" as any)
        .select(`
          *,
          projeto:projetos(id, codigo, nome)
        `)
        .eq("id", pcmsoId)
        .single() as any);
      if (error) throw error;
      return data as SgsstPcmso;
    },
  });
}

/** Teto para o uso como lista de apoio (selects de ASO e Exames). */
export const PCMSO_CATALOGO_LIMITE = 1000;

export interface SgsstPcmsoParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}

/**
 * Sem `params`, devolve a lista inteira (uso como lista de apoio).
 * Com `params`, pagina e filtra no servidor (uso na tela de PCMSO).
 */
export function useSgsstPcmso(params?: SgsstPcmsoParams) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const paginado = !!params;
  const page = params?.page ?? 0;
  const pageSize = params?.pageSize ?? 25;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      "sgsst_pcmso",
      empresaId,
      paginado ? page : "all",
      paginado ? pageSize : "all",
      params?.search ?? "",
      params?.status ?? "",
    ],
    enabled: !!empresaId,
    queryFn: async () => {
      let query = supabase
        .from("sgsst_pcmso" as any)
        .select(
          `
          *,
          projeto:projetos(id, codigo, nome)
        `,
          { count: "exact" }
        )
        .order("created_at", { ascending: false });

      if (params?.search) {
        const term = escapeSearchTerm(params.search);
        if (term) {
          query = query.or(
            `codigo.ilike.%${term}%,titulo.ilike.%${term}%,medico_responsavel.ilike.%${term}%`
          );
        }
      }

      if (params?.status && params.status !== "todos") {
        query = query.eq("status", params.status);
      }

      query = paginado
        ? query.range(page * pageSize, page * pageSize + pageSize - 1)
        : query.limit(PCMSO_CATALOGO_LIMITE);

      const { data, error, count } = await (query as any);
      if (error) throw error;

      const rows = (data as SgsstPcmso[]) || [];
      return {
        rows,
        total: count ?? rows.length,
        truncado: !paginado && rows.length >= PCMSO_CATALOGO_LIMITE,
      };
    },
  });

  const pcmsoList = data?.rows ?? [];

  const createPcmso = useMutation({
    mutationFn: async (input: SgsstPcmsoInput) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data: createdPcmso, error } = await (supabase
        .from("sgsst_pcmso" as any)
        .insert({
          ...input,
          empresa_id: empresaId,
          created_by: profile?.id,
          updated_by: profile?.id,
        })
        .select()
        .single() as any);

      if (error) throw error;

      // Log inicial no histórico
      await supabase.from("sgsst_pcmso_historico" as any).insert({
        empresa_id: empresaId,
        pcmso_id: createdPcmso.id,
        usuario_id: profile?.id,
        status_anterior: null,
        novo_status: createdPcmso.status,
        observacao: "Elaboração e criação do programa PCMSO",
      });

      return createdPcmso as SgsstPcmso;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pcmso"] });
      toast.success("PCMSO criado com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao criar PCMSO: ${err.message || err}`);
    },
  });

  const updatePcmso = useMutation({
    mutationFn: async ({ id, ...input }: Partial<SgsstPcmsoInput> & { id: string }) => {
      const { data, error } = await (supabase
        .from("sgsst_pcmso" as any)
        .update({
          ...input,
          updated_by: profile?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstPcmso;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pcmso"] });
      toast.success("PCMSO atualizado com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar PCMSO: ${err.message || err}`);
    },
  });

  const updateStatusPcmso = useMutation({
    mutationFn: async ({
      id,
      statusAnterior,
      novoStatus,
      observacao,
    }: {
      id: string;
      statusAnterior: StatusPcmso;
      novoStatus: StatusPcmso;
      observacao?: string;
    }) => {
      const { data, error } = await (supabase
        .from("sgsst_pcmso" as any)
        .update({
          status: novoStatus,
          updated_by: profile?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;

      // Log no histórico
      await supabase.from("sgsst_pcmso_historico" as any).insert({
        empresa_id: empresaId,
        pcmso_id: id,
        usuario_id: profile?.id,
        status_anterior: statusAnterior,
        novo_status: novoStatus,
        observacao: observacao || `Transição de status de ${statusAnterior} para ${novoStatus}`,
      });

      return data as SgsstPcmso;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pcmso"] });
      queryClient.invalidateQueries({ queryKey: ["sgsst_pcmso_historico"] });
      toast.success("Status do PCMSO alterado!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao alterar status: ${err.message || err}`);
    },
  });

  const removePcmso = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_pcmso" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pcmso"] });
      toast.success("PCMSO removido com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover PCMSO: ${err.message || err}`);
    },
  });

  return {
    pcmsoList,
    total: data?.total ?? 0,
    truncado: data?.truncado ?? false,
    isLoading,
    error,
    refetch,
    createPcmso,
    updatePcmso,
    updateStatusPcmso,
    removePcmso,
  };
}

// Hook for Exames Previstos
export function useSgsstPcmsoExames(pcmsoId?: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const { data: exames = [], isLoading, error, refetch } = useQuery({
    queryKey: ["sgsst_pcmso_exames", pcmsoId],
    enabled: !!pcmsoId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_pcmso_exames" as any)
        .select(`
          *,
          funcao:sgsst_funcoes(id, nome),
          risco:sgsst_riscos_catalogo(id, codigo, nome, categoria)
        `)
        .eq("pcmso_id", pcmsoId!)
        .order("created_at", { ascending: true }) as any);

      if (error) throw error;
      return (data as SgsstPcmsoExame[]) || [];
    },
  });

  const addExame = useMutation({
    mutationFn: async (
      input: Omit<SgsstPcmsoExame, "id" | "empresa_id" | "created_at" | "funcao">
    ) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data, error } = await (supabase
        .from("sgsst_pcmso_exames" as any)
        .insert({
          ...input,
          empresa_id: empresaId,
          pcmso_id: pcmsoId!,
        })
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstPcmsoExame;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pcmso_exames", pcmsoId] });
      toast.success("Exame previsto adicionado ao PCMSO!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao adicionar exame: ${err.message || err}`);
    },
  });

  const removeExame = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_pcmso_exames" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pcmso_exames", pcmsoId] });
      toast.success("Exame removido do PCMSO!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover exame: ${err.message || err}`);
    },
  });

  return {
    exames,
    isLoading,
    error,
    refetch,
    addExame,
    removeExame,
  };
}

// Hook for Histórico
export function useSgsstPcmsoHistorico(pcmsoId?: string) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const { data: historico = [], isLoading } = useQuery({
    queryKey: ["sgsst_pcmso_historico", pcmsoId],
    enabled: !!pcmsoId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_pcmso_historico" as any)
        .select(`
          *,
          usuario:profiles!sgsst_pcmso_historico_usuario_id_fkey(id, nome)
        `)
        .eq("pcmso_id", pcmsoId!)
        .order("created_at", { ascending: false }) as any);

      if (error) throw error;
      return (data as SgsstPcmsoHistorico[]) || [];
    },
  });

  return {
    historico,
    isLoading,
  };
}

/**
 * Quantos ASOs e exames apontam para cada PCMSO da página.
 *
 * Serve à confirmação de exclusão: o `ON DELETE SET NULL` nessas duas tabelas faz
 * os registros sobreviverem sem o vínculo, e o PDF do ASO imprime o PCMSO de
 * referência. Sem a contagem, a confirmação não tem como dizer o que vai
 * acontecer — e o usuário descobre depois, num atestado com o campo em branco.
 *
 * Uma consulta para a página inteira, não uma por linha.
 */
export function useSgsstPcmsoDependentes(pcmsoIds: readonly string[]) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  // Ordenado para a chave não mudar só porque a ordem da página mudou.
  const chaveIds = [...pcmsoIds].sort().join(",");

  const { data, isLoading, error } = useQuery({
    queryKey: ["sgsst_pcmso", "dependentes", empresaId, chaveIds],
    enabled: !!empresaId && pcmsoIds.length > 0,
    queryFn: async () => {
      const contar = async (tabela: string) => {
        const { data, error } = await (supabase
          .from(tabela as never)
          .select("pcmso_id")
          .in("pcmso_id", pcmsoIds as string[]) as never as Promise<{
          data: { pcmso_id: string | null }[] | null;
          error: { message?: string } | null;
        }>);
        if (error) throw error;
        return data ?? [];
      };

      const [asos, exames] = await Promise.all([contar("sgsst_asos"), contar("sgsst_exames")]);

      const porPcmso: Record<string, { asos: number; exames: number }> = {};
      for (const id of pcmsoIds) porPcmso[id] = { asos: 0, exames: 0 };
      for (const a of asos) if (a.pcmso_id && porPcmso[a.pcmso_id]) porPcmso[a.pcmso_id].asos += 1;
      for (const e of exames) if (e.pcmso_id && porPcmso[e.pcmso_id]) porPcmso[e.pcmso_id].exames += 1;

      return porPcmso;
    },
  });

  return {
    /**
     * Contagem do PCMSO. Enquanto carrega devolve `null` — e não zero: zero
     * afirmaria "não há ASO vinculado", que é justamente a informação que a
     * confirmação de exclusão não pode errar.
     */
    dependentesDe: (pcmsoId: string) => data?.[pcmsoId] ?? null,
    isLoading,
    error,
  };
}
