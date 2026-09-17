import { describe, expect, it } from "vitest";
import {
  impedimentoDaEntrega,
  tetoDaDevolucao,
  tetoDaEntrega,
} from "../movimentacaoDeEpi";

/**
 * Roteiro 13.3 e 13.5.
 *
 * As travas existem no banco. O que estava errado era a tela: o teto do campo
 * de quantidade vinha de `estoque_atual || 100`, e `||` trata zero como
 * ausência — com estoque zero o formulário passava a aceitar até cem.
 */

describe("tetoDaEntrega", () => {
  it("o teto é o estoque", () => {
    expect(tetoDaEntrega({ estoque_atual: 9 })).toBe(9);
  });

  it("estoque zero dá teto ZERO, e não cem", () => {
    // Este é o defeito: `0 || 100` é 100. O campo convidava a digitar 40
    // unidades de um EPI que não existe em prateleira.
    expect(tetoDaEntrega({ estoque_atual: 0 })).toBe(0);
  });

  it("estoque negativo não vira teto negativo", () => {
    expect(tetoDaEntrega({ estoque_atual: -3 })).toBe(0);
  });

  it("estoque quebrado é truncado, não arredondado para cima", () => {
    // Meia luva não se entrega.
    expect(tetoDaEntrega({ estoque_atual: 9.8 })).toBe(9);
  });

  it("sem EPI escolhido não afirma teto nenhum", () => {
    expect(tetoDaEntrega(null)).toBeUndefined();
    expect(tetoDaEntrega(undefined)).toBeUndefined();
  });

  it("estoque ausente ou inválido não inventa teto", () => {
    expect(tetoDaEntrega({ estoque_atual: null })).toBeUndefined();
    expect(tetoDaEntrega({ estoque_atual: undefined })).toBeUndefined();
    expect(tetoDaEntrega({ estoque_atual: NaN })).toBeUndefined();
  });
});

describe("impedimentoDaEntrega", () => {
  it("CA vencido impede, citando a norma", () => {
    const m = impedimentoDaEntrega({ statusValidadeCa: "VENCIDO", estoque_atual: 10 });
    expect(m).toMatch(/NR-06/);
    expect(m).toMatch(/6\.2/);
  });

  it("estoque zero impede, e diz o que fazer", () => {
    const m = impedimentoDaEntrega({ statusValidadeCa: "VALIDO", estoque_atual: 0 });
    expect(m).toMatch(/sem estoque/i);
    expect(m).toMatch(/entrada/i);
  });

  it("o CA vencido vem antes do estoque", () => {
    // Repor estoque não resolve nada se o CA está vencido: a entrega continua
    // proibida. Citar o estoque primeiro mandaria a pessoa comprar em vão.
    const m = impedimentoDaEntrega({ statusValidadeCa: "VENCIDO", estoque_atual: 0 });
    expect(m).toMatch(/NR-06/);
  });

  it("CA válido e estoque disponível não impedem", () => {
    expect(impedimentoDaEntrega({ statusValidadeCa: "VALIDO", estoque_atual: 5 })).toBeNull();
  });

  it("CA próximo do vencimento ainda permite entregar", () => {
    // Próximo do vencimento é aviso, não proibição — a NR-06 proíbe o vencido.
    expect(impedimentoDaEntrega({ statusValidadeCa: "PROXIMO_VENCIMENTO", estoque_atual: 5 })).toBeNull();
  });

  it("EPI sem validade de CA cadastrada não é tratado como vencido", () => {
    // `calculateValidadeCa` devolve VALIDO quando não há data — registro antigo
    // sem CA preenchido não pode virar bloqueio retroativo de entrega.
    expect(impedimentoDaEntrega({ statusValidadeCa: "VALIDO", estoque_atual: 5 })).toBeNull();
    expect(impedimentoDaEntrega({ estoque_atual: 5 })).toBeNull();
  });

  it("nenhum EPI escolhido ainda não é impedimento", () => {
    // O formulário abre vazio; acusar impedimento aí seria alarme falso.
    expect(impedimentoDaEntrega(null)).toBeNull();
  });
});

describe("tetoDaDevolucao", () => {
  it("o teto é o que aquela entrega teve", () => {
    expect(tetoDaDevolucao({ quantidade: 1 })).toBe(1);
  });

  it("quantidade zero dá teto zero, e não cem", () => {
    expect(tetoDaDevolucao({ quantidade: 0 })).toBe(0);
  });

  it("sem entrega escolhida não afirma teto", () => {
    expect(tetoDaDevolucao(null)).toBeUndefined();
    expect(tetoDaDevolucao({ quantidade: null })).toBeUndefined();
  });
});
