/**
 * A APR vinculada à Permissão de Trabalho ainda vale?
 *
 * O DEFEITO QUE ISTO FECHA
 *
 * A APR tem campo de validade. Ele era preenchido, era salvo, era impresso no
 * documento — e `apr.validade` nunca era comparado com a data de hoje. Em lugar
 * nenhum: nem na lista de APRs, nem no documento, nem na PT.
 *
 * Uma APR vencida ficava idêntica a uma vigente em toda tela do sistema. E a PT,
 * que é o papel afixado no local autorizando o trabalho, citava a análise de
 * risco sem dizer que o prazo dela tinha passado.
 *
 * POR QUE ISSO IMPORTA MAIS NA PT DO QUE NA APR
 *
 * A APR é o documento que diz quais são os perigos daquela atividade e o que
 * fazer sobre eles. A validade existe porque as condições mudam — o canteiro
 * avança, o entorno muda, o método muda. Vencida, ela descreve um local que pode
 * não existir mais.
 *
 * A PT é emitida CITANDO a APR. Quem assina a PT está dizendo "os riscos desta
 * atividade estão analisados". Se a análise venceu, essa frase deixou de ser
 * verdadeira — e é na PT, não na APR, que alguém vai ler isso antes de entrar.
 */

export type SituacaoDaApr = "VIGENTE" | "VENCIDA" | "SEM_VALIDADE";

/** Só o dia, em ISO. O banco pode devolver data com hora. */
const soODia = (valor?: string | null) => (valor ?? "").trim().slice(0, 10);

/**
 * Situação da APR na data de referência.
 *
 * A comparação é de texto ISO, e não de `Date`: `new Date("2026-09-16")` é lido
 * em UTC e no fuso do Brasil volta um dia — o mesmo erro que fazia a validade da
 * PT perder uma data. Texto ISO ordena igual a calendário.
 *
 * Vencer é DEPOIS do dia: uma APR válida até hoje ainda vale hoje.
 */
export function situacaoDaApr(
  validade: string | null | undefined,
  hojeIso: string
): SituacaoDaApr {
  const limite = soODia(validade);
  if (!limite) return "SEM_VALIDADE";

  return limite < soODia(hojeIso) ? "VENCIDA" : "VIGENTE";
}

export interface AvisoDaApr {
  /** Frase curta, para a tela e para a lista de pendências do documento. */
  texto: string;
  /** VENCIDA é impedimento de fato; SEM_VALIDADE é lacuna de cadastro. */
  grave: boolean;
}

/**
 * O que dizer sobre a APR vinculada, ou null quando não há o que dizer.
 *
 * `null` para APR vigente é de propósito: tela que anuncia o que está certo
 * ensina a ignorar avisos, e aí o que está errado passa junto.
 */
export function avisoDaAprVinculada(params: {
  validade?: string | null;
  hojeIso: string;
  /** Código ou título, para a frase nomear qual APR é. */
  identificacao?: string | null;
}): AvisoDaApr | null {
  const situacao = situacaoDaApr(params.validade, params.hojeIso);
  const nome = (params.identificacao ?? "").trim();
  const qual = nome ? ` (${nome})` : "";

  if (situacao === "VENCIDA") {
    return {
      grave: true,
      texto:
        `APR vinculada${qual} venceu em ${soODia(params.validade)} — a análise de risco ` +
        `desta atividade não está mais vigente`,
    };
  }

  if (situacao === "SEM_VALIDADE") {
    return {
      grave: false,
      texto:
        `APR vinculada${qual} não tem validade definida — sem prazo, ninguém sabe ` +
        `quando a análise precisa ser refeita`,
    };
  }

  return null;
}
