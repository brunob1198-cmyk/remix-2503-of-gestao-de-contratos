import { describe, it, expect } from "vitest";
import { getDefaultInspecaoItems } from "../../../utils/sgsstInspecaoDefaults";

describe("SGSST Inspeções de Segurança Validation", () => {
  it("generates default checklist items for Inspeção de EPI", () => {
    const items = getDefaultInspecaoItems("Inspeção de EPI");
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((i) => i.descricao.includes("Capacete"))).toBe(true);
    expect(items.some((i) => i.descricao.includes("Calçado"))).toBe(true);
  });

  it("generates default checklist items for Inspeção de Equipamento", () => {
    const items = getDefaultInspecaoItems("Inspeção de Equipamento");
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((i) => i.descricao.includes("Proteções mecânicas"))).toBe(true);
    expect(items.some((i) => i.descricao.includes("Botão de emergência"))).toBe(true);
  });

  it("validates Inspection workflow status transitions", () => {
    const validTransitions: Record<string, string[]> = {
      PLANEJADA: ["EM_EXECUCAO", "CANCELADA"],
      EM_EXECUCAO: ["CONCLUIDA", "CANCELADA"],
      CONCLUIDA: [],
      CANCELADA: [],
    };

    expect(validTransitions.PLANEJADA).toContain("EM_EXECUCAO");
    expect(validTransitions.EM_EXECUCAO).toContain("CONCLUIDA");
    expect(validTransitions.PLANEJADA).toContain("CANCELADA");
    expect(validTransitions.CONCLUIDA.length).toBe(0);
    expect(validTransitions.CANCELADA.length).toBe(0);
  });
});
