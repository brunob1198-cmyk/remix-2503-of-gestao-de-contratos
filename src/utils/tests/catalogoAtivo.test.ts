import { describe, expect, it } from "vitest";
import { estaInativo, itensParaSelecao, rotuloDoItem } from "../catalogoAtivo";

/**
 * Roteiro 1.8: "Inativar a função e ver a lista de funções de um novo
 * colaborador → A função inativa não aparece para seleção."
 *
 * Oito seletores consomem os catálogos de função e de risco; dois filtravam. Em
 * seis, inativar não tirava nada de circulação.
 */

const f = (id: string, status?: string | null) => ({ id, nome: id, status });

describe("estaInativo", () => {
  it("reconhece o inativo", () => {
    expect(estaInativo(f("a", "inativo"))).toBe(true);
  });

  it("ativo não é inativo", () => {
    expect(estaInativo(f("a", "ativo"))).toBe(false);
  });

  it("status ausente NÃO esconde a linha", () => {
    // Item de menos numa lista ninguém nota; item que some é procurado por horas.
    expect(estaInativo(f("a", null))).toBe(false);
    expect(estaInativo(f("a", undefined))).toBe(false);
    expect(estaInativo({})).toBe(false);
  });

  it("valor inesperado também não esconde", () => {
    expect(estaInativo(f("a", "arquivado"))).toBe(false);
  });

  it("espaço em volta não engana", () => {
    expect(estaInativo(f("a", " inativo "))).toBe(true);
  });
});

describe("itensParaSelecao", () => {
  const catalogo = [f("ativa1", "ativo"), f("velha", "inativo"), f("ativa2", "ativo")];

  it("tira os inativos", () => {
    expect(itensParaSelecao(catalogo).map((i) => i.id)).toEqual(["ativa1", "ativa2"]);
  });

  it("mantém o inativo que já está escolhido", () => {
    // Um colaborador cadastrado há um ano com função hoje inativa abriria o
    // formulário com o seletor em branco, e salvar gravaria o vazio por cima.
    expect(itensParaSelecao(catalogo, "velha").map((i) => i.id)).toEqual([
      "ativa1",
      "velha",
      "ativa2",
    ]);
  });

  it("mantém o escolhido na posição original, e não empurrado para o fim", () => {
    const r = itensParaSelecao(catalogo, "velha");
    expect(r[1].id).toBe("velha");
  });

  it("escolhido que é ativo não duplica", () => {
    const r = itensParaSelecao(catalogo, "ativa1");
    expect(r.filter((i) => i.id === "ativa1")).toHaveLength(1);
  });

  it("escolhido que não existe no catálogo não inventa linha", () => {
    expect(itensParaSelecao(catalogo, "sumida").map((i) => i.id)).toEqual(["ativa1", "ativa2"]);
  });

  it("id vazio ou nulo não preserva nada", () => {
    for (const id of ["", "   ", null, undefined]) {
      expect(itensParaSelecao(catalogo, id).map((i) => i.id)).toEqual(["ativa1", "ativa2"]);
    }
  });

  it("lista nula ou vazia não quebra", () => {
    expect(itensParaSelecao(null)).toEqual([]);
    expect(itensParaSelecao(undefined)).toEqual([]);
    expect(itensParaSelecao([])).toEqual([]);
  });

  it("não altera a lista de origem", () => {
    const original = [...catalogo];
    itensParaSelecao(catalogo, "velha");
    expect(catalogo).toEqual(original);
  });
});

describe("rotuloDoItem", () => {
  it("o inativo preservado diz que é inativo", () => {
    // Sem isto ele fica indistinguível dos ativos, e a pessoa conclui que o
    // filtro não funcionou — ou o escolhe de novo achando que está em uso.
    expect(rotuloDoItem("Montador", f("a", "inativo"))).toBe("Montador (inativo)");
  });

  it("o ativo sai limpo", () => {
    expect(rotuloDoItem("Montador", f("a", "ativo"))).toBe("Montador");
    expect(rotuloDoItem("Montador", f("a", null))).toBe("Montador");
  });
});
