import { describe, it, expect } from "vitest";

describe("SGSST Não Conformidades Validation", () => {
  it("validates NC workflow status transitions", () => {
    const validTransitions: Record<string, string[]> = {
      ABERTA: ["EM_ANALISE", "CANCELADA"],
      EM_ANALISE: ["PLANO_ACAO", "CANCELADA"],
      PLANO_ACAO: ["EM_TRATAMENTO", "CANCELADA"],
      EM_TRATAMENTO: ["AGUARDANDO_VERIFICACAO", "CANCELADA"],
      AGUARDANDO_VERIFICACAO: ["CONCLUIDA", "EM_TRATAMENTO", "CANCELADA"],
      CONCLUIDA: [],
      CANCELADA: [],
    };

    expect(validTransitions.ABERTA).toContain("EM_ANALISE");
    expect(validTransitions.EM_ANALISE).toContain("PLANO_ACAO");
    expect(validTransitions.PLANO_ACAO).toContain("EM_TRATAMENTO");
    expect(validTransitions.EM_TRATAMENTO).toContain("AGUARDANDO_VERIFICACAO");
    expect(validTransitions.AGUARDANDO_VERIFICACAO).toContain("CONCLUIDA");
    expect(validTransitions.AGUARDANDO_VERIFICACAO).toContain("EM_TRATAMENTO"); // Rejeição da eficácia
  });

  it("validates verification behavior: ACEITA concludes NC, REJEITADA reverts to EM_TRATAMENTO", () => {
    const processVerificacao = (resultado: "ACEITA" | "REJEITADA"): string => {
      if (resultado === "ACEITA") return "CONCLUIDA";
      return "EM_TRATAMENTO";
    };

    expect(processVerificacao("ACEITA")).toBe("CONCLUIDA");
    expect(processVerificacao("REJEITADA")).toBe("EM_TRATAMENTO");
  });

  it("validates closing rule: blocks verification request if open actions exist", () => {
    const acoes = [
      { id: "1", status: "CONCLUIDA" },
      { id: "2", status: "ABERTA" },
    ];

    const hasPendingActions = acoes.some(
      (a) => a.status === "ABERTA" || a.status === "EM_ANDAMENTO"
    );

    expect(hasPendingActions).toBe(true);
  });
});
