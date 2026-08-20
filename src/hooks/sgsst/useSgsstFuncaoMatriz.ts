import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  calcularMatriz,
  type ColaboradorMatriz,
  type EntregaEpi,
  type ExigenciaEpi,
  type ExigenciaTreinamento,
  type ParticipacaoTreinamento,
  type ResultadoMatriz,
} from "@/utils/sgsstMatrizFuncao";

/**
 * Matriz de conformidade por função.
 *
 * É o retorno de ter dado vínculos à função: agora dá para responder "quem está
 * sem o treinamento ou o EPI que a função dele exige". Antes essa pergunta não
 * tinha resposta possível, porque nada dizia o que cada função exige.
 *
 * O cruzamento acontece no cliente, sobre listas inteiras (não paginadas),
 * porque a resposta útil é o conjunto todo — mostrar "3 pendências" quando são
 * 40 seria pior que não mostrar nada.
 */

interface ErroConsulta {
  message?: string;
  code?: string;
}

/** Teto de segurança: acima disto a resposta vira lenta e pouco acionável. */
export const MATRIZ_LIMITE_LINHAS = 2000;

interface LinhaColaborador {
  id: string;
  nome?: string | null;
  funcao_id?: string | null;
  funcao?: { id: string; nome: string } | null;
  projeto?: { nome: string } | null;
  profile?: { nome: string } | null;
  recurso?: { nome: string } | null;
}

interface LinhaFuncaoTreinamento {
  funcao_id: string;
  treinamento_id: string;
  obrigatorio: boolean;
  treinamento?: { nome: string } | null;
}

interface LinhaFuncaoEpi {
  funcao_id: string;
  epi_id: string;
  obrigatorio: boolean;
  periodicidade_troca_meses?: number | null;
  epi?: { nome: string } | null;
}

interface LinhaParticipacao {
  colaborador_id: string;
  resultado: string;
  validade?: string | null;
  data_conclusao?: string | null;
  turma?: { treinamento_id: string } | null;
}

interface LinhaEntrega {
  colaborador_id: string;
  epi_id: string;
  data_entrega: string;
}

/**
 * Lê uma lista inteira (até o teto) de uma tabela SGSST.
 *
 * `somenteStatus` existe para o caso dos colaboradores: cobrar treinamento de
 * quem foi desligado é ruído.
 */
async function buscar<T>(
  tabela: string,
  select: string,
  somenteStatus?: string
): Promise<T[]> {
  const base = supabase.from(tabela as never).select(select).limit(MATRIZ_LIMITE_LINHAS);

  const query = somenteStatus
    ? (base as unknown as { eq: (coluna: string, valor: string) => unknown }).eq(
        "status",
        somenteStatus
      )
    : base;

  const { data, error } = await (query as never as Promise<{
    data: T[] | null;
    error: ErroConsulta | null;
  }>);

  if (error) throw error;
  return data ?? [];
}

export interface MatrizFuncao extends ResultadoMatriz {
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
  /** True quando alguma lista bateu o teto e o resultado pode estar incompleto. */
  truncado: boolean;
}

export function useSgsstFuncaoMatriz(options?: { enabled?: boolean }): MatrizFuncao {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["sgsst_funcao_pendencias", empresaId],
    enabled: !!empresaId && options?.enabled !== false,
    staleTime: 1000 * 60,
    queryFn: async () => {
      const [colaboradores, exigenciasTr, exigenciasEpi, participacoes, entregas] =
        await Promise.all([
          buscar<LinhaColaborador>(
            "sgsst_colaborador_dados",
            "id, nome, funcao_id, funcao:sgsst_funcoes(id, nome), projeto:projetos(nome), profile:profiles(nome), recurso:recursos(nome)",
            "ativo"
          ),
          buscar<LinhaFuncaoTreinamento>(
            "sgsst_funcao_treinamentos",
            "funcao_id, treinamento_id, obrigatorio, treinamento:sgsst_treinamentos(nome)"
          ),
          buscar<LinhaFuncaoEpi>(
            "sgsst_funcao_epis",
            "funcao_id, epi_id, obrigatorio, periodicidade_troca_meses, epi:sgsst_epis(nome)"
          ),
          buscar<LinhaParticipacao>(
            "sgsst_treinamentos_participantes",
            "colaborador_id, resultado, validade, data_conclusao, turma:sgsst_treinamentos_turmas(treinamento_id)"
          ),
          buscar<LinhaEntrega>("sgsst_epi_entregas", "colaborador_id, epi_id, data_entrega"),
        ]);

      const truncado = [colaboradores, exigenciasTr, exigenciasEpi, participacoes, entregas].some(
        (lista) => lista.length >= MATRIZ_LIMITE_LINHAS
      );

      const colaboradoresMatriz: ColaboradorMatriz[] = colaboradores.map((c) => ({
        id: c.id,
        // O nome pode vir do cadastro próprio, do profile ou do recurso.
        nome: c.nome || c.profile?.nome || c.recurso?.nome || "(sem nome)",
        funcaoId: c.funcao_id ?? null,
        funcaoNome: c.funcao?.nome ?? null,
        obra: c.projeto?.nome ?? null,
      }));

      const treinamentosPorFuncao: Record<string, ExigenciaTreinamento[]> = {};
      for (const linha of exigenciasTr) {
        (treinamentosPorFuncao[linha.funcao_id] ??= []).push({
          treinamentoId: linha.treinamento_id,
          nome: linha.treinamento?.nome ?? "(treinamento removido)",
          obrigatorio: linha.obrigatorio,
        });
      }

      const episPorFuncao: Record<string, ExigenciaEpi[]> = {};
      for (const linha of exigenciasEpi) {
        (episPorFuncao[linha.funcao_id] ??= []).push({
          epiId: linha.epi_id,
          nome: linha.epi?.nome ?? "(EPI removido)",
          obrigatorio: linha.obrigatorio,
          periodicidadeTrocaMeses: linha.periodicidade_troca_meses ?? null,
        });
      }

      const participacoesMatriz: ParticipacaoTreinamento[] = participacoes
        // Participação cuja turma sumiu não diz de qual treinamento é, então não
        // pode cobrir pendência nenhuma.
        .filter((p) => !!p.turma?.treinamento_id)
        .map((p) => ({
          colaboradorId: p.colaborador_id,
          treinamentoId: p.turma?.treinamento_id as string,
          resultado: p.resultado,
          validade: p.validade ?? null,
          dataConclusao: p.data_conclusao ?? null,
        }));

      const entregasMatriz: EntregaEpi[] = entregas.map((e) => ({
        colaboradorId: e.colaborador_id,
        epiId: e.epi_id,
        dataEntrega: e.data_entrega,
      }));

      const resultado = calcularMatriz({
        colaboradores: colaboradoresMatriz,
        treinamentosPorFuncao,
        episPorFuncao,
        participacoes: participacoesMatriz,
        entregas: entregasMatriz,
        hoje: new Date(),
      });

      return { ...resultado, truncado };
    },
  });

  return {
    pendencias: data?.pendencias ?? [],
    resumo:
      data?.resumo ?? {
        colaboradoresAvaliados: 0,
        semFuncao: 0,
        emDia: 0,
        comPendencia: 0,
        pendenciasTreinamento: 0,
        pendenciasEpi: 0,
      },
    truncado: data?.truncado ?? false,
    isLoading,
    error,
    refetch,
  };
}
