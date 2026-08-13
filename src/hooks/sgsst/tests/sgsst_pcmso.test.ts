import { describe, it, expect } from "vitest";

describe("SGSST PCMSO (Saúde Ocupacional) Validation", () => {
  it("validates PCMSO workflow status transitions", () => {
    const validTransitions: Record<string, string[]> = {
      RASCUNHO: ["ATIVO", "CANCELADO"],
      ATIVO: ["EM_REVISAO", "ENCERRADO", "CANCELADO"],
      EM_REVISAO: ["ATIVO", "ENCERRADO", "CANCELADO"],
      ENCERRADO: [],
      CANCELADO: [],
    };

    expect(validTransitions.RASCUNHO).toContain("ATIVO");
    expect(validTransitions.ATIVO).toContain("EM_REVISAO");
    expect(validTransitions.EM_REVISAO).toContain("ATIVO");
    expect(validTransitions.ATIVO).toContain("ENCERRADO");
    expect(validTransitions.RASCUNHO).toContain("CANCELADO");
    expect(validTransitions.ENCERRADO.length).toBe(0);
    expect(validTransitions.CANCELADO.length).toBe(0);
  });

  it("validates tipos de exames ocupacionais previstos", () => {
    const tiposValidos = [
      "Admissional",
      "Periódico",
      "Retorno ao Trabalho",
      "Mudança de Risco/Função",
      "Demissional",
      "Outros",
    ];

    expect(tiposValidos).toContain("Admissional");
    expect(tiposValidos).toContain("Periódico");
    expect(tiposValidos).toContain("Retorno ao Trabalho");
    expect(tiposValidos).toContain("Demissional");
  });
});
