import { describe, expect, it } from "vitest";
import {
  itensDoModeloEmOrdem,
  itensOrdenados,
  secoesOrdenadas,
} from "../ordemDoChecklist";

/**
 * Roteiro 15.8: "Reordenar os itens → A aplicação E O PDF seguem a ordem nova."
 *
 * Cada item guardava `ordem`, o formulário mantinha o número, e ninguém lia. As
 * seções eram ordenadas no documento; os itens, nunca. Quem decidia a ordem era
 * a ordem física da tabela — que muda quando uma linha é atualizada.
 *
 * Num checklist de campo a ordem é a sequência em que a pessoa percorre o
 * equipamento, não estética.
 */

const item = (titulo: string, ordem?: number | null) => ({ titulo, ordem });

describe("itensOrdenados", () => {
  it("ordena pelo número, não pela posição de chegada", () => {
    const r = itensOrdenados([item("c", 3), item("a", 1), item("b", 2)]);
    expect(r.map((i) => i.titulo)).toEqual(["a", "b", "c"]);
  });

  it("item sem ordem vai para o fim", () => {
    // O que chega sem número costuma ser o acrescentado depois; empurrá-lo para
    // cima reembaralharia o que já estava certo.
    const r = itensOrdenados([item("sem"), item("a", 1), item("b", 2)]);
    expect(r.map((i) => i.titulo)).toEqual(["a", "b", "sem"]);
  });

  it("nulo e vazio não quebram", () => {
    expect(itensOrdenados(null)).toEqual([]);
    expect(itensOrdenados(undefined)).toEqual([]);
    expect(itensOrdenados([])).toEqual([]);
  });

  it("não altera o array de origem", () => {
    // O cache do React Query é compartilhado: ordenar no lugar reordenaria a
    // mesma lista em telas que não pediram nada.
    const original = [item("c", 3), item("a", 1)];
    const copia = [...original];
    itensOrdenados(original);
    expect(original).toEqual(copia);
  });
});

describe("secoesOrdenadas", () => {
  const modelo = [
    { titulo: "S2", ordem: 2, itens: [item("b2", 2), item("b1", 1)] },
    { titulo: "S1", ordem: 1, itens: [item("a2", 2), item("a1", 1)] },
  ];

  it("ordena seções E os itens dentro de cada uma", () => {
    // O defeito era exatamente este: seção ordenada, item não.
    const r = secoesOrdenadas(modelo);
    expect(r.map((s) => s.titulo)).toEqual(["S1", "S2"]);
    expect(r[0].itens!.map((i) => i.titulo)).toEqual(["a1", "a2"]);
    expect(r[1].itens!.map((i) => i.titulo)).toEqual(["b1", "b2"]);
  });

  it("seção sem itens não vira erro", () => {
    const r = secoesOrdenadas([{ titulo: "vazia", ordem: 1, itens: null }]);
    expect(r[0].itens).toEqual([]);
  });

  it("preserva os demais campos da seção", () => {
    const r = secoesOrdenadas([{ titulo: "S1", ordem: 1, itens: [], id: "x" } as never]);
    expect((r[0] as { id: string }).id).toBe("x");
  });

  it("não altera o objeto de origem nem os itens dele", () => {
    const original = [{ titulo: "S", ordem: 1, itens: [item("b", 2), item("a", 1)] }];
    const antes = JSON.stringify(original);
    secoesOrdenadas(original);
    expect(JSON.stringify(original)).toBe(antes);
  });
});

describe("itensDoModeloEmOrdem", () => {
  it("achata na ordem de seção e depois de item", () => {
    const r = itensDoModeloEmOrdem([
      { ordem: 2, itens: [item("b1", 1)] },
      { ordem: 1, itens: [item("a2", 2), item("a1", 1)] },
    ]);
    expect(r.map((i) => i.titulo)).toEqual(["a1", "a2", "b1"]);
  });

  it("modelo sem seção devolve lista vazia", () => {
    expect(itensDoModeloEmOrdem(null)).toEqual([]);
  });
});
