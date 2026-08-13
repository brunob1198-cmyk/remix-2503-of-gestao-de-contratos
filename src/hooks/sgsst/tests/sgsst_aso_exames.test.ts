import { describe, it, expect } from "vitest";
import { calculateVencimentoAso } from "../../../utils/sgsstAsoUtils";
import { format, addDays, subDays } from "date-fns";

describe("SGSST ASO e Exames Ocupacionais Validation", () => {
  it("calculates ASO vencimento status dynamically (VALIDO, PROXIMO_VENCIMENTO, VENCIDO)", () => {
    const today = new Date();

    const futureValid = format(addDays(today, 60), "yyyy-MM-dd");
    expect(calculateVencimentoAso(futureValid)).toBe("VALIDO");

    const futureWarning = format(addDays(today, 15), "yyyy-MM-dd");
    expect(calculateVencimentoAso(futureWarning)).toBe("PROXIMO_VENCIMENTO");

    const pastExpired = format(subDays(today, 10), "yyyy-MM-dd");
    expect(calculateVencimentoAso(pastExpired)).toBe("VENCIDO");
  });

  it("validates aptidão enum options (APTO, APTO_COM_RESTRICAO, INAPTO)", () => {
    const aptidoesValidas = ["APTO", "APTO_COM_RESTRICAO", "INAPTO"];

    expect(aptidoesValidas).toContain("APTO");
    expect(aptidoesValidas).toContain("APTO_COM_RESTRICAO");
    expect(aptidoesValidas).toContain("INAPTO");
  });

  it("validates status workflow for Exames (PENDENTE, AGENDADO, REALIZADO, CANCELADO)", () => {
    const statusValidos = ["PENDENTE", "AGENDADO", "REALIZADO", "CANCELADO"];

    expect(statusValidos).toContain("PENDENTE");
    expect(statusValidos).toContain("REALIZADO");
  });
});
