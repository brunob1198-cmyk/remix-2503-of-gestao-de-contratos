/**
 * Completude do inventário de riscos contra a NR-01 1.5.7.3.2.
 *
 * A norma lista o que o inventário precisa conter. Antes desta fase o sistema
 * atendia 5 das 9 alíneas e não avisava nada sobre as outras — o usuário emitia
 * um PGR incompleto sem saber que estava incompleto.
 *
 * Aqui a checagem é explícita e por alínea, para a tela e o PDF apontarem
 * exatamente o que falta em vez de dizer "preencha melhor".
 */

export type TipoExposicao = "HABITUAL" | "OCASIONAL" | "EVENTUAL";
export type TecnicaAvaliacao = "QUALITATIVA" | "QUANTITATIVA";
export type ResultadoAvaliacao = "ABAIXO_LIMITE" | "ACIMA_LIMITE" | "NAO_APLICAVEL";

export const TIPO_EXPOSICAO_LABEL: Record<TipoExposicao, string> = {
  HABITUAL: "Habitual",
  OCASIONAL: "Ocasional",
  EVENTUAL: "Eventual",
};

export const RESULTADO_AVALIACAO_LABEL: Record<ResultadoAvaliacao, string> = {
  ABAIXO_LIMITE: "Abaixo do limite",
  ACIMA_LIMITE: "Acima do limite",
  NAO_APLICAVEL: "Não aplicável",
};

/** Só o que a checagem de completude precisa ler. */
export interface ItemInventarioConformidade {
  atividade?: string | null;
  perigo?: string | null;
  fonte_geradora?: string | null;
  consequencia?: string | null;
  descricao_local?: string | null;
  area_id?: string | null;
  tipo_exposicao?: TipoExposicao | null;
  tempo_exposicao?: string | null;
  grupos_expostos?: string | null;
  trabalhadores_expostos?: number | null;
  /** Quantas funções foram vinculadas ao item. */
  totalFuncoes?: number;
  probabilidade?: number | null;
  severidade?: number | null;
  /**
   * Texto legado. As medidas passaram a ser cadastradas no gerenciador, com tipo,
   * responsável, prazo e aferição; este campo continua satisfazendo a alínea para
   * os itens antigos que só têm texto.
   */
  medidas_existentes?: string | null;
  /**
   * Quantas medidas do gerenciador já estão implantadas neste item. É a forma
   * atual de atender a alínea "h": ela pede que as medidas EXISTENTES estejam
   * registradas, e não que estejam registradas como texto corrido.
   */
  medidasImplantadas?: number;
  tecnica_avaliacao?: TecnicaAvaliacao | null;
  intensidade_medida?: number | null;
  data_medicao?: string | null;
  resultado_avaliacao?: ResultadoAvaliacao | null;
}

export interface AlineaPendente {
  /** Referência da alínea na NR-01, para o usuário poder conferir na norma. */
  alinea: string;
  titulo: string;
  detalhe: string;
}

function vazio(valor: string | null | undefined): boolean {
  return !valor || valor.trim().length === 0;
}

/**
 * Alíneas do inventário que o item não atende.
 *
 * Lista vazia significa item completo pela norma. A ordem segue a da NR-01, para
 * quem confere de norma na mão acompanhar.
 */
export function alineasPendentes(item: ItemInventarioConformidade): AlineaPendente[] {
  const faltas: AlineaPendente[] = [];

  if (vazio(item.perigo)) {
    faltas.push({
      alinea: "a",
      titulo: "Descrição do perigo",
      detalhe: "O perigo ou fator de risco precisa estar descrito.",
    });
  }

  if (vazio(item.consequencia)) {
    faltas.push({
      alinea: "b",
      titulo: "Lesões ou agravos possíveis",
      detalhe: "Informe o dano à saúde que o perigo pode causar.",
    });
  }

  if (vazio(item.fonte_geradora)) {
    faltas.push({
      alinea: "c",
      titulo: "Fonte ou circunstância",
      detalhe: "De onde vem o risco: equipamento, atividade ou condição.",
    });
  }

  // O cadastro de área diz onde no organograma; a descrição diz como é o lugar
  // (ventilação, confinamento, iluminação), que é o que caracteriza a exposição.
  if (vazio(item.descricao_local) && !item.area_id) {
    faltas.push({
      alinea: "d",
      titulo: "Local ou ambiente",
      detalhe: "Vincule uma área ou descreva o ambiente onde a exposição ocorre.",
    });
  }

  if (!item.tipo_exposicao) {
    faltas.push({
      alinea: "e",
      titulo: "Caracterização da exposição",
      detalhe: "Diga se a exposição é habitual, ocasional ou eventual.",
    });
  }

  // Grupo expostos: função vinculada OU descrição em texto. Só o número não
  // basta — a norma pede QUAIS grupos, e um número não identifica ninguém.
  if ((item.totalFuncoes ?? 0) === 0 && vazio(item.grupos_expostos)) {
    faltas.push({
      alinea: "f",
      titulo: "Grupos de trabalhadores expostos",
      detalhe:
        "Vincule as funções expostas ou descreva o grupo. A quantidade de expostos, sozinha, não identifica quem está exposto.",
    });
  }

  if (!item.probabilidade || !item.severidade) {
    faltas.push({
      alinea: "g",
      titulo: "Avaliação do nível de risco",
      detalhe: "Probabilidade e severidade precisam estar preenchidas.",
    });
  }

  // Alínea "h" — medidas de prevenção existentes.
  //
  // Aceita as duas formas: uma medida já implantada no gerenciador, ou o texto
  // legado dos itens cadastrados antes de o gerenciador existir. A alínea pede
  // que as medidas existentes estejam registradas, não que sejam texto corrido —
  // e a medida do gerenciador registra mais: tipo de controle na hierarquia da
  // NR-01, responsável, prazo e aferição de eficácia.
  const semMedidaImplantada = (item.medidasImplantadas ?? 0) === 0;
  if (semMedidaImplantada && vazio(item.medidas_existentes)) {
    faltas.push({
      alinea: "h",
      titulo: "Medidas de prevenção existentes",
      detalhe:
        "Cadastre no gerenciador de medidas o que já existe de controle, com o tipo na " +
        "hierarquia da NR-01. Se não há nenhuma medida ainda, o plano de ação é o que " +
        "responde por isso.",
    });
  }

  // Alínea dos dados de monitoramento. Só cobrada quando a avaliação é
  // quantitativa: exigir medição instrumental de risco de acidente seria
  // cobrança indevida e ensinaria o usuário a ignorar o aviso.
  if (item.tecnica_avaliacao === "QUANTITATIVA") {
    if (item.intensidade_medida === null || item.intensidade_medida === undefined) {
      faltas.push({
        alinea: "i",
        titulo: "Dados de monitoramento",
        detalhe:
          "Avaliação quantitativa exige a intensidade medida. Sem medição não há como sustentar a classificação do risco.",
      });
    } else if (!item.data_medicao) {
      faltas.push({
        alinea: "i",
        titulo: "Data da medição",
        detalhe: "Medição sem data não permite saber se ainda representa a condição atual.",
      });
    } else if (!item.resultado_avaliacao) {
      faltas.push({
        alinea: "i",
        titulo: "Conclusão da medição",
        detalhe:
          "Declare se o resultado ficou abaixo ou acima do limite. A conclusão é declarada porque há agente cujo limite é piso, não teto.",
      });
    }
  }

  return faltas;
}

export interface ResumoConformidade {
  total: number;
  completos: number;
  incompletos: number;
  /** Alíneas mais frequentemente ausentes, da mais comum para a menos. */
  alineasMaisAusentes: { alinea: string; titulo: string; ocorrencias: number }[];
}

/** Panorama do inventário inteiro, para o cartão de indicador e o PDF. */
export function resumoConformidade(
  itens: readonly ItemInventarioConformidade[]
): ResumoConformidade {
  const contagem = new Map<string, { titulo: string; ocorrencias: number }>();
  let completos = 0;

  for (const item of itens) {
    const faltas = alineasPendentes(item);
    if (faltas.length === 0) {
      completos += 1;
      continue;
    }

    // Um item pode ter duas faltas da mesma alínea "i" em teoria; o Set evita
    // contar a mesma alínea duas vezes para o mesmo item.
    for (const alinea of new Set(faltas.map((f) => f.alinea))) {
      const titulo = faltas.find((f) => f.alinea === alinea)?.titulo ?? alinea;
      const atual = contagem.get(alinea);
      contagem.set(alinea, {
        titulo,
        ocorrencias: (atual?.ocorrencias ?? 0) + 1,
      });
    }
  }

  const alineasMaisAusentes = [...contagem.entries()]
    .map(([alinea, dados]) => ({ alinea, ...dados }))
    .sort((a, b) => b.ocorrencias - a.ocorrencias || a.alinea.localeCompare(b.alinea));

  return {
    total: itens.length,
    completos,
    incompletos: itens.length - completos,
    alineasMaisAusentes,
  };
}
