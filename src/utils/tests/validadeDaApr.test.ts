import { describe, expect, it } from "vitest";
import { avisoDaAprVinculada, situacaoDaApr } from "../validadeDaApr";

/**
 * Roteiro 7.8: "Pôr a validade da APR no passado → Consta como vencida — e a PT
 * que a vincula DEVE SINALIZAR ISSO."
 *
 * Não constava em lugar nenhum. `apr.validade` era preenchido, salvo e impresso,
 * e nunca comparado com hoje — nem na lista de APRs, nem no documento da APR,
 * nem na PT que a cita.
 */

const HOJE = "2026-09-16";

describe("situacaoDaApr", () => {
  it("validade no futuro está vigente", () => {
    expect(situacaoDaApr("2026-12-31", HOJE)).toBe("VIGENTE");
  });

  it("validade no passado está vencida", () => {
    expect(situacaoDaApr("2026-09-15", HOJE)).toBe("VENCIDA");
  });

  it("vence DEPOIS do dia — válida até hoje ainda vale hoje", () => {
    // A borda é o caso que importa: errar aqui invalida a APR no último dia em
    // que ela ainda protege alguém.
    expect(situacaoDaApr(HOJE, HOJE)).toBe("VIGENTE");
  });

  it("sem validade é estado próprio, não vencida", () => {
    // "Ninguém preencheu" e "o prazo passou" são problemas diferentes e pedem
    // ações diferentes. Tratar os dois como vencido esconderia o primeiro.
    expect(situacaoDaApr(null, HOJE)).toBe("SEM_VALIDADE");
    expect(situacaoDaApr("", HOJE)).toBe("SEM_VALIDADE");
    expect(situacaoDaApr("   ", HOJE)).toBe("SEM_VALIDADE");
  });

  it("aceita data com hora, como o banco devolve", () => {
    expect(situacaoDaApr("2026-09-15T00:00:00.000Z", HOJE)).toBe("VENCIDA");
    expect(situacaoDaApr("2026-12-31T23:59:00.000Z", HOJE)).toBe("VIGENTE");
  });

  it("compara como texto ISO, não como Date", () => {
    // `new Date("2026-09-16")` é meia-noite UTC e em GMT-3 volta para o dia 15 —
    // foi assim que a validade da PT perdeu um dia. Texto ISO ordena igual a
    // calendário, em qualquer fuso.
    expect(situacaoDaApr("2026-09-16", "2026-09-16T23:59")).toBe("VIGENTE");
  });
});

describe("avisoDaAprVinculada", () => {
  it("APR vencida gera aviso grave, com a data", () => {
    const a = avisoDaAprVinculada({
      validade: "2026-08-01",
      hojeIso: HOJE,
      identificacao: "APR-2026-0007",
    });
    expect(a?.grave).toBe(true);
    expect(a?.texto).toContain("APR-2026-0007");
    expect(a?.texto).toContain("2026-08-01");
    expect(a?.texto).toContain("não está mais vigente");
  });

  it("APR sem validade avisa, mas não como grave", () => {
    const a = avisoDaAprVinculada({ validade: null, hojeIso: HOJE });
    expect(a?.grave).toBe(false);
    expect(a?.texto).toContain("não tem validade definida");
  });

  it("APR vigente não diz nada", () => {
    // Tela que anuncia o que está certo ensina a ignorar avisos, e aí o que está
    // errado passa junto.
    expect(avisoDaAprVinculada({ validade: "2026-12-31", hojeIso: HOJE })).toBeNull();
  });

  it("funciona sem identificação, sem deixar parêntese vazio", () => {
    const a = avisoDaAprVinculada({ validade: "2026-08-01", hojeIso: HOJE });
    expect(a?.texto).not.toContain("()");
    expect(a?.texto).toContain("APR vinculada venceu");
  });
});
