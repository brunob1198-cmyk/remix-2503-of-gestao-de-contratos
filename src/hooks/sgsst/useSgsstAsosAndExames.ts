import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { escapeSearchTerm } from "@/utils/sgsstSearch";
import { parseISO, isBefore, isAfter, addDays, startOfDay } from "date-fns";

export type TipoExameOcupacional =
  | "Admissional"
  | "Periódico"
  | "Retorno ao Trabalho"
  | "Mudança de Risco/Função"
  | "Demissional"
  | "Complementar"
  | "Outros";

export type StatusExameOcupacional = "PENDENTE" | "AGENDADO" | "REALIZADO" | "CANCELADO";

/**
 * O relatório analítico (NR-07 7.6.2) conta exames clínicos e complementares
 * separadamente. O `tipo` que já existia é a ocasião (admissional, periódico...),
 * não a natureza.
 */
export type NaturezaExame = "CLINICO" | "COMPLEMENTAR";

/**
 * Classificação contável do achado. O `resultado` em texto livre continua para o
 * detalhe clínico — a classificação é para estatística, não substitui o laudo.
 */
export type ClassificacaoResultado = "NORMAL" | "ALTERADO" | "INCONCLUSIVO";

export const CLASSIFICACAO_LABEL: Record<ClassificacaoResultado, string> = {
  NORMAL: "Normal",
  ALTERADO: "Alterado",
  INCONCLUSIVO: "Inconclusivo",
};

// A aptidao mora em src/utils/sgsstAptidaoAso.ts, junto das regras que dizem o
// que cada estado autoriza. Reexportado aqui porque as telas importam daqui.
export type { AptidaoAso, AptidaoAtividade } from "@/utils/sgsstAptidaoAso";
import type {
  AptidaoAso as AptidaoAsoTipo,
  AptidaoAtividade as AptidaoAtividadeTipo,
} from "@/utils/sgsstAptidaoAso";

export type StatusAso = "ATIVO" | "SUBSTITUIDO" | "CANCELADO";

export type StatusVencimentoAso = "VALIDO" | "PROXIMO_VENCIMENTO" | "VENCIDO";

export interface SgsstExame {
  id: string;
  empresa_id: string;
  colaborador_id: string;
  pcmso_id?: string | null;
  pcmso_exame_id?: string | null;
  nome_exame: string;
  tipo: TipoExameOcupacional;
  data_solicitacao: string;
  data_realizacao?: string | null;
  /** Detalhe clínico em texto livre. Não entra na contagem do relatório. */
  resultado?: string | null;
  /** Classificação contável do achado. NULL = ainda não classificado. */
  resultado_classificacao?: ClassificacaoResultado | null;
  /** CLINICO = a consulta. COMPLEMENTAR = exame de apoio. */
  natureza?: NaturezaExame | null;
  medico_responsavel?: string | null;
  observacoes?: string | null;
  status: StatusExameOcupacional;
  /**
   * Clínica credenciada que vai realizar o exame.
   *
   * A coluna existe no banco desde a migration de clínicas, mas ficou sem tipo e
   * sem campo no formulário — então a guia de encaminhamento nunca conseguia
   * imprimir o endereço, e a fila de convocação nunca conseguia mostrar um exame
   * como agendado. Três colunas gravadas por ninguém.
   */
  clinica_id?: string | null;
  /** Data marcada na clínica. É ela que a fila de convocação lê como "agendado". */
  data_agendada?: string | null;
  hora_agendada?: string | null;
  created_at?: string;
  updated_at?: string;
  // Joined Data
  colaborador?: {
    id: string;
    cpf: string;
    /** NR-07 7.5.15.1 "a" pede o numero de registro de identidade, nao so o CPF. */
    rg?: string | null;
    /** Nome cadastrado direto no colaborador, usado quando ele não tem profile nem recurso vinculado. */
    nome?: string | null;
    profile?: { id: string; nome: string } | null;
    recurso?: { id: string; nome: string } | null;
    funcao?: { id: string; nome: string } | null;
  } | null;
  pcmso?: { id: string; codigo: string; titulo: string } | null;
}

export type SgsstExameInput = Omit<
  SgsstExame,
  "id" | "empresa_id" | "created_at" | "updated_at" | "colaborador" | "pcmso"
>;

export interface SgsstAso {
  id: string;
  empresa_id: string;
  colaborador_id: string;
  exame_id?: string | null;
  pcmso_id?: string | null;
  numero_documento?: string | null;
  data_emissao: string;
  tipo: TipoExameOcupacional;
  /**
   * Conclusao medica de aptidao. NULA = o medico ainda nao concluiu.
   *
   * A coluna nascia `NOT NULL DEFAULT APTO`, o que fazia todo ASO criado sem
   * tocar no campo afirmar que o trabalhador esta apto — a unica afirmacao do
   * documento que so um medico pode fazer, feita pelo sistema por omissao.
   */
  aptidao?: AptidaoAsoTipo | null;
  validade: string;
  /** Aptidao por atividade. NULL = nao avaliado; NAO_SE_APLICA nao e inapto. */
  apto_altura?: AptidaoAtividadeTipo | null;
  apto_espaco_confinado?: AptidaoAtividadeTipo | null;
  apto_maquinas?: AptidaoAtividadeTipo | null;
  /** Codigos do catalogo de agentes de risco. Vazio = nao preenchido. */
  riscos_marcados?: string[] | null;
  /** Afirmacao expressa de inexistencia de risco (NR-07 7.5.15.1 "b"). */
  sem_risco_especifico?: boolean | null;
  unidade?: string | null;
  /** Funcao para a qual esta sendo avaliado, no exame de mudanca de funcao. */
  nova_funcao?: string | null;
  /** Data do exame clinico, distinta da emissao e das datas dos complementares. */
  data_exame_clinico?: string | null;
  /** Médico EXAMINADOR: quem realizou o exame e assina o ASO. */
  medico_responsavel?: string | null;
  crm_medico?: string | null;
  /** Médico COORDENADOR do PCMSO. A norma pede os dois; podem ser pessoas diferentes. */
  medico_coordenador?: string | null;
  crm_coordenador?: string | null;
  /** NR-07: descrição dos perigos e fatores de risco. Obrigatória no documento. */
  descricao_riscos?: string | null;
  /**
   * Identificação da organização congelada na emissão. Ler de `empresas` na hora
   * de imprimir falsearia ASOs antigos se a empresa mudasse de nome.
   */
  empresa_nome?: string | null;
  empresa_cnpj?: string | null;
  descricao_restricao?: string | null;
  data_inicio_restricao?: string | null;
  data_termino_restricao?: string | null;
  observacoes?: string | null;
  status: StatusAso;
  created_at?: string;
  updated_at?: string;
  // Joined Data
  colaborador?: {
    id: string;
    cpf: string;
    /** NR-07 7.5.15.1 "a" pede o número de registro de identidade, não só o CPF. */
    rg?: string | null;
    /** Nome cadastrado direto no colaborador, usado quando ele não tem profile nem recurso vinculado. */
    nome?: string | null;
    profile?: { id: string; nome: string } | null;
    recurso?: { id: string; nome: string } | null;
    funcao?: { id: string; nome: string } | null;
  } | null;
  pcmso?: { id: string; codigo: string; titulo: string } | null;
  /** @deprecated Vínculo de exame único. Use `exames` (tabela de ligação). */
  exame?: { id: string; nome_exame: string; data_realizacao: string } | null;
  /** Todos os exames que compõem este ASO, via sgsst_aso_exames. */
  exames?: SgsstAsoExameVinculo[];
  // Calculated dynamically
  statusVencimento?: StatusVencimentoAso;
}

/** Linha da tabela de ligação, com o exame embutido. */
export interface SgsstAsoExameVinculo {
  id: string;
  aso_id: string;
  exame_id: string;
  exame?: {
    id: string;
    nome_exame: string;
    tipo: TipoExameOcupacional;
    data_realizacao: string | null;
    resultado: string | null;
    status: StatusExameOcupacional;
  } | null;
}

export type SgsstAsoInput = Omit<
  SgsstAso,
  "id" | "empresa_id" | "created_at" | "updated_at" | "colaborador" | "pcmso" | "exame" | "statusVencimento"
>;

export interface SgsstAsoHistorico {
  id: string;
  empresa_id: string;
  aso_id: string;
  usuario_id?: string | null;
  operacao: string;
  status_anterior?: string | null;
  novo_status: string;
  observacao?: string | null;
  created_at: string;
  usuario?: { id: string; nome: string | null } | null;
}

import { calculateVencimentoAso } from "@/utils/sgsstAsoUtils";

export { calculateVencimentoAso };

// Hook for Exames Ocupacionais
export interface SgsstExamesParams {
  page?: number;
  pageSize?: number;
  /** Busca no nome do exame e no medico responsavel. */
  search?: string;
  status?: string;
}

/** Teto para o uso como lista de apoio (select do dialogo de ASO). */
export const EXAMES_LISTA_LIMITE = 1000;

/**
 * Sem `params`, devolve a lista inteira (uso como lista de apoio).
 * Com `params`, pagina e filtra no servidor (uso na aba de Exames).
 */
export function useSgsstExames(params?: SgsstExamesParams) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const paginado = !!params;
  const page = params?.page ?? 0;
  const pageSize = params?.pageSize ?? 25;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      "sgsst_exames",
      empresaId,
      paginado ? page : "all",
      paginado ? pageSize : "all",
      params?.search ?? "",
      params?.status ?? "",
    ],
    enabled: !!empresaId,
    queryFn: async () => {
      let query = supabase
        .from("sgsst_exames" as any)
        .select(
          `
          *,
          colaborador:sgsst_colaborador_dados(
            id, cpf, rg, nome,
            profile:profiles(id, nome),
            recurso:recursos(id, nome),
            funcao:sgsst_funcoes(id, nome)
          ),
          pcmso:sgsst_pcmso(id, codigo, titulo)
        `,
          { count: "exact" }
        )
        .order("created_at", { ascending: false });

      if (params?.search) {
        const term = escapeSearchTerm(params.search);
        if (term) {
          query = query.or(
            `nome_exame.ilike.%${term}%,medico_responsavel.ilike.%${term}%`
          );
        }
      }

      if (params?.status && params.status !== "todos") {
        query = query.eq("status", params.status);
      }

      query = paginado
        ? query.range(page * pageSize, page * pageSize + pageSize - 1)
        : query.limit(EXAMES_LISTA_LIMITE);

      const { data, error, count } = await (query as any);
      if (error) throw error;

      const rows = (data as SgsstExame[]) || [];
      return { rows, total: count ?? rows.length };
    },
  });

  const exames = data?.rows ?? [];

  const createExame = useMutation({
    mutationFn: async (input: SgsstExameInput) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data, error } = await (supabase
        .from("sgsst_exames" as any)
        .insert({
          ...input,
          empresa_id: empresaId,
        })
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstExame;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_exames"] });
      // A fila de convocacao e DERIVADA dos exames: sem esta linha ela continuava
      // mandando convocar quem acabou de ser convocado, ate o cache expirar.
      queryClient.invalidateQueries({ queryKey: ["sgsst_convocacao"] });
      toast.success("Exame Ocupacional solicitado com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao solicitar exame: ${err.message || err}`);
    },
  });

  const updateExame = useMutation({
    mutationFn: async ({ id, ...input }: Partial<SgsstExameInput> & { id: string }) => {
      const { data, error } = await (supabase
        .from("sgsst_exames" as any)
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstExame;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_exames"] });
      // A fila de convocacao e DERIVADA dos exames: sem esta linha ela continuava
      // mandando convocar quem acabou de ser convocado, ate o cache expirar.
      queryClient.invalidateQueries({ queryKey: ["sgsst_convocacao"] });
      toast.success("Exame Ocupacional atualizado com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar exame: ${err.message || err}`);
    },
  });

  const removeExame = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_exames" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_exames"] });
      // A fila de convocacao e DERIVADA dos exames: sem esta linha ela continuava
      // mandando convocar quem acabou de ser convocado, ate o cache expirar.
      queryClient.invalidateQueries({ queryKey: ["sgsst_convocacao"] });
      toast.success("Exame Ocupacional removido!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover exame: ${err.message || err}`);
    },
  });

  return {
    exames,
    total: data?.total ?? 0,
    isLoading,
    error,
    refetch,
    createExame,
    updateExame,
    removeExame,
  };
}

// Hook for ASOs
export interface SgsstAsosParams {
  page?: number;
  pageSize?: number;
  /** Busca no numero do documento do ASO. */
  search?: string;
  tipo?: string;
  aptidao?: string;
  colaboradorId?: string;
  pcmsoId?: string;
  /** "VALIDO" | "PROXIMO_VENCIMENTO" | "VENCIDO" */
  vencimento?: string;
}

/** Mesma janela de 30 dias usada por calculateVencimentoAso. */
const DIAS_AVISO_VENCIMENTO = 30;

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * ASOs crescem por colaborador e por ano — e a consulta nao tinha limite algum,
 * entao a partir de ~1000 registros o PostgREST passava a cortar em silencio.
 * Agora pagina no servidor, com todos os filtros aplicados antes do corte.
 */
export function useSgsstAsos(params?: SgsstAsosParams) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const paginado = !!params;
  const page = params?.page ?? 0;
  const pageSize = params?.pageSize ?? 25;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      "sgsst_asos",
      empresaId,
      paginado ? page : "all",
      paginado ? pageSize : "all",
      params?.search ?? "",
      params?.tipo ?? "",
      params?.aptidao ?? "",
      params?.colaboradorId ?? "",
      params?.pcmsoId ?? "",
      params?.vencimento ?? "",
    ],
    enabled: !!empresaId,
    queryFn: async () => {
      let query = supabase
        .from("sgsst_asos" as any)
        .select(
          `
          *,
          colaborador:sgsst_colaborador_dados(
            id, cpf, rg, nome,
            profile:profiles(id, nome),
            recurso:recursos(id, nome),
            funcao:sgsst_funcoes(id, nome)
          ),
          pcmso:sgsst_pcmso(id, codigo, titulo),
          exame:sgsst_exames(id, nome_exame, data_realizacao),
          exames:sgsst_aso_exames(
            id, aso_id, exame_id,
            exame:sgsst_exames(id, nome_exame, tipo, data_realizacao, resultado, status)
          )
        `,
          { count: "exact" }
        )
        .order("data_emissao", { ascending: false });

      if (params?.search) {
        const term = escapeSearchTerm(params.search);
        if (term) query = query.ilike("numero_documento", `%${term}%`);
      }

      if (params?.tipo && params.tipo !== "todos") query = query.eq("tipo", params.tipo);
      if (params?.aptidao && params.aptidao !== "todos")
        query = query.eq("aptidao", params.aptidao);
      if (params?.colaboradorId && params.colaboradorId !== "todos")
        query = query.eq("colaborador_id", params.colaboradorId);
      if (params?.pcmsoId && params.pcmsoId !== "todos")
        query = query.eq("pcmso_id", params.pcmsoId);

      // O status de vencimento e derivado de `validade`, entao filtra por faixa
      // de data em vez de depender do calculo feito no cliente — assim o filtro
      // vale para a base inteira e nao so para a pagina carregada.
      if (params?.vencimento && params.vencimento !== "todos") {
        const hoje = new Date();
        const limite = new Date(hoje);
        limite.setDate(limite.getDate() + DIAS_AVISO_VENCIMENTO);

        if (params.vencimento === "VENCIDO") {
          query = query.lt("validade", isoDate(hoje));
        } else if (params.vencimento === "PROXIMO_VENCIMENTO") {
          query = query.gte("validade", isoDate(hoje)).lte("validade", isoDate(limite));
        } else if (params.vencimento === "VALIDO") {
          query = query.gt("validade", isoDate(limite));
        }
      }

      query = paginado
        ? query.range(page * pageSize, page * pageSize + pageSize - 1)
        : query.limit(1000);

      const { data, error, count } = await (query as any);
      if (error) throw error;

      const rows = ((data || []) as SgsstAso[]).map((aso) => ({
        ...aso,
        statusVencimento: calculateVencimentoAso(aso.validade),
      }));

      return { rows, total: count ?? rows.length };
    },
  });

  const asos = data?.rows ?? [];

  const createAso = useMutation({
    mutationFn: async (params: SgsstAsoInput & { exameIds?: string[] }) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      // exameIds vai para a tabela de ligação, não para a linha do ASO.
      const { exameIds = [], ...input } = params;

      // Regra de Integridade e Substituição: se existir ASO ATIVO para o mesmo colaborador, substitui
      const { data: activeAsos } = await (supabase
        .from("sgsst_asos" as any)
        .select("id")
        .eq("empresa_id", empresaId)
        .eq("colaborador_id", input.colaborador_id)
        .eq("status", "ATIVO") as any);

      if (activeAsos && activeAsos.length > 0) {
        for (const oldAso of activeAsos) {
          await supabase
            .from("sgsst_asos" as any)
            .update({ status: "SUBSTITUIDO", updated_at: new Date().toISOString() })
            .eq("id", oldAso.id);

          await supabase.from("sgsst_asos_historico" as any).insert({
            empresa_id: empresaId,
            aso_id: oldAso.id,
            usuario_id: profile?.id,
            operacao: "SUBSTITUICAO",
            status_anterior: "ATIVO",
            novo_status: "SUBSTITUIDO",
            observacao: "Substituído por novo ASO emitido.",
          });
        }
      }

      // Congela a identificação da organização na emissão. Ler de `empresas` na
      // hora de imprimir falsearia ASOs antigos se a empresa mudasse de nome.
      const { data: empresaAtual } = await supabase
        .from("empresas")
        .select("nome, cnpj")
        .eq("id", empresaId)
        .maybeSingle();

      const { data: createdAso, error } = await (supabase
        .from("sgsst_asos" as any)
        .insert({
          ...input,
          empresa_id: empresaId,
          empresa_nome: input.empresa_nome ?? empresaAtual?.nome ?? null,
          empresa_cnpj: input.empresa_cnpj ?? empresaAtual?.cnpj ?? null,
        })
        .select()
        .single() as any);

      if (error) throw error;

      // Vincula os exames que compõem este ASO. O erro é checado: sem os exames
      // o documento sai sem a indicação e data dos exames realizados, que é campo
      // obrigatório.
      if (exameIds.length > 0) {
        const { error: vinculoError } = await supabase
          .from("sgsst_aso_exames" as never)
          .insert(
            exameIds.map((exameId) => ({
              empresa_id: empresaId,
              aso_id: createdAso.id,
              exame_id: exameId,
            })) as never
          );

        if (vinculoError) throw vinculoError;
      }

      // Log inicial no histórico
      await supabase.from("sgsst_asos_historico" as any).insert({
        empresa_id: empresaId,
        aso_id: createdAso.id,
        usuario_id: profile?.id,
        operacao: "EMISSAO",
        status_anterior: null,
        novo_status: createdAso.status,
        observacao: `Emissão do ASO [Aptidão: ${createdAso.aptidao}]`,
      });

      // Todo exame que entrou no ASO passa a REALIZADO: emitir o atestado
      // significa que o exame aconteceu. Inclui o vínculo antigo de exame único,
      // para o comportamento não mudar em quem só usa um.
      const exameIdsParaRealizar = [
        ...new Set([...(input.exame_id ? [input.exame_id] : []), ...exameIds]),
      ];

      if (exameIdsParaRealizar.length > 0) {
        await supabase
          .from("sgsst_exames" as any)
          .update({ status: "REALIZADO", data_realizacao: input.data_emissao })
          .in("id", exameIdsParaRealizar);
      }

      return createdAso as SgsstAso;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_asos"] });
      queryClient.invalidateQueries({ queryKey: ["sgsst_exames"] });
      // A fila de convocacao e DERIVADA dos exames: sem esta linha ela continuava
      // mandando convocar quem acabou de ser convocado, ate o cache expirar.
      queryClient.invalidateQueries({ queryKey: ["sgsst_convocacao"] });
      toast.success("ASO emitido com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao emitir ASO: ${err.message || err}`);
    },
  });

  const updateAso = useMutation({
    mutationFn: async ({
      id,
      exameIds,
      ...input
    }: Partial<SgsstAsoInput> & { id: string; exameIds?: string[] }) => {
      const { data, error } = await (supabase
        .from("sgsst_asos" as any)
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;

      // Reconcilia os vínculos de exame. `undefined` significa "não mexer";
      // um array vazio significa "remover todos" — são coisas diferentes.
      if (exameIds !== undefined) {
        const { data: atuais, error: leituraError } = await supabase
          .from("sgsst_aso_exames" as never)
          .select("id, exame_id")
          .eq("aso_id", id);

        if (leituraError) throw leituraError;

        // `sgsst_aso_exames` é nova e ainda não está em types.ts; o cast cai
        // quando os tipos forem regerados após esta migration.
        const existentes = (atuais ?? []) as unknown as { id: string; exame_id: string }[];
        const idsAtuais = new Set(existentes.map((v) => v.exame_id));
        const idsDesejados = new Set(exameIds);

        const paraRemover = existentes.filter((v) => !idsDesejados.has(v.exame_id));
        const paraAdicionar = exameIds.filter((x) => !idsAtuais.has(x));

        if (paraRemover.length > 0) {
          const { error: delError } = await supabase
            .from("sgsst_aso_exames" as never)
            .delete()
            .in("id", paraRemover.map((v) => v.id));
          if (delError) throw delError;
        }

        if (paraAdicionar.length > 0) {
          const { error: insError } = await supabase
            .from("sgsst_aso_exames" as never)
            .insert(
              paraAdicionar.map((exameId) => ({
                empresa_id: (data as SgsstAso).empresa_id,
                aso_id: id,
                exame_id: exameId,
              })) as never
            );
          if (insError) throw insError;
        }
      }

      return data as SgsstAso;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_asos"] });
      queryClient.invalidateQueries({ queryKey: ["sgsst_exames"] });
      // A fila de convocacao e DERIVADA dos exames: sem esta linha ela continuava
      // mandando convocar quem acabou de ser convocado, ate o cache expirar.
      queryClient.invalidateQueries({ queryKey: ["sgsst_convocacao"] });
      toast.success("ASO atualizado!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar ASO: ${err.message || err}`);
    },
  });

  const cancelAso = useMutation({
    mutationFn: async ({ id, observacao }: { id: string; observacao?: string }) => {
      const { data, error } = await (supabase
        .from("sgsst_asos" as any)
        .update({
          status: "CANCELADO",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;

      // Log no histórico
      await supabase.from("sgsst_asos_historico" as any).insert({
        empresa_id: empresaId,
        aso_id: id,
        usuario_id: profile?.id,
        operacao: "CANCELAMENTO",
        status_anterior: "ATIVO",
        novo_status: "CANCELADO",
        observacao: observacao || "ASO cancelado formalmente.",
      });

      return data as SgsstAso;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_asos"] });
      queryClient.invalidateQueries({ queryKey: ["sgsst_asos_historico"] });
      toast.success("ASO cancelado!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao cancelar ASO: ${err.message || err}`);
    },
  });

  const removeAso = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_asos" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_asos"] });
      toast.success("ASO removido!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover ASO: ${err.message || err}`);
    },
  });

  return {
    asos,
    total: data?.total ?? 0,
    isLoading,
    error,
    refetch,
    createAso,
    updateAso,
    cancelAso,
    removeAso,
  };
}

// Hook for Histórico ASO
export function useSgsstAsoHistorico(asoId?: string) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const { data: historico = [], isLoading } = useQuery({
    queryKey: ["sgsst_asos_historico", asoId],
    enabled: !!asoId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_asos_historico" as any)
        .select(`
          *,
          usuario:profiles!sgsst_asos_historico_usuario_id_fkey(id, nome)
        `)
        .eq("aso_id", asoId!)
        .order("created_at", { ascending: false }) as any);

      if (error) throw error;
      return (data as SgsstAsoHistorico[]) || [];
    },
  });

  return {
    historico,
    isLoading,
  };
}

/**
 * ASO vigente de cada trabalhador, para o portão de aptidão da PT.
 *
 * Uma consulta para a lista inteira, e não uma por trabalhador: a PT precisa
 * conferir a equipe toda mais o candidato que está sendo autorizado, e N consultas
 * numa tela com dez pessoas é desperdício.
 *
 * Devolve `undefined` para trabalhador sem ASO e `null` enquanto não carregou —
 * distinção que o portão usa: sem ASO é impedimento, carregando não é.
 */
export function useSgsstAsoVigente(colaboradorIds: readonly string[]) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const ids = [...new Set(colaboradorIds.filter(Boolean))].sort();

  const { data, isLoading, error } = useQuery({
    queryKey: ["sgsst_asos", "vigente", empresaId, ids.join(",")],
    enabled: !!empresaId && ids.length > 0,
    queryFn: async () => {
      const { data, error } = (await (supabase
        .from("sgsst_asos" as never)
        .select(
          "id, colaborador_id, aptidao, apto_altura, apto_espaco_confinado, apto_maquinas, validade, status, data_emissao"
        )
        .in("colaborador_id", ids)
        .eq("status", "ATIVO")
        .order("data_emissao", { ascending: false }) as never as Promise<{
        data: SgsstAso[] | null;
        error: { message?: string } | null;
      }>));
      if (error) throw error;
      return data ?? [];
    },
  });

  /**
   * `null` enquanto carrega; `undefined` quando o trabalhador não tem ASO ativo.
   *
   * Vence o mais RECENTE por data de emissão — a consulta já vem ordenada, então
   * o primeiro de cada trabalhador é o vigente.
   */
  const asoDe = (colaboradorId: string): SgsstAso | null | undefined => {
    if (!data) return null;
    return data.find((a) => a.colaborador_id === colaboradorId);
  };

  return { asoDe, isLoading, temErro: !!error };
}
