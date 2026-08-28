import { getPdfOptions } from "@/lib/pdfTemplates";

/**
 * Papel timbrado dos documentos do SGSST.
 *
 * Os documentos saíam sem identidade visual: um PGR ou uma CAT impressa não
 * parecia documento da empresa, o que importa quando a folha vai para cliente,
 * seguradora ou fiscal.
 *
 * O timbre é montado em DUAS ETAPAS, e cada uma existe por um motivo diferente:
 *
 * 1. MARCA D'ÁGUA em CSS, como `background-image` com `repeat-y` no conteúdo.
 *    O html2pdf rasteriza tudo num canvas único e depois fatia em páginas, então
 *    um fundo que se repete a cada altura de página cai certo em cada folha. E,
 *    por ser fundo, o navegador o pinta ANTES do texto — a marca fica embaixo
 *    sem nenhum truque.
 *
 *    Isto substituiu uma versão que desenhava a marca com pdf-lib no PDF pronto.
 *    Funcionava visualmente, mas obrigava a rasterizar o conteúdo em PNG
 *    transparente para a marca aparecer, e o arquivo ia a ~1,2 MB por página —
 *    inviável para anexar. Com a marca dentro do JPEG, o peso volta ao normal.
 *
 * 2. LOGO, RODAPÉ e NUMERAÇÃO com pdf-lib, página por página, depois. Estes
 *    precisam de posição exata e texto selecionável, e o html2pdf não repete
 *    cabeçalho nem rodapé por conta própria.
 */

/** Dados da organização, transcritos do rodapé do papel timbrado oficial. */
export const ORGANIZACAO_TIMBRE = {
  site: "aivxtech.com",
  cnpj: "58.106.347/0001-01",
  endereco: "Rua C-152, n.478 — Jardim América, Goiânia – GO, 74.275-120",
  telefone: "(62) 3300-1148",
  email: "aivx@aivxtech.com",
} as const;

const LOGO_URL = "/papel-timbrado/logo-aivx.png";
const MARCA_DAGUA_URL = "/papel-timbrado/marca-dagua.png";

/** Proporção original do logo (2500 × 505), para não distorcer ao redimensionar. */
const LOGO_PROPORCAO = 505 / 2500;

const MM_PARA_PT = 72 / 25.4;

/**
 * Geometria do rodapé, medida A PARTIR DA BORDA INFERIOR DA FOLHA.
 *
 * A primeira versão ancorava o rodapé na linha de margem do conteúdo e o
 * desenhava para CIMA dela. O resultado é o defeito que isto corrige: as quatro
 * linhas do rodapé nasciam a 21 mm da borda e subiam até 29 mm, ou seja, os 9 mm
 * mais altos caíam dentro da área de conteúdo — e o pé de página aparecia
 * atravessado por cima do texto do documento.
 *
 * Agora a origem é a borda da folha, e a margem inferior é CALCULADA a partir da
 * altura deste bloco. Assim as duas não podem mais divergir: mexer no rodapé
 * reajusta a margem sozinho.
 */
const RODAPE_BORDA_PT = 14;
/** Deslocamentos de cada linha, a partir da base do bloco. */
const RODAPE_ENDERECO_PT = 0;
const RODAPE_CONTATO_PT = 9;
const RODAPE_FILETE_PT = 19;
const RODAPE_PAGINACAO_PT = 23;
/** Corpo do maior texto do bloco, que define onde está o topo dele. */
const RODAPE_CORPO_MAIOR_PT = 6.5;

/**
 * Altura total do rodapé: da borda da folha até o topo da linha mais alta.
 *
 * Exportada para o teste conferir que ela cabe na margem reservada — a checagem
 * que faltava e que deixou o defeito passar.
 */
export function alturaRodapePt(): number {
  return RODAPE_BORDA_PT + RODAPE_PAGINACAO_PT + RODAPE_CORPO_MAIOR_PT;
}

/** Geometria do logo, medida a partir da borda superior. */
const LOGO_BORDA_TOPO_MM = 12;
const LOGO_LARGURA_MM = 42;

/**
 * Altura do cabeçalho: da borda da folha até a base do logo.
 *
 * O filete separador fica de fora da conta de propósito — ele é traçado logo
 * acima da linha de margem justamente para marcar onde o conteúdo começa, e é um
 * fio, não texto que possa ser encoberto.
 */
export function alturaCabecalhoPt(): number {
  return (LOGO_BORDA_TOPO_MM + LOGO_LARGURA_MM * LOGO_PROPORCAO) * MM_PARA_PT;
}

/** Respiro entre o timbre e a primeira/última linha do conteúdo. */
const FOLGA_TIMBRE_MM = 5;

/**
 * Margens em milímetros, maiores que as do PDF comum.
 *
 * O timbre é desenhado por cima do PDF já paginado, então o conteúdo precisa
 * nascer com espaço reservado — sem isso, a primeira linha da tabela fica
 * embaixo do logo.
 *
 * As duas verticais são derivadas do tamanho real do que é estampado, e não
 * escolhidas à mão: número escolhido à mão foi exatamente o que produziu a
 * sobreposição no pé da página.
 */
export const MARGEM_SUPERIOR_MM = alturaCabecalhoPt() / MM_PARA_PT + FOLGA_TIMBRE_MM;
export const MARGEM_INFERIOR_MM = alturaRodapePt() / MM_PARA_PT + FOLGA_TIMBRE_MM;
const MARGEM_LATERAL_MM = 12;

/** A4 em milímetros. */
const A4_LARGURA_MM = 210;
const A4_ALTURA_MM = 297;

/**
 * Largura em pixels com que o html2canvas renderiza o conteúdo.
 *
 * Vale como `windowWidth` do html2canvas — largura da janela no documento
 * clonado. NÃO é a largura de diagramação: essa o html2pdf fixa em milímetros.
 * Ver a nota em `alturaPaginaEmPixels`.
 */
const LARGURA_RENDER_PX = 1024;

/**
 * Multiplicador de resolução do raster.
 *
 * O html2pdf rasteriza a página e depois a estica para o tamanho do A4. Com o
 * `scale: 1` do padrão, 1024 px cobrem 186 mm — cerca de **140 dpi**. É por isso
 * que o texto saía mole e as linhas de tabela pareciam "estouradas": uma imagem
 * de baixa resolução ampliada.
 *
 * Em 2× são ~280 dpi, que é resolução de impressão. Não afeta o alinhamento da
 * marca d'água: o `scale` multiplica os pixels do canvas, e a conta do azulejo é
 * em pixel de CSS, derivada das margens.
 */
const ESCALA_RENDER = 2;

/**
 * Qualidade do JPEG.
 *
 * Menor que o 0,98 do padrão de propósito: com o dobro da resolução, o artefato
 * de compressão fica menos visível, e manter 0,98 dobraria o arquivo sem ganho
 * perceptível.
 */
const QUALIDADE_JPEG = 0.92;

/**
 * Pixels de CSS por milímetro.
 *
 * O CSS define o milímetro em 96 dpi: 1mm = 96/25,4 px. Não é uma convenção
 * nossa nem depende de tela — é a unidade absoluta da especificação.
 */
const PX_POR_MM = 96 / 25.4;

/** Altura útil de uma página, em milímetros. */
function alturaUtilMm(): number {
  return A4_ALTURA_MM - MARGEM_SUPERIOR_MM - MARGEM_INFERIOR_MM;
}

/**
 * Altura, em pixels de layout, da área de conteúdo de UMA página.
 *
 * O html2pdf rasteriza o container inteiro num canvas só e depois fatia em
 * páginas. Uma marca d'água com `background-size: 100% <esta altura>` e
 * `repeat-y` cai, portanto, uma vez por folha.
 *
 * POR QUE A CONTA É EM 96 DPI E NÃO NA "LARGURA DE RENDER"
 *
 * A versão anterior derivava a escala de `LARGURA_RENDER_PX / larguraUtilMm`,
 * supondo que o conteúdo fosse diagramado a 1024px de largura. Não é: o html2pdf
 * fixa a largura do container em milímetros (`width: 186.002mm`), o que o
 * navegador resolve para 703px — e a diferença fazia esta função devolver 1382,8px
 * onde a folha real tem 949px. Um azulejo 1,457× mais alto que a página faz a
 * marca d'água deixar de casar com a quebra a partir da primeira folha.
 *
 * Medido no pipeline real: `pageSize.inner.px.height` do html2pdf devolve 949 para
 * as margens atuais, e é esse número que ele usa tanto para paginar quanto para
 * fatiar o raster. Esta função tem de reproduzi-lo, e o teste trava as duas contas
 * juntas para que não voltem a divergir em silêncio.
 */
export function alturaPaginaEmPixels(): number {
  return alturaUtilMm() * PX_POR_MM;
}

/** Cache por URL: o mesmo ativo é usado em toda emissão da sessão. */
const cacheAtivos = new Map<string, ArrayBuffer | null>();

/**
 * Busca um ativo do timbre.
 *
 * Devolve `null` em falha em vez de lançar: documento sem logo continua sendo
 * um documento válido, e derrubar a emissão por causa da identidade visual
 * seria trocar o essencial pelo acessório.
 */
async function buscarAtivo(url: string): Promise<ArrayBuffer | null> {
  if (cacheAtivos.has(url)) return cacheAtivos.get(url) ?? null;

  try {
    const resposta = await fetch(url);
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    const bytes = await resposta.arrayBuffer();
    cacheAtivos.set(url, bytes);
    return bytes;
  } catch {
    cacheAtivos.set(url, null);
    return null;
  }
}

export interface OpcoesTimbre {
  /** Texto curto identificando o documento, impresso no rodapé de cada página. */
  identificacao?: string;
}

/**
 * Estampa logo, rodapé e numeração em todas as páginas de um PDF já gerado.
 *
 * Recebe e devolve bytes para poder ficar entre a geração e o download, sem que
 * cada documento precise saber como o timbre funciona.
 */
export async function aplicarPapelTimbrado(
  pdfBytes: ArrayBuffer,
  opcoes: OpcoesTimbre = {}
): Promise<Uint8Array> {
  // Import dinâmico: pdf-lib só é necessário na emissão, e não deve pesar o
  // bundle das telas que apenas listam documentos.
  const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");

  // Desenha no PDF recebido, sem remontar documento.
  //
  // Uma versão anterior montava um PDF novo para conseguir colocar a marca
  // d'água por baixo do conteúdo — o `drawImage` do pdf-lib acrescenta ao fim do
  // stream, ou seja, pinta por cima. Aquilo funcionava, mas obrigava o conteúdo
  // a sair em PNG transparente e o arquivo ia a ~1,2 MB por página.
  //
  // Agora a marca é fundo CSS (ver `cssMarcaDagua`) e já vem embutida no
  // conteúdo rasterizado. O que sobra aqui — logo, rodapé, numeração — É o
  // timbre, e pintar por cima do conteúdo é justamente o correto.
  const pdf = await PDFDocument.load(pdfBytes);

  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  const fonteNegrito = await pdf.embedFont(StandardFonts.HelveticaBold);

  const logoBytes = await buscarAtivo(LOGO_URL);
  const logo = logoBytes ? await pdf.embedPng(logoBytes) : null;

  const paginas = pdf.getPages();
  const total = paginas.length;

  const tinta = rgb(0.12, 0.23, 0.37); // mesmo tom escuro dos documentos
  const tintaSuave = rgb(0.45, 0.5, 0.56);

  const margemLateral = MARGEM_LATERAL_MM * MM_PARA_PT;

  // Logo, rodapé e numeração vão POR CIMA do conteúdo — são o timbre, e não
  // podem ser cobertos por ele.
  paginas.forEach((pagina, indice) => {
    const { width, height } = pagina.getSize();

    if (logo) {
      const larguraLogo = LOGO_LARGURA_MM * MM_PARA_PT;
      const alturaLogo = larguraLogo * LOGO_PROPORCAO;
      pagina.drawImage(logo, {
        x: margemLateral,
        y: height - LOGO_BORDA_TOPO_MM * MM_PARA_PT - alturaLogo,
        width: larguraLogo,
        height: alturaLogo,
      });
    }

    // Linha fina separando o cabeçalho do conteúdo.
    const yLinha = height - MARGEM_SUPERIOR_MM * MM_PARA_PT + 4;
    pagina.drawLine({
      start: { x: margemLateral, y: yLinha },
      end: { x: width - margemLateral, y: yLinha },
      thickness: 0.5,
      color: rgb(0.85, 0.88, 0.92),
    });

    // ---- rodapé ----
    // Ancorado na BORDA da folha, e não na linha de margem: ancorado na margem, o
    // bloco crescia para dentro do conteúdo e o pé de página saía por cima do
    // texto do documento.
    const yRodape = RODAPE_BORDA_PT;

    pagina.drawLine({
      start: { x: margemLateral, y: yRodape + RODAPE_FILETE_PT },
      end: { x: width - margemLateral, y: yRodape + RODAPE_FILETE_PT },
      thickness: 0.5,
      color: rgb(0.85, 0.88, 0.92),
    });

    const linha1 = `${ORGANIZACAO_TIMBRE.site}  ·  CNPJ ${ORGANIZACAO_TIMBRE.cnpj}  ·  ${ORGANIZACAO_TIMBRE.telefone}  ·  ${ORGANIZACAO_TIMBRE.email}`;
    const tamanho1 = 6.5;
    const largura1 = fonte.widthOfTextAtSize(linha1, tamanho1);
    pagina.drawText(linha1, {
      x: (width - largura1) / 2,
      y: yRodape + RODAPE_CONTATO_PT,
      size: tamanho1,
      font: fonte,
      color: tinta,
    });

    const linha2 = ORGANIZACAO_TIMBRE.endereco;
    const tamanho2 = 6;
    const largura2 = fonte.widthOfTextAtSize(linha2, tamanho2);
    pagina.drawText(linha2, {
      x: (width - largura2) / 2,
      y: yRodape + RODAPE_ENDERECO_PT,
      size: tamanho2,
      font: fonte,
      color: tintaSuave,
    });

    // Numeração à direita e identificação do documento à esquerda: uma folha
    // solta que caiu do grampo precisa dizer de qual documento veio.
    const paginacao = `Página ${indice + 1} de ${total}`;
    const larguraPag = fonteNegrito.widthOfTextAtSize(paginacao, RODAPE_CORPO_MAIOR_PT);
    pagina.drawText(paginacao, {
      x: width - margemLateral - larguraPag,
      y: yRodape + RODAPE_PAGINACAO_PT,
      size: RODAPE_CORPO_MAIOR_PT,
      font: fonteNegrito,
      color: tintaSuave,
    });

    if (opcoes.identificacao) {
      pagina.drawText(opcoes.identificacao.slice(0, 90), {
        x: margemLateral,
        y: yRodape + RODAPE_PAGINACAO_PT,
        size: RODAPE_CORPO_MAIOR_PT,
        font: fonte,
        color: tintaSuave,
      });
    }
  });

  return pdf.save();
}

/**
 * CSS da marca d'água, aplicado ao conteúdo antes de rasterizar.
 *
 * `background-repeat: repeat-y` com o azulejo na altura exata de uma página faz
 * a marca cair uma vez por folha. Sendo fundo, o navegador a pinta antes do
 * texto — a marca fica embaixo por construção, sem depender de ordem de
 * desenho no PDF.
 *
 * `opacity` alta de propósito: a arte de origem já é pálida, com tons a menos de
 * 8% do branco. Foi por não perceber isso que a primeira versão, a 6%, saiu
 * invisível.
 *
 * Os fundos dos BLOCOS (`.doc-ident`, `.doc-aviso`, cabeçalho de tabela) ficam
 * como estão: são intencionais e é bom que cubram a marca localmente.
 */
export function cssMarcaDagua(): string {
  const alturaAzulejo = alturaPaginaEmPixels().toFixed(2);

  // `background-size: 100% <altura>` ESTICA a arte para casar exatamente com a
  // área útil da página. A arte é 1814×2565 (proporção 0,707) e a área útil é
  // 186×251 mm (0,741), então há ~5% de distorção vertical.
  //
  // É deliberado: o alinhamento exato com a quebra de página vale mais que a
  // proporção original numa marca abstrata e quase invisível. Usar `contain`
  // manteria a proporção, mas o azulejo deixaria de coincidir com a folha.

  return `
  <style>
    html, body { background: transparent !important; }
    .doc {
      background-image: url("${MARCA_DAGUA_URL}") !important;
      background-repeat: repeat-y !important;
      background-position: top center !important;
      background-size: 100% ${alturaAzulejo}px !important;
    }
  </style>
`;
}

/**
 * Opções do html2pdf para documento timbrado.
 *
 * Três diferenças em relação ao padrão:
 *
 * 1. MARGENS maiores: o logo e o rodapé são estampados por cima do PDF já
 *    paginado, e sem a reserva de espaço o conteúdo passaria por baixo deles.
 *
 * 2. RESOLUÇÃO em 2×. O padrão usa `scale: 1`, o que dá ~140 dpi depois de o
 *    raster ser esticado para o A4 — texto mole e linha de tabela borrada.
 *
 * 3. JPEG a 0,92 em vez de 0,98, porque com o dobro da resolução o artefato
 *    quase não aparece e a qualidade máxima só dobraria o arquivo.
 *
 * O formato continua JPEG. Uma versão anterior trocou por PNG transparente para
 * a marca d'água aparecer por baixo — funcionava, mas levava o arquivo a ~1,2 MB
 * por página. Com a marca embutida no fundo via CSS, o JPEG volta a servir.
 */
export function opcoesPdfTimbrado(nomeArquivo: string) {
  const base = getPdfOptions(nomeArquivo) as Record<string, unknown>;
  const html2canvasBase = (base.html2canvas ?? {}) as Record<string, unknown>;

  return {
    ...base,
    margin: [MARGEM_SUPERIOR_MM, MARGEM_LATERAL_MM, MARGEM_INFERIOR_MM, MARGEM_LATERAL_MM] as [
      number,
      number,
      number,
      number,
    ],
    image: { type: "jpeg" as const, quality: QUALIDADE_JPEG },
    html2canvas: {
      ...html2canvasBase,
      // `windowWidth` NÃO define a largura de diagramação: o html2pdf fixa a
      // largura do container em milímetros (medido: `width: 186.002mm`, que o
      // navegador resolve em 703px). Serve só como largura da janela no documento
      // clonado do html2canvas, o que importa para unidade de viewport e media
      // query — coisas que a folha destes documentos não usa. Fica declarado para
      // a medição não depender do tamanho da janela real do usuário.
      //
      // Um comentário anterior aqui dizia que era desta largura que saía a escala
      // do azulejo da marca d'água. Era falso, e foi o que manteve
      // `alturaPaginaEmPixels` errada por 1,457×.
      //
      // O `scale` é independente — multiplica os pixels do canvas, não o layout.
      windowWidth: LARGURA_RENDER_PX,
      scale: ESCALA_RENDER,
    },
  };
}

/**
 * Gera o PDF de um HTML já montado, estampa o papel timbrado e baixa.
 *
 * Ponto único de emissão dos documentos do SGSST: quem escreve um documento novo
 * chama isto e ganha o timbre sem saber como ele é feito.
 */
export async function emitirPdfTimbrado(params: {
  html: string;
  nomeArquivo: string;
  identificacao?: string;
  /**
   * Marca d'água ao fundo. Ligada por padrão; desligar em documento conferido
   * campo a campo e com área de assinatura, como o ASO e a CAT.
   */
  marcaDagua?: boolean;
}): Promise<void> {
  const { default: html2pdf } = await import("html2pdf.js");

  const { palco, container } = montarPalcoDeEmissao(
    (params.marcaDagua === false ? "" : cssMarcaDagua()) + params.html
  );
  document.body.appendChild(palco);

  try {
    await aguardarFontes(container);

    // `outputPdf("arraybuffer")` em vez de `save()`: precisamos dos bytes para
    // estampar logo e rodapé antes de entregar o arquivo.
    const bytes: ArrayBuffer = await html2pdf()
      .set(opcoesPdfTimbrado(params.nomeArquivo))
      .from(container)
      .outputPdf("arraybuffer");

    const timbrado = await aplicarPapelTimbrado(bytes, {
      identificacao: params.identificacao,
    });

    baixar(timbrado, params.nomeArquivo);
  } finally {
    // Sai do documento mesmo se a emissão falhar: um palco esquecido leva a folha
    // de estilo do documento junto, e ela vaza para a interface.
    palco.remove();
  }
}

/** Identificador único por emissão: o seletor que fixa a fonte precisa dele. */
let contadorDeEmissao = 0;

/**
 * Monta os dois elementos da emissão: o palco e o container.
 *
 * O POSICIONAMENTO VAI NO PALCO, NUNCA NO CONTAINER — e é por isto que esta
 * função existe separada e testada.
 *
 * O html2pdf CLONA o elemento que recebe e insere o clone dentro do container
 * dele. O clone leva junto o `style` inline. Quando o `position: fixed` que tira o
 * conteúdo da tela ficava no próprio container, ele viajava para dentro do
 * html2pdf: o clone saía do fluxo, o container da biblioteca ficava com ALTURA
 * ZERO e **todo documento saía em branco** — só o timbre aparecia, porque ele é
 * estampado depois, pelo pdf-lib, direto no PDF já paginado.
 *
 * Então: o `palco` fica fora da tela e é nosso; o `container` carrega só a largura,
 * que é o que precisa ser medido, e é ele que o html2pdf recebe.
 */
export function montarPalcoDeEmissao(html: string): {
  palco: HTMLDivElement;
  container: HTMLDivElement;
} {
  const palco = document.createElement("div");
  palco.style.cssText =
    `position: fixed; left: -100000px; top: 0; width: ${larguraRenderMm()}mm;`;

  const container = document.createElement("div");
  container.id = `doc-emissao-${contadorDeEmissao++}`;
  container.style.width = "100%";
  container.innerHTML = html;

  palco.appendChild(container);
  return { palco, container };
}

/** Largura útil da página, em mm — a mesma que o html2pdf dá ao container. */
function larguraRenderMm(): number {
  return A4_LARGURA_MM - MARGEM_LATERAL_MM * 2;
}

/**
 * Espera as fontes do documento estarem prontas ANTES de paginar.
 *
 * O DEFEITO QUE ISTO CORRIGE
 *
 * O html2pdf calcula onde cada quebra de página cai e insere espaçadores para não
 * fatiar elemento marcado com `page-break-inside: avoid`. Essa conta é feita uma
 * vez, na geometria do momento. Se a fonte chegar DEPOIS, tudo reflui: a altura
 * das linhas muda, o conteúdo sobe ou desce, e os espaçadores — já fixos — passam
 * a apontar para o lugar errado. O resultado é texto cortado ao meio na
 * horizontal, metade no pé de uma folha e metade no topo da seguinte.
 *
 * E a corrida era garantida por construção: o container era montado DESANEXADO do
 * documento, então o `@import` da fonte não começava a carregar; ele só disparava
 * quando o html2pdf inseria o clone — no mesmo instante em que media as quebras.
 * Com cache quente o PDF saía correto e o defeito parecia não existir.
 *
 * Medido: com a mesma folha, trocar a fonte depois da paginação produziu texto
 * cortado em 18 de 18 comprimentos de documento testados.
 *
 * Duas partes na correção:
 *
 * 1. O container entra no documento (fora da tela) ANTES de qualquer medição, o
 *    que faz o `@import` começar.
 * 2. `document.fonts.ready` espera o que já está em uso, e `fonts.load` força as
 *    famílias declaradas — `ready` sozinho pode resolver antes de uma família que
 *    ainda não foi solicitada por nenhum nó pintado.
 *
 * O TEMPO-LIMITE
 *
 * Se a rede não responder, emitir com a fonte de recurso é melhor que travar a
 * emissão: o documento sai com outra tipografia, mas sai — e sai INTEIRO, porque a
 * paginação e o raster usam a mesma geometria. Travar sem prazo transformaria uma
 * fonte indisponível em botão que não responde.
 */
const ESPERA_MAXIMA_FONTES_MS = 4000;

/** Famílias e pesos que os documentos do SGSST usam. */
const PESOS_DO_DOCUMENTO = ["400", "500", "600", "700"];
const FAMILIA_WEBFONT = "Inter";

/**
 * Pilha de recurso, sem a webfont. É a mesma que a folha dos documentos declara
 * depois da Inter, então fixá-la não muda nada além de tirar a Inter da jogada.
 */
const PILHA_DE_RECURSO = `'Segoe UI', system-ui, -apple-system, Arial, sans-serif`;

function esperarQuadro(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * Fixa, no container, a família que será efetivamente usada.
 *
 * É o que fecha a corrida nos DOIS sentidos. Não basta esperar: se a Inter chegar
 * depois de o html2pdf ter calculado as quebras, o refluxo move o texto e os
 * espaçadores já estão fixos. Fixando a família antes de qualquer medição, a
 * geometria medida é a geometria rasterizada — chegue a fonte quando chegar.
 */
function fixarFamilia(container: HTMLElement, usarWebfont: boolean): void {
  const familia = usarWebfont
    ? `'${FAMILIA_WEBFONT}', ${PILHA_DE_RECURSO}`
    : PILHA_DE_RECURSO;

  const estilo = document.createElement("style");
  // `!important` porque a folha do documento declara a família em várias regras;
  // o objetivo aqui não é estética, é impedir troca depois da medição.
  estilo.textContent = `#${container.id}, #${container.id} * { font-family: ${familia} !important; }`;
  container.appendChild(estilo);
}

/**
 * Espera as fontes do documento estarem resolvidas ANTES de paginar.
 *
 * Por que `document.fonts.ready` sozinho NÃO resolve: medido neste projeto, a app
 * não registra nenhuma face da Inter — ela vem do `@import` que está na folha do
 * próprio documento. Enquanto essa folha está em voo, o conjunto de fontes está
 * vazio, e `ready` resolve na hora (0 ms, medido). Só depois a folha chega,
 * registra a face, o arquivo é baixado e o texto reflui — já tarde.
 *
 * Então o laço abaixo espera a FACE APARECER antes de esperar o ARQUIVO.
 */
async function aguardarFontes(container: HTMLElement): Promise<void> {
  const fontes = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fontes) {
    fixarFamilia(container, false);
    return;
  }

  // Reflow para o navegador resolver o @import da folha recém-inserida.
  void container.offsetHeight;

  const limite = Date.now() + ESPERA_MAXIMA_FONTES_MS;
  const consulta = `400 12px ${FAMILIA_WEBFONT}`;

  // 1. A face existe? Sem ela, `load` devolve lista vazia e não há o que esperar.
  let faces = await fontes.load(consulta).catch(() => []);
  while (faces.length === 0 && Date.now() < limite) {
    await esperarQuadro();
    faces = await fontes.load(consulta).catch(() => []);
  }

  if (faces.length === 0) {
    // Sem rede, ou o serviço de fontes fora: emitir na pilha de recurso é melhor
    // que travar a emissão. E fixando a família, uma chegada tardia da Inter não
    // consegue mais mexer no que já foi medido.
    fixarFamilia(container, false);
    await esperarQuadro();
    return;
  }

  // 2. Os arquivos dos pesos que o documento usa.
  await Promise.all(
    PESOS_DO_DOCUMENTO.map((peso) =>
      fontes.load(`${peso} 12px ${FAMILIA_WEBFONT}`).catch(() => undefined)
    )
  );
  await fontes.ready;

  fixarFamilia(container, true);
  // Um quadro para o refluxo da troca terminar antes de qualquer medição.
  await esperarQuadro();
}

/** Entrega o arquivo ao usuário via link temporário. */
function baixar(bytes: Uint8Array, nomeArquivo: string): void {
  // `as unknown as BlobPart` porque o Uint8Array do pdf-lib carrega o tipo
  // genérico do ArrayBufferLike, que o lib.dom não aceita direto.
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Libera o blob no próximo tick: revogar de imediato cancela o download em
  // alguns navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
