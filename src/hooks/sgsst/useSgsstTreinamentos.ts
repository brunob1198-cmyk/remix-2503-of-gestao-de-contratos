import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { escapeSearchTerm } from "@/utils/sgsstSearch";
import { addMonths, addDays, format, parseISO } from "date-fns";
import { calculateVencimentoTreinamento, StatusVencimentoTreinamento } from "@/utils/sgsstTreinamentosUtils";
import { useEmpresaAtual } from "@/hooks/useEmpresaAtual";

export type CategoriaTreinamento =
  | "NR"
  | "Integração"
  | "Segurança"
  | "Saúde"
  | "Operacional"
  | "Comportamental"
  | "Outros";

export type StatusTreinamento = "ATIVO" | "INATIVO";
export type ModalidadeTurma = "PRESENCIAL" | "ONLINE" | "HIBRIDO";
export type StatusTurma = "PLANEJADA" | "EM_ANDAMENTO" | "CONCLUIDA" | "CANCELADA";
export type ResultadoParticipante = "APROVADO" | "REPROVADO" | "PENDENTE";

/** Classificação de treinamento da NR-01 1.7. */
export type TipoTreinamentoNorma = "INICIAL" | "PERIODICO" | "EVENTUAL";

export const TIPO_TREINAMENTO_LABEL: Record<TipoTreinamentoNorma, string> = {
  INICIAL: "Inicial",
  PERIODICO: "Periódico (reciclagem)",
  EVENTUAL: "Eventual",
};

export const TIPO_TREINAMENTO_AJUDA: Record<TipoTreinamentoNorma, string> = {
  INICIAL: "Primeira capacitação do trabalhador para a atividade.",
  PERIODICO:
    "Reciclagem no prazo que a norma específica exige — a NR-35 pede a cada dois anos, a NR-33 anualmente.",
  EVENTUAL:
    "Fora do ciclo: mudança de função, de procedimento, retorno de afastamento longo ou após acidente.",
};

export interface SgsstTreinamento {
  id: string;
  empresa_id: string;
  codigo?: string | null;
  nome: string;
  descricao?: string | null;
  categoria: CategoriaTreinamento;
  carga_horaria: number;
  validade_meses?: number | null;
  obrigatorio: boolean;
  /**
   * Conteudo programatico do curso — item obrigatorio do certificado
   * (NR-01 1.7). Diferente de `descricao`, que e texto de apresentacao.
   */
  conteudo_programatico?: string | null;
  /** Norma que exige o treinamento, ex.: "NR-35 item 35.3.2". */
  base_legal?: string | null;
  funcao_id?: string | null;
  projeto_id?: string | null;
  site_id?: string | null;
  area_id?: string | null;
  status: StatusTreinamento;
  observacoes?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
  // Joined Data
  funcao?: { id: string; nome: string } | null;
  projeto?: { id: string; codigo: string; nome: string } | null;
}

export type SgsstTreinamentoInput = Omit<
  SgsstTreinamento,
  "id" | "empresa_id" | "created_at" | "updated_at" | "funcao" | "projeto"
>;

export interface SgsstTreinamentoTurma {
  id: string;
  empresa_id: string;
  treinamento_id: string;
  codigo_turma?: string | null;
  data_inicial: string;
  data_final?: string | null;
  carga_horaria?: number | null;
  instrutor?: string | null;
  /**
   * Qualificacao do instrutor. A NR-01 1.7 exige nome E qualificacao no
   * certificado; so o nome deixa o documento incompleto.
   */
  instrutor_qualificacao?: string | null;
  /**
   * Classificacao da propria NR-01. Nao confundir com `categoria` do
   * treinamento, que e assunto (NR, Integracao, Comportamental).
   */
  tipo_treinamento?: TipoTreinamentoNorma | null;
  /** Quem assina tecnicamente pelo treinamento (NR-01 1.7). */
  responsavel_tecnico?: string | null;
  registro_responsavel?: string | null;
  /**
   * Identificacao da organizacao congelada na turma. Ler de `empresas` ao
   * imprimir faria certificados antigos mostrarem o nome novo da empresa.
   */
  empresa_nome?: string | null;
  empresa_cnpj?: string | null;
  local?: string | null;
  modalidade: ModalidadeTurma;
  capacidade?: number | null;
  status: StatusTurma;
  observacoes?: string | null;
  created_at?: string;
  updated_at?: string;
  // Joined Data
  treinamento?: SgsstTreinamento | null;
}

export type SgsstTreinamentoTurmaInput = Omit<
  SgsstTreinamentoTurma,
  "id" | "empresa_id" | "created_at" | "updated_at" | "treinamento"
>;

export interface SgsstTreinamentoParticipante {
  id: string;
  empresa_id: string;
  turma_id: string;
  colaborador_id: string;
  presenca: boolean;
  percentual_presenca: number;
  resultado: ResultadoParticipante;
  aprovacao: boolean;
  data_conclusao?: string | null;
  validade?: string | null;
  certificado?: string | null;
  observacoes?: string | null;
  created_at?: string;
  updated_at?: string;
  // Joined Data
  colaborador?: {
    id: string;
    cpf: string;
    profile?: { id: string; nome: string } | null;
    recurso?: { id: string; nome: string } | null;
    funcao?: { id: string; nome: string } | null;
  } | null;
  turma?: SgsstTreinamentoTurma | null;
  // Calculated
  statusVencimento?: StatusVencimentoTreinamento;
}

export interface SgsstTreinamentoHistorico {
  id: string;
  empresa_id: string;
  treinamento_id?: string | null;
  turma_id?: string | null;
  usuario_id?: string | null;
  operacao: string;
  observacao?: string | null;
  created_at: string;
  usuario?: { id: string; nome: string | null } | null;
}

// 1. Hook Catálogo de Treinamentos
export function useSgsstTreinamentos(params?: { page?: number; pageSize?: number; search?: string; categoria?: string }) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;
  const page = params?.page ?? 0;
  const pageSize = params?.pageSize ?? 25;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["sgsst_treinamentos", empresaId, page, pageSize, params?.search, params?.categoria],
    enabled: !!empresaId,
    queryFn: async () => {
      let query = supabase
        .from("sgsst_treinamentos" as any)
        .select(`
          *,
          funcao:sgsst_funcoes(id, nome),
          projeto:projetos(id, codigo, nome)
        `, { count: "exact" })
        .order("created_at", { ascending: false });

      if (params?.search) {
        query = query.ilike("nome", `%${params.search}%`);
      }
      if (params?.categoria && params.categoria !== "todos") {
        query = query.eq("categoria", params.categoria);
      }

      query = query.range(page * pageSize, page * pageSize + pageSize - 1);

      const { data, error, count } = await (query as any);

      if (error) throw error;
      return { rows: (data as SgsstTreinamento[]) || [], total: count ?? 0 };
    },
  });

  const createTreinamento = useMutation({
    mutationFn: async (input: SgsstTreinamentoInput) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data, error } = await (supabase
        .from("sgsst_treinamentos" as any)
        .insert({
          ...input,
          empresa_id: empresaId,
          created_by: profile?.id,
          updated_by: profile?.id,
        })
        .select()
        .single() as any);

      if (error) throw error;

      await supabase.from("sgsst_treinamentos_historico" as any).insert({
        empresa_id: empresaId,
        treinamento_id: data.id,
        usuario_id: profile?.id,
        operacao: "CRIACAO",
        observacao: `Cadastro de novo treinamento no catálogo: ${data.nome}`,
      });

      return data as SgsstTreinamento;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_treinamentos"] });
      toast.success("Treinamento cadastrado com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao cadastrar treinamento: ${err.message || err}`);
    },
  });

  const updateTreinamento = useMutation({
    mutationFn: async ({ id, ...input }: Partial<SgsstTreinamentoInput> & { id: string }) => {
      const { data, error } = await (supabase
        .from("sgsst_treinamentos" as any)
        .update({
          ...input,
          updated_by: profile?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstTreinamento;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_treinamentos"] });
      toast.success("Treinamento atualizado!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar treinamento: ${err.message || err}`);
    },
  });

  const removeTreinamento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_treinamentos" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_treinamentos"] });
      toast.success("Treinamento removido!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover treinamento: ${err.message || err}`);
    },
  });

  return {
    treinamentos: data?.rows ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    refetch,
    createTreinamento,
    updateTreinamento,
    removeTreinamento,
  };
}

// 2. Hook Turmas de Treinamentos
export interface SgsstTurmasParams {
  page?: number;
  pageSize?: number;
  /** Busca no código da turma e no instrutor. */
  search?: string;
  status?: string;
}

/** Teto para o uso como lista de apoio. */
export const TURMAS_LISTA_LIMITE = 1000;

/**
 * Sem `params`, devolve a lista inteira (uso como lista de apoio).
 * Com `params`, pagina e filtra no servidor (uso na aba de Turmas).
 *
 * A consulta nao tinha limite algum e o PostgREST cortava em silencio no teto de
 * linhas; turmas acumulam a cada capacitacao realizada.
 */
export function useSgsstTreinamentosTurmas(params?: SgsstTurmasParams) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;
  const { empresa } = useEmpresaAtual();

  const paginado = !!params;
  const page = params?.page ?? 0;
  const pageSize = params?.pageSize ?? 25;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      "sgsst_treinamentos_turmas",
      empresaId,
      paginado ? page : "all",
      paginado ? pageSize : "all",
      params?.search ?? "",
      params?.status ?? "",
    ],
    enabled: !!empresaId,
    queryFn: async () => {
      let query = supabase
        .from("sgsst_treinamentos_turmas" as any)
        .select(
          `
          *,
          treinamento:sgsst_treinamentos(*)
        `,
          { count: "exact" }
        )
        .order("data_inicial", { ascending: false });

      if (params?.search) {
        const term = escapeSearchTerm(params.search);
        if (term) {
          query = query.or(`codigo_turma.ilike.%${term}%,instrutor.ilike.%${term}%`);
        }
      }

      if (params?.status && params.status !== "todos") {
        query = query.eq("status", params.status);
      }

      query = paginado
        ? query.range(page * pageSize, page * pageSize + pageSize - 1)
        : query.limit(TURMAS_LISTA_LIMITE);

      const { data, error, count } = await (query as any);
      if (error) throw error;

      const rows = (data as SgsstTreinamentoTurma[]) || [];
      return { rows, total: count ?? rows.length };
    },
  });

  const turmas = data?.rows ?? [];

  const createTurma = useMutation({
    mutationFn: async (input: SgsstTreinamentoTurmaInput) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data, error } = await (supabase
        .from("sgsst_treinamentos_turmas" as any)
        .insert({
          ...input,
          empresa_id: empresaId,
          // Congela a identificacao da organizacao na abertura da turma. Ler de
          // `empresas` ao imprimir faria certificados antigos passarem a mostrar
          // o nome novo se a empresa fosse renomeada, o que falseia o documento.
          empresa_nome: input.empresa_nome ?? empresa?.nome ?? null,
          empresa_cnpj: input.empresa_cnpj ?? empresa?.cnpj ?? null,
        })
        .select()
        .single() as any);

      if (error) throw error;

      await supabase.from("sgsst_treinamentos_historico" as any).insert({
        empresa_id: empresaId,
        treinamento_id: input.treinamento_id,
        turma_id: data.id,
        usuario_id: profile?.id,
        operacao: "CRIACAO_TURMA",
        observacao: `Abertura de nova turma [Modalidade: ${data.modalidade}]`,
      });

      return data as SgsstTreinamentoTurma;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_treinamentos_turmas"] });
      toast.success("Turma de treinamento criada!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao criar turma: ${err.message || err}`);
    },
  });

  const updateTurma = useMutation({
    mutationFn: async ({ id, ...input }: Partial<SgsstTreinamentoTurmaInput> & { id: string }) => {
      const { data, error } = await (supabase
        .from("sgsst_treinamentos_turmas" as any)
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstTreinamentoTurma;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_treinamentos_turmas"] });
      toast.success("Turma de treinamento atualizada!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar turma: ${err.message || err}`);
    },
  });

  const removeTurma = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_treinamentos_turmas" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_treinamentos_turmas"] });
      toast.success("Turma removida!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover turma: ${err.message || err}`);
    },
  });

  return {
    turmas,
    total: data?.total ?? 0,
    isLoading,
    error,
    refetch,
    createTurma,
    updateTurma,
    removeTurma,
  };
}

// 3. Hook Participantes da Turma
export function useSgsstTreinamentosParticipantes(turmaId?: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const { data: participantes = [], isLoading, refetch } = useQuery({
    queryKey: ["sgsst_treinamentos_participantes", turmaId],
    enabled: !!turmaId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_treinamentos_participantes" as any)
        .select(`
          *,
          colaborador:sgsst_colaborador_dados(
            id, cpf,
            profile:profiles(id, nome),
            recurso:recursos(id, nome),
            funcao:sgsst_funcoes(id, nome)
          ),
          turma:sgsst_treinamentos_turmas(*, treinamento:sgsst_treinamentos(*))
        `)
        .eq("turma_id", turmaId!)
        .order("created_at", { ascending: true }) as any);

      if (error) throw error;

      return ((data || []) as SgsstTreinamentoParticipante[]).map((p) => ({
        ...p,
        statusVencimento: calculateVencimentoTreinamento(p.validade),
      }));
    },
  });

  const addParticipante = useMutation({
    mutationFn: async ({
      colaboradorId,
      turma,
    }: {
      colaboradorId: string;
      turma: SgsstTreinamentoTurma;
    }) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data, error } = await (supabase
        .from("sgsst_treinamentos_participantes" as any)
        .insert({
          empresa_id: empresaId,
          turma_id: turma.id,
          colaborador_id: colaboradorId,
          presenca: false,
          percentual_presenca: 100,
          resultado: "PENDENTE",
          aprovacao: false,
        })
        .select()
        .single() as any);

      if (error) throw error;

      await supabase.from("sgsst_treinamentos_historico" as any).insert({
        empresa_id: empresaId,
        treinamento_id: turma.treinamento_id,
        turma_id: turma.id,
        usuario_id: profile?.id,
        operacao: "INCLUSAO_PARTICIPANTE",
        observacao: `Matrícula do colaborador na turma`,
      });

      return data as SgsstTreinamentoParticipante;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_treinamentos_participantes"] });
      toast.success("Participante matriculado com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao matricular participante: ${err.message || err}`);
    },
  });

  const updateParticipante = useMutation({
    mutationFn: async ({
      id,
      presenca,
      percentualPresenca,
      resultado,
      dataConclusao,
      validadeMeses,
      observacoes,
    }: {
      id: string;
      presenca: boolean;
      percentualPresenca: number;
      resultado: ResultadoParticipante;
      dataConclusao?: string;
      validadeMeses?: number | null;
      observacoes?: string;
    }) => {
      const aprovacao = resultado === "APROVADO";
      let validadeCalc: string | null = null;

      if (aprovacao && dataConclusao && validadeMeses && validadeMeses > 0) {
        try {
          const dateObj = parseISO(dataConclusao);
          validadeCalc = format(addMonths(dateObj, validadeMeses), "yyyy-MM-dd");
        } catch {}
      }

      const { data, error } = await (supabase
        .from("sgsst_treinamentos_participantes" as any)
        .update({
          presenca,
          percentual_presenca: percentualPresenca,
          resultado,
          aprovacao,
          data_conclusao: dataConclusao || null,
          validade: validadeCalc,
          observacoes: observacoes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstTreinamentoParticipante;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_treinamentos_participantes"] });
      queryClient.invalidateQueries({ queryKey: ["sgsst_todos_participantes"] });
      toast.success("Resultado e presença do participante atualizados!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar participante: ${err.message || err}`);
    },
  });

  const removeParticipante = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_treinamentos_participantes" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_treinamentos_participantes"] });
      queryClient.invalidateQueries({ queryKey: ["sgsst_todos_participantes"] });
      toast.success("Participante removido da turma!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover participante: ${err.message || err}`);
    },
  });

  return {
    participantes,
    isLoading,
    refetch,
    addParticipante,
    updateParticipante,
    removeParticipante,
  };
}

/**
 * 4. Hook Global Todos Participantes (Matriculas, Vencimentos & Relatorio)
 *
 * A consulta nasceu para a aba de Vencimentos e por isso filtrava sempre
 * `validade <= hoje + janela`. Quem chamava para listar matriculas recebia uma
 * lista silenciosamente recortada: participante sem validade, ou com validade
 * distante, nunca aparecia. Passa a ter modo.
 */
export function useSgsstTodosParticipantes(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  statusVencimento?: string;
  diasJanela?: number;
  enabled?: boolean;
  /**
   * "VENCIMENTOS" (padrao) recorta pela janela de validade; "TODOS" lista as
   * matriculas sem recorte, inclusive as sem validade definida.
   */
  modo?: "VENCIMENTOS" | "TODOS";
}) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const page = params?.page ?? 0;
  const pageSize = params?.pageSize ?? 25;
  const isEnabled = (params?.enabled ?? true) && !!empresaId;
  const modo = params?.modo ?? "VENCIMENTOS";

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      "sgsst_todos_participantes",
      empresaId,
      modo,
      page,
      pageSize,
      params?.search,
      params?.statusVencimento,
      params?.diasJanela,
    ],
    enabled: isEnabled,
    queryFn: async () => {
      let query = supabase
        .from("sgsst_treinamentos_participantes" as any)
        .select(`
          *,
          colaborador:sgsst_colaborador_dados(
            id, cpf,
            profile:profiles(id, nome),
            recurso:recursos(id, nome),
            funcao:sgsst_funcoes(id, nome)
          ),
          turma:sgsst_treinamentos_turmas(*, treinamento:sgsst_treinamentos(*))
        `, { count: "exact" })
        .order("validade", { ascending: true });

      // Filtro por janela de validade: validade nos próximos 90 dias ou já
      // vencidas (validade <= HOJE + diasJanela). No modo TODOS não se aplica —
      // recortar aqui esconderia matrícula recém-criada e sem validade.
      if (modo === "VENCIMENTOS") {
        const maxValidade = format(addDays(new Date(), params?.diasJanela ?? 90), "yyyy-MM-dd");
        query = query.lte("validade", maxValidade);
      }

      query = query.range(page * pageSize, page * pageSize + pageSize - 1);

      const { data, error, count } = await (query as any);

      if (error) throw error;

      const rows = ((data || []) as SgsstTreinamentoParticipante[]).map((p) => ({
        ...p,
        statusVencimento: calculateVencimentoTreinamento(p.validade),
      }));

      return { rows, total: count ?? 0 };
    },
  });

  return {
    todosParticipantes: data?.rows ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    refetch,
  };
}

// 5. Hook Histórico
export function useSgsstTreinamentosHistorico(treinamentoId?: string, turmaId?: string) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const { data: historico = [], isLoading } = useQuery({
    queryKey: ["sgsst_treinamentos_historico", treinamentoId, turmaId],
    enabled: !!empresaId && (!!treinamentoId || !!turmaId),
    queryFn: async () => {
      let query = supabase
        .from("sgsst_treinamentos_historico" as any)
        .select(`
          *,
          usuario:profiles!sgsst_treinamentos_historico_usuario_id_fkey(id, nome)
        `)
        .order("created_at", { ascending: false });

      if (treinamentoId) query = query.eq("treinamento_id", treinamentoId);
      if (turmaId) query = query.eq("turma_id", turmaId);

      const { data, error } = await (query as any);
      if (error) throw error;
      return (data as SgsstTreinamentoHistorico[]) || [];
    },
  });

  return {
    historico,
    isLoading,
  };
}
