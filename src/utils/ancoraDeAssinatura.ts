/**
 * Onde carimbar a assinatura DENTRO do documento.
 *
 * O QUE FALTAVA
 *
 * O documento assinado passou a trazer o original mais a folha de assinaturas.
 * Mas no original nada mudava: a coluna "Assinatura" da lista de presença saía
 * vazia. Quem abre o documento não vê quem assinou — precisa ir até a folha do
 * fim e cruzar nome por nome. O DocuSign resolve isso pondo a assinatura no lugar
 * certo, ao lado do nome de cada um.
 *
 * DE ONDE VEM A POSIÇÃO
 *
 * - **Do próprio desenho**, quando o documento é montado em PDF direto: quem
 *   desenha a célula sabe exatamente onde ela ficou, e registra. É o caso da
 *   lista de presença. Ver `documentoPdfDireto`.
 *
 * - **Do texto do PDF** (`posicaoDoCarimbo`), para arquivo que o usuário anexa —
 *   um contrato saído do Word. Esse tem camada de texto, e aí dá para procurar o
 *   nome e o cabeçalho da coluna.
 *
 * Nos dois casos a posição acaba gravada nos metadados do arquivo, e é de lá que
 * `carimbarAssinaturas` a lê na hora de fechar a fila.
 *
 * Houve um terceiro caminho, removido: medir a célula no clone que o `html2pdf`
 * monta. Ele existia porque o documento rasterizado não tem texto para procurar —
 * e deixou de ser necessário quando a lista de presença passou a ser desenhada
 * direto. Se outro documento precisar de assinatura no corpo, o caminho é portá-lo,
 * e não ressuscitar a medição.
 *
 * QUANDO NÃO DÁ PARA SABER, NÃO CARIMBA
 *
 * Nome ausente, nome escrito diferente do cadastro, dois homônimos: em todos o
 * lugar não é encontrado, e o resultado é não carimbar. Carimbar no lugar errado é
 * o único desfecho pior que não carimbar — a folha de assinaturas do fim continua
 * valendo como registro em qualquer um dos casos.
 */

// ---------------------------------------------------------------------------
// Âncora medida
// ---------------------------------------------------------------------------

/**
 * A geometria da folha, passada de fora.
 *
 * Os números moram em `sgsstPapelTimbrado`, que é quem decide as margens. Recebê-los
 * por parâmetro mantém este módulo puro e evita o ciclo de importação — o papel
 * timbrado precisa daqui, e daqui não se precisa dele.
 */
export interface GeometriaDaFolha {
  /** Largura da área de conteúdo. É a largura que o html2pdf dá ao container. */
  larguraUtilMm: number;
  alturaUtilMm: number;
  margemEsquerdaMm: number;
  margemSuperiorMm: number;
  alturaDaFolhaMm: number;
  /**
   * Largura da folha inteira.
   *
   * Existe porque quem desenha o PDF direto precisa CRIAR a página, e deduzi-la
   * de `larguraUtil + margem × 2` funcionaria hoje e divergiria no dia em que as
   * margens deixassem de ser simétricas — sem nada acusando.
   */
  larguraDaFolhaMm: number;
}

/** Onde carimbar, em pontos, no sistema do PDF (origem embaixo à esquerda). */
export interface Ancora {
  /** Identifica de quem é esta célula. Normalizado por `chaveDoTexto`. */
  chave: string;
  /** Página, começando em 0. */
  pagina: number;
  x: number;
  /** Base do retângulo — `y` cresce para cima no PDF. */
  y: number;
  largura: number;
  altura: number;
}

// ---------------------------------------------------------------------------
// Guardar e recuperar as âncoras
// ---------------------------------------------------------------------------

/**
 * Marca que identifica o bloco de âncoras dentro dos metadados do PDF.
 *
 * As âncoras ficam NO ARQUIVO, e não numa coluna do banco, porque elas descrevem
 * AQUELE arquivo: as coordenadas valem para a paginação daquela emissão. Guardadas
 * fora, uma segunda emissão do mesmo documento — com uma linha a mais, com a
 * quebra em outro lugar — deixaria as coordenadas antigas apontando para o vazio, e
 * ninguém perceberia.
 */
const MARCA_DAS_ANCORAS = "ancoras-de-assinatura:";

/** Uma casa decimal de ponto é ~0,35 mm: precisão muito além do necessário. */
function arredondar(v: number): number {
  return Math.round(v * 10) / 10;
}

export function serializarAncoras(ancoras: readonly Ancora[]): string {
  const enxutas = ancoras.map((a) => ({
    c: a.chave,
    p: a.pagina,
    x: arredondar(a.x),
    y: arredondar(a.y),
    l: arredondar(a.largura),
    a: arredondar(a.altura),
  }));
  return MARCA_DAS_ANCORAS + JSON.stringify(enxutas);
}

/**
 * Lê o bloco de âncoras. Devolve lista vazia para qualquer coisa que não seja
 * exatamente o que gravamos — metadado é campo livre, e o PDF pode ter vindo de
 * outro lugar.
 */
export function lerAncoras(bruto: string | null | undefined): Ancora[] {
  if (!bruto) return [];
  const inicio = bruto.indexOf(MARCA_DAS_ANCORAS);
  if (inicio < 0) return [];

  try {
    const json = bruto.slice(inicio + MARCA_DAS_ANCORAS.length);
    const lista: unknown = JSON.parse(json);
    if (!Array.isArray(lista)) return [];

    return lista
      .map((item): Ancora | null => {
        const o = item as Record<string, unknown>;
        const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
        const chave = typeof o?.c === "string" ? o.c : null;
        const pagina = num(o?.p);
        const x = num(o?.x);
        const y = num(o?.y);
        const largura = num(o?.l);
        const altura = num(o?.a);
        if (!chave || pagina === null || x === null || y === null) return null;
        if (largura === null || altura === null) return null;
        return { chave, pagina, x, y, largura, altura };
      })
      .filter((a): a is Ancora => a !== null);
  } catch {
    return [];
  }
}

/**
 * A âncora desta pessoa, ou nula.
 *
 * Duas âncoras com a mesma chave — dois homônimos na mesma turma — devolvem nulo:
 * escolher uma seria carimbar na linha de outra pessoa.
 */
export function ancoraDe(ancoras: readonly Ancora[], nome: string): Ancora | null {
  const alvo = chaveDoTexto(nome);
  if (!alvo) return null;
  const achadas = ancoras.filter((a) => a.chave === alvo);
  return achadas.length === 1 ? achadas[0] : null;
}

// ---------------------------------------------------------------------------
// Âncora por texto — para PDF anexado, que tem camada de texto
// ---------------------------------------------------------------------------

/** Normaliza para comparar: sem acento, sem caixa, sem espaço repetido. */
export function chaveDoTexto(valor: string): string {
  return (valor ?? "")
    .normalize("NFD")
    // Faixa U+0300–U+036F: os acentos que o NFD separou da letra. Escritos como
    // escape, e não com os próprios caracteres, porque um combinante solto no
    // arquivo-fonte não sobrevive a toda ferramenta que toca no código.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Um pedaço de texto do PDF, com onde ele está. Vem do pdfjs. */
export interface TextoDoPdf {
  texto: string;
  /** Página, começando em 0. */
  pagina: number;
  /** Canto inferior esquerdo, no sistema do PDF (y cresce para cima). */
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/**
 * Acha o item de texto que contém o nome.
 *
 * Exige o nome INTEIRO, e não a primeira palavra: "Bruno" acertaria qualquer Bruno
 * da folha. Nome repetido em mais de um item — o cabeçalho e a linha — devolve
 * nulo, porque escolher seria adivinhar.
 */
export function acharNome(
  itens: readonly TextoDoPdf[],
  nome: string
): TextoDoPdf | null {
  const alvo = chaveDoTexto(nome);
  if (alvo.length < 5) return null; // Curto demais casa com qualquer coisa.

  const achados = itens.filter((i) => chaveDoTexto(i.texto).includes(alvo));
  return achados.length === 1 ? achados[0] : null;
}

/**
 * Acha a coluna pelo texto do cabeçalho, na mesma página.
 *
 * O cabeçalho tem de estar ACIMA da linha — `y` maior, porque no PDF o eixo cresce
 * para cima. Sem essa checagem, um texto igual mais abaixo na folha passaria por
 * cabeçalho de coluna.
 */
export function acharColuna(
  itens: readonly TextoDoPdf[],
  rotulo: string,
  referencia: TextoDoPdf
): TextoDoPdf | null {
  const alvo = chaveDoTexto(rotulo);

  const candidatos = itens.filter(
    (i) =>
      i.pagina === referencia.pagina && i.y > referencia.y && chaveDoTexto(i.texto) === alvo
  );
  if (candidatos.length === 0) return null;

  // O cabeçalho mais próximo da linha, quando o rótulo aparece mais de uma vez.
  return candidatos.sort((a, b) => a.y - b.y)[0];
}

/**
 * Onde carimbar num PDF com camada de texto, ou nulo quando não dá para saber.
 *
 * POR QUE SÓ O CRUZAMENTO LINHA × COLUNA, E NÃO "ACIMA DO NOME"
 *
 * Carimbar logo acima do nome é o que se faria num contrato, onde o nome vem sob a
 * linha de assinatura. Mas o nome de alguém também aparece no meio do texto — "…
 * entre a CONTRATANTE e BRUNO SOUZA DA SILVA, doravante …" — e nesse caso o
 * carimbo cairia dentro de um parágrafo. Sem enxergar o documento não há como
 * distinguir os dois casos.
 *
 * Exigir um cabeçalho de coluna ACIMA do nome elimina o parágrafo: coluna de
 * assinatura só existe em tabela. Se o documento não tiver essa coluna, não há
 * carimbo — e a folha de assinaturas do fim continua provando quem assinou.
 */
export function posicaoDoCarimbo(params: {
  itens: readonly TextoDoPdf[];
  nome: string;
  rotuloDaColuna: string;
}): Ancora | null {
  const linha = acharNome(params.itens, params.nome);
  if (!linha) return null;

  const chave = chaveDoTexto(params.nome);

  const coluna = acharColuna(params.itens, params.rotuloDaColuna, linha);
  if (!coluna) return null;

  // Largura disponível: até o próximo item à direita do cabeçalho, na mesma
  // altura. Sem esse limite, um nome longo atravessaria a borda da célula.
  const vizinhoDireita = params.itens
    .filter(
      (i) =>
        i.pagina === coluna.pagina &&
        Math.abs(i.y - coluna.y) < coluna.altura &&
        i.x > coluna.x + coluna.largura
    )
    .sort((a, b) => a.x - b.x)[0];

  const largura = vizinhoDireita
    ? vizinhoDireita.x - coluna.x - 4
    : Math.max(coluna.largura * 1.6, 60);

  return {
    chave,
    pagina: linha.pagina,
    x: coluna.x,
    // Alinhado pela base do nome, para o carimbo ficar na mesma linha da tabela.
    y: linha.y,
    largura,
    altura: linha.altura,
  };
}

// ---------------------------------------------------------------------------
// Ajuste do texto à célula
// ---------------------------------------------------------------------------

/**
 * Reduz o corpo da fonte até o texto caber na largura disponível.
 *
 * `medirLargura` vem de fora — na emissão é o `widthOfTextAtSize` da própria fonte
 * embutida, que é a medida exata. O teste passa uma medida sintética.
 *
 * Abaixo do mínimo o texto seria ilegível impresso; nesse caso ele é ENCURTADO
 * pelo chamador, porque um nome miúdo demais não prova nada.
 */
export function corpoQueCabe(params: {
  texto: string;
  larguraMaxima: number;
  medirLargura: (texto: string, corpo: number) => number;
  corpoIdeal?: number;
  corpoMinimo?: number;
}): number {
  const ideal = params.corpoIdeal ?? 9;
  const minimo = params.corpoMinimo ?? 5;

  if (!(params.larguraMaxima > 0) || !params.texto) return minimo;

  let corpo = ideal;
  // Passos de meio ponto: o suficiente para acompanhar a diferença de largura e
  // poucas iterações até o mínimo.
  while (corpo > minimo && params.medirLargura(params.texto, corpo) > params.larguraMaxima) {
    corpo -= 0.5;
  }
  return Math.max(minimo, corpo);
}

/**
 * Encurta o nome para caber, quando nem no corpo mínimo ele cabe.
 *
 * Mantém o PRIMEIRO e o ÚLTIMO nome e abrevia o meio — "Bruno S. da Silva" — que é
 * como a pessoa é identificada na fala e no crachá. Cortar o fim produziria "Bruno
 * Souza da S", que parece erro de sistema.
 */
export function encurtarNome(nome: string): string {
  const partes = (nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 2) return partes.join(" ");

  const primeiro = partes[0];
  const ultimo = partes[partes.length - 1];
  const meio = partes
    .slice(1, -1)
    // Preposições ficam inteiras: "da", "de", "dos" abreviadas viram ruído.
    .map((p) => (p.length <= 3 ? p : `${p[0]}.`))
    .join(" ");

  return `${primeiro} ${meio} ${ultimo}`;
}
