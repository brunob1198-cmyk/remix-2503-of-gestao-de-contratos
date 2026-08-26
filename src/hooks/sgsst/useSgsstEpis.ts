import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { escapeSearchTerm } from "@/utils/sgsstSearch";
import type {
  TipoManutencaoEpi,
  ResultadoManutencaoEpi,
} from "@/utils/sgsstEpiHigienizacao";
import { calculateValidadeCa, StatusValidadeCa } from "@/utils/sgsstEpiUtils";

export type CategoriaEpi =
  | "Proteção da Cabeça"
  | "Proteção dos Olhos e Face"
  | "Proteção Auditiva"
  | "Proteção Respiratória"
  | "Proteção das Mãos"
  | "Proteção dos Pés"
  | "Proteção do Corpo"
  | "Proteção Contra Quedas"
  | "Outros";

export type StatusEpi = "ATIVO" | "INATIVO";
export type MotivoEntregaEpi =
  | "PRIMEIRA_ENTREGA"
  | "SUBSTITUICAO"
  | "PERDA"
  | "DANIFICADO"
  | "VENCIMENTO"
  | "OUTROS";

export type CondicaoDevolucaoEpi = "BOM" | "DANIFICADO" | "INUTILIZADO" | "VENCIDO";

export interface SgsstEpi {
  id: string;
  empresa_id: string;
  codigo?: string | null;
  nome: string;
  categoria: CategoriaEpi;
  fabricante?: string | null;
  modelo?: string | null;
  ca: string;
  validade_ca?: string | null;
  unidade_medida: string;
  estoque_atual: number;
  estoque_minimo: number;
  /**
   * Vida util em meses, contada da entrega. Nao confundir com `validade_ca`: o CA
   * e do modelo e vence para todos na mesma data; a vida util e da unidade que o
   * trabalhador recebeu.
   */
  vida_util_meses?: number | null;
  /**
   * De quantos em quantos dias o equipamento deve ser higienizado ou revisado
   * (NR-06 6.6.1 alínea "f"). Nulo = sem periodicidade, e o sistema não cobra prazo.
   */
  higienizacao_periodicidade_dias?: number | null;
  /**
   * Verdadeiro para reutilizável. Falso para descartável — cobrar higienização de
   * máscara PFF1 é ruído, e ruído ensina o usuário a ignorar o aviso verdadeiro.
   */
  exige_higienizacao?: boolean | null;
  status: StatusEpi;
  descricao?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
  // Calculated
  statusValidadeCa?: StatusValidadeCa;
  abaixoMinimo?: boolean;
}

export type SgsstEpiInput = Omit<
  SgsstEpi,
  "id" | "empresa_id" | "created_at" | "updated_at" | "statusValidadeCa" | "abaixoMinimo"
>;

export interface SgsstEpiEntrega {
  id: string;
  empresa_id: string;
  colaborador_id: string;
  epi_id: string;
  quantidade: number;
  data_entrega: string;
  responsavel_entrega_id?: string | null;
  motivo: MotivoEntregaEpi;
  tamanho_modelo?: string | null;
  confirmacao_recebimento: boolean;
  /** NR-06 6.6.1 "d": orientado quanto ao uso, guarda e conservacao. */
  orientacao_uso?: boolean | null;
  orientacao_observacao?: string | null;
  observacao?: string | null;
  created_at?: string;
  updated_at?: string;
  // Joined Data
  colaborador?: {
    id: string;
    cpf: string;
    /** Nome cadastrado direto no colaborador, usado quando ele não tem profile nem recurso vinculado. */
    nome?: string | null;
    profile?: { id: string; nome: string } | null;
    recurso?: { id: string; nome: string } | null;
    funcao?: { id: string; nome: string } | null;
  } | null;
  epi?: SgsstEpi | null;
  responsavel?: { id: string; nome: string | null } | null;
}

export type SgsstEpiEntregaInput = Omit<
  SgsstEpiEntrega,
  "id" | "empresa_id" | "created_at" | "updated_at" | "colaborador" | "epi" | "responsavel"
>;

export interface SgsstEpiDevolucao {
  id: string;
  empresa_id: string;
  entrega_id: string;
  quantidade_devolvida: number;
  data_devolucao: string;
  responsavel_devolucao_id?: string | null;
  motivo?: string | null;
  condicao_epi: CondicaoDevolucaoEpi;
  observacao?: string | null;
  created_at?: string;
  // Joined Data
  entrega?: SgsstEpiEntrega | null;
  responsavel?: { id: string; nome: string | null } | null;
}

export interface SgsstEpiHistorico {
  id: string;
  empresa_id: string;
  epi_id?: string | null;
  colaborador_id?: string | null;
  usuario_id?: string | null;
  operacao: string;
  quantidade?: number | null;
  observacao?: string | null;
  created_at: string;
  usuario?: { id: string; nome: string | null } | null;
}

// 1. Hook Catálogo & Estoque EPIs
export function useSgsstEpis(params?: { page?: number; pageSize?: number; search?: string; status?: string }) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;
  const page = params?.page ?? 0;
  const pageSize = params?.pageSize ?? 25;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["sgsst_epis", empresaId, page, pageSize, params?.search, params?.status],
    enabled: !!empresaId,
    queryFn: async () => {
      let query = supabase
        .from("sgsst_epis" as any)
        .select("*", { count: "exact" })
        .order("nome", { ascending: true });

      if (params?.search) {
        // Sem escapar, um "%" ou uma virgula na busca quebram o filtro `or` do
        // PostgREST e a tela devolve resultado errado sem avisar.
        const termo = escapeSearchTerm(params.search);
        query = query.or(`nome.ilike.%${termo}%,ca.ilike.%${termo}%`);
      }
      if (params?.status && params.status !== "todos") {
        query = query.eq("status", params.status);
      }

      query = query.range(page * pageSize, page * pageSize + pageSize - 1);

      const { data, error, count } = await (query as any);

      if (error) throw error;

      const rows = ((data || []) as SgsstEpi[]).map((e) => ({
        ...e,
        statusValidadeCa: calculateValidadeCa(e.validade_ca),
        abaixoMinimo: e.estoque_atual <= e.estoque_minimo,
      }));

      return { rows, total: count ?? 0 };
    },
  });

  const createEpi = useMutation({
    mutationFn: async (input: SgsstEpiInput) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data, error } = await (supabase
        .from("sgsst_epis" as any)
        .insert({
          ...input,
          empresa_id: empresaId,
          created_by: profile?.id,
          updated_by: profile?.id,
        })
        .select()
        .single() as any);

      if (error) throw error;

      await supabase.from("sgsst_epi_historico" as any).insert({
        empresa_id: empresaId,
        epi_id: data.id,
        usuario_id: profile?.id,
        operacao: "CRIACAO_EPI",
        observacao: `Cadastro de novo EPI no catálogo: ${data.nome} (CA: ${data.ca})`,
      });

      return data as SgsstEpi;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_epis"] });
      toast.success("EPI cadastrado no catálogo com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao cadastrar EPI: ${err.message || err}`);
    },
  });

  const updateEpi = useMutation({
    mutationFn: async ({ id, ...input }: Partial<SgsstEpiInput> & { id: string }) => {
      const { data, error } = await (supabase
        .from("sgsst_epis" as any)
        .update({
          ...input,
          updated_by: profile?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstEpi;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_epis"] });
      toast.success("EPI atualizado!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar EPI: ${err.message || err}`);
    },
  });

  const removeEpi = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_epis" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_epis"] });
      toast.success("EPI removido do catálogo!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover EPI: ${err.message || err}`);
    },
  });

  return {
    epis: data?.rows ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    refetch,
    createEpi,
    updateEpi,
    removeEpi,
  };
}

/**
 * 2. Hook Entregas de EPI
 *
 * A consulta trazia TODAS as entregas da empresa, sem limite e sem paginacao, com
 * os joins completos (`epi:sgsst_epis(*)`). O PostgREST corta no teto padrao em
 * silencio: passando dele, a tela mostrava uma lista incompleta sem dizer que era
 * incompleta — e entregas de EPI acumulam a cada reposicao de cada trabalhador.
 *
 * Sem `params`, devolve a primeira pagina com o teto explicito (uso como lista de
 * apoio). Com `params`, pagina no servidor.
 */
export function useSgsstEpiEntregas(params?: {
  page?: number;
  pageSize?: number;
  colaboradorId?: string;
}) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const page = params?.page ?? 0;
  const pageSize = params?.pageSize ?? 100;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      "sgsst_epi_entregas",
      empresaId,
      page,
      pageSize,
      params?.colaboradorId ?? null,
    ],
    enabled: !!empresaId,
    queryFn: async () => {
      const consulta = (supabase
        .from("sgsst_epi_entregas" as any)
        .select(`
          *,
          colaborador:sgsst_colaborador_dados(
            id, cpf, nome,
            profile:profiles(id, nome),
            recurso:recursos(id, nome),
            funcao:sgsst_funcoes(id, nome)
          ),
          epi:sgsst_epis(*),
          responsavel:profiles!sgsst_epi_entregas_responsavel_entrega_id_fkey(id, nome)
        `, { count: "exact" })
        .order("data_entrega", { ascending: false }) as any);

      const filtrada = params?.colaboradorId
        ? consulta.eq("colaborador_id", params.colaboradorId)
        : consulta;

      const { data, error, count } = await (filtrada.range(
        page * pageSize,
        page * pageSize + pageSize - 1
      ) as any);

      if (error) throw error;

      const rows = (data as SgsstEpiEntrega[]) || [];
      return { rows, total: count ?? rows.length };
    },
  });

  const entregas = data?.rows ?? [];

  const createEntrega = useMutation({
    mutationFn: async (input: SgsstEpiEntregaInput) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      // Regra de Validação: Não permitir entrega de EPI com CA Vencido
      const { data: epiData } = await (supabase
        .from("sgsst_epis" as any)
        .select("ca, validade_ca, estoque_atual, nome")
        .eq("id", input.epi_id)
        .single() as any);

      if (epiData && epiData.validade_ca) {
        const caStatus = calculateValidadeCa(epiData.validade_ca);
        if (caStatus === "VENCIDO") {
          throw new Error(`Operação Bloqueada: O EPI "${epiData.nome}" está com o Certificado de Aprovação (CA ${epiData.ca}) VENCIDO em ${epiData.validade_ca}. Não é permitida nova entrega.`);
        }
      }

      // Regra de Estoque: Verificar saldo disponível
      if (epiData && epiData.estoque_atual < input.quantidade) {
        throw new Error(`Estoque Insuficiente: O estoque atual do EPI (${epiData.estoque_atual}) é menor que a quantidade solicitada (${input.quantidade}).`);
      }

      const { data: createdEntrega, error } = await (supabase
        .from("sgsst_epi_entregas" as any)
        .insert({
          ...input,
          empresa_id: empresaId,
          responsavel_entrega_id: profile?.id,
        })
        .select()
        .single() as any);

      if (error) throw error;

      // O estoque e movimentado por trigger no banco (trg_sgsst_epi_estoque_entrega).
      // Fazer a conta aqui tambem derrubaria o estoque duas vezes por entrega — e
      // era aqui que estava a corrida: duas entregas simultaneas liam o mesmo
      // valor e a segunda sobrescrevia a primeira.

      // Log no histórico
      await supabase.from("sgsst_epi_historico" as any).insert({
        empresa_id: empresaId,
        epi_id: input.epi_id,
        colaborador_id: input.colaborador_id,
        usuario_id: profile?.id,
        operacao: "ENTREGA_EPI",
        quantidade: input.quantidade,
        observacao: `Entrega de ${input.quantidade} unidade(s) [Motivo: ${input.motivo}]`,
      });

      return createdEntrega as SgsstEpiEntrega;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_epi_entregas"] });
      queryClient.invalidateQueries({ queryKey: ["sgsst_epis"] });
      toast.success("Entrega de EPI registrada com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao registrar entrega de EPI: ${err.message || err}`);
    },
  });

  const removeEntrega = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_epi_entregas" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_epi_entregas"] });
      queryClient.invalidateQueries({ queryKey: ["sgsst_epis"] });
      toast.success("Registro de entrega removido!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover entrega: ${err.message || err}`);
    },
  });

  return {
    entregas,
    total: data?.total ?? 0,
    isLoading,
    error,
    refetch,
    createEntrega,
    removeEntrega,
  };
}

// 3. Hook Devoluções de EPI
/**
 * 3. Hook Devolucoes de EPI
 *
 * Mesma correcao das entregas: a consulta trazia todas as devolucoes da empresa
 * sem limite, com `entrega:...(*, epi:sgsst_epis(*))` dentro. Passando do teto do
 * PostgREST, a lista saia cortada em silencio.
 */
export function useSgsstEpiDevolucoes(params?: { page?: number; pageSize?: number }) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const page = params?.page ?? 0;
  const pageSize = params?.pageSize ?? 100;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["sgsst_epi_devolucoes", empresaId, page, pageSize],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error, count } = await (supabase
        .from("sgsst_epi_devolucoes" as any)
        .select(`
          *,
          entrega:sgsst_epi_entregas(
            *,
            colaborador:sgsst_colaborador_dados(
              id, cpf, nome,
              profile:profiles(id, nome),
              recurso:recursos(id, nome)
            ),
            epi:sgsst_epis(*)
          ),
          responsavel:profiles!sgsst_epi_devolucoes_responsavel_devolucao_id_fkey(id, nome)
        `, { count: "exact" })
        .order("data_devolucao", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1) as any);

      if (error) throw error;

      const rows = (data as SgsstEpiDevolucao[]) || [];
      return { rows, total: count ?? rows.length };
    },
  });

  const devolucoes = data?.rows ?? [];

  const createDevolucao = useMutation({
    mutationFn: async ({
      entregaId,
      quantidadeDevolvida,
      dataDevolucao,
      condicaoEpi,
      motivo,
      observacao,
    }: {
      entregaId: string;
      quantidadeDevolvida: number;
      dataDevolucao: string;
      condicaoEpi: CondicaoDevolucaoEpi;
      motivo?: string;
      observacao?: string;
    }) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data: entregaData } = await (supabase
        .from("sgsst_epi_entregas" as any)
        .select("id, epi_id, colaborador_id, quantidade")
        .eq("id", entregaId)
        .single() as any);

      if (!entregaData) throw new Error("Entrega de origem não encontrada.");

      const { data: createdDev, error } = await (supabase
        .from("sgsst_epi_devolucoes" as any)
        .insert({
          empresa_id: empresaId,
          entrega_id: entregaId,
          quantidade_devolvida: quantidadeDevolvida,
          data_devolucao: dataDevolucao,
          responsavel_devolucao_id: profile?.id,
          motivo: motivo || null,
          condicao_epi: condicaoEpi,
          observacao: observacao || null,
        })
        .select()
        .single() as any);

      if (error) throw error;

      // A reincorporacao ao estoque (so em condicao BOM) e feita por trigger no
      // banco: trg_sgsst_epi_estoque_devolucao.

      // Log no histórico
      await supabase.from("sgsst_epi_historico" as any).insert({
        empresa_id: empresaId,
        epi_id: entregaData.epi_id,
        colaborador_id: entregaData.colaborador_id,
        usuario_id: profile?.id,
        operacao: "DEVOLUCAO_EPI",
        quantidade: quantidadeDevolvida,
        observacao: `Devolução de ${quantidadeDevolvida} unidade(s) [Condição: ${condicaoEpi}]`,
      });

      return createdDev as SgsstEpiDevolucao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_epi_devolucoes"] });
      queryClient.invalidateQueries({ queryKey: ["sgsst_epi_entregas"] });
      queryClient.invalidateQueries({ queryKey: ["sgsst_epis"] });
      toast.success("Devolução de EPI registrada com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao registrar devolução: ${err.message || err}`);
    },
  });

  return {
    devolucoes,
    total: data?.total ?? 0,
    isLoading,
    error,
    refetch,
    createDevolucao,
  };
}

// 4. Hook Histórico e Ficha de Posse do Colaborador
export function useSgsstEpiHistoricoColaborador(colaboradorId?: string) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const { data: historico = [], isLoading } = useQuery({
    queryKey: ["sgsst_epi_historico_colab", colaboradorId],
    enabled: !!empresaId && !!colaboradorId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_epi_historico" as any)
        .select(`
          *,
          usuario:profiles!sgsst_epi_historico_usuario_id_fkey(id, nome),
          epi:sgsst_epis(id, nome, ca)
        `)
        .eq("colaborador_id", colaboradorId!)
        .order("created_at", { ascending: false }) as any);

      if (error) throw error;
      return (data as SgsstEpiHistorico[]) || [];
    },
  });

  return {
    historico,
    isLoading,
  };
}

/**
 * 5. Hook Ficha de EPI de um colaborador
 *
 * A tela pagina entregas e devolucoes, e isso e correto para navegar. Mas a ficha
 * de entrega e do TRABALHADOR e cumulativa: montada a partir da pagina carregada,
 * sairia com as entregas dos ultimos 25 registros da empresa — e faltando
 * justamente as antigas, que sao as que se contesta.
 *
 * Por isso duas consultas proprias, ligadas so quando um colaborador esta
 * selecionado: todas as entregas dele e as devolucoes dessas entregas.
 */
export const FICHA_EPI_LIMITE_LINHAS = 500;

export function useSgsstFichaEpiDoColaborador(
  colaboradorId?: string,
  options?: { enabled?: boolean }
) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const habilitado = !!colaboradorId && !!empresaId && options?.enabled !== false;

  const entregas = useQuery({
    queryKey: ["sgsst_ficha_epi_entregas", colaboradorId],
    enabled: habilitado,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_epi_entregas" as never)
        .select(`
          *,
          colaborador:sgsst_colaborador_dados(
            id, cpf, nome,
            profile:profiles(id, nome),
            recurso:recursos(id, nome),
            funcao:sgsst_funcoes(id, nome)
          ),
          epi:sgsst_epis(*),
          responsavel:profiles!sgsst_epi_entregas_responsavel_entrega_id_fkey(id, nome)
        `)
        .eq("colaborador_id", colaboradorId!)
        .order("data_entrega", { ascending: true })
        .limit(FICHA_EPI_LIMITE_LINHAS) as never as Promise<{
        data: SgsstEpiEntrega[] | null;
        error: { message?: string } | null;
      }>);

      if (error) throw error;
      return data ?? [];
    },
  });

  const idsDasEntregas = (entregas.data ?? []).map((e) => e.id);

  const devolucoes = useQuery({
    // Ordenado para a chave nao mudar so porque a lista chegou em outra ordem.
    queryKey: ["sgsst_ficha_epi_devolucoes", [...idsDasEntregas].sort().join(",")],
    enabled: habilitado && idsDasEntregas.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_epi_devolucoes" as never)
        .select("*, responsavel:profiles!sgsst_epi_devolucoes_responsavel_devolucao_id_fkey(id, nome)")
        .in("entrega_id", idsDasEntregas)
        .order("data_devolucao", { ascending: true })
        .limit(FICHA_EPI_LIMITE_LINHAS) as never as Promise<{
        data: SgsstEpiDevolucao[] | null;
        error: { message?: string } | null;
      }>);

      if (error) throw error;
      return data ?? [];
    },
  });

  return {
    entregas: entregas.data ?? [],
    devolucoes: devolucoes.data ?? [],
    isLoading: entregas.isLoading || devolucoes.isLoading,
    error: entregas.error ?? devolucoes.error,
    truncado: (entregas.data ?? []).length >= FICHA_EPI_LIMITE_LINHAS,
  };
}

/**
 * 6. Higienização, manutenção e inspeção de EPI — NR-06 6.6.1 alínea "f"
 *
 * A norma cobra higienização e manutenção PERIÓDICA. Periódica significa histórico,
 * e por isso é uma tabela e não um campo `ultima_higienizacao` no EPI — que
 * guardaria a última e apagaria justamente a prova da periodicidade.
 *
 * O registro aponta sempre para o EPI e opcionalmente para a entrega: higienizar o
 * lote de máscaras do estoque (sem entrega) e higienizar o cinto que um trabalhador
 * usa (com entrega, e portanto com trabalhador identificado) são os dois casos
 * reais da obra.
 */
export interface SgsstEpiManutencao {
  id: string;
  empresa_id: string;
  epi_id: string;
  /** Nula quando a execução é sobre itens do estoque. */
  entrega_id?: string | null;
  tipo: TipoManutencaoEpi;
  data_execucao: string;
  quantidade: number;
  executado_por_id?: string | null;
  executado_por_nome?: string | null;
  resultado: ResultadoManutencaoEpi;
  proxima_prevista?: string | null;
  observacao?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  // Joined Data
  epi?: SgsstEpi | null;
  entrega?: {
    id: string;
    data_entrega: string;
    colaborador_id: string;
    colaborador?: {
      id: string;
      /** Nome cadastrado direto no colaborador, usado quando ele não tem profile nem recurso vinculado. */
      nome?: string | null;
      profile?: { nome: string } | null;
      recurso?: { nome: string } | null;
    } | null;
  } | null;
  executado_por?: { id: string; nome: string | null } | null;
}

export type SgsstEpiManutencaoInput = Omit<
  SgsstEpiManutencao,
  "id" | "empresa_id" | "created_at" | "updated_at" | "epi" | "entrega" | "executado_por"
>;

export const MANUTENCAO_LIMITE_LINHAS = 500;

export function useSgsstEpiManutencoes(params?: {
  page?: number;
  pageSize?: number;
  epiId?: string;
  /** Ids de entregas — usado pela ficha de um trabalhador. */
  entregaIds?: readonly string[];
  enabled?: boolean;
}) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const page = params?.page ?? 0;
  const pageSize = params?.pageSize ?? 50;

  // Ordenado para a chave do cache não mudar só porque a lista chegou em outra ordem.
  const chaveEntregas = [...(params?.entregaIds ?? [])].sort().join(",");

  const habilitado =
    !!empresaId &&
    params?.enabled !== false &&
    // Filtro por entregas com lista vazia significa "nada a buscar", não "buscar
    // tudo": sem esta guarda, a ficha de um trabalhador sem entrega nenhuma
    // carregaria as execuções da empresa inteira.
    (params?.entregaIds === undefined || params.entregaIds.length > 0);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      "sgsst_epi_manutencoes",
      empresaId,
      page,
      pageSize,
      params?.epiId ?? null,
      chaveEntregas,
    ],
    enabled: habilitado,
    queryFn: async () => {
      type Encadeavel = {
        eq: (coluna: string, valor: string) => Encadeavel;
        in: (coluna: string, valores: string[]) => Encadeavel;
        range: (de: number, ate: number) => unknown;
      };

      const base = supabase
        .from("sgsst_epi_manutencoes" as never)
        .select(
          `*,
           epi:sgsst_epis(id, nome, ca, unidade_medida, exige_higienizacao, higienizacao_periodicidade_dias),
           entrega:sgsst_epi_entregas(
             id, data_entrega, colaborador_id,
             colaborador:sgsst_colaborador_dados(
               id, nome, profile:profiles(nome), recurso:recursos(nome)
             )
           ),
           executado_por:profiles!sgsst_epi_manutencoes_executado_por_id_fkey(id, nome)`,
          { count: "exact" }
        )
        .order("data_execucao", { ascending: false }) as unknown as Encadeavel;

      let consulta = base;
      if (params?.epiId) consulta = consulta.eq("epi_id", params.epiId);
      if (params?.entregaIds && params.entregaIds.length > 0) {
        consulta = consulta.in("entrega_id", [...params.entregaIds]);
      }

      const { data, error, count } = await (consulta.range(
        page * pageSize,
        page * pageSize + pageSize - 1
      ) as never as Promise<{
        data: SgsstEpiManutencao[] | null;
        error: { message?: string } | null;
        count: number | null;
      }>);

      if (error) throw error;

      const rows = data ?? [];
      return { rows, total: count ?? rows.length };
    },
  });

  const createManutencao = useMutation({
    mutationFn: async (input: SgsstEpiManutencaoInput) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      // A tabela e nova e ainda nao esta no `types.ts` gerado, entao o payload vai
      // como `never` — mesmo tratamento das outras tabelas SGSST recem-criadas.
      const payload = {
        ...input,
        empresa_id: empresaId,
        created_by: profile?.id,
      } as never;

      const { data, error } = await (supabase
        .from("sgsst_epi_manutencoes" as never)
        .insert(payload)
        .select()
        .single() as never as Promise<{
        data: SgsstEpiManutencao | null;
        error: { message?: string } | null;
      }>);

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_epi_manutencoes"] });
      // O descarte de itens do estoque movimenta o estoque, por trigger.
      queryClient.invalidateQueries({ queryKey: ["sgsst_epis"] });
      queryClient.invalidateQueries({ queryKey: ["sgsst_epi_historico_colab"] });
      toast.success("Execução registrada!");
    },
    onError: (err: { message?: string }) => {
      toast.error(`Erro ao registrar a execução: ${err.message || err}`);
    },
  });

  const removeManutencao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_epi_manutencoes" as never)
        .delete()
        .eq("id", id) as never as Promise<{ error: { message?: string } | null }>);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_epi_manutencoes"] });
      queryClient.invalidateQueries({ queryKey: ["sgsst_epis"] });
      toast.success("Registro removido.");
    },
    onError: (err: { message?: string }) => {
      toast.error(`Erro ao remover: ${err.message || err}`);
    },
  });

  return {
    manutencoes: data?.rows ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    refetch,
    createManutencao,
    removeManutencao,
  };
}
