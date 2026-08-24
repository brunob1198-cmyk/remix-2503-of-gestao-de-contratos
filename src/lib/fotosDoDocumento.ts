import { escDoc as esc, CORES_DOC } from "@/lib/sgsstDocumentoEstilos";
import { seloDaFoto, type OrigemFoto } from "@/utils/fotoGeolocalizada";
import { resolveFileUrl } from "@/utils/fileUrlResolver";

/**
 * A foto dentro do documento emitido.
 *
 * As fotos passaram a ser anexáveis em todo o SGSST, mas ficavam só na tela. Uma
 * evidência que não sai no documento não é evidência: o que vai para a auditoria,
 * para o cliente e para o arquivo é a folha, e a folha dizia "2 evidências
 * anexadas" — uma afirmação que quem recebe não tem como conferir.
 *
 * Quatro decisões governam este módulo:
 *
 * 1. **A imagem entra como dado, não como endereço.** O PDF é rasterizado pelo
 *    html2canvas; um `<img src="https://...">` depende do cabeçalho de CORS do
 *    servidor E de a imagem terminar de carregar antes do instantâneo do canvas.
 *    Foto que chega tarde sai como retângulo vazio, e retângulo vazio em documento
 *    assinado é pior que foto nenhuma. Baixar e embutir remove os dois riscos.
 *
 * 2. **Reduz antes de embutir.** Foto de celular tem 3 a 5 megapixels. Doze delas
 *    no mesmo canvas são centenas de MB de memória e um PDF que ninguém consegue
 *    anexar em e-mail. O lado maior em 900 px é folgado para os ~85 mm que a foto
 *    ocupa no A4.
 *
 * 3. **Falha é impressa, não escondida.** Se o arquivo não vem, o quadro sai com o
 *    selo, a legenda e a linha dizendo que a imagem não foi incorporada. Sumir com
 *    a foto faria o documento afirmar que havia menos evidência do que havia.
 *
 * 4. **O selo vai debaixo de cada foto.** Onde, quando e por qual meio: é isso que
 *    separa evidência de ilustração. Sem o selo, a foto no documento não prova
 *    nada além de que alguém anexou um arquivo.
 */

/** Uma foto vinda do banco, pronta para o documento. */
export interface FotoParaDocumento {
  /** Endereço gravado na evidência. */
  url: string;
  descricao?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  precisao?: number | null;
  capturadaEm?: string | null;
  origem?: OrigemFoto | null;
  motivoSemGeo?: string | null;
  /** Identifica a que parte do registro a foto pertence, quando há mais de uma. */
  rotulo?: string | null;
}

/** A mesma foto depois de baixada e reduzida. */
export interface FotoPreparada extends FotoParaDocumento {
  /** A imagem em base64, ou nulo se não foi possível baixar. */
  dataUri: string | null;
  /** Por que não foi possível embutir. Sai impresso no lugar da imagem. */
  falha: string | null;
}

/**
 * Teto de fotos por documento.
 *
 * Não é limite de armazenamento — o registro aceita cem. É o ponto em que o PDF
 * deixa de ser documento e passa a ser álbum: 24 fotos já são seis páginas só de
 * imagem. Passando disso o documento diz quantas ficaram de fora, para quem lê
 * saber que precisa abrir o sistema.
 */
export const FOTOS_LIMITE_DOCUMENTO = 24;

/** Lado maior da imagem embutida, em pixels. */
export const LADO_MAXIMO_PX = 900;

/** Qualidade do JPEG das fotos embutidas. */
const QUALIDADE_FOTO = 0.72;

/**
 * Reduz mantendo a proporção; imagem já pequena passa intacta.
 *
 * Ampliar foto pequena só aumentaria o arquivo sem acrescentar detalhe.
 */
export function dimensoesReduzidas(
  largura: number,
  altura: number,
  ladoMaximo = LADO_MAXIMO_PX
): { largura: number; altura: number } {
  if (!Number.isFinite(largura) || !Number.isFinite(altura) || largura <= 0 || altura <= 0) {
    return { largura: 0, altura: 0 };
  }

  const maior = Math.max(largura, altura);
  if (maior <= ladoMaximo) return { largura: Math.round(largura), altura: Math.round(altura) };

  const fator = ladoMaximo / maior;
  return {
    largura: Math.max(1, Math.round(largura * fator)),
    altura: Math.max(1, Math.round(altura * fator)),
  };
}

/**
 * Baixa uma foto e devolve em base64, já reduzida.
 *
 * O caminho é fetch → blob → `blob:` → canvas. O desvio pelo blob local existe
 * porque um `<img>` apontando para outro domínio CONTAMINA o canvas, e o
 * `toDataURL` passa a lançar exceção de segurança. Com o blob a imagem é de mesma
 * origem e o canvas fica limpo.
 */
async function baixarEReduzir(
  url: string
): Promise<{ dataUri: string | null; falha: string | null }> {
  let objectUrl: string | null = null;

  try {
    const resposta = await fetch(url);
    if (!resposta.ok) {
      return { dataUri: null, falha: `o arquivo respondeu HTTP ${resposta.status}` };
    }

    const blob = await resposta.blob();
    objectUrl = URL.createObjectURL(blob);

    const imagem = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("o arquivo não é uma imagem legível"));
      img.src = objectUrl as string;
    });

    const { largura, altura } = dimensoesReduzidas(imagem.naturalWidth, imagem.naturalHeight);
    if (largura === 0) return { dataUri: null, falha: "a imagem chegou sem dimensão" };

    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;

    const ctx = canvas.getContext("2d");
    if (!ctx) return { dataUri: null, falha: "o navegador não forneceu contexto de desenho" };

    // Fundo branco antes de desenhar: PNG com transparência viraria preto no JPEG.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, largura, altura);
    ctx.drawImage(imagem, 0, 0, largura, altura);

    return { dataUri: canvas.toDataURL("image/jpeg", QUALIDADE_FOTO), falha: null };
  } catch (e) {
    return { dataUri: null, falha: (e as Error).message || "falha ao baixar o arquivo" };
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

export interface FotosPreparadas {
  fotos: readonly FotoPreparada[];
  /** Quantas ficaram fora por causa do teto. Sai impresso quando maior que zero. */
  omitidas: number;
}

/**
 * Baixa e reduz as fotos de um documento.
 *
 * Em paralelo: são requisições independentes, e uma foto lenta não deve atrasar as
 * outras. O contexto vai ao `resolveFileUrl` porque as fotos antigas do projeto
 * guardam o caminho relativo ao bucket, e sem o contexto o endereço sai errado.
 */
export async function prepararFotosDoDocumento(
  fotos: readonly FotoParaDocumento[],
  opcoes: { contexto?: string; limite?: number } = {}
): Promise<FotosPreparadas> {
  const limite = opcoes.limite ?? FOTOS_LIMITE_DOCUMENTO;
  const consideradas = fotos.slice(0, limite);

  const preparadas = await Promise.all(
    consideradas.map(async (foto): Promise<FotoPreparada> => {
      const endereco = resolveFileUrl(foto.url, false, opcoes.contexto);
      if (!endereco) {
        return { ...foto, dataUri: null, falha: "a evidência está sem endereço de arquivo" };
      }

      const { dataUri, falha } = await baixarEReduzir(endereco);
      return { ...foto, dataUri, falha };
    })
  );

  return { fotos: preparadas, omitidas: Math.max(0, fotos.length - consideradas.length) };
}

/**
 * Estilos do bloco de fotos.
 *
 * Fica separado dos estilos gerais porque só os documentos que imprimem foto
 * pagam o custo, e porque a regra de quebra de página é específica: o quadro da
 * foto não pode ser cortado no meio, ou o selo cai numa folha e a imagem em outra.
 */
export const estilosFotosDocumento = `
  <style>
    .doc-fotos { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
    .doc-foto { width: calc(50% - 4px); border: 1px solid ${CORES_DOC.linha};
      border-radius: 3px; overflow: hidden; background: #fff;
      page-break-inside: avoid; break-inside: avoid; }
    .doc-fotos.doc-fotos-3 .doc-foto { width: calc(33.333% - 6px); }
    .doc-foto img { display: block; width: 100%; height: 132px; object-fit: cover; }
    .doc-fotos.doc-fotos-3 .doc-foto img { height: 104px; }
    .doc-foto .corpo { padding: 4px 6px 5px; }
    .doc-foto .num { font-size: 8px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .05em; color: ${CORES_DOC.tinta}; }
    .doc-foto .rotulo { font-size: 8px; color: ${CORES_DOC.textoFraco}; font-weight: 400;
      text-transform: none; letter-spacing: 0; }
    .doc-foto .legenda { font-size: 9px; color: ${CORES_DOC.texto}; margin-top: 2px;
      line-height: 1.3; }
    /* O selo em corpo pequeno, mas presente: é o que faz da foto uma evidência. */
    .doc-foto .selo { font-size: 7.5px; color: ${CORES_DOC.textoFraco}; margin-top: 2px;
      line-height: 1.25; }
    .doc-foto .selo.alerta { color: ${CORES_DOC.atencao}; }
    /* Quadro sem imagem: mantém a moldura, para a ausência não passar por lapso. */
    .doc-foto .semimagem { height: 132px; display: flex; align-items: center;
      justify-content: center; text-align: center; padding: 8px;
      background: ${CORES_DOC.fundoSuave}; font-size: 8.5px;
      color: ${CORES_DOC.atencao}; line-height: 1.3; }
  </style>
`;

export interface OpcoesBlocoFotos {
  /** Título da seção. Ausente, o bloco sai sem título (uso dentro de outro bloco). */
  titulo?: string;
  /** Três por linha para conjuntos grandes; duas é o padrão. */
  colunas?: 2 | 3;
  /** Texto quando não há foto nenhuma. Ausente, o bloco não sai. */
  vazio?: string;
  /** Numeração inicial, para o documento numerar as fotos em sequência contínua. */
  primeiroNumero?: number;
  omitidas?: number;
}

/**
 * Monta o HTML das fotos.
 *
 * Síncrono e puro de propósito: recebe fotos já baixadas e devolve texto. O que
 * depende de rede fica em `prepararFotosDoDocumento`, e o que decide como a folha
 * fica pode ser testado sem navegador.
 */
export function blocoDeFotos(
  fotos: readonly FotoPreparada[],
  opcoes: OpcoesBlocoFotos = {}
): string {
  const titulo = opcoes.titulo ? `<h2 class="doc-sec">${esc(opcoes.titulo)}</h2>` : "";

  if (fotos.length === 0) {
    if (!opcoes.vazio) return "";
    return `${titulo}<p class="doc-vazio">${esc(opcoes.vazio)}</p>`;
  }

  const inicio = opcoes.primeiroNumero ?? 1;
  const classeColunas = opcoes.colunas === 3 ? " doc-fotos-3" : "";

  const quadros = fotos
    .map((foto, indice) => {
      const numero = inicio + indice;

      const selo = seloDaFoto({
        coord: {
          latitude: foto.latitude,
          longitude: foto.longitude,
          precisao: foto.precisao,
        },
        capturadaEm: foto.capturadaEm,
        origem: foto.origem,
        motivoSemCoordenada: foto.motivoSemGeo,
      });

      const imagem = foto.dataUri
        ? `<img src="${foto.dataUri}" alt="Foto ${numero}">`
        : `<div class="semimagem">Imagem não incorporada a este PDF — ${esc(
            foto.falha ?? "falha ao baixar o arquivo"
          )}. A foto continua anexada ao registro no sistema.</div>`;

      return `
        <div class="doc-foto">
          ${imagem}
          <div class="corpo">
            <div class="num">Foto ${numero}${
              foto.rotulo ? ` <span class="rotulo">· ${esc(foto.rotulo)}</span>` : ""
            }</div>
            ${foto.descricao ? `<div class="legenda">${esc(foto.descricao)}</div>` : ""}
            <div class="selo${selo.alerta ? " alerta" : ""}">${esc(selo.texto)}</div>
          </div>
        </div>`;
    })
    .join("");

  const nota =
    opcoes.omitidas && opcoes.omitidas > 0
      ? `<p class="doc-aviso">Este documento traz as primeiras ${fotos.length} fotos. Outras ${opcoes.omitidas} estão anexadas ao registro e não couberam aqui — consulte o sistema para vê-las.</p>`
      : "";

  return `${titulo}<div class="doc-fotos${classeColunas}">${quadros}</div>${nota}`;
}

/** Quantas fotos foram efetivamente embutidas, para o resumo do documento. */
export function totalEmbutidas(fotos: readonly FotoPreparada[]): number {
  return fotos.filter((f) => !!f.dataUri).length;
}
