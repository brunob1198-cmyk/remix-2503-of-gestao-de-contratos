/**
 * A CAT do incidente: declarada, registrada, ou faltando.
 *
 * O DEFEITO QUE ISTO CORRIGE
 *
 * O formulário do incidente tem a chave "CAT emitida". Marcá-la não criava CAT
 * nenhuma, não vinculava nada, e a tela do incidente não mostrava CAT em lugar
 * algum — o usuário marcava e ficava sem saber se aquilo tinha ligado a alguma
 * coisa.
 *
 * O vínculo existe no banco desde sempre: `sgsst_cats.incidente_id`, com comentário
 * dizendo "liga a CAT ao incidente que a originou". Mas `CatFormDialog` gravava
 * `incidente_id: null` fixo no código, então TODA CAT já criada tem o vínculo
 * vazio, e a consulta de CATs — que até faz o join do incidente — nunca teve nada
 * para mostrar.
 *
 * TRES SITUACOES QUE A CHAVE SOZINHA NAO DISTINGUE
 *
 * A chave é uma declaração de quem digitou; a CAT é um documento. Confundir as duas
 * é como um sistema afirmar que o documento existe porque alguém disse que existe:
 *
 * - Existe CAT vinculada .................. o documento está no sistema
 * - Chave marcada e nenhuma CAT ........... alguém declarou, ninguém registrou
 * - Chave desmarcada com afastamento ...... a CAT é devida e não foi declarada
 *
 * A do meio é a pior, porque é a que passa por resolvida. Numa fiscalização o que
 * vale é a CAT, não a chave.
 */

export type SituacaoDaCat =
  /** Há CAT vinculada a este incidente. */
  | "REGISTRADA"
  /** A chave diz que foi emitida, mas não há CAT registrada no sistema. */
  | "DECLARADA_SEM_REGISTRO"
  /** Houve afastamento e a CAT não foi nem declarada. */
  | "DEVIDA_NAO_DECLARADA"
  /** Sem afastamento e sem declaração: nada a cobrar por aqui. */
  | "NAO_EXIGIDA";

export function situacaoDaCat(params: {
  catEmitida?: boolean | null;
  diasPerdidos?: number | null;
  /** Quantas CATs estão vinculadas a este incidente. */
  catsVinculadas: number;
}): SituacaoDaCat {
  // O documento vence a declaração: se a CAT está no sistema, a chave é redundante.
  if (params.catsVinculadas > 0) return "REGISTRADA";

  if (params.catEmitida === true) return "DECLARADA_SEM_REGISTRO";

  // Dia perdido significa afastamento, e afastamento significa lesão — qualquer que
  // seja o tipo escolhido no cadastro. Julgar pelo `tipo` deixaria passar o caso em
  // que alguém classificou como quase acidente e ainda assim lançou dias perdidos.
  const dias = Number(params.diasPerdidos ?? 0);
  if (Number.isFinite(dias) && dias > 0) return "DEVIDA_NAO_DECLARADA";

  return "NAO_EXIGIDA";
}

/** Verdadeiro para o que precisa de providência. */
export function catExigeAcao(situacao: SituacaoDaCat): boolean {
  return situacao === "DECLARADA_SEM_REGISTRO" || situacao === "DEVIDA_NAO_DECLARADA";
}

/**
 * O que dizer na tela.
 *
 * O prazo entra na frase porque é o que muda a urgência: CAT é comunicação com
 * prazo legal (primeiro dia útil seguinte ao acidente, e imediata em caso de
 * óbito), e sem essa informação o aviso parece burocracia adiável.
 */
export function mensagemDaCat(
  situacao: SituacaoDaCat
): { titulo: string; comoResolver: string } | null {
  switch (situacao) {
    case "DECLARADA_SEM_REGISTRO":
      return {
        titulo: "CAT marcada como emitida, mas não registrada no sistema",
        comoResolver:
          "A chave “CAT emitida” é uma declaração de quem preencheu o registro — ela não " +
          "cria a CAT. Registre a CAT para que ela fique vinculada a este incidente e entre " +
          "no relatório analítico do PCMSO.",
      };
    case "DEVIDA_NAO_DECLARADA":
      return {
        titulo: "Acidente com afastamento sem CAT",
        comoResolver:
          "Houve dias perdidos, então a CAT é devida. O prazo legal é o primeiro dia útil " +
          "seguinte ao acidente, e imediato em caso de óbito. Registre a CAT vinculada a " +
          "este incidente.",
      };
    default:
      return null;
  }
}

/**
 * Dados do incidente que a CAT herda, para o formulário já vir preenchido.
 *
 * Redigitar data, colaborador e dias de afastamento que já estão no incidente é
 * onde os dois registros começam a divergir — e divergência entre incidente e CAT
 * é exatamente o que aparece numa fiscalização.
 */
export interface HerancaParaCat {
  incidente_id: string;
  projeto_id: string | null;
  colaborador_id: string | null;
  data_acidente: string | null;
  descricao: string | null;
  dias_afastamento: number;
}

export function herancaParaCat(params: {
  incidenteId: string;
  projetoId?: string | null;
  /** Primeiro envolvido do incidente, quando houver. */
  colaboradorId?: string | null;
  dataOcorrencia?: string | null;
  titulo?: string | null;
  descricao?: string | null;
  diasPerdidos?: number | null;
}): HerancaParaCat {
  const dias = Number(params.diasPerdidos ?? 0);

  return {
    incidente_id: params.incidenteId,
    projeto_id: params.projetoId ?? null,
    colaborador_id: params.colaboradorId ?? null,
    // Só o dia: o incidente guarda data e hora, e a CAT tem campo de data.
    data_acidente: (params.dataOcorrencia ?? "").slice(0, 10) || null,
    // Descrição só de espaços conta como ausente e cai no título. `??` sozinho não
    // resolveria: ele desvia em nulo, não em branco, e a CAT sairia sem descrição
    // alguma tendo o título disponível ali do lado.
    descricao: (params.descricao ?? "").trim() || (params.titulo ?? "").trim() || null,
    dias_afastamento: Number.isFinite(dias) && dias > 0 ? dias : 0,
  };
}
