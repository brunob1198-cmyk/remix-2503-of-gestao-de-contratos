import {
  ancoraDe,
  corpoQueCabe,
  encurtarNome,
  lerAncoras,
  posicaoDoCarimbo,
  type Ancora,
} from "@/utils/ancoraDeAssinatura";

/**
 * O nome de quem assinou, carimbado DENTRO do documento.
 *
 * O PROBLEMA
 *
 * O documento assinado já trazia o original mais a folha de assinaturas do fim.
 * Mas no original a coluna "Assinatura" continuava em branco: quem abre a lista de
 * presença vê uma folha vazia e precisa ir até o fim para descobrir que ela foi
 * assinada. O DocuSign põe a assinatura no lugar certo, ao lado do nome — e é isso
 * que faz o documento se explicar sozinho.
 *
 * DE ONDE SAI A POSIÇÃO
 *
 * Duas fontes, nesta ordem:
 *
 * 1. **Medida na emissão**, gravada nos metadados do próprio arquivo. É o caso dos
 *    documentos que este sistema gera — e é o único que funciona para eles, porque
 *    o `html2pdf` rasteriza a folha e não sobra texto para procurar.
 *
 * 2. **Achada no texto**, para PDF que o usuário anexou. Exige uma coluna de
 *    assinatura na tabela; ver `posicaoDoCarimbo`.
 *
 * Sem nenhuma das duas, não há carimbo. O documento sai como antes, com a folha de
 * assinaturas — que continua sendo a prova. Um carimbo no lugar errado seria pior
 * que carimbo nenhum, e é o único desfecho que este módulo não pode produzir.
 */

export interface AssinanteDoCarimbo {
  nome: string;
  /** Quando assinou, em ISO. */
  assinadoEm: string;
}

export interface ResultadoDoCarimbo {
  bytes: Uint8Array;
  /** Nomes que foram carimbados no documento. */
  carimbados: string[];
  /** Nomes sem lugar conhecido no documento — constam só na folha do fim. */
  semLugar: string[];
}

/** Rótulos de coluna procurados num PDF anexado, do mais específico ao mais amplo. */
const ROTULOS_DE_COLUNA = ["Assinatura", "Assinaturas", "Assinatura do participante"];

/** Respiro entre o texto e a borda da célula. */
const MARGEM_NA_CELULA_PT = 2;

/** Data em dd/mm/aaaa pelo fuso local — `toISOString` é UTC e erra o dia. */
function dataBr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * Troca o que a fonte padrão do PDF não sabe escrever.
 *
 * As fontes padrão usam WinAnsi, que cobre o português — mas não cobre tudo o que
 * pode vir de um cadastro. Um caractere fora da tabela faz o `drawText` lançar, e
 * aí o documento inteiro sairia sem carimbo por causa de um nome.
 */
function apenasWinAnsi(texto: string): string {
  // Faixa aceita: ASCII imprimível (32–126) mais o bloco Latin-1 (160–255), que é
  // onde estão os acentos do português. Escrito como comparação de código, e não
  // como classe de regex, porque a classe exigiria os próprios caracteres altos no
  // arquivo-fonte — e eles não sobrevivem a toda ferramenta que toca no código.
  return Array.from(texto)
    .filter((c) => {
      const cod = c.codePointAt(0) ?? 0;
      return (cod >= 32 && cod <= 126) || (cod >= 160 && cod <= 255);
    })
    .join("");
}

/**
 * Carimba o nome de cada signatário na célula de assinatura dele.
 *
 * Devolve sempre bytes utilizáveis: falha na leitura das posições não impede o
 * documento de ser montado.
 */
export async function carimbarAssinaturas(params: {
  original: ArrayBuffer;
  assinantes: readonly AssinanteDoCarimbo[];
}): Promise<ResultadoDoCarimbo> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

  const pdf = await PDFDocument.load(params.original);

  const ancoras = await descobrirAncoras({
    pdf: { keywords: pdf.getKeywords() },
    original: params.original,
    nomes: params.assinantes.map((a) => a.nome),
  });

  if (ancoras.length === 0) {
    return {
      bytes: await pdf.save(),
      carimbados: [],
      semLugar: params.assinantes.map((a) => a.nome),
    };
  }

  // Times em itálico: é a face das padrão do PDF que mais se afasta do texto
  // impresso, e a assinatura precisa se distinguir do que já estava na folha.
  const fonteDoNome = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const fonteDaNota = await pdf.embedFont(StandardFonts.Helvetica);

  // Azul-tinta escuro: lê como algo escrito depois, e não como parte da impressão.
  const tinta = rgb(0.09, 0.19, 0.42);
  const tintaDaNota = rgb(0.4, 0.45, 0.55);

  const paginas = pdf.getPages();
  const carimbados: string[] = [];
  const semLugar: string[] = [];

  for (const assinante of params.assinantes) {
    const ancora = ancoraDe(ancoras, assinante.nome);
    const pagina = ancora ? paginas[ancora.pagina] : undefined;

    if (!ancora || !pagina) {
      semLugar.push(assinante.nome);
      continue;
    }

    const larguraUtil = ancora.largura - MARGEM_NA_CELULA_PT * 2;
    if (larguraUtil <= 0) {
      semLugar.push(assinante.nome);
      continue;
    }

    const medir = (t: string, corpo: number) => fonteDoNome.widthOfTextAtSize(t, corpo);

    // Primeiro tenta o nome inteiro; se nem no corpo mínimo couber, abrevia o
    // meio — "Bruno S. da Silva" é como a pessoa é identificada, e cortar o fim
    // produziria "Bruno Souza da S", que parece defeito.
    let nome = apenasWinAnsi(assinante.nome.trim());
    let corpo = corpoQueCabe({ texto: nome, larguraMaxima: larguraUtil, medirLargura: medir });
    if (medir(nome, corpo) > larguraUtil) {
      nome = apenasWinAnsi(encurtarNome(assinante.nome));
      corpo = corpoQueCabe({ texto: nome, larguraMaxima: larguraUtil, medirLargura: medir });
    }

    const data = dataBr(assinante.assinadoEm);
    const corpoDaNota = corpoQueCabe({
      texto: data,
      larguraMaxima: larguraUtil,
      medirLargura: (t, c) => fonteDaNota.widthOfTextAtSize(t, c),
      corpoIdeal: 5,
      corpoMinimo: 4,
    });

    // Nome na metade de cima da célula, data embaixo: é a disposição de uma
    // assinatura sobre a linha, com a data ao pé.
    pagina.drawText(nome, {
      x: ancora.x + MARGEM_NA_CELULA_PT,
      y: ancora.y + ancora.altura * 0.42,
      size: corpo,
      font: fonteDoNome,
      color: tinta,
      maxWidth: larguraUtil,
    });

    if (data && ancora.altura > corpo + corpoDaNota + 2) {
      pagina.drawText(data, {
        x: ancora.x + MARGEM_NA_CELULA_PT,
        y: ancora.y + ancora.altura * 0.14,
        size: corpoDaNota,
        font: fonteDaNota,
        color: tintaDaNota,
        maxWidth: larguraUtil,
      });
    }

    carimbados.push(assinante.nome);
  }

  return { bytes: await pdf.save(), carimbados, semLugar };
}

/**
 * As posições de carimbo deste documento.
 *
 * A medida da emissão tem precedência: ela é exata. A busca no texto é a saída
 * para o PDF que veio de fora, e só é tentada quando não há medida — o que também
 * evita carregar o `pdfjs` no caminho comum.
 */
async function descobrirAncoras(params: {
  pdf: { keywords: string | undefined };
  original: ArrayBuffer;
  nomes: readonly string[];
}): Promise<Ancora[]> {
  const medidas = lerAncoras(params.pdf.keywords);
  if (medidas.length > 0) return medidas;

  try {
    const { extrairTextoComPosicao } = await import("@/lib/textoDoPdf");
    const itens = await extrairTextoComPosicao(params.original);
    if (itens.length === 0) return [];

    const achadas: Ancora[] = [];
    for (const nome of params.nomes) {
      for (const rotulo of ROTULOS_DE_COLUNA) {
        const ancora = posicaoDoCarimbo({ itens, nome, rotuloDaColuna: rotulo });
        if (ancora) {
          achadas.push(ancora);
          break;
        }
      }
    }
    return achadas;
  } catch (e) {
    // Documento protegido, corrompido ou sem camada de texto. O documento assinado
    // sai igual, só sem o carimbo no corpo.
    console.warn("Não foi possível ler o texto do documento para posicionar a assinatura:", e);
    return [];
  }
}
