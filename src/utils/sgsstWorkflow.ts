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
 * Em que ponto do ciclo a não conformidade está DE FATO.
 *
 * O DEFEITO QUE ISTO CORRIGE
 *
 * Concluir todas as ações do plano não produzia sinal nenhum: a NC continuava
 * mostrando "ABERTA" e o cabeçalho dizia "Verificador de Eficácia: Pendente" — a
 * mesma frase de uma NC recém-criada, sem plano de ação nenhum. Quem olhava não
 * distinguia "ainda não começou" de "tudo executado, falta aferir se resolveu".
 *
 * O status `AGUARDANDO_VERIFICACAO` já existia no banco e na tela, mas só por
 * mudança MANUAL. Se ninguém apertasse o botão, o ciclo ficava aberto para sempre
 * sem que nada apontasse o que faltava — e a NR-01 1.5.5.2 pede justamente a
 * aferição do resultado, não só a execução da ação.
 *
 * POR QUE DERIVADO, E NÃO GRAVADO
 *
 * Seria possível mudar o status automaticamente ao concluir a última ação. Não é
 * bom: reabrir uma ação teria de desfazer o status, o histórico encheria de
 * transições que ninguém pediu, e o registro passaria a afirmar uma decisão que
 * nenhuma pessoa tomou. Derivar mantém o fato (as ações) como única fonte e deixa
 * a decisão de submeter à verificação com quem responde por ela.
 */
export type CicloDaNc =
  /** Nenhuma ação cadastrada: não há plano a executar. */
  | "SEM_PLANO"
  /** Há ação aberta ou em andamento. */
  | "ACOES_EM_ANDAMENTO"
  /** Todas as ações foram canceladas: o plano existiu e não foi executado. */
  | "PLANO_SEM_EXECUCAO"
  /** Tudo executado e a eficácia ainda não foi aferida. É o item 10.5. */
  | "AGUARDANDO_VERIFICACAO"
  | "VERIFICADA_ACEITA"
  | "VERIFICADA_REJEITADA"
  /** NC concluída ou cancelada: o ciclo terminou. */
  | "ENCERRADA";

export function cicloDaNc(params: {
  statusNc: string;
  acoes: readonly AcaoComStatus[];
  resultadoVerificacao?: string | null;
}): CicloDaNc {
  const status = (params.statusNc ?? "").toUpperCase();
  if (status === "CONCLUIDA" || status === "CANCELADA") return "ENCERRADA";

  const resultado = (params.resultadoVerificacao ?? "").toUpperCase();
  if (resultado === "ACEITA") return "VERIFICADA_ACEITA";
  if (resultado === "REJEITADA") return "VERIFICADA_REJEITADA";

  if (params.acoes.length === 0) return "SEM_PLANO";
  if (acoesPendentes(params.acoes).length > 0) return "ACOES_EM_ANDAMENTO";

  // Sem esta checagem, um plano com todas as ações CANCELADA cairia em
  // "aguardando verificação" — porque `acoesPendentes` não considera cancelada
  // como pendente. Diria que está tudo executado quando nada foi feito, que é o
  // oposto do que aconteceu.
  const concluidas = params.acoes.filter((a) => (a.status ?? "").toUpperCase() === "CONCLUIDA");
  if (concluidas.length === 0) return "PLANO_SEM_EXECUCAO";

  return "AGUARDANDO_VERIFICACAO";
}

/** Verdadeiro quando o ciclo depende de alguém agir. */
export function cicloExigeAcao(ciclo: CicloDaNc): boolean {
  return (
    ciclo === "AGUARDANDO_VERIFICACAO" ||
    ciclo === "VERIFICADA_REJEITADA" ||
    ciclo === "PLANO_SEM_EXECUCAO"
  );
}

/**
 * O que dizer na tela, e o que a pessoa deve fazer.
 *
 * A frase diz explicitamente que concluir a ação NÃO fecha a NC: é a confusão que
 * o roteiro 10.5 aponta, e sem dizê-la o usuário assume que terminou.
 */
export function mensagemDoCiclo(ciclo: CicloDaNc): { titulo: string; comoResolver: string } | null {
  switch (ciclo) {
    case "AGUARDANDO_VERIFICACAO":
      return {
        titulo: "Pendente de verificação de eficácia",
        comoResolver:
          "Todas as ações do plano estão concluídas, mas concluir a ação não fecha a não " +
          "conformidade: falta aferir se o problema foi realmente resolvido. Use “Registrar " +
          "Verificação” para informar o resultado.",
      };
    case "VERIFICADA_REJEITADA":
      return {
        titulo: "Verificação rejeitada",
        comoResolver:
          "A aferição concluiu que o problema não foi resolvido. Cadastre nova ação corretiva " +
          "antes de encerrar.",
      };
    case "PLANO_SEM_EXECUCAO":
      return {
        titulo: "Plano de ação sem execução",
        comoResolver:
          "Todas as ações cadastradas foram canceladas e nenhuma foi concluída. A não " +
          "conformidade segue sem tratamento.",
      };
    default:
      return null;
  }
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
