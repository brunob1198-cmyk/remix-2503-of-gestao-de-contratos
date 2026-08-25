/**
 * Catálogo de agentes de risco do ASO.
 *
 * O ASO trazia os perigos como TEXTO LIVRE num campo só. Dois problemas:
 *
 * 1. **Não é o que os modelos de ASO fazem.** Toda ficha de ASO em uso — a da
 *    portaria SSST 24/1994 e as que a sucederam — traz os agentes em lista de
 *    marcação, agrupados por categoria. Texto livre obriga quem emite a redigir de
 *    novo, a cada ASO, o que já é um vocabulário fechado.
 *
 * 2. **Texto livre não se conta nem se confere.** "Ruído" num ASO, "ruido
 *    excessivo" em outro e "exposição a ruído" num terceiro são o mesmo agente e
 *    três strings diferentes. Marcado por código, o mesmo agente é o mesmo agente
 *    em toda a base — e passa a ser possível responder "quantos trabalhadores
 *    expostos a ruído".
 *
 * As cinco categorias e os agentes são os da ficha da portaria SSST 24, que é o
 * vocabulário que os serviços de saúde ocupacional do país usam. A descrição em
 * texto continua existindo, e agora como COMPLEMENTO: é onde entra o que a lista
 * não cobre e a classificação vinda do inventário do PGR.
 *
 * NR-07 7.5.15.1 alínea "b" pede os perigos "ou a sua inexistência" — por isso a
 * ausência de risco é uma afirmação própria (`sem_risco_especifico`) e não a
 * simples lista vazia. Lista vazia é "ninguém preencheu".
 */

export type CategoriaRiscoAso =
  | "FISICO"
  | "QUIMICO"
  | "BIOLOGICO"
  | "ERGONOMICO"
  | "ACIDENTE";

export const CATEGORIA_RISCO_ASO_LABEL: Record<CategoriaRiscoAso, string> = {
  FISICO: "Físicos",
  QUIMICO: "Químicos",
  BIOLOGICO: "Biológicos",
  ERGONOMICO: "Ergonômicos",
  ACIDENTE: "Acidentes",
};

/** A ordem em que as categorias saem na folha. */
export const CATEGORIAS_RISCO_ASO: readonly CategoriaRiscoAso[] = [
  "FISICO",
  "QUIMICO",
  "BIOLOGICO",
  "ERGONOMICO",
  "ACIDENTE",
];

export interface AgenteDeRiscoAso {
  /**
   * Identificador estável, gravado no banco.
   *
   * Nunca renomear: o código é o que liga o ASO emitido em 2026 à lista de hoje.
   * Agente que sai de uso é marcado como obsoleto, não removido.
   */
  codigo: string;
  nome: string;
  categoria: CategoriaRiscoAso;
}

export const AGENTES_RISCO_ASO: readonly AgenteDeRiscoAso[] = [
  // Físicos
  { codigo: "FIS_RUIDO", nome: "Ruídos", categoria: "FISICO" },
  { codigo: "FIS_VIBRACAO", nome: "Vibrações", categoria: "FISICO" },
  { codigo: "FIS_RAD_IONIZANTE", nome: "Radiações ionizantes", categoria: "FISICO" },
  { codigo: "FIS_RAD_NAO_IONIZANTE", nome: "Radiações não ionizantes", categoria: "FISICO" },
  { codigo: "FIS_FRIO", nome: "Frio", categoria: "FISICO" },
  { codigo: "FIS_PRESSAO_ANORMAL", nome: "Pressões anormais", categoria: "FISICO" },
  { codigo: "FIS_UMIDADE", nome: "Umidade", categoria: "FISICO" },
  { codigo: "FIS_CALOR", nome: "Calor", categoria: "FISICO" },

  // Químicos
  { codigo: "QUI_POEIRA", nome: "Poeiras", categoria: "QUIMICO" },
  { codigo: "QUI_FUMO", nome: "Fumos", categoria: "QUIMICO" },
  { codigo: "QUI_NEVOA", nome: "Névoas", categoria: "QUIMICO" },
  { codigo: "QUI_NEBLINA", nome: "Neblinas", categoria: "QUIMICO" },
  { codigo: "QUI_GAS", nome: "Gases", categoria: "QUIMICO" },
  { codigo: "QUI_VAPOR", nome: "Vapores", categoria: "QUIMICO" },
  { codigo: "QUI_OUTROS_PRODUTOS", nome: "Outros produtos químicos", categoria: "QUIMICO" },

  // Biológicos
  { codigo: "BIO_BACILO", nome: "Bacilos", categoria: "BIOLOGICO" },
  { codigo: "BIO_BACTERIA", nome: "Bactérias", categoria: "BIOLOGICO" },
  { codigo: "BIO_FUNGO", nome: "Fungos", categoria: "BIOLOGICO" },
  { codigo: "BIO_PARASITA", nome: "Parasitas", categoria: "BIOLOGICO" },
  { codigo: "BIO_PROTOZOARIO", nome: "Protozoários", categoria: "BIOLOGICO" },
  { codigo: "BIO_VIRUS", nome: "Vírus", categoria: "BIOLOGICO" },

  // Ergonômicos
  { codigo: "ERG_ESFORCO_INTENSO", nome: "Esforço físico intenso", categoria: "ERGONOMICO" },
  { codigo: "ERG_LEVANTAMENTO_PESO", nome: "Levantamento manual de peso", categoria: "ERGONOMICO" },
  { codigo: "ERG_POSTURA", nome: "Postura inadequada", categoria: "ERGONOMICO" },
  { codigo: "ERG_MONOTONIA", nome: "Monotonia e repetitividade", categoria: "ERGONOMICO" },
  { codigo: "ERG_RITMO_EXCESSIVO", nome: "Ritmos excessivos", categoria: "ERGONOMICO" },
  { codigo: "ERG_TURNO_NOTURNO", nome: "Trabalho em turno ou noturno", categoria: "ERGONOMICO" },
  { codigo: "ERG_TRANSPORTE_PESO", nome: "Transporte manual de peso", categoria: "ERGONOMICO" },
  { codigo: "ERG_JORNADA_PROLONGADA", nome: "Jornada prolongada", categoria: "ERGONOMICO" },

  // Acidentes
  { codigo: "ACI_ARRANJO_FISICO", nome: "Arranjo físico inadequado", categoria: "ACIDENTE" },
  { codigo: "ACI_CHOQUE_ELETRICO", nome: "Choque elétrico", categoria: "ACIDENTE" },
  { codigo: "ACI_ANIMAL_PECONHENTO", nome: "Animais peçonhentos", categoria: "ACIDENTE" },
  { codigo: "ACI_ARMAZENAGEM", nome: "Armazenagem inadequada", categoria: "ACIDENTE" },
  { codigo: "ACI_INCENDIO_EXPLOSAO", nome: "Incêndios e explosões", categoria: "ACIDENTE" },
  { codigo: "ACI_AFOGAMENTO", nome: "Afogamentos", categoria: "ACIDENTE" },
  { codigo: "ACI_QUEIMADURA", nome: "Queimaduras", categoria: "ACIDENTE" },
  { codigo: "ACI_TRANSITO", nome: "Trânsito", categoria: "ACIDENTE" },
  { codigo: "ACI_QUEDA", nome: "Quedas", categoria: "ACIDENTE" },
  { codigo: "ACI_CORTE", nome: "Cortes", categoria: "ACIDENTE" },
  { codigo: "ACI_ESPACO_CONFINADO", nome: "Espaço confinado", categoria: "ACIDENTE" },
  { codigo: "ACI_ALTURA", nome: "Trabalho em altura", categoria: "ACIDENTE" },
];

/** Índice por código, para resolver o que está marcado sem varrer a lista. */
const POR_CODIGO = new Map(AGENTES_RISCO_ASO.map((a) => [a.codigo, a]));

/** O agente, ou nulo se o código não é do catálogo. */
export function agenteDeRisco(codigo: string): AgenteDeRiscoAso | null {
  return POR_CODIGO.get(codigo) ?? null;
}

/** Os agentes de uma categoria, na ordem do catálogo. */
export function agentesDaCategoria(
  categoria: CategoriaRiscoAso
): readonly AgenteDeRiscoAso[] {
  return AGENTES_RISCO_ASO.filter((a) => a.categoria === categoria);
}

/**
 * Nomes dos agentes marcados, na ordem do catálogo.
 *
 * Código desconhecido é DEVOLVIDO como está, e não descartado: ele veio de algum
 * lugar, e sumir com ele faria o ASO impresso listar menos riscos do que o
 * registro guarda. Vale para agente removido do catálogo depois da emissão.
 */
export function nomesDosRiscos(codigos: readonly string[] | null | undefined): string[] {
  const marcados = new Set(codigos ?? []);
  if (marcados.size === 0) return [];

  const doCatalogo = AGENTES_RISCO_ASO.filter((a) => marcados.has(a.codigo));
  const foraDoCatalogo = [...marcados].filter((c) => !POR_CODIGO.has(c));

  return [...doCatalogo.map((a) => a.nome), ...foraDoCatalogo];
}

/** Quantos agentes estão marcados, contando os fora do catálogo. */
export function totalDeRiscos(codigos: readonly string[] | null | undefined): number {
  return new Set(codigos ?? []).size;
}

export type SituacaoRiscosAso =
  /** Ninguém respondeu: nem marcou agente, nem afirmou que não há. */
  | "NAO_PREENCHIDO"
  /** Afirmou expressamente que a atividade não tem risco específico. */
  | "SEM_RISCO_DECLARADO"
  /** Há agentes marcados. */
  | "COM_RISCOS"
  /** Contradição: declarou ausência E marcou agentes. */
  | "CONTRADITORIO";

export const SITUACAO_RISCOS_ASO_LABEL: Record<SituacaoRiscosAso, string> = {
  NAO_PREENCHIDO: "Perigos não preenchidos",
  SEM_RISCO_DECLARADO: "Sem risco específico declarado",
  COM_RISCOS: "Perigos identificados",
  CONTRADITORIO: "Declaração contraditória de perigos",
};

/**
 * Em que estado está o bloco de perigos.
 *
 * A distinção que importa: **lista vazia não é "não há risco"**. A NR-07 pede os
 * perigos "ou a sua inexistência", e inexistência é uma afirmação que alguém faz
 * — não o silêncio de um campo em branco. Tratar vazio como ausência de risco
 * transformaria todo ASO não preenchido num atestado de atividade sem perigo.
 */
export function situacaoDosRiscos(params: {
  codigos?: readonly string[] | null;
  semRiscoEspecifico?: boolean | null;
}): SituacaoRiscosAso {
  const quantos = totalDeRiscos(params.codigos);
  const semRisco = !!params.semRiscoEspecifico;

  if (semRisco && quantos > 0) return "CONTRADITORIO";
  if (semRisco) return "SEM_RISCO_DECLARADO";
  if (quantos > 0) return "COM_RISCOS";
  return "NAO_PREENCHIDO";
}
