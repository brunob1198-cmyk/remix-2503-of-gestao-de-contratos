import { describe, expect, it } from "vitest";
import { alturaDeLinhas, quebrarTexto, truncarEmUmaLinha, ENTRELINHA } from "./pdfTexto";

/** Medida sintética: cada caractere ocupa meio corpo. Conferível de cabeça. */
const medir = (t: string, corpo: number) => t.length * corpo * 0.5;
const corpo = 10; // 5pt por caractere

describe("quebrarTexto", () => {
  it("mantém numa linha o que cabe", () => {
    expect(quebrarTexto({ texto: "Bruno Souza", larguraMaxima: 100, corpo, medir })).toEqual([
      "Bruno Souza",
    ]);
  });

  it("quebra no espaço quando passa da largura", () => {
    // 50pt = 10 caracteres por linha.
    const linhas = quebrarTexto({ texto: "Bruno Souza da Silva", larguraMaxima: 50, corpo, medir });
    expect(linhas).toEqual(["Bruno", "Souza da", "Silva"]);
    for (const l of linhas) expect(medir(l, corpo)).toBeLessThanOrEqual(50);
  });

  it("parte a palavra que não cabe nem sozinha", () => {
    // Deixar vazar escreveria por cima da coluna vizinha.
    const linhas = quebrarTexto({
      texto: "supercalifragilistico",
      larguraMaxima: 50,
      corpo,
      medir,
    });
    expect(linhas.length).toBeGreaterThan(1);
    for (const l of linhas) expect(medir(l, corpo)).toBeLessThanOrEqual(50);
    expect(linhas.join("")).toBe("supercalifragilistico");
  });

  it("respeita a quebra obrigatória do texto de origem", () => {
    expect(quebrarTexto({ texto: "um\ndois", larguraMaxima: 200, corpo, medir })).toEqual([
      "um",
      "dois",
    ]);
  });

  it("texto vazio ocupa uma linha, e não nenhuma", () => {
    // Zero linhas faria o bloco seguinte subir e colar no anterior.
    expect(quebrarTexto({ texto: "", larguraMaxima: 100, corpo, medir })).toEqual([""]);
  });

  it("largura inválida devolve o texto inteiro em vez de travar", () => {
    expect(quebrarTexto({ texto: "abc", larguraMaxima: 0, corpo, medir })).toEqual(["abc"]);
  });

  it("largura menor que um caractere não entra em laço infinito", () => {
    const linhas = quebrarTexto({ texto: "abcdef", larguraMaxima: 1, corpo, medir });
    expect(linhas.length).toBeGreaterThan(0);
    expect(linhas.join("")).toBe("abcdef");
  });

  it("espaços repetidos não viram linha vazia no meio", () => {
    expect(
      quebrarTexto({ texto: "Bruno    Souza", larguraMaxima: 200, corpo, medir })
    ).toEqual(["Bruno Souza"]);
  });
});

describe("truncarEmUmaLinha", () => {
  it("devolve inteiro o que cabe", () => {
    expect(truncarEmUmaLinha({ texto: "Montador", larguraMaxima: 100, corpo, medir })).toBe(
      "Montador"
    );
  });

  it("corta com reticências, e o resultado cabe", () => {
    const t = truncarEmUmaLinha({
      texto: "Montador de Estruturas Metalicas",
      larguraMaxima: 50,
      corpo,
      medir,
    });
    expect(t.endsWith("…")).toBe(true);
    expect(medir(t, corpo)).toBeLessThanOrEqual(50);
    // Corte seco produziria "Montador d", que parece defeito de sistema.
    expect(t).not.toBe("Montador d");
  });

  it("achata quebras de linha: célula de tabela é uma linha só", () => {
    expect(
      truncarEmUmaLinha({ texto: "Montador\nde Estruturas", larguraMaxima: 500, corpo, medir })
    ).toBe("Montador de Estruturas");
  });
});

describe("alturaDeLinhas", () => {
  it("multiplica pela entrelinha", () => {
    expect(alturaDeLinhas(3, 10)).toBeCloseTo(3 * 10 * ENTRELINHA, 5);
  });

  it("quantidade negativa não devolve altura negativa", () => {
    expect(alturaDeLinhas(-2, 10)).toBe(0);
  });
});
