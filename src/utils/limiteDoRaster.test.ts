import { describe, expect, it } from "vitest";
import {
  decisaoDoRaster,
  mensagemDeDocumentoLongoDemais,
  paginasEstimadas,
  paginasQueCabem,
  ESCALAS_DE_RASTER,
  AREA_MAXIMA_DE_CANVAS_PX,
} from "./limiteDoRaster";

/** Geometria real dos documentos do SGSST, medida no navegador. */
const ALTURA_DA_PAGINA_PX = 949.3;
const LARGURA_PX = 703;
/** Limite do Chrome, confirmado na medição: 65.312 passa, 67.184 sai em branco. */
const TETO_CHROME = 65_535;

const alturaDe = (paginas: number) => paginas * ALTURA_DA_PAGINA_PX;

describe("decisaoDoRaster", () => {
  it("mantém a resolução cheia enquanto o canvas cabe", () => {
    // 30 páginas a 2x dão 56.958px — abaixo do teto medido.
    const d = decisaoDoRaster({
      alturaConteudoPx: alturaDe(30),
      larguraConteudoPx: LARGURA_PX,
      tetoAlturaPx: TETO_CHROME,
    });
    expect(d).toEqual({ escala: 2, reduzida: false });
  });

  // Os dois casos abaixo usam as ALTURAS DE CONTEÚDO medidas no navegador, e não
  // uma contagem de páginas: no harness cada bloco era um pouco mais alto que o
  // pretendido, então "alvo 34" produziu conteúdo de 35,4 páginas. Ancorar o teste
  // na altura medida evita repetir essa confusão.

  it("o último caso que saiu com conteúdo continua em resolução cheia", () => {
    // Medido: conteúdo de 32.656px → canvas 1406×65.312 → 5,13 MB, com conteúdo.
    const d = decisaoDoRaster({
      alturaConteudoPx: 32_656,
      larguraConteudoPx: LARGURA_PX,
      tetoAlturaPx: TETO_CHROME,
    });
    expect(d).toEqual({ escala: 2, reduzida: false });
  });

  it("o caso que saiu EM BRANCO agora reduz em vez de estourar", () => {
    // Medido: conteúdo de 33.592px → canvas 1406×67.184 → 0,12 MB, 36 folhas
    // vazias e nenhum erro. É exatamente este o defeito que a redução evita.
    const d = decisaoDoRaster({
      alturaConteudoPx: 33_592,
      larguraConteudoPx: LARGURA_PX,
      tetoAlturaPx: TETO_CHROME,
    });
    expect(d).toEqual({ escala: 1.5, reduzida: true });
    expect(33_592 * (d?.escala ?? 0)).toBeLessThanOrEqual(TETO_CHROME);
  });

  it("35 páginas não cabem mais em resolução cheia", () => {
    // 34 é o último que cabe (34 × 949,3 × 2 = 64.552); 35 passa do teto.
    expect(
      decisaoDoRaster({
        alturaConteudoPx: alturaDe(34),
        larguraConteudoPx: LARGURA_PX,
        tetoAlturaPx: TETO_CHROME,
      })?.escala
    ).toBe(2);
    expect(
      decisaoDoRaster({
        alturaConteudoPx: alturaDe(35),
        larguraConteudoPx: LARGURA_PX,
        tetoAlturaPx: TETO_CHROME,
      })
    ).toEqual({ escala: 1.5, reduzida: true });
  });

  it("desce até a resolução mínima antes de desistir", () => {
    const d = decisaoDoRaster({
      alturaConteudoPx: alturaDe(60),
      larguraConteudoPx: LARGURA_PX,
      tetoAlturaPx: TETO_CHROME,
    });
    expect(d).toEqual({ escala: 1, reduzida: true });
  });

  it("recusa quando nem a resolução mínima cabe", () => {
    // Acima disto não há truque: reduzir mais entregaria um documento ilegível.
    const d = decisaoDoRaster({
      alturaConteudoPx: alturaDe(100),
      larguraConteudoPx: LARGURA_PX,
      tetoAlturaPx: TETO_CHROME,
    });
    expect(d).toBeNull();
  });

  it("respeita o teto menor de outro navegador", () => {
    // O Firefox para em 32.767. Com o número do Chrome fixado no código, o
    // usuário de Firefox teria o mesmo defeito silencioso na metade das páginas.
    const d = decisaoDoRaster({
      alturaConteudoPx: alturaDe(20),
      larguraConteudoPx: LARGURA_PX,
      tetoAlturaPx: 32_767,
    });
    expect(d).toEqual({ escala: 1.5, reduzida: true });
  });

  it("também respeita o teto de ÁREA, e não só o de altura", () => {
    // Folha larga: a altura cabe, a área não. São limites diferentes do
    // navegador, e checar só um deixaria o outro passar em falso.
    const d = decisaoDoRaster({
      alturaConteudoPx: 30_000,
      larguraConteudoPx: 8_000,
      tetoAlturaPx: TETO_CHROME,
      tetoAreaPx: AREA_MAXIMA_DE_CANVAS_PX,
    });
    expect(d?.escala).toBe(1);
    expect(30_000 * 8_000).toBeLessThanOrEqual(AREA_MAXIMA_DE_CANVAS_PX);
  });

  it("conteúdo sem altura não trava a emissão", () => {
    const d = decisaoDoRaster({
      alturaConteudoPx: 0,
      larguraConteudoPx: 0,
      tetoAlturaPx: TETO_CHROME,
    });
    expect(d).toEqual({ escala: ESCALAS_DE_RASTER[0], reduzida: false });
  });
});

describe("paginasQueCabem", () => {
  it("diz quantas páginas a resolução mínima alcança", () => {
    const n = paginasQueCabem({
      alturaDaPaginaPx: ALTURA_DA_PAGINA_PX,
      escala: 1,
      tetoAlturaPx: TETO_CHROME,
    });
    expect(n).toBe(69);
  });

  it("na resolução cheia alcança a metade", () => {
    const n = paginasQueCabem({
      alturaDaPaginaPx: ALTURA_DA_PAGINA_PX,
      escala: 2,
      tetoAlturaPx: TETO_CHROME,
    });
    // Bate com a medição: 33 saiu com conteúdo, 34 saiu em branco.
    expect(n).toBe(34);
  });
});

describe("mensagem de recusa", () => {
  it("diz o tamanho, o limite e o que fazer", () => {
    const m = mensagemDeDocumentoLongoDemais({
      paginasEstimadas: 120,
      paginasSuportadas: 69,
    });
    expect(m).toContain("120");
    expect(m).toContain("69");
    // "Erro ao gerar o PDF" mandaria o usuário tentar de novo para sempre.
    expect(m).toContain("partes");
    expect(m).toContain("Nada foi gerado");
  });
});

describe("paginasEstimadas", () => {
  it("arredonda para cima, porque folha pela metade ocupa uma folha", () => {
    expect(paginasEstimadas(ALTURA_DA_PAGINA_PX * 2.2, ALTURA_DA_PAGINA_PX)).toBe(3);
  });

  it("documento curto conta como uma página", () => {
    expect(paginasEstimadas(10, ALTURA_DA_PAGINA_PX)).toBe(1);
  });
});
