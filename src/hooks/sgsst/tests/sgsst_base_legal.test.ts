import { describe, it, expect } from "vitest";
import { BASE_LEGAL_PCMSO, BASE_LEGAL_PGR } from "@/utils/sgsstBaseLegal";

/**
 * A base legal sai no documento, entao errar aqui e errar numa folha assinada.
 * Estes testes travam as decisoes, nao o texto: cada referencia precisa dizer POR
 * QUE entra naquele documento, e nenhuma pode afirmar conformidade.
 */

const TODAS = [...BASE_LEGAL_PCMSO, ...BASE_LEGAL_PGR];

describe("base legal", () => {
  it("toda referencia tem norma, ementa e pertinencia", () => {
    // Lista de siglas sem pertinencia nao informa: ninguem sabe se a norma e
    // central ou tangencial ao documento.
    for (const r of TODAS) {
      expect(r.norma.trim(), JSON.stringify(r)).not.toBe("");
      expect(r.ementa.trim(), r.norma).not.toBe("");
      expect(r.pertinencia.trim(), r.norma).not.toBe("");
    }
  });

  it("nao repete referencia dentro do mesmo documento", () => {
    for (const lista of [BASE_LEGAL_PCMSO, BASE_LEGAL_PGR]) {
      const normas = lista.map((r) => r.norma);
      expect(new Set(normas).size).toBe(normas.length);
    }
  });

  it("o PCMSO tem a NR-07 como norma central", () => {
    const nr07 = BASE_LEGAL_PCMSO.find((r) => r.norma.startsWith("NR-07"));
    expect(nr07).toBeDefined();
    expect(nr07!.norma).toContain("Portaria SSST n.º 24");
    expect(nr07!.pertinencia).toContain("institui este programa");
  });

  it("o PGR tem NR-01, NR-09 e NR-15", () => {
    const normas = BASE_LEGAL_PGR.map((r) => r.norma).join(" ");
    for (const n of ["NR-01", "NR-09", "NR-15"]) expect(normas, n).toContain(n);
  });

  it("os dois documentos citam a LGPD, porque os dois tratam dado pessoal", () => {
    for (const lista of [BASE_LEGAL_PCMSO, BASE_LEGAL_PGR]) {
      expect(lista.some((r) => r.norma.includes("13.709"))).toBe(true);
    }
  });

  it("o PCMSO cita a previdencia; o PGR nao precisa", () => {
    // O PCMSO sustenta CAT e beneficio; o PGR e inventario de risco.
    expect(BASE_LEGAL_PCMSO.some((r) => r.norma.includes("8.213"))).toBe(true);
    expect(BASE_LEGAL_PGR.some((r) => r.norma.includes("8.213"))).toBe(false);
  });

  it("nenhuma referencia afirma que o programa ATENDE a norma", () => {
    // O documento declara a base OBSERVADA. Dizer que atende e conclusao de quem
    // assina, e o sistema nao pode assinar por ele.
    const texto = TODAS.map((r) => `${r.ementa} ${r.pertinencia}`).join(" ").toLowerCase();
    for (const proibido of ["está em conformidade", "atende integralmente", "certifica"]) {
      expect(texto, proibido).not.toContain(proibido);
    }
  });

  it("nao cita numero de portaria onde a redacao vigente muda", () => {
    // Portaria errada num documento de conformidade e pior que citar so a norma.
    // Onde a redacao muda, o texto usa "e alteracoes posteriores".
    const nrs = TODAS.filter((r) => /^NR-\d/.test(r.norma));
    for (const r of nrs) {
      expect(r.norma, r.norma).toContain("alterações posteriores");
    }
  });
});
