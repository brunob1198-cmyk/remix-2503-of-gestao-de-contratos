/**
 * Os dias de uma turma, para a folha de presença ter uma coluna por dia.
 *
 * POR QUE UMA COLUNA POR DIA, E NÃO UMA ASSINATURA SÓ
 *
 * A lista de presença não é um comprovante emitido depois: é a folha que circula
 * NA SALA e que cada participante assina. Treinamento de NR costuma ser de dois ou
 * três dias, e quem faltou no segundo dia não cumpriu a carga horária — é o que a
 * folha precisa provar, e uma assinatura única não prova.
 *
 * Assinar uma vez por uma turma de três dias é exatamente o vício que a folha
 * existe para impedir.
 */

/** Acima disto a coluna fica estreita demais para caber uma assinatura. */
export const MAXIMO_DE_COLUNAS_DE_DIA = 6;

function soODia(valor?: string | null): string {
  return (valor ?? "").trim().slice(0, 10);
}

/** Converte "YYYY-MM-DD" em Date local, sem o deslocamento de fuso do ISO puro. */
function comoData(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function comoIso(data: Date): string {
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${data.getFullYear()}-${dois(data.getMonth() + 1)}-${dois(data.getDate())}`;
}

export interface DiasDaTurma {
  /** Um item por dia, em ISO. Vazio quando não há data inicial. */
  dias: string[];
  /**
   * Verdadeiro quando o período é longo demais para uma coluna por dia e a folha
   * sai com uma coluna única.
   */
  colunaUnica: boolean;
}

/**
 * Os dias entre a data inicial e a final, inclusive.
 *
 * Data final ausente ou anterior à inicial vira turma de um dia: é o caso comum
 * (turma de um dia só grava a inicial) e o caso de cadastro errado, e nos dois a
 * folha de um dia é o que serve.
 */
export function diasDaTurma(params: {
  dataInicial?: string | null;
  dataFinal?: string | null;
}): DiasDaTurma {
  const inicio = soODia(params.dataInicial);
  if (!inicio) return { dias: [], colunaUnica: true };

  const fim = soODia(params.dataFinal);
  if (!fim || fim <= inicio) return { dias: [inicio], colunaUnica: false };

  const dias: string[] = [];
  const corrente = comoData(inicio);
  const ultimo = comoData(fim);

  while (corrente <= ultimo) {
    dias.push(comoIso(corrente));
    corrente.setDate(corrente.getDate() + 1);

    // Trava de segurança: data final absurda no cadastro geraria milhares de
    // colunas e travaria a emissão. Melhor sair com coluna única.
    if (dias.length > MAXIMO_DE_COLUNAS_DE_DIA) {
      return { dias: [inicio, fim], colunaUnica: true };
    }
  }

  return { dias, colunaUnica: false };
}

/**
 * Quantas linhas em branco acrescentar ao fim da lista.
 *
 * Folha de presença sem linha vazia é folha que não serve na sala: aparece o
 * ajudante que entrou na equipe ontem, o motorista que vai subir na torre, o
 * fiscal do cliente. Sem linha para eles, alguém assina na margem ou não assina —
 * e a folha deixa de valer como registro.
 *
 * O número acompanha a turma: poucas linhas numa turma grande não resolvem, e
 * vinte linhas vazias numa turma de dois desperdiçam folha.
 */
export function linhasEmBranco(params: {
  inscritos: number;
  capacidade?: number | null;
}): number {
  const capacidade = Number(params.capacidade ?? 0);

  // Vagas ainda abertas, quando a turma declara capacidade.
  const ateALotacao =
    Number.isFinite(capacidade) && capacidade > params.inscritos
      ? capacidade - params.inscritos
      : 0;

  // Sobra proporcional, que vale mesmo com a turma lotada: é justamente quando a
  // capacidade está cheia que aparece alguém a mais na sala.
  const proporcional = Math.ceil(params.inscritos * 0.2);

  // Uma regra só, e não dois ramos: com dois, a turma exatamente lotada caía no
  // ramo errado e rendia menos linhas que uma turma com uma vaga sobrando.
  return Math.min(Math.max(ateALotacao, proporcional, 3), 15);
}

export type SituacaoDaFolha = "ANTES_DO_TREINAMENTO" | "DEPOIS_DO_TREINAMENTO";

/**
 * A folha está sendo emitida antes ou depois do treinamento?
 *
 * Muda o texto do rodapé, não o conteúdo. Antes, é uma folha para assinar; depois,
 * é a reimpressão de um registro que já deveria estar assinado em papel. Imprimir
 * as duas iguais faz a segunda parecer documento válido sem assinatura nenhuma.
 */
export function situacaoDaFolha(statusDaTurma?: string | null): SituacaoDaFolha {
  return (statusDaTurma ?? "").toUpperCase() === "CONCLUIDA"
    ? "DEPOIS_DO_TREINAMENTO"
    : "ANTES_DO_TREINAMENTO";
}
