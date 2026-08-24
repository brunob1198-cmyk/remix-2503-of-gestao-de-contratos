import { describe, it, expect } from "vitest";
import {
  blocoDeFotos,
  dimensoesReduzidas,
  totalEmbutidas,
  estilosFotosDocumento,
  FOTOS_LIMITE_DOCUMENTO,
  LADO_MAXIMO_PX,
  type FotoPreparada,
} from "@/lib/fotosDoDocumento";

/**
 * As fotos passaram a ser anexáveis em todo o SGSST, mas ficavam só na tela — e o
 * que vai para a auditoria é o PDF. Estes testes protegem três coisas:
 *
 * 1. Que a foto que NÃO pôde ser baixada apareça dizendo isso, em vez de sumir. O
 *    documento com uma foto a menos e sem aviso afirma que havia menos evidência
 *    do que havia.
 *
 * 2. Que o selo — onde, quando, por qual meio — saia debaixo de cada imagem. É o
 *    selo que separa evidência de ilustração.
 *
 * 3. Que a redução de tamanho nunca amplie nem devolva dimensão inválida: um
 *    canvas de zero por zero derrubaria a emissão inteira.
 */

const DATA_URI_FALSO = "data:image/jpeg;base64,AAAA";

function foto(over: Partial<FotoPreparada> = {}): FotoPreparada {
  return {
    url: "fotos/desvio.jpg",
    dataUri: DATA_URI_FALSO,
    falha: null,
    latitude: -16.6869,
    longitude: -49.2648,
    precisao: 8,
    capturadaEm: "2026-08-24T10:32:00.000Z",
    origem: "CAMERA",
    motivoSemGeo: null,
    ...over,
  };
}

describe("dimensoesReduzidas", () => {
  it("reduz mantendo a proporção", () => {
    const r = dimensoesReduzidas(4000, 3000);
    expect(r.largura).toBe(LADO_MAXIMO_PX);
    expect(r.altura).toBe(675); // 900 × 3/4
  });

  it("reduz pelo lado maior, mesmo em foto em pé", () => {
    // Foto de celular na vertical: limitar pela largura deixaria 1200 px de altura.
    const r = dimensoesReduzidas(3000, 4000);
    expect(r.altura).toBe(LADO_MAXIMO_PX);
    expect(r.largura).toBe(675);
  });

  it("imagem já pequena passa intacta, sem ampliar", () => {
    // Ampliar só aumentaria o arquivo sem acrescentar detalhe nenhum.
    const r = dimensoesReduzidas(320, 240);
    expect(r).toEqual({ largura: 320, altura: 240 });
  });

  it("exatamente no limite não é reduzida", () => {
    const r = dimensoesReduzidas(LADO_MAXIMO_PX, 600);
    expect(r).toEqual({ largura: LADO_MAXIMO_PX, altura: 600 });
  });

  it("nunca devolve dimensão zero para imagem válida", () => {
    // Canvas de altura zero lançaria exceção e derrubaria a emissão inteira.
    const r = dimensoesReduzidas(5000, 3);
    expect(r.altura).toBeGreaterThanOrEqual(1);
  });

  it("dimensão inválida devolve zero, para o chamador desistir da foto", () => {
    expect(dimensoesReduzidas(0, 100)).toEqual({ largura: 0, altura: 0 });
    expect(dimensoesReduzidas(-10, 100)).toEqual({ largura: 0, altura: 0 });
    expect(dimensoesReduzidas(Number.NaN, 100)).toEqual({ largura: 0, altura: 0 });
    expect(dimensoesReduzidas(Number.POSITIVE_INFINITY, 100)).toEqual({
      largura: 0,
      altura: 0,
    });
  });

  it("respeita um lado máximo customizado", () => {
    const r = dimensoesReduzidas(2000, 1000, 500);
    expect(r).toEqual({ largura: 500, altura: 250 });
  });
});

describe("blocoDeFotos — a imagem sai no documento", () => {
  it("embute a imagem como dado, e não como endereço", () => {
    // Endereço remoto depende do CORS do servidor e de a imagem carregar antes do
    // instantâneo do canvas. Foto que chega tarde sai como retângulo vazio.
    const html = blocoDeFotos([foto()]);
    expect(html).toContain(`src="${DATA_URI_FALSO}"`);
    expect(html).not.toContain("fotos/desvio.jpg");
  });

  it("numera as fotos", () => {
    const html = blocoDeFotos([foto(), foto()]);
    expect(html).toContain("Foto 1");
    expect(html).toContain("Foto 2");
  });

  it("continua a numeração de onde o documento parou", () => {
    // O checklist numera as fotos numa sequência só: a linha do item diz "Foto 7"
    // e a galeria tem de trazer a Foto 7.
    const html = blocoDeFotos([foto()], { primeiroNumero: 7 });
    expect(html).toContain("Foto 7");
    expect(html).not.toContain("Foto 1<");
  });

  it("imprime o selo com a coordenada debaixo de cada foto", () => {
    const html = blocoDeFotos([foto()]);
    expect(html).toContain("class=\"selo\"");
    // O selo traz a coordenada: é o que transforma a foto em evidência.
    expect(html).toContain("-16.686900");
  });

  it("marca o selo quando a localização é ruim ou ausente", () => {
    const html = blocoDeFotos([
      foto({ latitude: null, longitude: null, motivoSemGeo: "permissão negada" }),
    ]);
    expect(html).toContain("selo alerta");
  });

  it("a legenda escrita pelo usuário sai impressa", () => {
    const html = blocoDeFotos([foto({ descricao: "Guarda-corpo do vão 3 removido" })]);
    expect(html).toContain("Guarda-corpo do vão 3 removido");
  });

  it("o rótulo diz a que registro a foto pertence", () => {
    // Sem o rótulo, a foto do visor marcando 18% de oxigênio poderia ser lida como
    // prova da medição aprovada logo acima dela.
    const html = blocoDeFotos([foto({ rotulo: "NC 2" })]);
    expect(html).toContain("NC 2");
  });

  it("escapa o texto vindo do banco", () => {
    const html = blocoDeFotos([foto({ descricao: '<script>x</script>' })]);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("blocoDeFotos — a falha é impressa, não escondida", () => {
  it("foto sem imagem mantém a moldura e diz por que", () => {
    const html = blocoDeFotos([
      foto({ dataUri: null, falha: "o arquivo respondeu HTTP 404" }),
    ]);

    expect(html).toContain("semimagem");
    expect(html).toContain("não incorporada");
    expect(html).toContain("o arquivo respondeu HTTP 404");
  });

  it("a foto que falhou continua contando na numeração", () => {
    // Pular a numeração faria o leitor concluir que a foto 2 não existe.
    const html = blocoDeFotos([foto({ dataUri: null, falha: "erro" }), foto()]);
    expect(html).toContain("Foto 1");
    expect(html).toContain("Foto 2");
  });

  it("o selo sai mesmo sem a imagem", () => {
    // Onde e quando a foto foi tirada continua sendo informação verdadeira, ainda
    // que o arquivo não tenha vindo.
    const html = blocoDeFotos([foto({ dataUri: null, falha: "erro" })]);
    expect(html).toContain("-16.686900");
  });

  it("falha sem motivo informado não sai como texto vazio", () => {
    const html = blocoDeFotos([foto({ dataUri: null, falha: null })]);
    expect(html).toContain("falha ao baixar o arquivo");
  });
});

describe("blocoDeFotos — ausência e truncamento", () => {
  it("sem foto e sem texto de vazio, o bloco não sai", () => {
    // Documento que não trata de foto não deve ganhar uma seção vazia.
    expect(blocoDeFotos([])).toBe("");
  });

  it("sem foto e com texto de vazio, a ausência é dita", () => {
    const html = blocoDeFotos([], {
      titulo: "Evidência fotográfica",
      vazio: "Nenhuma foto anexada a esta permissão.",
    });
    expect(html).toContain("Evidência fotográfica");
    expect(html).toContain("Nenhuma foto anexada a esta permissão.");
  });

  it("diz quantas fotos ficaram de fora", () => {
    // Truncar em silêncio faria o documento parecer completo.
    const html = blocoDeFotos([foto()], { omitidas: 30 });
    expect(html).toContain("Outras 30");
    expect(html).toContain("consulte o sistema");
  });

  it("sem omissão não há aviso de truncamento", () => {
    const html = blocoDeFotos([foto()], { omitidas: 0 });
    expect(html).not.toContain("não couberam");
  });

  it("o teto por documento é menor que o teto por registro", () => {
    // O registro aceita cem fotos; o documento pararia de ser documento.
    expect(FOTOS_LIMITE_DOCUMENTO).toBeLessThan(100);
  });
});

describe("blocoDeFotos — layout", () => {
  it("três colunas quando pedido", () => {
    expect(blocoDeFotos([foto()], { colunas: 3 })).toContain("doc-fotos-3");
  });

  it("duas colunas é o padrão", () => {
    expect(blocoDeFotos([foto()])).not.toContain("doc-fotos-3");
  });

  it("o título só sai quando informado", () => {
    expect(blocoDeFotos([foto()])).not.toContain("doc-sec");
    expect(blocoDeFotos([foto()], { titulo: "Fotos" })).toContain("doc-sec");
  });

  it("o quadro da foto não pode ser cortado pela quebra de página", () => {
    // Sem isto, o selo cai numa folha e a imagem em outra.
    expect(estilosFotosDocumento).toContain("page-break-inside: avoid");
  });
});

describe("totalEmbutidas", () => {
  it("conta só as que têm imagem", () => {
    expect(totalEmbutidas([foto(), foto({ dataUri: null, falha: "erro" })])).toBe(1);
  });

  it("lista vazia é zero", () => {
    expect(totalEmbutidas([])).toBe(0);
  });
});
