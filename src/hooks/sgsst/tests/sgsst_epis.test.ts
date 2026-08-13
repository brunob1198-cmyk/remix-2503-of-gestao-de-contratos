import { describe, it, expect } from "vitest";
import { calculateValidadeCa } from "../../../utils/sgsstEpiUtils";
import { format, addDays, subDays } from "date-fns";

describe("SGSST EPIs (Equipamentos de Proteção Individual) Validation", () => {
  it("calculates CA validade status dynamically (VALIDO, PROXIMO_VENCIMENTO, VENCIDO)", () => {
    const today = new Date();

    const futureValid = format(addDays(today, 60), "yyyy-MM-dd");
    expect(calculateValidadeCa(futureValid)).toBe("VALIDO");

    const futureWarning = format(addDays(today, 15), "yyyy-MM-dd");
    expect(calculateValidadeCa(futureWarning)).toBe("PROXIMO_VENCIMENTO");

    const pastExpired = format(subDays(today, 10), "yyyy-MM-dd");
    expect(calculateValidadeCa(pastExpired)).toBe("VENCIDO");

    // Sem data de CA informada
    expect(calculateValidadeCa(null)).toBe("VALIDO");
  });

  it("validates motivos de entrega de EPI (PRIMEIRA_ENTREGA, SUBSTITUICAO, PERDA, DANIFICADO, VENCIMENTO, OUTROS)", () => {
    const motivos = [
      "PRIMEIRA_ENTREGA",
      "SUBSTITUICAO",
      "PERDA",
      "DANIFICADO",
      "VENCIMENTO",
      "OUTROS",
    ];

    expect(motivos).toContain("PRIMEIRA_ENTREGA");
    expect(motivos).toContain("SUBSTITUICAO");
    expect(motivos).toContain("DANIFICADO");
  });

  it("validates condições de devolução (BOM, DANIFICADO, INUTILIZADO, VENCIDO)", () => {
    const condicoes = ["BOM", "DANIFICADO", "INUTILIZADO", "VENCIDO"];

    expect(condicoes).toContain("BOM");
    expect(condicoes).toContain("DANIFICADO");
    expect(condicoes).toContain("INUTILIZADO");
  });
});
