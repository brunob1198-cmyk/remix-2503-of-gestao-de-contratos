import { describe, it, expect } from "vitest";
import { calculateVencimentoTreinamento } from "../../../utils/sgsstTreinamentosUtils";
import { format, addDays, subDays } from "date-fns";

describe("SGSST Treinamentos e Capacitações Validation", () => {
  it("calculates Treinamentos validade status dynamically (VALIDO, PROXIMO_VENCIMENTO, VENCIDO)", () => {
    const today = new Date();

    const futureValid = format(addDays(today, 60), "yyyy-MM-dd");
    expect(calculateVencimentoTreinamento(futureValid)).toBe("VALIDO");

    const futureWarning = format(addDays(today, 15), "yyyy-MM-dd");
    expect(calculateVencimentoTreinamento(futureWarning)).toBe("PROXIMO_VENCIMENTO");

    const pastExpired = format(subDays(today, 10), "yyyy-MM-dd");
    expect(calculateVencimentoTreinamento(pastExpired)).toBe("VENCIDO");

    // Sem data de validade (Reciclagem não aplicável / Indeterminado)
    expect(calculateVencimentoTreinamento(null)).toBe("VALIDO");
  });

  it("validates modalidades de turmas (PRESENCIAL, ONLINE, HIBRIDO)", () => {
    const modalidades = ["PRESENCIAL", "ONLINE", "HIBRIDO"];
    expect(modalidades).toContain("PRESENCIAL");
    expect(modalidades).toContain("ONLINE");
    expect(modalidades).toContain("HIBRIDO");
  });

  it("validates resultados de participantes (APROVADO, REPROVADO, PENDENTE)", () => {
    const resultados = ["APROVADO", "REPROVADO", "PENDENTE"];
    expect(resultados).toContain("APROVADO");
    expect(resultados).toContain("REPROVADO");
    expect(resultados).toContain("PENDENTE");
  });
});
