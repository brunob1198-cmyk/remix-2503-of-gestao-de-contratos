/**
 * Avaliação atmosférica de espaço confinado — NR-33.
 *
 * A PT já cobria os tipos de trabalho que a norma exige, mas não guardava o
 * registro que a NR-33 coloca ANTES da entrada: a medição de oxigênio,
 * inflamáveis e contaminantes. Sem ele, uma PT de espaço confinado podia ser
 * aprovada e executada sem que ninguém tivesse medido nada.
 *
 * VALORES, conferidos no texto oficial da norma:
 *  - 33.5.15.2 — entrada aceitável com oxigênio entre 19,5% e 23% em volume.
 *  - Glossário — "deficiência de oxigênio" é atmosfera com menos de 20,9%;
 *    "enriquecimento" é mais de 23%. Logo, a faixa 19,5%–20,9% já é deficiência,
 *    e só é admitida quando a causa da variação é conhecida e controlada.
 *  - Anexo II (modelo de PET) — inflamáveis abaixo de 10% do LIE.
 *  - Contaminantes tóxicos — a NR-33 não fixa limite próprio; remete ao PGR
 *    (NR-01) e aos limites da NR-15. Por isso o limite vem informado na medição.
 *
 * A regra que atravessa tudo aqui: **na ausência de dado, NÃO libera.** Este é o
 * único módulo do sistema em que o erro custa vida — presumir que está seguro
 * porque falta informação é exatamente o erro que mata.
 */

export const OXIGENIO_MINIMO_ENTRADA = 19.5;
export const OXIGENIO_DEFICIENCIA = 20.9;
export const OXIGENIO_MAXIMO = 23;
export const INFLAMAVEIS_MAXIMO_LIE = 10;

export type MomentoMedicao = "ANTES_ENTRADA" | "DURANTE" | "APOS_INTERRUPCAO";

export const MOMENTO_LABEL: Record<MomentoMedicao, string> = {
  ANTES_ENTRADA: "Antes da entrada",
  DURANTE: "Durante a permanência",
  APOS_INTERRUPCAO: "Após interrupção",
};

export const MOMENTO_AJUDA: Record<MomentoMedicao, string> = {
  ANTES_ENTRADA:
    "Condição de entrada: nenhum trabalhador entra antes desta medição estar registrada e aprovada.",
  DURANTE:
    "Monitoramento durante a permanência. A atmosfera pode mudar com o trabalho — solda consome oxigênio, limpeza libera vapor.",
  APOS_INTERRUPCAO:
    "Nova medição depois de o espaço ficar sem vigilância. Não se retoma a entrada com a medição antiga.",
};

export type SituacaoParametro = "APROVADO" | "REPROVADO" | "NAO_MEDIDO" | "ATENCAO";

export interface AvaliacaoParametro {
  situacao: SituacaoParametro;
  /** Explicação pronta para a interface, dizendo o motivo e o critério. */
  mensagem: string;
}

/** Só o que a avaliação precisa ler de uma medição. */
export interface MedicaoAtmosfera {
  id?: string;
  medido_em?: string | null;
  momento?: MomentoMedicao | null;
  oxigenio_percentual?: number | null;
  causa_variacao_conhecida?: boolean | null;
  inflamaveis_percentual_lie?: number | null;
  contaminante_nome?: string | null;
  contaminante_valor?: number | null;
  contaminante_unidade?: string | null;
  contaminante_limite?: number | null;
  calibracao_validade?: string | null;
}

function numero(valor: number): string {
  return String(valor).replace(".", ",");
}

/**
 * Oxigênio contra o critério de entrada da 33.5.15.2.
 *
 * A faixa entre 19,5% e 20,9% é deficiência de oxigênio: aprovada apenas quando
 * a causa da variação foi declarada como conhecida e controlada. Sem essa
 * declaração, fica em ATENCAO — que não libera.
 */
export function avaliarOxigenio(
  percentual: number | null | undefined,
  causaConhecida?: boolean | null
): AvaliacaoParametro {
  if (percentual === null || percentual === undefined) {
    return { situacao: "NAO_MEDIDO", mensagem: "Oxigênio não medido." };
  }

  if (percentual < OXIGENIO_MINIMO_ENTRADA) {
    return {
      situacao: "REPROVADO",
      mensagem: `${numero(percentual)}% de O₂ está abaixo do mínimo de ${numero(
        OXIGENIO_MINIMO_ENTRADA
      )}% da NR-33 33.5.15.2. Entrada proibida.`,
    };
  }

  if (percentual > OXIGENIO_MAXIMO) {
    return {
      situacao: "REPROVADO",
      mensagem: `${numero(percentual)}% de O₂ caracteriza atmosfera enriquecida (acima de ${numero(
        OXIGENIO_MAXIMO
      )}%). Risco de combustão acelerada. Entrada proibida.`,
    };
  }

  if (percentual < OXIGENIO_DEFICIENCIA) {
    if (causaConhecida) {
      return {
        situacao: "APROVADO",
        mensagem: `${numero(percentual)}% de O₂ é deficiência de oxigênio (abaixo de ${numero(
          OXIGENIO_DEFICIENCIA
        )}%), aceita porque a causa da variação foi declarada conhecida e controlada.`,
      };
    }
    return {
      situacao: "ATENCAO",
      mensagem: `${numero(percentual)}% de O₂ é deficiência de oxigênio (abaixo de ${numero(
        OXIGENIO_DEFICIENCIA
      )}%). A norma só admite a entrada se a causa da variação for conhecida e controlada — declare isso na medição ou corrija a atmosfera.`,
    };
  }

  return {
    situacao: "APROVADO",
    mensagem: `${numero(percentual)}% de O₂ está na faixa normal.`,
  };
}

/** Inflamáveis contra o limite de 10% do LIE do Anexo II. */
export function avaliarInflamaveis(
  percentualLie: number | null | undefined
): AvaliacaoParametro {
  if (percentualLie === null || percentualLie === undefined) {
    return { situacao: "NAO_MEDIDO", mensagem: "Gases inflamáveis não medidos." };
  }

  if (percentualLie >= INFLAMAVEIS_MAXIMO_LIE) {
    return {
      situacao: "REPROVADO",
      mensagem: `${numero(percentualLie)}% do LIE atinge ou passa o limite de ${
        INFLAMAVEIS_MAXIMO_LIE
      }% do Anexo II da NR-33. Entrada proibida.`,
    };
  }

  return {
    situacao: "APROVADO",
    mensagem: `${numero(percentualLie)}% do LIE está abaixo do limite de ${
      INFLAMAVEIS_MAXIMO_LIE
    }%.`,
  };
}

/**
 * Contaminante contra o limite informado.
 *
 * O limite vem da medição porque a NR-33 não fixa valor próprio: remete ao PGR e
 * à NR-15, e o valor varia por substância. Valor medido sem limite informado
 * fica em ATENCAO — há um número, mas nada contra o que compará-lo.
 */
export function avaliarContaminante(medicao: MedicaoAtmosfera): AvaliacaoParametro {
  const { contaminante_valor: valor, contaminante_limite: limite } = medicao;
  const nome = medicao.contaminante_nome?.trim() || "Contaminante";
  const unidade = medicao.contaminante_unidade?.trim() || "";
  const sufixo = unidade ? ` ${unidade}` : "";

  if (valor === null || valor === undefined) {
    return { situacao: "NAO_MEDIDO", mensagem: "Contaminantes tóxicos não medidos." };
  }

  if (limite === null || limite === undefined) {
    return {
      situacao: "ATENCAO",
      mensagem: `${nome} medido em ${numero(valor)}${sufixo}, mas sem limite de tolerância informado. A NR-33 não fixa limite próprio — informe o valor da NR-15 ou do PGR para o sistema poder concluir.`,
    };
  }

  if (valor > limite) {
    return {
      situacao: "REPROVADO",
      mensagem: `${nome} em ${numero(valor)}${sufixo} passa o limite de ${numero(
        limite
      )}${sufixo}. Entrada proibida.`,
    };
  }

  return {
    situacao: "APROVADO",
    mensagem: `${nome} em ${numero(valor)}${sufixo} está dentro do limite de ${numero(
      limite
    )}${sufixo}.`,
  };
}

/** Detector com calibração vencida não serve como avaliação. */
export function avaliarCalibracao(
  validade: string | null | undefined,
  hoje: Date
): AvaliacaoParametro {
  if (!validade) {
    return {
      situacao: "ATENCAO",
      mensagem:
        "Validade da calibração do detector não informada. A NR-33 exige equipamento adequado e calibrado.",
    };
  }

  const vencimento = new Date(`${validade}T00:00:00`);
  if (vencimento < new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) {
    return {
      situacao: "REPROVADO",
      mensagem: `Calibração do detector venceu em ${vencimento.toLocaleDateString(
        "pt-BR"
      )}. Medição feita com detector descalibrado não serve como avaliação atmosférica.`,
    };
  }

  return {
    situacao: "APROVADO",
    mensagem: `Calibração do detector válida até ${vencimento.toLocaleDateString("pt-BR")}.`,
  };
}

export interface AvaliacaoMedicao {
  oxigenio: AvaliacaoParametro;
  inflamaveis: AvaliacaoParametro;
  contaminante: AvaliacaoParametro;
  calibracao: AvaliacaoParametro;
  /** True somente quando nada reprova e nada fica em atenção. */
  liberado: boolean;
  /** Motivos que impedem a liberação, prontos para exibir. */
  impedimentos: string[];
}

/**
 * Avalia uma medição inteira.
 *
 * `liberado` exige que todo parâmetro medido esteja aprovado E que oxigênio e
 * inflamáveis tenham sido medidos. São os dois que a norma trata como condição
 * de entrada: contaminante não medido é lacuna grave, mas há espaço confinado
 * sem contaminante esperado — oxigênio e inflamáveis, não.
 */
export function avaliarMedicao(medicao: MedicaoAtmosfera, hoje: Date): AvaliacaoMedicao {
  const oxigenio = avaliarOxigenio(medicao.oxigenio_percentual, medicao.causa_variacao_conhecida);
  const inflamaveis = avaliarInflamaveis(medicao.inflamaveis_percentual_lie);
  const contaminante = avaliarContaminante(medicao);
  const calibracao = avaliarCalibracao(medicao.calibracao_validade, hoje);

  const impedimentos: string[] = [];

  for (const avaliacao of [oxigenio, inflamaveis, contaminante, calibracao]) {
    if (avaliacao.situacao === "REPROVADO" || avaliacao.situacao === "ATENCAO") {
      impedimentos.push(avaliacao.mensagem);
    }
  }

  // Contaminante não medido não impede: há espaço confinado sem contaminante
  // esperado. Oxigênio e inflamáveis impedem, porque a norma os trata como
  // condição de entrada.
  if (oxigenio.situacao === "NAO_MEDIDO") impedimentos.push(oxigenio.mensagem);
  if (inflamaveis.situacao === "NAO_MEDIDO") impedimentos.push(inflamaveis.mensagem);

  return {
    oxigenio,
    inflamaveis,
    contaminante,
    calibracao,
    liberado: impedimentos.length === 0,
    impedimentos,
  };
}

export interface LiberacaoEntrada {
  /** True quando há medição pré-entrada válida e vigia designado. */
  liberado: boolean;
  /** Tudo que falta para liberar, pronto para exibir. */
  impedimentos: string[];
  /** A medição pré-entrada mais recente, se houver. */
  medicaoVigente: MedicaoAtmosfera | null;
}

/** Papel que a NR-33 exige presente durante toda a permanência. */
export const PAPEL_VIGIA = "Vigia";

/**
 * A PT de espaço confinado pode ser liberada?
 *
 * Duas condições que a norma trata como inegociáveis: avaliação atmosférica
 * prévia aprovada, e vigia designado. Sem qualquer uma delas a entrada é
 * proibida, não "não recomendada".
 */
export function avaliarLiberacaoEntrada(params: {
  medicoes: readonly MedicaoAtmosfera[];
  /** Responsabilidades dos participantes, como estão cadastradas. */
  responsabilidades: readonly (string | null | undefined)[];
  hoje: Date;
}): LiberacaoEntrada {
  const { medicoes, responsabilidades, hoje } = params;
  const impedimentos: string[] = [];

  const preEntrada = medicoes
    .filter((m) => (m.momento ?? "ANTES_ENTRADA") === "ANTES_ENTRADA")
    // Mais recente primeiro. Medição antiga não vale quando há uma nova.
    .sort((a, b) => (b.medido_em ?? "").localeCompare(a.medido_em ?? ""));

  const medicaoVigente = preEntrada[0] ?? null;

  if (!medicaoVigente) {
    impedimentos.push(
      "Nenhuma avaliação atmosférica registrada antes da entrada. A NR-33 proíbe a entrada sem ela."
    );
  } else {
    const avaliacao = avaliarMedicao(medicaoVigente, hoje);
    impedimentos.push(...avaliacao.impedimentos);
  }

  const temVigia = responsabilidades.some(
    (r) => (r ?? "").trim().toLowerCase() === PAPEL_VIGIA.toLowerCase()
  );

  if (!temVigia) {
    impedimentos.push(
      "Nenhum participante designado como Vigia. A NR-33 exige vigia do lado de fora durante toda a permanência."
    );
  }

  return { liberado: impedimentos.length === 0, impedimentos, medicaoVigente };
}
