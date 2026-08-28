/**
 * Base legal dos documentos do SGSST.
 *
 * Um programa impresso sem a base legal declarada obriga quem lê — auditor,
 * cliente, sindicato — a confiar que o autor conhecia as normas. Declarar as
 * referências é o que permite conferir o escopo do documento em vez de supô-lo.
 *
 * Duas regras neste arquivo:
 *
 * 1. **Nada de número de portaria que eu não possa sustentar.** As normas são
 *    republicadas com frequência, e citar a portaria errada num documento de
 *    conformidade é pior que citar só a norma. Onde a redação vigente muda,
 *    aparece "e alterações posteriores" em vez de um número inventado.
 *
 * 2. **Isto é a base legal OBSERVADA, não um atestado de conformidade.** O
 *    documento lista o que o programa toma como referência; dizer que o programa
 *    "atende" a norma é conclusão de quem assina, não do sistema.
 */

export interface ReferenciaLegal {
  /** Como se cita. Ex.: "NR-07". */
  norma: string;
  /** O que ela governa, em uma linha. */
  ementa: string;
  /**
   * Por que ela entra NESTE documento. É o que transforma uma lista de siglas em
   * informação: sem isto, ninguém sabe se a norma é central ou tangencial.
   */
  pertinencia: string;
}

/** Fundamento comum a qualquer programa de SST no Brasil. */
const FUNDAMENTO: ReferenciaLegal[] = [
  {
    norma: "CLT, Capítulo V do Título II",
    ementa: "Segurança e Medicina do Trabalho (artigos 154 a 201).",
    pertinencia:
      "É a lei que dá competência às Normas Regulamentadoras. Sem ela as NRs não " +
      "obrigariam ninguém.",
  },
  {
    norma: "Portaria MTb n.º 3.214, de 8 de junho de 1978",
    ementa: "Aprovou as Normas Regulamentadoras originais.",
    pertinencia:
      "Marco de origem das NRs citadas adiante, todas já com alterações posteriores.",
  },
  {
    norma: "NR-01 — e alterações posteriores",
    ementa:
      "Disposições gerais e Gerenciamento de Riscos Ocupacionais (GRO), do qual o " +
      "PGR é o programa.",
    pertinencia:
      "Define o inventário de riscos e o plano de ação, e é a referência com a qual " +
      "este programa tem de estar articulado.",
  },
];

/** LGPD e previdência: entram onde o documento trata de dado de saúde. */
const DADO_DE_SAUDE: ReferenciaLegal[] = [
  {
    norma: "Lei n.º 8.213, de 24 de julho de 1991",
    ementa: "Planos de Benefícios da Previdência Social.",
    pertinencia:
      "Fundamenta o nexo entre agravo e trabalho, a CAT e o benefício por " +
      "incapacidade.",
  },
  {
    norma: "Decreto n.º 3.048, de 6 de maio de 1999",
    ementa: "Regulamento da Previdência Social.",
    pertinencia:
      "Regulamenta a Lei 8.213 e traz a lista de agentes nocivos usada na " +
      "caracterização da exposição.",
  },
  {
    norma: "Instrução Normativa INSS n.º 128, de 28 de março de 2022",
    ementa: "Procedimentos e rotinas dos benefícios do INSS.",
    pertinencia:
      "Orienta a instrução dos requerimentos que se apoiam nos registros de saúde " +
      "ocupacional.",
  },
  {
    norma: "Lei n.º 13.709, de 14 de agosto de 2018 (LGPD)",
    ementa: "Proteção de dados pessoais.",
    pertinencia:
      "Resultado de exame e conclusão de aptidão são dado pessoal SENSÍVEL. " +
      "Circulam com finalidade e acesso restritos, e o diagnóstico não vai para " +
      "quem só precisa saber se há aptidão.",
  },
];

/**
 * Base legal do PCMSO.
 *
 * A NR-07 é o centro; a NR-01 entra porque o PCMSO se planeja a partir do
 * inventário de riscos, e a NR-17 porque agravo ergonômico é a queixa que mais
 * aparece em exame periódico sem ter risco mapeado.
 */
export const BASE_LEGAL_PCMSO: ReferenciaLegal[] = [
  ...FUNDAMENTO,
  {
    norma: "NR-07 — redação inicial pela Portaria SSST n.º 24, de 29 de dezembro de 1994, e alterações posteriores",
    ementa: "Programa de Controle Médico de Saúde Ocupacional (PCMSO).",
    pertinencia: "É a norma que institui este programa e define seu conteúdo mínimo.",
  },
  {
    norma: "NR-17 — e alterações posteriores",
    ementa: "Ergonomia.",
    pertinencia:
      "O exame periódico é onde o agravo ergonômico aparece primeiro, e ele " +
      "frequentemente não tem risco correspondente no inventário.",
  },
  ...DADO_DE_SAUDE,
];

/**
 * Base legal do PGR.
 *
 * A NR-01 é o centro. A NR-09 entra pela avaliação de agentes, e a NR-15 porque
 * é dela que saem os limites de tolerância comparados no monitoramento.
 */
export const BASE_LEGAL_PGR: ReferenciaLegal[] = [
  ...FUNDAMENTO,
  {
    norma: "NR-09 — e alterações posteriores",
    ementa: "Avaliação e controle das exposições a agentes físicos, químicos e biológicos.",
    pertinencia:
      "Orienta como a exposição é avaliada, inclusive quando a avaliação precisa ser " +
      "quantitativa.",
  },
  {
    norma: "NR-15 — e alterações posteriores",
    ementa: "Atividades e operações insalubres, com os limites de tolerância.",
    pertinencia:
      "É a fonte dos limites contra os quais as medições do inventário são " +
      "comparadas.",
  },
  {
    norma: "NR-07 — e alterações posteriores",
    ementa: "Controle médico de saúde ocupacional.",
    pertinencia:
      "O inventário de riscos deste programa é o que dimensiona os exames do PCMSO.",
  },
  {
    norma: "Lei n.º 13.709, de 14 de agosto de 2018 (LGPD)",
    ementa: "Proteção de dados pessoais.",
    pertinencia:
      "O inventário nomeia grupos expostos; a identificação de trabalhador " +
      "exposto é dado pessoal.",
  },
];
