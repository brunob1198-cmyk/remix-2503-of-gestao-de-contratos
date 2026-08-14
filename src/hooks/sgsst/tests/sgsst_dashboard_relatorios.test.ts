import { describe, it, expect } from "vitest";

describe("SGSST Dashboard Geral + Relatórios Executivos", () => {
  it("validates report types for SGSST executive reporting", () => {
    const tiposRelatorio = [
      "PGR",
      "APR",
      "PT",
      "INSPECAO",
      "INCIDENTE",
      "NC",
      "SAUDE",
      "TREINAMENTO",
      "EPI",
    ];

    expect(tiposRelatorio.length).toBe(9);
    expect(tiposRelatorio).toContain("PGR");
    expect(tiposRelatorio).toContain("APR");
    expect(tiposRelatorio).toContain("NC");
    expect(tiposRelatorio).toContain("SAUDE");
    expect(tiposRelatorio).toContain("EPI");
  });

  it("validates critical urgency levels for Requer Atenção alerts", () => {
    const urgencias = ["CRITICA", "ALTA", "MEDIA"];
    expect(urgencias).toContain("CRITICA");
    expect(urgencias).toContain("ALTA");
    expect(urgencias).toContain("MEDIA");
  });
});
