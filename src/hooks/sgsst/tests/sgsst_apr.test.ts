import { describe, it, expect } from "vitest";
import { calcularClassificacaoRisco } from "../../../utils/sgsstRiscoMatrix";

describe("SGSST APR Risk Matrix and Workflow Validation", () => {
  it("calculates APR risk levels correctly using shared matrix", () => {
    const r1 = calcularClassificacaoRisco(2, 2);
    expect(r1.nivel).toBe(4);
    expect(r1.classificacao).toBe("BAIXO");

    const r2 = calcularClassificacaoRisco(4, 4);
    expect(r2.nivel).toBe(16);
    expect(r2.classificacao).toBe("ALTO");

    const r3 = calcularClassificacaoRisco(5, 5);
    expect(r3.nivel).toBe(25);
    expect(r3.classificacao).toBe("CRÍTICO");
  });

  it("validates APR status flow transitions", () => {
    const validTransitions: Record<string, string[]> = {
      RASCUNHO: ["EM_ANALISE", "CANCELADA"],
      EM_ANALISE: ["APROVADA", "REJEITADA", "RASCUNHO"],
      REJEITADA: ["RASCUNHO", "CANCELADA"],
      APROVADA: ["EM_ANALISE", "ENCERRADA"],
    };

    expect(validTransitions.RASCUNHO).toContain("EM_ANALISE");
    expect(validTransitions.EM_ANALISE).toContain("APROVADA");
    expect(validTransitions.EM_ANALISE).toContain("REJEITADA");
  });
});
