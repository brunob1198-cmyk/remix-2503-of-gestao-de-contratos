import { describe, expect, it } from "vitest";
import {
  MAXIMO_DE_COLUNAS_DE_DIA,
  diasDaTurma,
  linhasEmBranco,
  situacaoDaFolha,
} from "@/utils/sgsstListaPresenca";

describe("diasDaTurma", () => {
  it("turma de um dia tem uma coluna", () => {
    expect(diasDaTurma({ dataInicial: "2026-08-19", dataFinal: "2026-08-19" })).toEqual({
      dias: ["2026-08-19"],
      colunaUnica: false,
    });
  });

  it("sem data final e turma de um dia", () => {
    // O cadastro de turma de um dia so grava a inicial.
    expect(diasDaTurma({ dataInicial: "2026-08-19", dataFinal: null }).dias).toEqual([
      "2026-08-19",
    ]);
  });

  it("periodo de tres dias gera uma coluna por dia", () => {
    // Quem faltou no segundo dia nao cumpriu a carga horaria, e e isso que a
    // folha precisa provar.
    expect(diasDaTurma({ dataInicial: "2026-08-19", dataFinal: "2026-08-21" }).dias).toEqual([
      "2026-08-19",
      "2026-08-20",
      "2026-08-21",
    ]);
  });

  it("atravessa a virada de mes", () => {
    expect(diasDaTurma({ dataInicial: "2026-08-30", dataFinal: "2026-09-01" }).dias).toEqual([
      "2026-08-30",
      "2026-08-31",
      "2026-09-01",
    ]);
  });

  it("data final anterior a inicial vira turma de um dia, nao lista vazia", () => {
    // Cadastro errado nao pode produzir folha sem coluna de assinatura.
    expect(diasDaTurma({ dataInicial: "2026-08-19", dataFinal: "2026-08-10" }).dias).toEqual([
      "2026-08-19",
    ]);
  });

  it("periodo longo demais cai para coluna unica em vez de travar", () => {
    // Data final absurda no cadastro geraria milhares de colunas.
    const r = diasDaTurma({ dataInicial: "2026-01-01", dataFinal: "2027-01-01" });
    expect(r.colunaUnica).toBe(true);
    expect(r.dias.length).toBeLessThanOrEqual(MAXIMO_DE_COLUNAS_DE_DIA);
  });

  it("sem data inicial nao inventa dia", () => {
    expect(diasDaTurma({ dataInicial: null, dataFinal: "2026-08-21" })).toEqual({
      dias: [],
      colunaUnica: true,
    });
  });

  it("aceita timestamp completo, usando so o dia", () => {
    expect(
      diasDaTurma({ dataInicial: "2026-08-19T08:00:00Z", dataFinal: "2026-08-20T18:00:00Z" }).dias
    ).toEqual(["2026-08-19", "2026-08-20"]);
  });
});

describe("linhasEmBranco", () => {
  it("com capacidade declarada, completa ate a lotacao", () => {
    expect(linhasEmBranco({ inscritos: 12, capacidade: 30 })).toBe(15);
    expect(linhasEmBranco({ inscritos: 25, capacidade: 30 })).toBe(5);
  });

  it("capacidade cheia ainda rende linhas, porque e quando aparece gente a mais", () => {
    // Com dois ramos separados, a turma EXATAMENTE lotada caia no ramo errado e
    // rendia menos linhas que uma turma com uma vaga sobrando. Por isso a regra
    // e o maior entre vagas abertas, proporcional e o piso.
    expect(linhasEmBranco({ inscritos: 30, capacidade: 30 })).toBe(6);
    expect(linhasEmBranco({ inscritos: 31, capacidade: 30 })).toBe(7);
  });

  it("turma lotada nao rende menos que uma com vaga sobrando", () => {
    const lotada = linhasEmBranco({ inscritos: 30, capacidade: 30 });
    const comUmaVaga = linhasEmBranco({ inscritos: 29, capacidade: 30 });
    expect(lotada).toBeGreaterThanOrEqual(comUmaVaga);
  });

  it("sem capacidade, acompanha o tamanho da turma", () => {
    expect(linhasEmBranco({ inscritos: 1 })).toBe(3);
    expect(linhasEmBranco({ inscritos: 50 })).toBe(10);
  });

  it("turma vazia ainda tem folha utilizavel", () => {
    // Emitir a folha antes de matricular alguem e uso legitimo.
    expect(linhasEmBranco({ inscritos: 0 })).toBe(3);
  });

  it("capacidade invalida nao quebra a conta", () => {
    expect(linhasEmBranco({ inscritos: 4, capacidade: NaN })).toBe(3);
    expect(linhasEmBranco({ inscritos: 4, capacidade: null })).toBe(3);
  });
});

describe("situacaoDaFolha", () => {
  it("turma concluida e reimpressao de registro", () => {
    expect(situacaoDaFolha("CONCLUIDA")).toBe("DEPOIS_DO_TREINAMENTO");
  });

  it.each(["PLANEJADA", "EM_ANDAMENTO", "CANCELADA", null, undefined])(
    "%s e folha para assinar",
    (status) => {
      expect(situacaoDaFolha(status)).toBe("ANTES_DO_TREINAMENTO");
    }
  );

  it("status em minusculas e tratado igual", () => {
    expect(situacaoDaFolha("concluida")).toBe("DEPOIS_DO_TREINAMENTO");
  });
});
