import { describe, expect, it } from "vitest";
import { paginarFatias, totalDePaginas, type Fatia } from "./pdfPaginacao";

const ALTURA_UTIL = 100;

describe("paginarFatias", () => {
  it("empilha o que cabe numa folha só", () => {
    const fatias: Fatia[] = [{ altura: 30 }, { altura: 30 }, { altura: 30 }];
    const p = paginarFatias({ fatias, alturaUtil: ALTURA_UTIL });

    expect(p.map((x) => x.pagina)).toEqual([0, 0, 0]);
    expect(p.map((x) => x.topo)).toEqual([0, 30, 60]);
    expect(totalDePaginas(p)).toBe(1);
  });

  it("passa para a folha seguinte sem deixar buraco atrás", () => {
    const fatias: Fatia[] = [{ altura: 60 }, { altura: 60 }];
    const p = paginarFatias({ fatias, alturaUtil: ALTURA_UTIL });

    expect(p[0]).toMatchObject({ pagina: 0, topo: 0 });
    // A segunda começa no TOPO da folha nova, e a primeira folha fica com 60 de
    // conteúdo — não com 60 de conteúdo e um enchimento de 40 antes dele, que era
    // o que o html2pdf fazia.
    expect(p[1]).toMatchObject({ pagina: 1, topo: 0 });
  });

  it("não deixa título de seção sozinho no pé da página", () => {
    const fatias: Fatia[] = [
      { altura: 80 },
      { altura: 15, prendeAProxima: true }, // título
      { altura: 40 }, // conteúdo da seção
    ];
    const p = paginarFatias({ fatias, alturaUtil: ALTURA_UTIL });

    // O título cabia sozinho (80 + 15 = 95), mas iria virar a página sem o
    // conteúdo — e o leitor viraria achando a seção vazia.
    expect(p[1].pagina).toBe(1);
    expect(p[2].pagina).toBe(1);
  });

  it("repete o cabeçalho da tabela na continuação", () => {
    const fatias: Fatia[] = [
      { altura: 20, grupo: "t", cabecalhoDoGrupo: true },
      { altura: 30, grupo: "t" },
      { altura: 30, grupo: "t" },
      { altura: 30, grupo: "t" },
    ];
    const p = paginarFatias({ fatias, alturaUtil: ALTURA_UTIL });

    // 20 + 30 + 30 = 80 na primeira; a terceira linha não cabe.
    const naSegunda = p.filter((x) => x.pagina === 1);
    expect(naSegunda[0]).toMatchObject({ indice: 0, repetida: true, topo: 0 });
    expect(naSegunda[1]).toMatchObject({ indice: 3, repetida: false, topo: 20 });
  });

  it("o cabeçalho de uma tabela não vaza para a tabela seguinte", () => {
    const fatias: Fatia[] = [
      { altura: 20, grupo: "a", cabecalhoDoGrupo: true },
      { altura: 40, grupo: "a" },
      { altura: 20, grupo: "b", cabecalhoDoGrupo: true },
      { altura: 40, grupo: "b" },
      { altura: 40, grupo: "b" },
    ];
    const p = paginarFatias({ fatias, alturaUtil: ALTURA_UTIL });

    const repetidas = p.filter((x) => x.repetida);
    // Só o cabeçalho de "b" pode reaparecer, porque é dele a tabela que quebrou.
    expect(repetidas).toHaveLength(1);
    expect(repetidas[0].indice).toBe(2);
  });

  it("texto fora de tabela nunca repete cabeçalho", () => {
    const fatias: Fatia[] = [
      { altura: 20, grupo: "t", cabecalhoDoGrupo: true },
      { altura: 40, grupo: "t" },
      { altura: 90 }, // parágrafo depois da tabela
    ];
    const p = paginarFatias({ fatias, alturaUtil: ALTURA_UTIL });

    expect(p.filter((x) => x.repetida)).toHaveLength(0);
    expect(p[2].pagina).toBe(1);
  });

  it("fatia mais alta que a folha é colocada mesmo assim", () => {
    // Transbordar é visível; laço infinito, não.
    const fatias: Fatia[] = [{ altura: 40 }, { altura: 500 }];
    const p = paginarFatias({ fatias, alturaUtil: ALTURA_UTIL });

    expect(p).toHaveLength(2);
    expect(p[1]).toMatchObject({ pagina: 1, topo: 0 });
  });

  it("não abre folha em branco quando a primeira fatia já não cabe", () => {
    const fatias: Fatia[] = [{ altura: 500 }, { altura: 10 }];
    const p = paginarFatias({ fatias, alturaUtil: ALTURA_UTIL });

    expect(p[0]).toMatchObject({ pagina: 0, topo: 0 });
    expect(totalDePaginas(p)).toBe(2);
  });

  it("lista vazia não produz posição nenhuma", () => {
    expect(paginarFatias({ fatias: [], alturaUtil: ALTURA_UTIL })).toEqual([]);
    expect(totalDePaginas([])).toBe(1);
  });

  it("tabela longa repete o cabeçalho em TODA folha nova", () => {
    const fatias: Fatia[] = [
      { altura: 20, grupo: "t", cabecalhoDoGrupo: true },
      ...Array.from({ length: 12 }, () => ({ altura: 30, grupo: "t" })),
    ];
    const p = paginarFatias({ fatias, alturaUtil: ALTURA_UTIL });

    const paginas = totalDePaginas(p);
    const repetidas = p.filter((x) => x.repetida);
    // Uma repetição por folha, menos a primeira, onde o cabeçalho é o original.
    expect(repetidas).toHaveLength(paginas - 1);
    expect(repetidas.every((x) => x.topo === 0)).toBe(true);
  });
});
