import { diasEntreDatas } from "@/utils/sgsstEpiVidaUtil";

/**
 * Higienização e manutenção periódica de EPI — NR-06 6.6.1 alínea "f".
 *
 * A norma põe no empregador a obrigação de responsabilizar-se pela higienização e
 * manutenção periódica do equipamento. O módulo sabia o que foi entregue, a quem, e
 * quando trocar — e nada sobre o equipamento ter sido lavado, revisado ou condenado
 * no meio do caminho.
 *
 * O arquivo responde uma pergunta só: **este equipamento está com a higienização em
 * dia?** E responde com estados distintos onde a diferença importa:
 *
 *  - `NAO_SE_APLICA` — descartável. Cobrar higienização de máscara PFF1 é ruído, e
 *    ruído ensina o usuário a ignorar o aviso verdadeiro.
 *  - `SEM_PERIODICIDADE` — reutilizável, mas ninguém definiu de quanto em quanto
 *    tempo. Sem prazo cadastrado não existe atraso: não há o que comparar.
 *  - `NUNCA_REGISTRADA` — tem prazo e nunca houve execução. É cadastro em falta, não
 *    prazo perdido, e a ação para resolver é outra.
 *  - `ATRASADA` — houve execução e o prazo da próxima passou.
 *  - `DESCARTADO` — o equipamento foi condenado. Cobrar higienização dele seria
 *    cobrar manutenção de coisa que foi para o lixo.
 *
 * Essa separação é a mesma que o dossiê faz entre "sem ASO" e "ASO vencido": estados
 * diferentes, ações diferentes, e juntá-los num só esconde qual é o problema.
 */

export type TipoManutencaoEpi = "HIGIENIZACAO" | "MANUTENCAO" | "INSPECAO";

export const TIPO_MANUTENCAO_LABEL: Record<TipoManutencaoEpi, string> = {
  HIGIENIZACAO: "Higienização",
  MANUTENCAO: "Manutenção",
  INSPECAO: "Inspeção",
};

export const TIPO_MANUTENCAO_AJUDA: Record<TipoManutencaoEpi, string> = {
  HIGIENIZACAO: "Limpeza e desinfecção do equipamento, para devolvê-lo ao uso.",
  MANUTENCAO:
    "Reparo ou substituição de componente — costura, catraca, elástico, filtro.",
  INSPECAO:
    "Verificação da condição sem intervir. É o que a NR-35 pede antes de cada uso do cinto, por exemplo.",
};

export type ResultadoManutencaoEpi = "APROVADO" | "REPROVADO" | "DESCARTADO";

export const RESULTADO_MANUTENCAO_LABEL: Record<ResultadoManutencaoEpi, string> = {
  APROVADO: "Aprovado — volta ao uso",
  REPROVADO: "Reprovado — aguarda decisão",
  DESCARTADO: "Descartado — equipamento condenado",
};

export type SituacaoHigienizacao =
  | "NAO_SE_APLICA"
  | "SEM_PERIODICIDADE"
  | "NUNCA_REGISTRADA"
  | "EM_DIA"
  | "PROXIMA"
  | "ATRASADA"
  | "DESCARTADO";

export const SITUACAO_HIGIENIZACAO_LABEL: Record<SituacaoHigienizacao, string> = {
  NAO_SE_APLICA: "Não se aplica (descartável)",
  SEM_PERIODICIDADE: "Sem periodicidade definida",
  NUNCA_REGISTRADA: "Nunca registrada",
  EM_DIA: "Em dia",
  PROXIMA: "Próxima do prazo",
  ATRASADA: "Atrasada",
  DESCARTADO: "Equipamento descartado",
};

/** Janela de antecedência do aviso. */
export const JANELA_HIGIENIZACAO_DIAS = 7;

/** Converte "YYYY-MM-DD" em Date local — o ISO puro desloca o fuso. */
function comoData(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

/** Data local em "YYYY-MM-DD". `toISOString()` volta o dia anterior em fuso positivo. */
function comoIso(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${data.getFullYear()}-${mes}-${dia}`;
}

/** Só o que o cálculo precisa ler de uma execução. */
export interface ExecucaoManutencao {
  data_execucao: string;
  tipo?: TipoManutencaoEpi | string | null;
  resultado?: ResultadoManutencaoEpi | string | null;
}

/**
 * Soma dias a uma data pelo calendário.
 *
 * Em dias, e não em meses: a periodicidade de higienização se cadastra em dias
 * porque os prazos reais são curtos — sete, quinze, trinta —, e converter para mês
 * introduziria o problema de fim de mês sem nenhum ganho.
 */
export function somarDias(iso: string, dias: number): string {
  const base = comoData(iso);
  base.setDate(base.getDate() + dias);
  return comoIso(base);
}

/**
 * Próxima execução prevista a partir de uma execução e da periodicidade.
 *
 * Nula sem periodicidade: preencher com a própria data da execução faria a tela
 * cobrar de novo no mesmo dia.
 */
export function proximaPrevista(
  dataExecucao: string | null | undefined,
  periodicidadeDias: number | null | undefined
): string | null {
  if (!dataExecucao || !periodicidadeDias || periodicidadeDias <= 0) return null;
  return somarDias(dataExecucao, periodicidadeDias);
}

/**
 * A execução mais recente da lista.
 *
 * Empate de data resolve pela ordem de chegada — duas execuções no mesmo dia são
 * equivalentes para efeito de prazo, e escolher entre elas não muda a resposta.
 */
export function ultimaExecucao<T extends ExecucaoManutencao>(
  execucoes: readonly T[]
): T | null {
  if (execucoes.length === 0) return null;

  return [...execucoes].sort((a, b) =>
    (b.data_execucao ?? "").localeCompare(a.data_execucao ?? "")
  )[0];
}

/** Verdadeiro quando alguma execução condenou o equipamento. */
export function foiDescartado(execucoes: readonly ExecucaoManutencao[]): boolean {
  return execucoes.some((e) => e.resultado === "DESCARTADO");
}

export interface SituacaoDaHigienizacao {
  situacao: SituacaoHigienizacao;
  /** Data da última execução registrada; nula quando nunca houve. */
  ultimaEm: string | null;
  /** Próxima prevista; nula sem periodicidade ou sem execução anterior. */
  proximaEm: string | null;
  /** Dias até a próxima; negativo quando o prazo passou; nulo sem prazo. */
  diasRestantes: number | null;
}

/**
 * Situação da higienização de um equipamento.
 *
 * A ordem das checagens é deliberada: descarte primeiro (não se cobra manutenção do
 * que foi condenado), depois "não se aplica", depois a falta de prazo, depois a
 * falta de execução. Cada saída antecipada evita cobrar uma coisa cuja causa é
 * outra.
 */
export function situacaoHigienizacao(params: {
  exigeHigienizacao?: boolean | null;
  periodicidadeDias?: number | null;
  execucoes: readonly ExecucaoManutencao[];
  hoje: Date;
  janelaDias?: number;
}): SituacaoDaHigienizacao {
  const { exigeHigienizacao, periodicidadeDias, execucoes, hoje } = params;
  const janela = params.janelaDias ?? JANELA_HIGIENIZACAO_DIAS;

  const ultima = ultimaExecucao(execucoes);
  const ultimaEm = ultima?.data_execucao ?? null;

  const vazio = { ultimaEm, proximaEm: null, diasRestantes: null };

  if (foiDescartado(execucoes)) {
    return { situacao: "DESCARTADO", ...vazio };
  }

  if (!exigeHigienizacao) {
    return { situacao: "NAO_SE_APLICA", ...vazio };
  }

  if (!periodicidadeDias || periodicidadeDias <= 0) {
    return { situacao: "SEM_PERIODICIDADE", ...vazio };
  }

  if (!ultimaEm) {
    return { situacao: "NUNCA_REGISTRADA", ...vazio };
  }

  const proximaEm = somarDias(ultimaEm, periodicidadeDias);
  const diasRestantes = diasEntreDatas(hoje, comoData(proximaEm));

  const situacao: SituacaoHigienizacao =
    diasRestantes < 0 ? "ATRASADA" : diasRestantes <= janela ? "PROXIMA" : "EM_DIA";

  return { situacao, ultimaEm, proximaEm, diasRestantes };
}

/** Situações que exigem ação de quem administra o EPI. */
const SITUACOES_PENDENTES = new Set<SituacaoHigienizacao>([
  "NUNCA_REGISTRADA",
  "ATRASADA",
]);

/**
 * Verdadeiro quando a situação cobra ação.
 *
 * `PROXIMA` não entra: é aviso de antecedência, não pendência. Contar o que ainda
 * está no prazo como pendente inflaria o número que deveria alarmar.
 */
export function higienizacaoPendente(situacao: SituacaoHigienizacao): boolean {
  return SITUACOES_PENDENTES.has(situacao);
}

export interface ResumoHigienizacao {
  emDia: number;
  proximas: number;
  atrasadas: number;
  nuncaRegistradas: number;
  descartados: number;
  /** Equipamentos fora da conta, com o motivo separado. */
  semPeriodicidade: number;
  naoSeAplica: number;
}

/** Consolida as situações de vários equipamentos, sem somar o que é diferente. */
export function consolidarHigienizacao(
  situacoes: readonly SituacaoHigienizacao[]
): ResumoHigienizacao {
  const conta = (s: SituacaoHigienizacao) =>
    situacoes.filter((x) => x === s).length;

  return {
    emDia: conta("EM_DIA"),
    proximas: conta("PROXIMA"),
    atrasadas: conta("ATRASADA"),
    nuncaRegistradas: conta("NUNCA_REGISTRADA"),
    descartados: conta("DESCARTADO"),
    semPeriodicidade: conta("SEM_PERIODICIDADE"),
    naoSeAplica: conta("NAO_SE_APLICA"),
  };
}
