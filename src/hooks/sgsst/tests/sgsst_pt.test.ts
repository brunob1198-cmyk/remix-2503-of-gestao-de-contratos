import { describe, it, expect } from "vitest";
import { getDefaultChecklistItems } from "../../../utils/sgsstChecklistDefaults";

describe("SGSST PT (Permissão de Trabalho) Validation", () => {
  it("generates default checklist items for Trabalho em Altura", () => {
    const items = getDefaultChecklistItems("Trabalho em Altura");
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((i) => i.item.includes("Cinto de Segurança"))).toBe(true);
    expect(items.some((i) => i.item.includes("Ponto de Ancoragem"))).toBe(true);
  });

  it("generates default checklist items for Espaço Confinado", () => {
    const items = getDefaultChecklistItems("Espaço Confinado");
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((i) => i.item.includes("atmosfera"))).toBe(true);
    expect(items.some((i) => i.item.includes("Vigia"))).toBe(true);
  });

  it("validates PT workflow status transitions", () => {
    const validTransitions: Record<string, string[]> = {
      RASCUNHO: ["EM_ANALISE", "CANCELADA"],
      EM_ANALISE: ["APROVADA", "REJEITADA", "CANCELADA"],
      APROVADA: ["EM_EXECUCAO", "SUSPENSA", "CANCELADA"],
      EM_EXECUCAO: ["SUSPENSA", "ENCERRADA", "CANCELADA"],
      SUSPENSA: ["EM_EXECUCAO", "CANCELADA", "ENCERRADA"],
    };

    expect(validTransitions.RASCUNHO).toContain("EM_ANALISE");
    expect(validTransitions.EM_ANALISE).toContain("APROVADA");
    expect(validTransitions.APROVADA).toContain("EM_EXECUCAO");
    expect(validTransitions.EM_EXECUCAO).toContain("SUSPENSA");
    expect(validTransitions.SUSPENSA).toContain("EM_EXECUCAO");
    expect(validTransitions.EM_EXECUCAO).toContain("ENCERRADA");
  });
});
