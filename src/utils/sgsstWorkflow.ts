/**
 * Regras de workflow do SGSST.
 *
 * Estas regras existiam apenas embutidas nos componentes de tela (a de
 * encerramento, repetida em IncidentesDetail e NaoConformidadesDetail) ou não
 * existiam em lugar nenhum — a de transição de status era declarada dentro do
 * próprio teste, que por isso passava sem exercitar nada. Aqui elas viram código
 * de produção único e testável.
 */

/** Status de ação corretiva/preventiva que ainda impedem o encerramento. */
export const STATUS_ACAO_PENDENTE = ["ABERTA", "EM_ANDAMENTO"] as const;

export interface AcaoComStatus {
  status: string;
}

/**
 * Ações que ainda bloqueiam o encerramento de um incidente ou de uma NC.
 * Ações CONCLUIDA e CANCELADA não bloqueiam.
 */
export function acoesPendentes<T extends AcaoComStatus>(acoes: readonly T[]): T[] {
  return acoes.filter((a) => (STATUS_ACAO_PENDENTE as readonly string[]).includes(a.status));
}

export function podeEncerrar(acoes: readonly AcaoComStatus[]): boolean {
  return acoesPendentes(acoes).length === 0;
}

/** Mensagem única para os dois módulos, com o número de ações bloqueando. */
export function mensagemBloqueioEncerramento(
  quantidade: number,
  acao: "encerrar o incidente" | "solicitar verificação"
): string {
  const plural = quantidade === 1 ? "ação" : "ações";
  return (
    `Não é possível ${acao}. ` +
    `${quantidade} ${plural} corretiva(s)/preventiva(s) ainda está(ão) pendente(s) ou em andamento.`
  );
}

/**
 * Transições de status permitidas para incidentes.
 * Status terminais (ENCERRADO, CANCELADO) não têm saída.
 */
export const TRANSICOES_INCIDENTE: Record<string, readonly string[]> = {
  REGISTRADO: ["EM_INVESTIGACAO", "CANCELADO"],
  EM_INVESTIGACAO: ["PLANO_ACAO", "CANCELADO"],
  PLANO_ACAO: ["EM_TRATAMENTO", "ENCERRADO", "CANCELADO"],
  EM_TRATAMENTO: ["ENCERRADO", "CANCELADO"],
  ENCERRADO: [],
  CANCELADO: [],
};

export function podeTransicionar(
  de: string,
  para: string,
  transicoes: Record<string, readonly string[]> = TRANSICOES_INCIDENTE
): boolean {
  return (transicoes[de] ?? []).includes(para);
}

/** Status a partir dos quais não há mais nenhuma transição possível. */
export function isStatusTerminal(
  status: string,
  transicoes: Record<string, readonly string[]> = TRANSICOES_INCIDENTE
): boolean {
  return (transicoes[status] ?? []).length === 0;
}
