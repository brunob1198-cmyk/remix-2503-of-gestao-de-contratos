/**
 * Coerência entre o status do exame ocupacional e as datas dele.
 *
 * O DEFEITO QUE ISTO FECHA
 *
 * Um exame gravado como REALIZADO sem data de realização passava batido. A lista
 * mostrava "REALIZADO", e a fila de convocação continuava dizendo "vencido, nunca
 * realizado" — porque o cálculo da periodicidade só conta exame que tem status
 * REALIZADO **e** data. Duas telas afirmando coisas opostas sobre o mesmo exame,
 * sem nada explicando a diferença.
 *
 * POR QUE ESTE CASO BLOQUEIA E O DA CLASSIFICAÇÃO NÃO
 *
 * Exame realizado sem classificação de resultado é informação PENDENTE: o médico
 * ainda vai classificar, e o sistema avisa sem impedir. Já exame realizado sem
 * data é CONTRADIÇÃO: não existe saber que aconteceu e não saber quando. Se a data
 * é desconhecida, o status honesto é PENDENTE ou AGENDADO — não REALIZADO.
 *
 * Por isso a primeira é um aviso e esta é um impedimento.
 */

export type StatusExameCoerencia = "PENDENTE" | "AGENDADO" | "REALIZADO" | "CANCELADO";

export type GravidadeIncoerencia = "IMPEDE" | "AVISA";

export interface Incoerencia {
  gravidade: GravidadeIncoerencia;
  /** Frase curta para a lista e para o ícone de alerta. */
  resumo: string;
  /** O que fazer, para a mensagem não ser só um diagnóstico. */
  comoResolver: string;
}

/**
 * Confronta status e datas de um exame.
 *
 * Devolve `null` quando está coerente. Não recebe o registro inteiro de propósito:
 * a regra depende só destes três campos, e uma função que aceita o objeto todo
 * convida a crescer para dentro de assuntos que não são dela.
 */
export function incoerenciaDoExame(params: {
  status: string | null | undefined;
  dataRealizacao: string | null | undefined;
}): Incoerencia | null {
  const status = (params.status ?? "").trim().toUpperCase();
  const temData = !!(params.dataRealizacao ?? "").trim();

  if (status === "REALIZADO" && !temData) {
    return {
      gravidade: "IMPEDE",
      resumo: "Marcado como realizado sem data de realização.",
      comoResolver:
        "Informe a data em que o exame foi feito. Se ela ainda não é conhecida, o " +
        "status correto é Pendente ou Agendado — sem a data, este exame não conta " +
        "no cálculo da próxima convocação.",
    };
  }

  // O inverso é menos grave: a data está lá, então a informação existe e o
  // cálculo da periodicidade tem base. O que falta é alguém confirmar o status.
  if (temData && status !== "REALIZADO" && status !== "CANCELADO") {
    return {
      gravidade: "AVISA",
      resumo: "Tem data de realização, mas o status não é Realizado.",
      comoResolver:
        "Confirme o status para Realizado. Enquanto não estiver, este exame não " +
        "conta no cálculo da próxima convocação.",
    };
  }

  return null;
}

/** Atalho para a tela: dá para gravar? */
export function podeGravarExame(params: {
  status: string | null | undefined;
  dataRealizacao: string | null | undefined;
}): boolean {
  return incoerenciaDoExame(params)?.gravidade !== "IMPEDE";
}

/**
 * Quantos exames de uma lista estão marcados como realizados sem data.
 *
 * A fila de convocação usa isto para explicar por que um exame que a lista mostra
 * como realizado não entrou no cálculo — sem essa contagem, o usuário vê "nunca
 * realizado" ao lado de um exame realizado e conclui que a tela está com defeito.
 */
export function realizadosSemData(
  exames: readonly { status: string | null; data_realizacao: string | null }[]
): number {
  return exames.filter(
    (e) => incoerenciaDoExame({ status: e.status, dataRealizacao: e.data_realizacao })?.gravidade === "IMPEDE"
  ).length;
}
