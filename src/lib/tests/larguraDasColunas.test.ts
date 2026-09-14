import { describe, expect, it } from "vitest";
import { largurasDasColunas, type ColunaDaTabela } from "@/lib/documentoPdfDireto";
import { larguraDaColunaDeAssinatura } from "@/lib/listaPresencaDocumento";

/** Largura útil real da folha timbrada: 186mm. */
const LARGURA_UTIL = 186 * (72 / 25.4);

describe("largurasDasColunas", () => {
  it("as fixas mandam e o resto divide o que sobra", () => {
    const colunas: ColunaDaTabela[] = [
      { rotulo: "#", largura: 20 },
      { rotulo: "Nome" },
      { rotulo: "CPF", largura: 80 },
      { rotulo: "Função" },
    ];
    const l = largurasDasColunas(colunas, 500);
    expect(l[0]).toBe(20);
    expect(l[2]).toBe(80);
    expect(l[1]).toBe(200);
    expect(l[3]).toBe(200);
    expect(l.reduce((s, x) => s + x, 0)).toBe(500);
  });

  it("todas fixas não inventam largura a mais", () => {
    const colunas: ColunaDaTabela[] = [
      { rotulo: "a", largura: 100 },
      { rotulo: "b", largura: 100 },
    ];
    expect(largurasDasColunas(colunas, 500)).toEqual([100, 100]);
  });

  it("fixas que estouram a largura não geram coluna negativa", () => {
    // Sobra zero, e não uma largura negativa que desenharia a coluna ao contrário.
    const colunas: ColunaDaTabela[] = [
      { rotulo: "a", largura: 400 },
      { rotulo: "b", largura: 400 },
      { rotulo: "c" },
    ];
    const l = largurasDasColunas(colunas, 500);
    expect(l[2]).toBe(0);
  });
});

describe("larguraDaColunaDeAssinatura", () => {
  it("uma coluna fica com a largura confortável", () => {
    // ~24mm: o espaço de assinatura de próprio punho que a folha em papel tinha.
    expect(larguraDaColunaDeAssinatura({ larguraUtil: LARGURA_UTIL, colunas: 1 })).toBe(67.5);
  });

  it("com muitas colunas de dia, elas encolhem em vez de espremer o nome", () => {
    // Seis dias é o teto da turma. Identificar quem assinou vale mais que o
    // tamanho do campo — nome cortado a duas letras inutiliza a folha.
    const l = larguraDaColunaDeAssinatura({ larguraUtil: LARGURA_UTIL, colunas: 6 });
    expect(l).toBeLessThan(67.5);
    expect(l * 6).toBeLessThanOrEqual(LARGURA_UTIL - 18 - 72 - 200 + 1);
  });

  it("nunca desce abaixo do mínimo em que caberia um rabisco", () => {
    const l = larguraDaColunaDeAssinatura({ larguraUtil: 200, colunas: 6 });
    expect(l).toBe(24);
  });

  it("sem coluna nenhuma, largura zero", () => {
    expect(larguraDaColunaDeAssinatura({ larguraUtil: LARGURA_UTIL, colunas: 0 })).toBe(0);
  });
});
