import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/**
 * Vínculos de uma função: riscos, treinamentos e EPIs.
 *
 * Antes as sete referências a `sgsst_funcoes` apontavam todas para dentro dela —
 * colaborador tem função, APR tem função, PT tem função. Não havia o contrário,
 * então ninguém conseguia responder "quem exerce esta função está exposto a quê,
 * e precisa de qual treinamento e de qual EPI".
 *
 * Na prática essa informação era digitada três vezes, em três telas, sem nada
 * garantindo que as três concordassem. É também o conjunto que o eSocial S-2240
 * exige.
 */

export type TipoExposicao = "HABITUAL" | "OCASIONAL" | "EVENTUAL";

/** Do mais frequente ao mais raro — a ordem em que aparecem em qualquer select. */
export const TIPOS_EXPOSICAO: readonly TipoExposicao[] = [
  "HABITUAL",
  "OCASIONAL",
  "EVENTUAL",
];

export const TIPO_EXPOSICAO_LABEL: Record<TipoExposicao, string> = {
  HABITUAL: "Habitual",
  OCASIONAL: "Ocasional",
  EVENTUAL: "Eventual",
};

export const TIPO_EXPOSICAO_AJUDA: Record<TipoExposicao, string> = {
  HABITUAL: "Parte rotineira da atividade — acontece em todo dia de trabalho.",
  OCASIONAL: "Acontece com regularidade previsível, mas não é rotina diária.",
  EVENTUAL: "Raro e não programado. Ainda precisa constar no inventário.",
};

/** As três tabelas de ligação da função. */
export type TabelaVinculo =
  | "sgsst_funcao_riscos"
  | "sgsst_funcao_treinamentos"
  | "sgsst_funcao_epis";

export interface FuncaoRisco {
  id: string;
  empresa_id: string;
  funcao_id: string;
  risco_catalogo_id: string;
  tipo_exposicao: TipoExposicao;
  tempo_exposicao?: string | null;
  observacoes?: string | null;
  risco?: {
    id: string;
    codigo?: string | null;
    nome: string;
    categoria: string;
    agente?: string | null;
    limite_tolerancia?: number | null;
    unidade_medida?: string | null;
    tecnica_avaliacao?: string | null;
  } | null;
}

export interface FuncaoTreinamento {
  id: string;
  empresa_id: string;
  funcao_id: string;
  treinamento_id: string;
  obrigatorio: boolean;
  observacoes?: string | null;
  treinamento?: {
    id: string;
    codigo?: string | null;
    nome: string;
    categoria: string;
    carga_horaria: number;
    validade_meses?: number | null;
  } | null;
}

export interface FuncaoEpi {
  id: string;
  empresa_id: string;
  funcao_id: string;
  epi_id: string;
  obrigatorio: boolean;
  quantidade_padrao: number;
  periodicidade_troca_meses?: number | null;
  observacoes?: string | null;
  epi?: {
    id: string;
    codigo?: string | null;
    nome: string;
    categoria: string;
    ca: string;
    validade_ca?: string | null;
  } | null;
}

/** Erro do PostgREST no formato mínimo que precisamos inspecionar. */
interface ErroConsulta {
  message?: string;
  code?: string;
}

const SELECT_POR_TABELA: Record<TabelaVinculo, string> = {
  sgsst_funcao_riscos:
    "*, risco:sgsst_riscos_catalogo(id, codigo, nome, categoria, agente, limite_tolerancia, unidade_medida, tecnica_avaliacao)",
  sgsst_funcao_treinamentos:
    "*, treinamento:sgsst_treinamentos(id, codigo, nome, categoria, carga_horaria, validade_meses)",
  sgsst_funcao_epis: "*, epi:sgsst_epis(id, codigo, nome, categoria, ca, validade_ca)",
};

async function buscarVinculos<T>(tabela: TabelaVinculo, funcaoId: string): Promise<T[]> {
  const { data, error } = await (supabase
    .from(tabela as never)
    .select(SELECT_POR_TABELA[tabela])
    .eq("funcao_id", funcaoId)
    .order("created_at", { ascending: true }) as never as Promise<{
    data: T[] | null;
    error: ErroConsulta | null;
  }>);

  if (error) throw error;
  return data ?? [];
}

function mensagemErro(err: unknown, acao: string): string {
  const erro = err as ErroConsulta;
  // 23505 = índice único (funcao_id, X): o item já está na lista.
  if (erro?.code === "23505") return "Este item já está vinculado a esta função.";
  // A mensagem do trigger de tenant já é legível; repassamos como está.
  if (erro?.message) return erro.message;
  return `Não foi possível ${acao}.`;
}

export interface ResumoVinculos {
  riscos: number;
  treinamentos: number;
  epis: number;
}

const TABELAS: readonly TabelaVinculo[] = [
  "sgsst_funcao_riscos",
  "sgsst_funcao_treinamentos",
  "sgsst_funcao_epis",
];

const CHAVE_RESUMO: Record<TabelaVinculo, keyof ResumoVinculos> = {
  sgsst_funcao_riscos: "riscos",
  sgsst_funcao_treinamentos: "treinamentos",
  sgsst_funcao_epis: "epis",
};

/**
 * Quantos vínculos cada função da página tem.
 *
 * Consulta separada da lista de funções de propósito: se as tabelas de ligação
 * ainda não existirem no banco, a lista de funções continua abrindo — só os
 * contadores ficam indisponíveis.
 */
export function useSgsstFuncaoVinculosResumo(funcaoIds: readonly string[]) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  // Ordenado para a chave de cache não mudar só porque a ordem da página mudou.
  const chaveIds = [...funcaoIds].sort().join(",");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["sgsst_funcao_vinculos_resumo", empresaId, chaveIds],
    enabled: !!empresaId && funcaoIds.length > 0,
    staleTime: 1000 * 30,
    queryFn: async () => {
      const porFuncao: Record<string, ResumoVinculos> = {};
      for (const id of funcaoIds) porFuncao[id] = { riscos: 0, treinamentos: 0, epis: 0 };

      const indisponiveis: TabelaVinculo[] = [];

      await Promise.all(
        TABELAS.map(async (tabela) => {
          const { data, error } = await (supabase
            .from(tabela as never)
            .select("funcao_id")
            .in("funcao_id", funcaoIds as string[]) as never as Promise<{
            data: { funcao_id: string }[] | null;
            error: ErroConsulta | null;
          }>);

          // Falha de uma tabela não zera as outras duas. Zero e "não deu para
          // contar" são coisas diferentes e a tela precisa distinguir.
          if (error) {
            indisponiveis.push(tabela);
            return;
          }

          for (const linha of data ?? []) {
            const alvo = porFuncao[linha.funcao_id];
            if (alvo) alvo[CHAVE_RESUMO[tabela]] += 1;
          }
        })
      );

      return { porFuncao, indisponiveis };
    },
  });

  const vazio: ResumoVinculos = { riscos: 0, treinamentos: 0, epis: 0 };

  return {
    resumo: (funcaoId: string): ResumoVinculos => data?.porFuncao[funcaoId] ?? vazio,
    /** True quando nenhuma das três tabelas pôde ser lida. */
    indisponivel: (data?.indisponiveis.length ?? 0) === TABELAS.length,
    indisponiveis: data?.indisponiveis ?? [],
    isLoading,
    error,
    refetch,
  };
}

export function useSgsstFuncaoVinculos(funcaoId: string | null) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const habilitado = !!empresaId && !!funcaoId;

  // Uma query por tipo de vínculo, não uma só com três embeds: assim a falha de
  // um não apaga os outros dois, e o painel mostra o que conseguiu carregar.
  const riscos = useQuery({
    queryKey: ["sgsst_funcao_riscos", funcaoId, empresaId],
    enabled: habilitado,
    queryFn: () => buscarVinculos<FuncaoRisco>("sgsst_funcao_riscos", funcaoId as string),
  });

  const treinamentos = useQuery({
    queryKey: ["sgsst_funcao_treinamentos", funcaoId, empresaId],
    enabled: habilitado,
    queryFn: () =>
      buscarVinculos<FuncaoTreinamento>("sgsst_funcao_treinamentos", funcaoId as string),
  });

  const epis = useQuery({
    queryKey: ["sgsst_funcao_epis", funcaoId, empresaId],
    enabled: habilitado,
    queryFn: () => buscarVinculos<FuncaoEpi>("sgsst_funcao_epis", funcaoId as string),
  });

  /**
   * Invalida por prefixo. As chaves começam com o nome da tabela, então isto
   * revalida tanto o painel aberto quanto os contadores da lista de funções e o
   * quadro de pendências.
   */
  const invalidar = (tabela: TabelaVinculo) => {
    queryClient.invalidateQueries({ queryKey: [tabela] });
    queryClient.invalidateQueries({ queryKey: ["sgsst_funcao_vinculos_resumo"] });
    queryClient.invalidateQueries({ queryKey: ["sgsst_funcao_pendencias"] });
  };

  /**
   * Uma mutation para as três tabelas, com a tabela vindo no argumento.
   *
   * A alternativa — um trio de mutations por tabela — exigiria chamar
   * `useMutation` dentro de função auxiliar, o que quebra a regra de ordem dos
   * hooks e rende nove mutations quase idênticas.
   */
  const adicionar = useMutation({
    mutationFn: async ({
      tabela,
      dados,
    }: {
      tabela: TabelaVinculo;
      dados: Record<string, unknown>;
    }) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");
      if (!funcaoId) throw new Error("Função não selecionada.");

      const { error } = await (supabase.from(tabela as never).insert({
        ...dados,
        funcao_id: funcaoId,
        empresa_id: empresaId,
        created_by: profile?.id,
      } as never) as never as Promise<{ error: ErroConsulta | null }>);

      if (error) throw error;
      return tabela;
    },
    onSuccess: (tabela) => {
      invalidar(tabela);
      toast.success("Vínculo adicionado à função.");
    },
    onError: (err: unknown) => toast.error(mensagemErro(err, "adicionar o vínculo")),
  });

  const atualizar = useMutation({
    mutationFn: async ({
      tabela,
      id,
      campos,
    }: {
      tabela: TabelaVinculo;
      id: string;
      campos: Record<string, unknown>;
    }) => {
      const { error } = await (supabase
        .from(tabela as never)
        .update({ ...campos, updated_at: new Date().toISOString() } as never)
        .eq("id", id) as never as Promise<{ error: ErroConsulta | null }>);

      if (error) throw error;
      return tabela;
    },
    onSuccess: (tabela) => {
      invalidar(tabela);
      // Confirma a gravação. Sem isto, corrigir um campo de texto na linha não
      // dá sinal nenhum: o valor fica na tela igual ao que foi digitado, salvo
      // ou não.
      toast.success("Vínculo atualizado.");
    },
    onError: (err: unknown) => toast.error(mensagemErro(err, "atualizar o vínculo")),
  });

  const remover = useMutation({
    mutationFn: async ({ tabela, id }: { tabela: TabelaVinculo; id: string }) => {
      const { error } = await (supabase
        .from(tabela as never)
        .delete()
        .eq("id", id) as never as Promise<{ error: ErroConsulta | null }>);

      if (error) throw error;
      return tabela;
    },
    onSuccess: (tabela) => {
      invalidar(tabela);
      toast.success("Vínculo removido.");
    },
    onError: (err: unknown) => toast.error(mensagemErro(err, "remover o vínculo")),
  });

  return {
    riscos: {
      itens: riscos.data ?? [],
      isLoading: riscos.isLoading,
      error: riscos.error,
      refetch: riscos.refetch,
    },
    treinamentos: {
      itens: treinamentos.data ?? [],
      isLoading: treinamentos.isLoading,
      error: treinamentos.error,
      refetch: treinamentos.refetch,
    },
    epis: {
      itens: epis.data ?? [],
      isLoading: epis.isLoading,
      error: epis.error,
      refetch: epis.refetch,
    },
    adicionar,
    atualizar,
    remover,
  };
}
