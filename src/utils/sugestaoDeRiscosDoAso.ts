import {
  CATEGORIAS_RISCO_ASO,
  type CategoriaRiscoAso,
} from "@/utils/sgsstRiscosAso";

/**
 * O que o PGR da obra já sabe, oferecido a quem preenche o ASO.
 *
 * A DECISÃO, E O QUE ELA RECUSA
 *
 * O inventário do PGR daquela obra já lista os riscos, com categoria. A grade de
 * perigos do ASO é preenchida à mão, do zero, toda vez. Dava para pré-marcar.
 *
 * O dono decidiu **sugerir sem marcar**, e o motivo é o que este arquivo
 * protege: o ASO é do TRABALHADOR e o inventário é da OBRA. São recortes
 * diferentes — o pedreiro e o vigia da mesma obra não têm a mesma exposição.
 * Pré-marcar empurraria o médico a aceitar uma lista que não é exatamente a
 * daquela pessoa, e a assinatura no ASO é dele.
 *
 * Por isso este módulo só devolve TEXTO para ser lido. Ele não produz códigos de
 * agente, não toca em `riscos_marcados` e não tem como marcar nada.
 *
 * POR QUE NÃO TENTO CASAR NOME COM AGENTE
 *
 * A ficha do ASO tem 42 agentes de vocabulário fechado; o `perigo` do inventário
 * é texto livre ("Ruído contínuo da serra do pátio B"). Casar um no outro por
 * semelhança de texto acertaria na maioria e erraria em alguns — e um agente
 * sugerido errado num documento de saúde é pior que sugestão nenhuma, porque
 * vem com a autoridade de ter sido proposto pelo sistema.
 *
 * O que é confiável é a CATEGORIA: o catálogo de riscos usa as mesmas cinco da
 * ficha. Então a sugestão aparece agrupada por categoria, ao lado das caixas
 * daquela categoria, e quem preenche encontra o agente correspondente.
 *
 * "OUTROS" NÃO PODE SUMIR
 *
 * O catálogo tem uma sexta categoria, "Outros", que não existe na ficha do ASO.
 * Descartá-la calada esconderia um risco que o PGR listou. Ela sai à parte,
 * dita como o que é: risco inventariado sem categoria correspondente na ficha.
 */

/** O que este módulo precisa de um item do inventário do PGR. */
export interface ItemInventariadoParaSugestao {
  perigo?: string | null;
  risco_catalogo?: {
    nome?: string | null;
    categoria?: string | null;
  } | null;
}

export interface SugestaoDaCategoria {
  categoria: CategoriaRiscoAso;
  /** Nomes como o PGR os escreve, sem repetição. */
  nomes: string[];
}

export interface SugestaoDeRiscos {
  porCategoria: SugestaoDaCategoria[];
  /**
   * Riscos do inventário que não caem em nenhuma categoria da ficha — sem
   * vínculo com o catálogo, ou catalogados como "Outros".
   */
  semCategoria: string[];
  /** Quantos riscos distintos o inventário oferece, somando tudo. */
  total: number;
}

/** A categoria do catálogo, traduzida para a da ficha do ASO. */
const DO_CATALOGO_PARA_A_FICHA: Record<string, CategoriaRiscoAso> = {
  físico: "FISICO",
  fisico: "FISICO",
  químico: "QUIMICO",
  quimico: "QUIMICO",
  biológico: "BIOLOGICO",
  biologico: "BIOLOGICO",
  ergonômico: "ERGONOMICO",
  ergonomico: "ERGONOMICO",
  acidente: "ACIDENTE",
};

/** Aceita com e sem acento: o dado vem de cadastro antigo e de digitação. */
function categoriaDaFicha(bruta?: string | null): CategoriaRiscoAso | null {
  const chave = (bruta ?? "").trim().toLocaleLowerCase("pt-BR");
  return DO_CATALOGO_PARA_A_FICHA[chave] ?? null;
}

/**
 * O nome a exibir.
 *
 * O `perigo` do item vem primeiro porque é o que a pessoa vai encontrar se abrir
 * o PGR; o nome do catálogo é a alternativa quando o item não o detalhou.
 */
function nomeDoItem(item: ItemInventariadoParaSugestao): string {
  const proprio = (item.perigo ?? "").trim();
  if (proprio) return proprio;
  return (item.risco_catalogo?.nome ?? "").trim();
}

/** Sem repetir, e em ordem alfabética — a ordem do inventário não diz nada aqui. */
function organizados(nomes: string[]): string[] {
  return [...new Set(nomes)].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function sugestaoDeRiscosDoAso(
  itens?: readonly ItemInventariadoParaSugestao[] | null
): SugestaoDeRiscos {
  const porCategoria = new Map<CategoriaRiscoAso, string[]>();
  const semCategoria: string[] = [];

  for (const item of itens ?? []) {
    const nome = nomeDoItem(item);
    if (!nome) continue;

    const categoria = categoriaDaFicha(item.risco_catalogo?.categoria);

    if (!categoria) {
      semCategoria.push(nome);
      continue;
    }

    const lista = porCategoria.get(categoria) ?? [];
    lista.push(nome);
    porCategoria.set(categoria, lista);
  }

  // A ordem das categorias é a da ficha, e não a de chegada: quem lê está
  // percorrendo a grade de cima a baixo.
  const agrupadas: SugestaoDaCategoria[] = CATEGORIAS_RISCO_ASO.filter((c) =>
    porCategoria.has(c)
  ).map((categoria) => ({
    categoria,
    nomes: organizados(porCategoria.get(categoria)!),
  }));

  const soltos = organizados(semCategoria);

  return {
    porCategoria: agrupadas,
    semCategoria: soltos,
    total: agrupadas.reduce((s, g) => s + g.nomes.length, 0) + soltos.length,
  };
}

/** Os nomes sugeridos de uma categoria, ou vazio quando não há. */
export function sugestaoDaCategoria(
  sugestao: SugestaoDeRiscos,
  categoria: CategoriaRiscoAso
): string[] {
  return sugestao.porCategoria.find((g) => g.categoria === categoria)?.nomes ?? [];
}
