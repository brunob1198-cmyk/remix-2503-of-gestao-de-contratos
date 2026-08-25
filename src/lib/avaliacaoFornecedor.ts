/**
 * A avaliação de fornecedor: critérios, pesos, escala e o que cada nota significa.
 *
 * O modal de avaliação dizia "Avalie o fornecedor para atualizar o seu Score" e não
 * atualizava nada — gravava em `avaliacoes_fornecedor` e nunca tocava nas colunas de
 * score. Isso foi corrigido no banco. Este módulo resolve a outra metade do
 * problema: **o que a pessoa que avalia está sendo perguntada.**
 *
 * Antes, os quatro critérios eram quatro rótulos de duas palavras com cinco
 * estrelas ao lado. Nada dizia o que separa 3 de 4 estrelas, nada dizia que prazo
 * pesa o dobro de qualidade, e nada dizia que a nota entra numa média que decide
 * pedidos futuros. Quem avalia clica em 5 por gentileza, e o score deixa de
 * significar coisa alguma.
 *
 * A ESCALA, que é o ponto que mais confunde
 *
 * A nota é de 1 a 5 estrelas. O score guardado é de 0 a 100, porque é isso que a
 * tela de fornecedores e a importação por planilha sempre usaram. A conversão é
 * **nota × 20**, feita no banco, num lugar só. Aqui ela aparece de novo apenas para
 * a tela poder mostrar ao usuário quanto a nota dele vale em pontos.
 */

export type CriterioAvaliacao = "PRAZO" | "PRECO" | "QUALIDADE" | "RESPONSIVIDADE";

export interface DefinicaoCriterio {
  criterio: CriterioAvaliacao;
  /** Como o critério se chama na tela. */
  titulo: string;
  /** O que exatamente está sendo avaliado. Uma frase. */
  pergunta: string;
  /** Peso no score final, em fração. Soma 1 entre os quatro. */
  peso: number;
  /**
   * O que cada nota significa, de 1 a 5.
   *
   * Existe porque "3 estrelas" não quer dizer nada sem referência: dois
   * compradores dão notas diferentes para a mesma entrega, e a média deixa de ser
   * comparável entre fornecedores.
   */
  ancoras: Readonly<Record<1 | 2 | 3 | 4 | 5, string>>;
  /** Coluna correspondente em `avaliacoes_fornecedor`. */
  coluna: "nota_prazo" | "nota_preco" | "nota_qualidade" | "nota_responsividade";
}

/**
 * Os pesos vêm do gatilho `calculate_supplier_score`, que já existia no banco:
 * prazo 40%, preço 30%, qualidade 20%, responsividade 10%.
 *
 * Estão repetidos aqui só para a tela poder EXIBI-LOS. A conta continua sendo do
 * banco — duplicar o cálculo daria duas respostas para a mesma pergunta.
 */
export const CRITERIOS_AVALIACAO: readonly DefinicaoCriterio[] = [
  {
    criterio: "PRAZO",
    titulo: "Prazo de entrega",
    pergunta: "O fornecedor entregou na data que prometeu?",
    peso: 0.4,
    coluna: "nota_prazo",
    ancoras: {
      1: "Atrasou muito e sem avisar — parou serviço na obra",
      2: "Atrasou vários dias",
      3: "Atrasou pouco, ou avisou o atraso com antecedência",
      4: "Entregou na data combinada",
      5: "Entregou antes do prazo",
    },
  },
  {
    criterio: "PRECO",
    titulo: "Preço e condições",
    pergunta: "O preço e as condições de pagamento se sustentaram até o fim?",
    peso: 0.3,
    coluna: "nota_preco",
    ancoras: {
      1: "Cobrou acima do cotado, ou mudou a condição depois de fechado",
      2: "Preço acima do mercado, sem contrapartida",
      3: "Preço na média, condição cumprida",
      4: "Bom preço e condição de pagamento favorável",
      5: "Melhor preço do mercado com condição favorável",
    },
  },
  {
    criterio: "QUALIDADE",
    titulo: "Qualidade do material ou serviço",
    pergunta: "O que chegou era o que foi pedido, e em condição de uso?",
    peso: 0.2,
    coluna: "nota_qualidade",
    ancoras: {
      1: "Material fora de especificação ou avariado — houve retrabalho",
      2: "Precisou de troca ou complemento",
      3: "Conforme o pedido, sem sobras nem faltas",
      4: "Conforme, bem embalado e bem identificado",
      5: "Acima do especificado, sem nenhuma ocorrência",
    },
  },
  {
    criterio: "RESPONSIVIDADE",
    titulo: "Atendimento",
    pergunta: "Quando foi preciso falar com ele, ele respondeu?",
    peso: 0.1,
    coluna: "nota_responsividade",
    ancoras: {
      1: "Não respondeu, ou só respondeu depois de cobrança",
      2: "Demorou muito para responder",
      3: "Respondeu no tempo normal",
      4: "Respondeu rápido e resolveu",
      5: "Antecipou-se, avisou de problema antes de ser perguntado",
    },
  },
];

/** Pontos que uma nota vale no score de 0 a 100. */
export const PONTOS_POR_ESTRELA = 20;

export function pontosDaNota(nota: number): number {
  return Math.max(0, Math.min(5, nota)) * PONTOS_POR_ESTRELA;
}

/**
 * O score que a avaliação em tela produziria, se fosse a única do fornecedor.
 *
 * Serve para a pessoa ver, antes de salvar, o efeito do que está marcando. Não
 * substitui a conta do banco — que faz a média de todas as avaliações — e a tela
 * diz isso.
 */
export function scoreDaAvaliacao(notas: Record<CriterioAvaliacao, number>): number {
  const total = CRITERIOS_AVALIACAO.reduce(
    (soma, c) => soma + pontosDaNota(notas[c.criterio] ?? 0) * c.peso,
    0
  );
  return Math.round(total * 10) / 10;
}

// ─────────────────────────────────────────────────────────────────────────────
// O prazo medido, ao lado do prazo opinado
// ─────────────────────────────────────────────────────────────────────────────

export interface PrazoDoPedido {
  /** Dias que o fornecedor prometeu na cotação. */
  diasPrometidos: number | null;
  /** Dias decorridos entre a emissão e a entrega. */
  diasEntregues: number | null;
  /** Positivo é atraso, negativo é adiantamento. Nulo quando falta dado. */
  atrasoDias: number | null;
}

/**
 * O prazo REAL do pedido, calculado dos dados que o próprio pedido já tem.
 *
 * A nota de prazo é opinião; o atraso é fato, e o sistema conhece os dois. As
 * colunas `dias_prometidos`, `dias_entregues` e `atraso_dias` existiam na tabela de
 * avaliações e nenhuma tela as preenchia.
 *
 * Mostrar o atraso medido ANTES de a pessoa dar a nota é o que impede a avaliação
 * de virar gentileza: é difícil marcar cinco estrelas de prazo com "atrasou 9 dias"
 * escrito ao lado.
 */
export function prazoDoPedido(pedido: {
  prazo_entrega_dias?: number | null;
  data_emissao?: string | null;
  data_entrega_real?: string | null;
}): PrazoDoPedido {
  const prometidos =
    pedido.prazo_entrega_dias !== null &&
    pedido.prazo_entrega_dias !== undefined &&
    Number(pedido.prazo_entrega_dias) > 0
      ? Number(pedido.prazo_entrega_dias)
      : null;

  const entregues = diasEntre(pedido.data_emissao, pedido.data_entrega_real);

  return {
    diasPrometidos: prometidos,
    diasEntregues: entregues,
    // Sem os dois lados não há atraso a afirmar. Zero seria "entregou no prazo",
    // que é conclusão diferente de "não sei".
    atrasoDias: prometidos !== null && entregues !== null ? entregues - prometidos : null,
  };
}

/** Dias entre duas datas ISO, ignorando a hora. Nulo se faltar alguma. */
function diasEntre(inicio?: string | null, fim?: string | null): number | null {
  if (!inicio || !fim) return null;

  const a = new Date(`${inicio.slice(0, 10)}T12:00:00`);
  const b = new Date(`${fim.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;

  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** Frase pronta sobre o prazo, para a tela. */
export function textoDoPrazo(prazo: PrazoDoPedido): string {
  if (prazo.atrasoDias === null) {
    if (prazo.diasPrometidos === null && prazo.diasEntregues === null) {
      return "Sem prazo prometido nem data de entrega registrada — não há atraso a medir.";
    }
    if (prazo.diasPrometidos === null) {
      return `Entregue em ${prazo.diasEntregues} dia(s), mas o pedido não registrou prazo prometido.`;
    }
    return `Prazo prometido de ${prazo.diasPrometidos} dia(s), mas não há data de entrega registrada.`;
  }

  if (prazo.atrasoDias > 0) {
    return `Atrasou ${prazo.atrasoDias} dia(s): prometeu ${prazo.diasPrometidos} e entregou em ${prazo.diasEntregues}.`;
  }
  if (prazo.atrasoDias < 0) {
    return `Adiantou ${Math.abs(prazo.atrasoDias)} dia(s): prometeu ${prazo.diasPrometidos} e entregou em ${prazo.diasEntregues}.`;
  }
  return `Entregou exatamente no prazo: ${prazo.diasPrometidos} dia(s).`;
}

/** A nota de prazo que o atraso medido sugere. Sugestão, não imposição. */
export function notaSugeridaDePrazo(prazo: PrazoDoPedido): number | null {
  if (prazo.atrasoDias === null) return null;
  if (prazo.atrasoDias < 0) return 5;
  if (prazo.atrasoDias === 0) return 4;
  if (prazo.atrasoDias <= 2) return 3;
  if (prazo.atrasoDias <= 7) return 2;
  return 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// Leitura do score
// ─────────────────────────────────────────────────────────────────────────────

export type ForcaDoScore = "SEM_AVALIACAO" | "INDICIO_FRACO" | "CONSOLIDADO";

/**
 * Quanto o score pode ser levado a sério.
 *
 * Score 100 vindo de uma avaliação não é a mesma coisa que score 100 vindo de
 * vinte, e é com esse número que se decide para quem vai o pedido. Sem esta
 * distinção, o comparativo trataria as duas coisas como iguais.
 */
export function forcaDoScore(avaliacoesTotal?: number | null): ForcaDoScore {
  const total = Number(avaliacoesTotal ?? 0);
  if (total <= 0) return "SEM_AVALIACAO";
  if (total < 3) return "INDICIO_FRACO";
  return "CONSOLIDADO";
}

export const FORCA_DO_SCORE_LABEL: Record<ForcaDoScore, string> = {
  SEM_AVALIACAO: "Sem avaliação",
  INDICIO_FRACO: "Indício fraco",
  CONSOLIDADO: "Consolidado",
};

export function textoDaForca(avaliacoesTotal?: number | null): string {
  const total = Number(avaliacoesTotal ?? 0);
  const forca = forcaDoScore(total);

  if (forca === "SEM_AVALIACAO") {
    return "Nenhuma avaliação registrada. O score exibido vem do cadastro, não do histórico de entregas.";
  }
  if (forca === "INDICIO_FRACO") {
    return `Score baseado em ${total} avaliação(ões). Ainda é indício fraco — uma entrega ruim ou boa move muito a média.`;
  }
  return `Score baseado em ${total} avaliações do histórico de entregas.`;
}
