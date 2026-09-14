import { describe, expect, it } from "vitest";
import {
  acharColuna,
  acharNome,
  ancoraDe,
  chaveDoTexto,
  corpoQueCabe,
  encurtarNome,
  lerAncoras,
  posicaoDoCarimbo,
  serializarAncoras,
  type Ancora,
  type TextoDoPdf,
} from "./ancoraDeAssinatura";

describe("serializarAncoras e lerAncoras", () => {
  const ancoras: Ancora[] = [
    { chave: "ana maria", pagina: 0, x: 420.55, y: 600.21, largura: 68, altura: 22 },
    { chave: "joao pedro", pagina: 1, x: 420.55, y: 500.19, largura: 68, altura: 22 },
  ];

  it("volta igual ao que foi gravado", () => {
    const lidas = lerAncoras(serializarAncoras(ancoras));
    expect(lidas).toHaveLength(2);
    expect(lidas[0].chave).toBe("ana maria");
    expect(lidas[0].x).toBeCloseTo(420.6, 1);
    expect(lidas[1].pagina).toBe(1);
  });

  it("ignora metadado que não é nosso", () => {
    // `Keywords` é campo livre: o PDF pode ter vindo de qualquer lugar.
    expect(lerAncoras("relatorio, seguranca, 2026")).toEqual([]);
    expect(lerAncoras(null)).toEqual([]);
    expect(lerAncoras("ancoras-de-assinatura:{isso nao e json}")).toEqual([]);
  });

  it("descarta item incompleto em vez de carimbar com coordenada faltando", () => {
    const lidas = lerAncoras('ancoras-de-assinatura:[{"c":"ana","p":0,"x":10}]');
    expect(lidas).toEqual([]);
  });
});

describe("ancoraDe", () => {
  const ancoras: Ancora[] = [
    { chave: "bruno souza da silva", pagina: 0, x: 400, y: 600, largura: 68, altura: 22 },
    { chave: "ana maria", pagina: 0, x: 400, y: 560, largura: 68, altura: 22 },
  ];

  it("acha ignorando acento e caixa", () => {
    expect(ancoraDe(ancoras, "BRUNO SOUZA DA SILVA")?.y).toBe(600);
  });

  it("não carimba quando há dois homônimos na mesma folha", () => {
    const comHomonimo = [
      ...ancoras,
      { chave: "ana maria", pagina: 1, x: 400, y: 300, largura: 68, altura: 22 },
    ];
    // Escolher uma das duas seria assinar a linha da outra pessoa.
    expect(ancoraDe(comHomonimo, "Ana Maria")).toBeNull();
  });

  it("devolve nulo para quem não está no documento", () => {
    expect(ancoraDe(ancoras, "Carlos Eduardo")).toBeNull();
  });
});

describe("âncora por texto, para PDF anexado", () => {
  const itens: TextoDoPdf[] = [
    { texto: "Nome", pagina: 0, x: 50, y: 700, largura: 30, altura: 10 },
    { texto: "Assinatura", pagina: 0, x: 300, y: 700, largura: 50, altura: 10 },
    { texto: "Bruno Souza da Silva", pagina: 0, x: 50, y: 680, largura: 120, altura: 10 },
    { texto: "Ana Maria", pagina: 0, x: 50, y: 660, largura: 60, altura: 10 },
  ];

  it("acha o nome inteiro", () => {
    expect(acharNome(itens, "Bruno Souza da Silva")?.y).toBe(680);
  });

  it("não aceita nome curto demais, que casaria com qualquer linha", () => {
    expect(acharNome(itens, "Ana")).toBeNull();
  });

  it("exige que o cabeçalho esteja acima da linha", () => {
    const linha = acharNome(itens, "Bruno Souza da Silva")!;
    expect(acharColuna(itens, "Assinatura", linha)?.x).toBe(300);
    // Um item com o mesmo texto ABAIXO da linha não é cabeçalho de coluna.
    const soAbaixo: TextoDoPdf[] = [
      itens[2],
      { texto: "Assinatura", pagina: 0, x: 300, y: 100, largura: 50, altura: 10 },
    ];
    expect(acharColuna(soAbaixo, "Assinatura", linha)).toBeNull();
  });

  it("carimba no cruzamento da linha com a coluna", () => {
    const a = posicaoDoCarimbo({
      itens,
      nome: "Bruno Souza da Silva",
      rotuloDaColuna: "Assinatura",
    });
    expect(a?.pagina).toBe(0);
    expect(a?.x).toBe(300);
    expect(a?.y).toBe(680);
  });

  it("não carimba quando o nome só aparece no meio do texto", () => {
    // Sem coluna de assinatura, carimbar acima do nome poria a assinatura dentro
    // de um parágrafo do contrato.
    const contrato: TextoDoPdf[] = [
      {
        texto: "entre a CONTRATANTE e Bruno Souza da Silva, doravante",
        pagina: 0,
        x: 50,
        y: 400,
        largura: 400,
        altura: 10,
      },
    ];
    expect(
      posicaoDoCarimbo({ itens: contrato, nome: "Bruno Souza da Silva", rotuloDaColuna: "Assinatura" })
    ).toBeNull();
  });
});

describe("ajuste do texto à célula", () => {
  /** Medida sintética: meio ponto de largura por caractere. */
  const medir = (t: string, corpo: number) => t.length * corpo * 0.5;

  it("mantém o corpo ideal quando o nome cabe", () => {
    expect(corpoQueCabe({ texto: "Ana", larguraMaxima: 200, medirLargura: medir })).toBe(9);
  });

  it("diminui até caber", () => {
    const corpo = corpoQueCabe({
      texto: "Bruno Souza da Silva",
      larguraMaxima: 60,
      medirLargura: medir,
    });
    expect(medir("Bruno Souza da Silva", corpo)).toBeLessThanOrEqual(60);
    expect(corpo).toBeLessThan(9);
  });

  it("não desce abaixo do mínimo legível", () => {
    const corpo = corpoQueCabe({ texto: "Nome muito longo mesmo", larguraMaxima: 5, medirLargura: medir });
    expect(corpo).toBe(5);
  });

  it("abrevia o meio do nome, e não o fim", () => {
    expect(encurtarNome("Bruno Souza da Silva")).toBe("Bruno S. da Silva");
    expect(encurtarNome("Ana Maria")).toBe("Ana Maria");
    expect(encurtarNome("Maria")).toBe("Maria");
  });
});

describe("chaveDoTexto", () => {

  it("tira acento, caixa e espaço repetido", () => {
    expect(chaveDoTexto("  JOÃO   Gonçalves ")).toBe("joao goncalves");
  });
});
