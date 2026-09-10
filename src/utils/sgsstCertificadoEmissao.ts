/**
 * Quando o certificado pode ser emitido.
 *
 * O DEFEITO QUE ISTO CORRIGE
 *
 * O certificado saía de turma ainda PLANEJADA. Nada olhava o status da turma:
 * `pendenciasCertificado` conferia aprovação do aluno e os campos do documento
 * (conteúdo programático, carga, local, instrutor), e a emissão avisava as
 * pendências sem impedir.
 *
 * A POLÍTICA DE "AVISAR SEM IMPEDIR" ESTÁ CERTA — E NÃO SE APLICA AQUI
 *
 * A regra do módulo é deliberada e boa: pendência não bloqueia, o PDF sai
 * marcando cada falta, e a decisão fica com quem assina. Impedir esconderia o
 * problema.
 *
 * Mas há duas coisas diferentes debaixo da palavra "pendência":
 *
 * - FALTA DE INFORMAÇÃO. "Conteúdo programático não preenchido" é um documento
 *   incompleto. Sai marcado, e quem assina decide. Ninguém é enganado: a lacuna
 *   está impressa na folha.
 *
 * - AFIRMAÇÃO FALSA. Certificado é o documento que atesta que alguém CONCLUIU um
 *   treinamento. Emiti-lo para turma que ainda não aconteceu não produz documento
 *   incompleto — produz documento que afirma um fato que não ocorreu. Não há como
 *   "marcar a lacuna": a lacuna é a própria afirmação central.
 *
 * É essa a linha. Falta de dado avisa; afirmação falsa impede.
 */

export type StatusDaTurma = "PLANEJADA" | "EM_ANDAMENTO" | "CONCLUIDA" | "CANCELADA";

export type EmissaoDoCertificado =
  | { emite: true }
  | { emite: false; motivo: string; comoResolver: string };

/** Só o dia, em ISO. O banco pode devolver data com hora. */
function soODia(valor?: string | null): string {
  return (valor ?? "").trim().slice(0, 10);
}

/**
 * O certificado pode sair?
 *
 * `hoje` entra por parâmetro para o teste não depender do relógio, e a comparação
 * é de texto ISO: `new Date("2026-09-10")` é lido em UTC e no fuso do Brasil volta
 * um dia, o que reprovaria uma conclusão de hoje.
 */
export function emissaoDoCertificado(params: {
  statusDaTurma?: StatusDaTurma | string | null;
  /** `data_conclusao` do participante. */
  dataConclusao?: string | null;
  hoje: string;
}): EmissaoDoCertificado {
  const status = (params.statusDaTurma ?? "").toUpperCase();

  if (status === "CANCELADA") {
    return {
      emite: false,
      motivo: "A turma foi cancelada.",
      comoResolver:
        "Certificado de turma cancelada atestaria um treinamento que não aconteceu. " +
        "Reabra a turma ou matricule o trabalhador em outra.",
    };
  }

  if (status === "PLANEJADA" || status === "EM_ANDAMENTO") {
    const emAndamento = status === "EM_ANDAMENTO";
    return {
      emite: false,
      motivo: emAndamento
        ? "A turma ainda está em andamento."
        : "A turma ainda está planejada.",
      comoResolver:
        "O certificado atesta que o trabalhador CONCLUIU o treinamento. " +
        (emAndamento
          ? "Encerre a turma como concluída antes de emitir."
          : "O treinamento ainda não aconteceu: conclua a turma antes de emitir."),
    };
  }

  // Status desconhecido ou ausente: não afirma nem nega a conclusão. Deixa passar
  // em vez de travar por um valor que o sistema não reconhece — travar aqui
  // bloquearia turma legítima se alguém acrescentar um status novo no banco.
  if (status !== "CONCLUIDA") {
    return { emite: true };
  }

  // Turma concluída, mas a conclusão do ALUNO lançada no futuro. A data sai
  // impressa no certificado; datada para frente, o documento atesta hoje algo
  // que, pelo próprio papel, só acontece depois.
  const conclusao = soODia(params.dataConclusao);
  if (conclusao && conclusao > soODia(params.hoje)) {
    return {
      emite: false,
      motivo: `A conclusão do participante está lançada para ${conclusao}, no futuro.`,
      comoResolver:
        "Corrija a data de conclusão do participante. O certificado imprime essa data, " +
        "e datado para frente ele atesta hoje o que ainda não aconteceu.",
    };
  }

  return { emite: true };
}

/**
 * Filtra quem pode receber certificado num lote.
 *
 * O lote da turma já filtrava por aprovação. Precisa da mesma trava de status, e
 * precisa dizer QUANTOS ficaram de fora e por quê — um lote que emite menos folhas
 * do que a lista de aprovados, calado, faz o usuário achar que perdeu arquivo.
 */
export function loteDeCertificados<T extends { data_conclusao?: string | null }>(params: {
  aprovados: readonly T[];
  statusDaTurma?: StatusDaTurma | string | null;
  hoje: string;
}): { emitir: T[]; bloqueados: { item: T; motivo: string }[] } {
  const emitir: T[] = [];
  const bloqueados: { item: T; motivo: string }[] = [];

  for (const item of params.aprovados) {
    const decisao = emissaoDoCertificado({
      statusDaTurma: params.statusDaTurma,
      dataConclusao: item.data_conclusao,
      hoje: params.hoje,
    });

    if (decisao.emite === true) emitir.push(item);
    else bloqueados.push({ item, motivo: decisao.motivo });
  }

  return { emitir, bloqueados };
}
