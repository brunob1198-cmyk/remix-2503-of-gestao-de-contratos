import type { PDFDocument, PDFFont, PDFImage, PDFPage, RGB } from "pdf-lib";
import {
  aplicarPapelTimbrado,
  geometriaDaFolha,
} from "@/lib/sgsstPapelTimbrado";
import { CORES_DOC } from "@/lib/sgsstDocumentoEstilos";
import { paginarFatias, totalDePaginas, type Fatia } from "@/utils/pdfPaginacao";
import { alturaDeLinhas, quebrarTexto, truncarEmUmaLinha } from "@/utils/pdfTexto";
import type { Ancora } from "@/utils/ancoraDeAssinatura";
import { chaveDoTexto } from "@/utils/ancoraDeAssinatura";
import { ancoraDoCampo, geometriaDoBloco } from "@/utils/blocoDeAssinaturaPdf";

// WOFF, e não WOFF2 — ver a nota em `embutirFontes`.
import interRegular from "@fontsource/inter/files/inter-latin-400-normal.woff?url";
import interSemi from "@fontsource/inter/files/inter-latin-600-normal.woff?url";

/**
 * Documento do SGSST desenhado DIRETO em PDF, sem passar por HTML.
 *
 * POR QUE SAIR DO CAMINHO ANTIGO
 *
 * Os documentos eram montados em HTML e rasterizados pelo `html2pdf`: a folha
 * inteira virava um canvas, depois fatiado em páginas e inserido como UMA IMAGEM
 * JPEG por folha. Três consequências, todas medidas:
 *
 * 1. **Espaço em branco.** Para não partir um elemento no meio, o html2pdf
 *    inseria uma div de enchimento empurrando-o para a folha seguinte. Uma tabela
 *    que começasse na metade da página deixava a metade de cima vazia.
 *
 * 2. **Teto de páginas.** Acima de ~34 páginas o canvas passava do limite do
 *    navegador e voltava em branco — sem erro. O arquivo saía com logo, rodapé e
 *    numeração, e nada dentro.
 *
 * 3. **Peso e texto morto.** 156 KB por página, e nenhum texto: não dava para
 *    selecionar, buscar nem copiar. O único texto real era o rodapé.
 *
 * Desenhando direto, os três somem de uma vez. A quebra de página passa a ser
 * nossa (ver `pdfPaginacao`), e tabela que não cabe simplesmente continua na
 * folha seguinte com o cabeçalho repetido — que o raster nunca soube fazer.
 *
 * A MARCA D'ÁGUA FICA MAIS SIMPLES, E NÃO MAIS DIFÍCIL
 *
 * No caminho antigo ela precisava ser fundo CSS: o `drawImage` do pdf-lib
 * acrescenta ao fim do stream, ou seja, pinta POR CIMA, e uma tentativa anterior
 * de desenhá-la no PDF pronto obrigou a rasterizar o conteúdo em PNG transparente
 * — o arquivo foi a ~1,2 MB por página. Aqui a ordem de desenho é nossa: a marca
 * é a primeira coisa de cada folha, e o texto vai por cima naturalmente.
 *
 * O QUE ESTE MÓDULO NÃO FAZ
 *
 * Logo, rodapé e numeração continuam com `aplicarPapelTimbrado`, estampados
 * depois em todas as páginas. É o mesmo timbre dos demais documentos, e mantê-lo
 * num lugar só é o que impede os dois caminhos de divergirem enquanto a migração
 * não termina.
 */

// ---------------------------------------------------------------------------
// O documento, como dado
// ---------------------------------------------------------------------------

export interface CelulaDaTabela {
  texto: string;
  /**
   * Marca esta célula como o lugar da assinatura de alguém. O valor é o nome da
   * pessoa, e vira a âncora gravada no arquivo.
   *
   * Aqui a posição é EXATA, e não deduzida: quem desenha a célula sabe onde ela
   * ficou. No caminho por HTML era preciso medir o clone do html2pdf e torcer.
   */
  ancoraDeAssinatura?: string;
}

export interface ColunaDaTabela {
  rotulo: string;
  /** Largura fixa em pontos. Sem isto, divide o espaço que sobrar com as demais. */
  largura?: number;
  alinhamento?: "esquerda" | "centro" | "direita";
}

export interface ParDeIdentificacao {
  rotulo: string;
  valor: string;
  /** Valor em negrito: o que identifica o documento (nome, curso, obra). */
  forte?: boolean;
  /** Valor ausente no cadastro: sai em âmbar, dizendo que falta. */
  falta?: boolean;
}

export type Bloco =
  | { tipo: "cabecalho"; titulo: string; subtitulo?: string }
  | { tipo: "aviso"; titulo?: string; texto: string }
  | { tipo: "identificacao"; pares: readonly ParDeIdentificacao[] }
  | { tipo: "secao"; titulo: string }
  | {
      tipo: "tabela";
      colunas: readonly ColunaDaTabela[];
      linhas: readonly (readonly CelulaDaTabela[])[];
      /** Altura da linha do corpo. Folha de presença precisa de espaço para a mão. */
      alturaDaLinha?: number;
    }
  | { tipo: "paragrafo"; texto: string; fraco?: boolean }
  | { tipo: "assinaturas"; campos: readonly { nome?: string | null; papel: string }[] }
  | { tipo: "espaco"; altura: number };

export interface DocumentoDireto {
  blocos: readonly Bloco[];
  /** Texto curto no rodapé de cada página, para folha solta se identificar. */
  identificacao?: string;
  /** Marca d'água ao fundo. Ligada por padrão. */
  marcaDagua?: boolean;
}

// ---------------------------------------------------------------------------
// Medidas e cores
// ---------------------------------------------------------------------------

const MM_PARA_PT = 72 / 25.4;

/**
 * Corpos em pontos, derivados dos tamanhos em pixel da folha de estilo atual
 * (1px de CSS = 0,75pt). Manter a proporção é o que faz o documento continuar
 * reconhecível depois da troca de motor.
 */
const CORPO = {
  titulo: 12,
  subtitulo: 7.5,
  secao: 9.5,
  corpo: 8.25,
  tabela: 7.5,
  nota: 7,
} as const;

const ESPACO = {
  aposCabecalho: 12,
  aposSecao: 5,
  entreBlocos: 9,
  padding: 4,
} as const;

/** Converte "#1e3a5f" no rgb do pdf-lib. */
function corDoHex(hex: string, rgb: (r: number, g: number, b: number) => RGB): RGB {
  const limpo = hex.replace("#", "");
  const n = parseInt(limpo, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

// ---------------------------------------------------------------------------
// Fontes
// ---------------------------------------------------------------------------

/**
 * A Inter, embutida.
 *
 * É a fonte que os documentos já usam. As fontes padrão do PDF (Helvetica, Times)
 * não custam nada e mudariam a cara do documento — e a decisão foi manter a
 * identidade visual.
 *
 * POR QUE WOFF E NÃO WOFF2
 *
 * O `@fontsource/inter` traz os dois, e o fontkit **lê** os dois. Mas o
 * SUBSETTER, que é o que reduz a fonte aos glifos usados, quebra com a origem em
 * woff2. Medido, embutindo e salvando:
 *
 *   woff2 + subset  -> RangeError em `TTFSubset._addGlyph`
 *   woff2 sem subset -> 27 KB
 *   woff  + subset  ->  2,9 KB   <- este
 *   woff  sem subset -> 34 KB
 *
 * E a falha do woff2 é especialmente ruim: ela acontece numa fila interna do
 * fontkit, fora da cadeia de promessas, então nem `try/catch` em volta do
 * `save()` a segura — derruba a emissão inteira. Por isso a escolha não é de
 * preferência: é o único caminho que não pode explodir sem defesa.
 *
 * Cache por URL: a mesma sessão emite vários documentos, e buscar de novo a cada
 * emissão seria desperdício.
 */
const cacheDeFontes = new Map<string, ArrayBuffer | null>();

async function bytesDaFonte(url: string): Promise<ArrayBuffer | null> {
  if (cacheDeFontes.has(url)) return cacheDeFontes.get(url) ?? null;
  try {
    const resposta = await fetch(url);
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    const bytes = await resposta.arrayBuffer();
    cacheDeFontes.set(url, bytes);
    return bytes;
  } catch (e) {
    console.warn(`Não foi possível carregar a fonte ${url}:`, e);
    cacheDeFontes.set(url, null);
    return null;
  }
}

interface Fontes {
  normal: PDFFont;
  forte: PDFFont;
}

async function embutirFontes(pdf: PDFDocument): Promise<Fontes> {
  const { StandardFonts } = await import("pdf-lib");
  const [regular, semi] = await Promise.all([
    bytesDaFonte(interRegular),
    bytesDaFonte(interSemi),
  ]);

  if (!regular || !semi) {
    // Sem rede ou ativo indisponível: o documento sai na Helvetica. Muda a
    // tipografia e sai INTEIRO — travar a emissão por causa da fonte seria
    // trocar o essencial pelo acessório.
    console.warn("Inter indisponível; emitindo com a fonte padrão do PDF.");
    return {
      normal: await pdf.embedFont(StandardFonts.Helvetica),
      forte: await pdf.embedFont(StandardFonts.HelveticaBold),
    };
  }

  const fontkit = (await import("@pdf-lib/fontkit")).default;
  pdf.registerFontkit(fontkit);

  return {
    normal: await pdf.embedFont(regular, { subset: true }),
    forte: await pdf.embedFont(semi, { subset: true }),
  };
}

// ---------------------------------------------------------------------------
// Desenho
// ---------------------------------------------------------------------------

/**
 * O que uma fatia precisa para se desenhar: a página, onde começa a área útil e
 * como converter "distância do topo" na coordenada do PDF (que cresce para cima).
 */
interface Pincel {
  pagina: PDFPage;
  esquerda: number;
  largura: number;
  /** Converte distância do topo da área útil em `y` do PDF. */
  y: (topo: number) => number;
  /** Página onde este pincel está desenhando, começando em 0. */
  indiceDaPagina: number;
}

interface FatiaDesenhavel extends Fatia {
  desenhar: (pincel: Pincel, topo: number) => void;
}

interface Contexto {
  fontes: Fontes;
  cores: Record<keyof typeof CORES_DOC, RGB>;
  largura: number;
  /** Preenchido durante o desenho, com a posição real de cada célula marcada. */
  ancoras: Ancora[];
  rgb: (r: number, g: number, b: number) => RGB;
}

/** Linha de texto simples, com a base calculada a partir do topo. */
function escrever(
  pincel: Pincel,
  params: {
    texto: string;
    x: number;
    topo: number;
    corpo: number;
    fonte: PDFFont;
    cor: RGB;
  }
): void {
  pincel.pagina.drawText(params.texto, {
    x: params.x,
    // A base fica a ~80% do corpo abaixo do topo: é onde a maiúscula encosta.
    y: pincel.y(params.topo + params.corpo * 0.8),
    size: params.corpo,
    font: params.fonte,
    color: params.cor,
  });
}

function linhaHorizontal(
  pincel: Pincel,
  params: { x1: number; x2: number; topo: number; cor: RGB; espessura?: number }
): void {
  pincel.pagina.drawLine({
    start: { x: params.x1, y: pincel.y(params.topo) },
    end: { x: params.x2, y: pincel.y(params.topo) },
    thickness: params.espessura ?? 0.5,
    color: params.cor,
  });
}

function retangulo(
  pincel: Pincel,
  params: {
    x: number;
    topo: number;
    largura: number;
    altura: number;
    preenchimento?: RGB;
    borda?: RGB;
  }
): void {
  pincel.pagina.drawRectangle({
    x: params.x,
    y: pincel.y(params.topo + params.altura),
    width: params.largura,
    height: params.altura,
    color: params.preenchimento,
    borderColor: params.borda,
    borderWidth: params.borda ? 0.5 : 0,
  });
}

/** Larguras de coluna: as fixas mandam, o resto divide o que sobra. */
export function largurasDasColunas(
  colunas: readonly ColunaDaTabela[],
  larguraTotal: number
): number[] {
  const fixas = colunas.reduce((s, c) => s + (c.largura ?? 0), 0);
  const semLargura = colunas.filter((c) => c.largura === undefined).length;
  const sobra = Math.max(0, larguraTotal - fixas);
  const cada = semLargura > 0 ? sobra / semLargura : 0;
  return colunas.map((c) => c.largura ?? cada);
}

function alinhar(
  alinhamento: ColunaDaTabela["alinhamento"],
  x: number,
  larguraDaColuna: number,
  larguraDoTexto: number
): number {
  if (alinhamento === "centro") return x + (larguraDaColuna - larguraDoTexto) / 2;
  if (alinhamento === "direita") return x + larguraDaColuna - larguraDoTexto - ESPACO.padding;
  return x + ESPACO.padding;
}

// ---------------------------------------------------------------------------
// Blocos -> fatias
// ---------------------------------------------------------------------------

function fatiasDoBloco(bloco: Bloco, ctx: Contexto): FatiaDesenhavel[] {
  const { fontes, cores, largura } = ctx;
  const medirNormal = (t: string, c: number) => fontes.normal.widthOfTextAtSize(t, c);
  const medirForte = (t: string, c: number) => fontes.forte.widthOfTextAtSize(t, c);

  switch (bloco.tipo) {
    case "cabecalho": {
      const linhasSub = bloco.subtitulo
        ? quebrarTexto({
            texto: bloco.subtitulo,
            larguraMaxima: largura,
            corpo: CORPO.subtitulo,
            medir: medirNormal,
          })
        : [];
      const altura =
        alturaDeLinhas(1, CORPO.titulo) +
        alturaDeLinhas(linhasSub.length, CORPO.subtitulo) +
        ESPACO.aposCabecalho;

      return [
        {
          altura,
          desenhar: (p, topo) => {
            escrever(p, {
              texto: bloco.titulo.toUpperCase(),
              x: p.esquerda,
              topo,
              corpo: CORPO.titulo,
              fonte: fontes.forte,
              cor: cores.tinta,
            });
            let y = topo + alturaDeLinhas(1, CORPO.titulo);
            for (const linha of linhasSub) {
              escrever(p, {
                texto: linha,
                x: p.esquerda,
                topo: y,
                corpo: CORPO.subtitulo,
                fonte: fontes.normal,
                cor: cores.textoFraco,
              });
              y += alturaDeLinhas(1, CORPO.subtitulo);
            }
            // Traço fino, e não faixa chapada: é a marca do cabeçalho atual.
            linhaHorizontal(p, {
              x1: p.esquerda,
              x2: p.esquerda + p.largura,
              topo: topo + altura - ESPACO.aposCabecalho + 4,
              cor: cores.linhaForte,
            });
          },
        },
      ];
    }

    case "aviso": {
      const larguraInterna = largura - ESPACO.padding * 4;
      const linhasTitulo = bloco.titulo
        ? quebrarTexto({
            texto: bloco.titulo,
            larguraMaxima: larguraInterna,
            corpo: CORPO.corpo,
            medir: medirForte,
          })
        : [];
      const linhasTexto = quebrarTexto({
        texto: bloco.texto,
        larguraMaxima: larguraInterna,
        corpo: CORPO.corpo,
        medir: medirNormal,
      });
      const alturaCaixa =
        alturaDeLinhas(linhasTitulo.length + linhasTexto.length, CORPO.corpo) +
        ESPACO.padding * 2;

      return [
        {
          altura: alturaCaixa + ESPACO.entreBlocos,
          desenhar: (p, topo) => {
            retangulo(p, {
              x: p.esquerda,
              topo,
              largura: p.largura,
              altura: alturaCaixa,
              preenchimento: cores.avisoFundo,
              borda: cores.avisoBorda,
            });
            let y = topo + ESPACO.padding;
            for (const linha of linhasTitulo) {
              escrever(p, {
                texto: linha,
                x: p.esquerda + ESPACO.padding * 2,
                topo: y,
                corpo: CORPO.corpo,
                fonte: fontes.forte,
                cor: cores.avisoTexto,
              });
              y += alturaDeLinhas(1, CORPO.corpo);
            }
            for (const linha of linhasTexto) {
              escrever(p, {
                texto: linha,
                x: p.esquerda + ESPACO.padding * 2,
                topo: y,
                corpo: CORPO.corpo,
                fonte: fontes.normal,
                cor: cores.avisoTexto,
              });
              y += alturaDeLinhas(1, CORPO.corpo);
            }
          },
        },
      ];
    }

    case "identificacao": {
      // Dois pares por linha, como a grade de quatro colunas do documento atual.
      const porLinha = 2;
      const larguraDoPar = largura / porLinha;
      const larguraDoRotulo = Math.min(90, larguraDoPar * 0.42);
      const alturaDaLinha = alturaDeLinhas(1, CORPO.corpo) + 3;
      const linhas: ParDeIdentificacao[][] = [];
      for (let i = 0; i < bloco.pares.length; i += porLinha) {
        linhas.push(bloco.pares.slice(i, i + porLinha) as ParDeIdentificacao[]);
      }
      const alturaCaixa = linhas.length * alturaDaLinha + ESPACO.padding * 2;

      return [
        {
          altura: alturaCaixa + ESPACO.entreBlocos,
          desenhar: (p, topo) => {
            retangulo(p, {
              x: p.esquerda,
              topo,
              largura: p.largura,
              altura: alturaCaixa,
              preenchimento: cores.fundoSuave,
              borda: cores.linha,
            });

            linhas.forEach((linha, iLinha) => {
              const y = topo + ESPACO.padding + iLinha * alturaDaLinha;
              linha.forEach((par, iPar) => {
                const x = p.esquerda + ESPACO.padding + iPar * larguraDoPar;

                escrever(p, {
                  texto: truncarEmUmaLinha({
                    texto: par.rotulo,
                    larguraMaxima: larguraDoRotulo - 4,
                    corpo: CORPO.nota,
                    medir: medirNormal,
                  }),
                  x,
                  topo: y + 0.5,
                  corpo: CORPO.nota,
                  fonte: fontes.normal,
                  cor: cores.textoFraco,
                });

                const fonte = par.forte ? fontes.forte : fontes.normal;
                escrever(p, {
                  texto: truncarEmUmaLinha({
                    texto: par.valor,
                    larguraMaxima: larguraDoPar - larguraDoRotulo - ESPACO.padding * 2,
                    corpo: CORPO.corpo,
                    medir: (t, c) => fonte.widthOfTextAtSize(t, c),
                  }),
                  x: x + larguraDoRotulo,
                  topo: y,
                  corpo: CORPO.corpo,
                  fonte,
                  cor: par.falta ? cores.atencao : cores.texto,
                });
              });
            });
          },
        },
      ];
    }

    case "secao": {
      const altura = alturaDeLinhas(1, CORPO.secao) + ESPACO.aposSecao;
      return [
        {
          altura,
          // Título sozinho no pé da folha faria o leitor virar a página achando
          // que a seção está vazia.
          prendeAProxima: true,
          desenhar: (p, topo) => {
            // Marcador vertical à esquerda, no lugar da faixa chapada.
            retangulo(p, {
              x: p.esquerda,
              topo: topo + 1,
              largura: 2.5,
              altura: CORPO.secao,
              preenchimento: cores.tinta,
            });
            escrever(p, {
              texto: bloco.titulo.toUpperCase(),
              x: p.esquerda + 7,
              topo,
              corpo: CORPO.secao,
              fonte: fontes.forte,
              cor: cores.tinta,
            });
          },
        },
      ];
    }

    case "paragrafo": {
      const linhas = quebrarTexto({
        texto: bloco.texto,
        larguraMaxima: largura,
        corpo: CORPO.corpo,
        medir: medirNormal,
      });
      return [
        {
          altura: alturaDeLinhas(linhas.length, CORPO.corpo) + ESPACO.entreBlocos,
          desenhar: (p, topo) => {
            let y = topo;
            for (const linha of linhas) {
              escrever(p, {
                texto: linha,
                x: p.esquerda,
                topo: y,
                corpo: CORPO.corpo,
                fonte: fontes.normal,
                cor: bloco.fraco ? cores.textoFraco : cores.texto,
              });
              y += alturaDeLinhas(1, CORPO.corpo);
            }
          },
        },
      ];
    }

    case "assinaturas": {
      const larguraDoCampo = largura / Math.max(1, bloco.campos.length);
      const geo = geometriaDoBloco({
        corpo: CORPO.corpo,
        nota: CORPO.nota,
        entreBlocos: ESPACO.entreBlocos,
      });

      return [
        {
          altura: geo.altura,
          desenhar: (p, topo) => {
            bloco.campos.forEach((campo, i) => {
              const centro = p.esquerda + larguraDoCampo * (i + 0.5);
              const meia = Math.min(larguraDoCampo, 190) / 2;

              // A âncora é o espaço ACIMA do traço — o mesmo espaço que a mão
              // usaria. Registrada aqui porque é aqui que se sabe onde o campo
              // caiu depois da paginação.
              const ancora = ancoraDoCampo({
                nome: campo.nome,
                jaUsadas: ctx.ancoras.map((a) => a.chave),
                pagina: p.indiceDaPagina,
                x: centro - meia,
                y: p.y(topo + geo.topoDaLinha),
                largura: meia * 2,
              });
              if (ancora) ctx.ancoras.push(ancora);

              linhaHorizontal(p, {
                x1: centro - meia,
                x2: centro + meia,
                topo: topo + geo.topoDaLinha,
                cor: cores.linhaForte,
              });

              if (campo.nome) {
                const t = truncarEmUmaLinha({
                  texto: campo.nome,
                  larguraMaxima: meia * 2,
                  corpo: CORPO.corpo,
                  medir: medirNormal,
                });
                escrever(p, {
                  texto: t,
                  x: centro - medirNormal(t, CORPO.corpo) / 2,
                  topo: topo + geo.topoDoNome,
                  corpo: CORPO.corpo,
                  fonte: fontes.normal,
                  cor: cores.texto,
                });
              }

              const papel = truncarEmUmaLinha({
                texto: campo.papel,
                larguraMaxima: meia * 2,
                corpo: CORPO.nota,
                medir: medirNormal,
              });
              escrever(p, {
                texto: papel,
                x: centro - medirNormal(papel, CORPO.nota) / 2,
                topo: topo + geo.topoDoPapel,
                corpo: CORPO.nota,
                fonte: fontes.normal,
                cor: cores.textoFraco,
              });
            });
          },
        },
      ];
    }

    case "espaco":
      return [{ altura: bloco.altura, desenhar: () => undefined }];

    case "tabela":
      return fatiasDaTabela(bloco, ctx);
  }
}

/**
 * Uma fatia por linha, mais o cabeçalho.
 *
 * É esta granularidade que permite a tabela continuar na folha seguinte em vez de
 * ser empurrada inteira — e é justamente o empurrão que produzia meia folha em
 * branco no caminho antigo.
 */
function fatiasDaTabela(
  bloco: Extract<Bloco, { tipo: "tabela" }>,
  ctx: Contexto
): FatiaDesenhavel[] {
  const { fontes, cores, largura } = ctx;
  const larguras = largurasDasColunas(bloco.colunas, largura);
  const alturaDoCabecalho = alturaDeLinhas(1, CORPO.tabela) + 6;
  const alturaDaLinha = bloco.alturaDaLinha ?? alturaDeLinhas(1, CORPO.tabela) + 6;
  const grupo = `tabela-${Math.random().toString(36).slice(2, 9)}`;

  const xDaColuna = (i: number, esquerda: number) =>
    esquerda + larguras.slice(0, i).reduce((s, w) => s + w, 0);

  const cabecalho: FatiaDesenhavel = {
    altura: alturaDoCabecalho,
    grupo,
    cabecalhoDoGrupo: true,
    prendeAProxima: true,
    desenhar: (p, topo) => {
      retangulo(p, {
        x: p.esquerda,
        topo,
        largura: p.largura,
        altura: alturaDoCabecalho,
        preenchimento: cores.fundoCabecalho,
      });
      bloco.colunas.forEach((coluna, i) => {
        const x = xDaColuna(i, p.esquerda);
        const texto = truncarEmUmaLinha({
          texto: coluna.rotulo,
          larguraMaxima: larguras[i] - ESPACO.padding * 2,
          corpo: CORPO.tabela,
          medir: (t, c) => fontes.forte.widthOfTextAtSize(t, c),
        });
        escrever(p, {
          texto,
          x: alinhar(
            coluna.alinhamento,
            x,
            larguras[i],
            fontes.forte.widthOfTextAtSize(texto, CORPO.tabela)
          ),
          topo: topo + 3,
          corpo: CORPO.tabela,
          fonte: fontes.forte,
          cor: cores.tinta,
        });
      });
      linhaHorizontal(p, {
        x1: p.esquerda,
        x2: p.esquerda + p.largura,
        topo: topo + alturaDoCabecalho,
        cor: cores.linhaForte,
      });
    },
  };

  const linhas: FatiaDesenhavel[] = bloco.linhas.map((celulas) => ({
    altura: alturaDaLinha,
    grupo,
    desenhar: (p, topo) => {
      bloco.colunas.forEach((coluna, i) => {
        const x = xDaColuna(i, p.esquerda);
        const celula = celulas[i];

        // Separador vertical entre colunas, menos antes da primeira.
        if (i > 0) {
          p.pagina.drawLine({
            start: { x, y: p.y(topo) },
            end: { x, y: p.y(topo + alturaDaLinha) },
            thickness: 0.5,
            color: cores.linha,
          });
        }

        if (celula?.ancoraDeAssinatura) {
          // A posição é registrada, não deduzida: esta é a célula, e este é o
          // retângulo dela. Fica para a assinatura eletrônica carimbar depois.
          ctx.ancoras.push({
            chave: chaveDoTexto(celula.ancoraDeAssinatura),
            pagina: p.indiceDaPagina,
            x,
            y: p.y(topo + alturaDaLinha),
            largura: larguras[i],
            altura: alturaDaLinha,
          });
        }

        if (!celula?.texto) return;

        const texto = truncarEmUmaLinha({
          texto: celula.texto,
          larguraMaxima: larguras[i] - ESPACO.padding * 2,
          corpo: CORPO.tabela,
          medir: (t, c) => fontes.normal.widthOfTextAtSize(t, c),
        });
        escrever(p, {
          texto,
          x: alinhar(
            coluna.alinhamento,
            x,
            larguras[i],
            fontes.normal.widthOfTextAtSize(texto, CORPO.tabela)
          ),
          // Centrado na altura da linha: em folha de presença a linha é alta, e
          // o texto colado no topo pareceria desalinhado do resto.
          topo: topo + (alturaDaLinha - CORPO.tabela) / 2 - 1,
          corpo: CORPO.tabela,
          fonte: fontes.normal,
          cor: cores.texto,
        });
      });

      linhaHorizontal(p, {
        x1: p.esquerda,
        x2: p.esquerda + p.largura,
        topo: topo + alturaDaLinha,
        cor: cores.linha,
      });
    },
  }));

  // O respiro depois da tabela é uma fatia à parte, fora do grupo: dentro dele,
  // ele seria arrastado para o topo da folha seguinte junto do cabeçalho.
  return [cabecalho, ...linhas, { altura: ESPACO.entreBlocos, desenhar: () => undefined }];
}

// ---------------------------------------------------------------------------
// Emissão
// ---------------------------------------------------------------------------

const MARCA_DAGUA_URL = "/papel-timbrado/marca-dagua.png";
let cacheDaMarca: ArrayBuffer | null | undefined;

async function bytesDaMarcaDagua(): Promise<ArrayBuffer | null> {
  if (cacheDaMarca !== undefined) return cacheDaMarca;
  try {
    const r = await fetch(MARCA_DAGUA_URL);
    cacheDaMarca = r.ok ? await r.arrayBuffer() : null;
  } catch {
    cacheDaMarca = null;
  }
  return cacheDaMarca;
}

/** Bytes do PDF, já com o papel timbrado e as âncoras de assinatura gravadas. */
export async function gerarPdfDireto(documento: DocumentoDireto): Promise<Uint8Array> {
  const { PDFDocument, rgb } = await import("pdf-lib");

  const pdf = await PDFDocument.create();
  const fontes = await embutirFontes(pdf);

  const geo = geometriaDaFolha();
  const larguraUtil = geo.larguraUtilMm * MM_PARA_PT;
  const alturaUtil = geo.alturaUtilMm * MM_PARA_PT;
  const esquerda = geo.margemEsquerdaMm * MM_PARA_PT;
  const topoDaArea = (geo.alturaDaFolhaMm - geo.margemSuperiorMm) * MM_PARA_PT;

  const cores = Object.fromEntries(
    Object.entries(CORES_DOC).map(([k, v]) => [k, corDoHex(v, rgb)])
  ) as Contexto["cores"];

  const ctx: Contexto = { fontes, cores, largura: larguraUtil, ancoras: [], rgb };

  const fatias = documento.blocos.flatMap((b) => fatiasDoBloco(b, ctx));
  const posicoes = paginarFatias({ fatias, alturaUtil });
  const paginas = totalDePaginas(posicoes);

  const marca =
    documento.marcaDagua === false ? null : await bytesDaMarcaDagua();
  let imagemDaMarca: PDFImage | null = null;
  if (marca) {
    try {
      imagemDaMarca = await pdf.embedPng(marca);
    } catch (e) {
      console.warn("Marca d'água indisponível:", e);
    }
  }

  const folhas: PDFPage[] = [];
  for (let i = 0; i < paginas; i++) {
    const folha = pdf.addPage([
      geo.larguraDaFolhaMm * MM_PARA_PT,
      geo.alturaDaFolhaMm * MM_PARA_PT,
    ]);

    // A marca é a PRIMEIRA coisa da folha: o pdf-lib acrescenta ao fim do stream,
    // então o que vem depois é pintado por cima. Aqui isso funciona a nosso favor.
    if (imagemDaMarca) {
      folha.drawImage(imagemDaMarca, {
        x: esquerda,
        y: topoDaArea - alturaUtil,
        width: larguraUtil,
        height: alturaUtil,
        opacity: 0.5,
      });
    }

    folhas.push(folha);
  }

  for (const posicao of posicoes) {
    const fatia = fatias[posicao.indice];
    const pincel: Pincel = {
      pagina: folhas[posicao.pagina],
      esquerda,
      largura: larguraUtil,
      y: (topo: number) => topoDaArea - topo,
      indiceDaPagina: posicao.pagina,
    };
    fatia.desenhar(pincel, posicao.topo);
  }

  const bytes = await pdf.save();
  return aplicarPapelTimbrado(bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer, {
    identificacao: documento.identificacao,
    ancoras: ctx.ancoras,
  });
}

/** O mesmo PDF, entregue ao disco do usuário. */
export async function baixarPdfDireto(
  documento: DocumentoDireto,
  nomeArquivo: string
): Promise<void> {
  const bytes = await gerarPdfDireto(documento);
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Revogar de imediato cancela o download em alguns navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** O mesmo PDF, embrulhado como `File` para a fila de assinatura. */
export async function arquivoPdfDireto(
  documento: DocumentoDireto,
  nomeArquivo: string
): Promise<File> {
  const bytes = await gerarPdfDireto(documento);
  return new File([bytes as unknown as BlobPart], nomeArquivo, {
    type: "application/pdf",
  });
}
