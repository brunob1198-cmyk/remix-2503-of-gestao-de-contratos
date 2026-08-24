/**
 * Vida útil do EPI entregue — previsão de troca.
 *
 * O módulo tinha duas datas e nenhuma respondia "quando trocar":
 *
 *  - `validade_ca` é do MODELO. O Certificado de Aprovação vence para todo mundo
 *    na mesma data, e a NR-06 6.2 proíbe *fornecer* equipamento sem CA válido. Não
 *    diz nada sobre a peça que o trabalhador já usa há dois anos.
 *  - `periodicidade_troca_meses`, cadastrada no vínculo função↔EPI, dizia de quanto
 *    em quanto tempo a função exige reposição — mas só existia para função com
 *    vínculo cadastrado.
 *
 * Falta a terceira: a vida útil da unidade entregue, contada da entrega. É a que
 * responde "este capacete precisa ser trocado".
 *
 * Uma decisão que atravessa o arquivo: **sem vida útil cadastrada, não se inventa
 * prazo.** Um padrão de doze meses aplicado a tudo faria o sistema cobrar troca de
 * cinto de segurança no mesmo ritmo de luva de raspa, e o usuário aprenderia a
 * ignorar o aviso.
 */

export type SituacaoVidaUtil =
  | "SEM_PRAZO"
  | "EM_USO"
  | "PROXIMO_DA_TROCA"
  | "VENCIDO";

export const SITUACAO_VIDA_UTIL_LABEL: Record<SituacaoVidaUtil, string> = {
  SEM_PRAZO: "Sem vida útil cadastrada",
  EM_USO: "Em uso",
  PROXIMO_DA_TROCA: "Próximo da troca",
  VENCIDO: "Troca vencida",
};

/** Janela de antecedência do aviso de troca. */
export const JANELA_TROCA_DIAS = 30;

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

/** Diferença em dias inteiros pelo calendário, ignorando a hora. */
export function diasEntreDatas(de: Date, ate: Date): number {
  const a = new Date(de.getFullYear(), de.getMonth(), de.getDate());
  const b = new Date(ate.getFullYear(), ate.getMonth(), ate.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * Soma meses a uma data pelo calendário.
 *
 * Precisa de cuidado no fim do mês: 31/01 + 1 mês não é 31/02. O JavaScript
 * transborda para 03/03, o que adiantaria a troca em dois dias. Aqui o resultado
 * é o último dia do mês de destino.
 */
export function somarMeses(iso: string, meses: number): string {
  const base = comoData(iso);
  const diaOriginal = base.getDate();

  const destino = new Date(base.getFullYear(), base.getMonth() + meses, 1);
  const ultimoDiaDoMes = new Date(
    destino.getFullYear(),
    destino.getMonth() + 1,
    0
  ).getDate();

  destino.setDate(Math.min(diaOriginal, ultimoDiaDoMes));
  return comoIso(destino);
}

export interface PrevisaoTroca {
  situacao: SituacaoVidaUtil;
  /** Data prevista da troca; nula quando não há vida útil cadastrada. */
  dataPrevista: string | null;
  /** Dias até a troca; negativo quando já passou; nulo sem prazo. */
  diasRestantes: number | null;
}

/**
 * Previsão de troca de uma unidade entregue.
 *
 * `vidaUtilMeses` nulo, zero ou negativo devolve SEM_PRAZO — e não uma data
 * qualquer. Vida útil zero seria "trocar no dia da entrega", que nenhum cadastro
 * quer dizer.
 */
export function previsaoTroca(params: {
  dataEntrega?: string | null;
  vidaUtilMeses?: number | null;
  hoje: Date;
  janelaDias?: number;
}): PrevisaoTroca {
  const { dataEntrega, vidaUtilMeses, hoje } = params;
  const janela = params.janelaDias ?? JANELA_TROCA_DIAS;

  if (!dataEntrega || !vidaUtilMeses || vidaUtilMeses <= 0) {
    return { situacao: "SEM_PRAZO", dataPrevista: null, diasRestantes: null };
  }

  const dataPrevista = somarMeses(dataEntrega, vidaUtilMeses);
  const diasRestantes = diasEntreDatas(hoje, comoData(dataPrevista));

  const situacao: SituacaoVidaUtil =
    diasRestantes < 0
      ? "VENCIDO"
      : diasRestantes <= janela
        ? "PROXIMO_DA_TROCA"
        : "EM_USO";

  return { situacao, dataPrevista, diasRestantes };
}

export type SituacaoCa = "SEM_VALIDADE" | "VALIDO" | "PROXIMO_DO_VENCIMENTO" | "VENCIDO";

export const SITUACAO_CA_LABEL: Record<SituacaoCa, string> = {
  SEM_VALIDADE: "Validade do CA não informada",
  VALIDO: "CA válido",
  PROXIMO_DO_VENCIMENTO: "CA próximo do vencimento",
  VENCIDO: "CA vencido",
};

/**
 * Situação do CA do modelo.
 *
 * Separado da vida útil de propósito: são duas perguntas diferentes. "Posso
 * entregar este modelo hoje?" é o CA. "Esta peça que o trabalhador tem precisa ser
 * trocada?" é a vida útil. Já vi as duas confundidas — e a confusão faz o sistema
 * liberar entrega de peça velha e barrar entrega de peça nova.
 */
export function situacaoDoCa(
  validadeCa: string | null | undefined,
  hoje: Date,
  janelaDias = 60
): { situacao: SituacaoCa; diasRestantes: number | null } {
  if (!validadeCa) return { situacao: "SEM_VALIDADE", diasRestantes: null };

  const diasRestantes = diasEntreDatas(hoje, comoData(validadeCa));

  if (diasRestantes < 0) return { situacao: "VENCIDO", diasRestantes };
  if (diasRestantes <= janelaDias)
    return { situacao: "PROXIMO_DO_VENCIMENTO", diasRestantes };

  return { situacao: "VALIDO", diasRestantes };
}

/**
 * Saldo em posse de uma entrega, descontadas as devoluções.
 *
 * Nunca negativo: devolução maior que a entrega passou a ser barrada no banco, mas
 * registros anteriores a essa regra existem, e a ficha não deve transformar erro de
 * lançamento em dívida do trabalhador.
 */
export function saldoDaEntrega(
  quantidadeEntregue: number,
  devolucoes: readonly { quantidade_devolvida: number }[]
): number {
  const devolvido = devolucoes.reduce(
    (soma, d) => soma + (d.quantidade_devolvida || 0),
    0
  );
  return Math.max(0, (quantidadeEntregue || 0) - devolvido);
}
