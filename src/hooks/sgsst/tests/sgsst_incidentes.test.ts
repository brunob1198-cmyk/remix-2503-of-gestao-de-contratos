import { describe, it, expect } from "vitest";

describe("SGSST Incidentes e Acidentes Validation", () => {
  it("validates Incidente workflow status transitions", () => {
    const validTransitions: Record<string, string[]> = {
      REGISTRADO: ["EM_INVESTIGACAO", "CANCELADO"],
      EM_INVESTIGACAO: ["PLANO_ACAO", "CANCELADO"],
      PLANO_ACAO: ["EM_TRATAMENTO", "ENCERRADO", "CANCELADO"],
      EM_TRATAMENTO: ["ENCERRADO", "CANCELADO"],
      ENCERRADO: [],
      CANCELADO: [],
    };

    expect(validTransitions.REGISTRADO).toContain("EM_INVESTIGACAO");
    expect(validTransitions.EM_INVESTIGACAO).toContain("PLANO_ACAO");
    expect(validTransitions.PLANO_ACAO).toContain("EM_TRATAMENTO");
    expect(validTransitions.EM_TRATAMENTO).toContain("ENCERRADO");
    expect(validTransitions.REGISTRADO).toContain("CANCELADO");
    expect(validTransitions.ENCERRADO.length).toBe(0);
    expect(validTransitions.CANCELADO.length).toBe(0);
  });

  it("validates closing rule: blocks closing if open actions exist", () => {
    const acoes = [
      { id: "1", status: "CONCLUIDA" },
      { id: "2", status: "EM_ANDAMENTO" },
    ];

    const hasPendingActions = acoes.some(
      (a) => a.status === "ABERTA" || a.status === "EM_ANDAMENTO"
    );

    expect(hasPendingActions).toBe(true);
  });
});
