import { describe, it, expect } from "vitest";
import { calcularClassificacaoRisco } from "../../../utils/sgsstRiscoMatrix";

describe("SGSST PGR Risk Matrix Calculation (NR-1)", () => {
  it("calculates BAIXO risk classification (nivel <= 4)", () => {
    const res1 = calcularClassificacaoRisco(1, 1);
    expect(res1.nivel).toBe(1);
    expect(res1.classificacao).toBe("BAIXO");

    const res2 = calcularClassificacaoRisco(2, 2);
    expect(res2.nivel).toBe(4);
    expect(res2.classificacao).toBe("BAIXO");
  });

  it("calculates MODERADO risk classification (5 <= nivel <= 9)", () => {
    const res1 = calcularClassificacaoRisco(3, 2);
    expect(res1.nivel).toBe(6);
    expect(res1.classificacao).toBe("MODERADO");

    const res2 = calcularClassificacaoRisco(3, 3);
    expect(res2.nivel).toBe(9);
    expect(res2.classificacao).toBe("MODERADO");
  });

  it("calculates ALTO risk classification (10 <= nivel <= 16)", () => {
    const res1 = calcularClassificacaoRisco(4, 3);
    expect(res1.nivel).toBe(12);
    expect(res1.classificacao).toBe("ALTO");

    const res2 = calcularClassificacaoRisco(4, 4);
    expect(res2.nivel).toBe(16);
    expect(res2.classificacao).toBe("ALTO");
  });

  it("calculates CRÍTICO risk classification (17 <= nivel <= 25)", () => {
    const res1 = calcularClassificacaoRisco(5, 4);
    expect(res1.nivel).toBe(20);
    expect(res1.classificacao).toBe("CRÍTICO");

    const res2 = calcularClassificacaoRisco(5, 5);
    expect(res2.nivel).toBe(25);
    expect(res2.classificacao).toBe("CRÍTICO");
  });
});
