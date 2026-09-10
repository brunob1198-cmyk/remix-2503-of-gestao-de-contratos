import { describe, expect, it } from "vitest";
import {
  emissaoDoCertificado,
  loteDeCertificados,
} from "@/utils/sgsstCertificadoEmissao";

const HOJE = "2026-09-10";

describe("emissaoDoCertificado", () => {
  it("turma PLANEJADA nao emite — e o item 12.5", () => {
    const r = emissaoDoCertificado({ statusDaTurma: "PLANEJADA", hoje: HOJE });
    expect(r.emite).toBe(false);
    if (r.emite !== false) throw new Error("esperava bloqueio");
    expect(r.motivo).toContain("planejada");
    expect(r.comoResolver).toContain("CONCLUIU");
  });

  it("turma EM_ANDAMENTO tambem nao emite", () => {
    // Comecou nao e terminou. O certificado atesta conclusao.
    const r = emissaoDoCertificado({ statusDaTurma: "EM_ANDAMENTO", hoje: HOJE });
    expect(r.emite).toBe(false);
    if (r.emite !== false) throw new Error("esperava bloqueio");
    expect(r.motivo).toContain("andamento");
  });

  it("turma CANCELADA nao emite", () => {
    const r = emissaoDoCertificado({ statusDaTurma: "CANCELADA", hoje: HOJE });
    expect(r.emite).toBe(false);
  });

  it("turma CONCLUIDA emite", () => {
    expect(
      emissaoDoCertificado({
        statusDaTurma: "CONCLUIDA",
        dataConclusao: "2026-08-26",
        hoje: HOJE,
      })
    ).toEqual({ emite: true });
  });

  it("conclusao HOJE emite — o dia nao precisa ter acabado", () => {
    expect(
      emissaoDoCertificado({ statusDaTurma: "CONCLUIDA", dataConclusao: HOJE, hoje: HOJE }).emite
    ).toBe(true);
  });

  it("conclusao no FUTURO nao emite, mesmo com turma concluida", () => {
    // A data sai impressa no certificado: datada para frente, o documento atesta
    // hoje algo que, pelo proprio papel, so acontece depois.
    const r = emissaoDoCertificado({
      statusDaTurma: "CONCLUIDA",
      dataConclusao: "2026-12-01",
      hoje: HOJE,
    });
    expect(r.emite).toBe(false);
    if (r.emite !== false) throw new Error("esperava bloqueio");
    expect(r.motivo).toContain("2026-12-01");
  });

  it("turma concluida sem data de conclusao do aluno emite", () => {
    // A falta da data e pendencia de INFORMACAO, tratada por pendenciasCertificado:
    // sai impressa na folha. Nao e afirmacao falsa, entao nao bloqueia aqui.
    expect(
      emissaoDoCertificado({ statusDaTurma: "CONCLUIDA", dataConclusao: null, hoje: HOJE }).emite
    ).toBe(true);
  });

  it("aceita timestamp completo, comparando so o dia", () => {
    expect(
      emissaoDoCertificado({
        statusDaTurma: "CONCLUIDA",
        dataConclusao: "2026-09-10T23:00:00Z",
        hoje: "2026-09-10T01:00:00Z",
      }).emite
    ).toBe(true);
  });

  it("status minusculo e tratado igual", () => {
    expect(emissaoDoCertificado({ statusDaTurma: "planejada", hoje: HOJE }).emite).toBe(false);
  });

  it("status desconhecido ou ausente NAO bloqueia", () => {
    // Travar por valor que o sistema nao reconhece bloquearia turma legitima se
    // alguem acrescentar um status novo no banco.
    expect(emissaoDoCertificado({ statusDaTurma: null, hoje: HOJE }).emite).toBe(true);
    expect(emissaoDoCertificado({ statusDaTurma: "REABERTA", hoje: HOJE }).emite).toBe(true);
  });
});

describe("loteDeCertificados", () => {
  const aluno = (id: string, data?: string | null) => ({ id, data_conclusao: data ?? null });

  it("turma planejada bloqueia o lote inteiro", () => {
    const r = loteDeCertificados({
      aprovados: [aluno("1"), aluno("2")],
      statusDaTurma: "PLANEJADA",
      hoje: HOJE,
    });
    expect(r.emitir).toEqual([]);
    expect(r.bloqueados).toHaveLength(2);
    expect(r.bloqueados[0].motivo).toContain("planejada");
  });

  it("turma concluida separa quem tem data futura", () => {
    // O lote nao pode sair calado com menos folhas que a lista de aprovados.
    const r = loteDeCertificados({
      aprovados: [aluno("1", "2026-08-26"), aluno("2", "2026-12-01"), aluno("3", null)],
      statusDaTurma: "CONCLUIDA",
      hoje: HOJE,
    });
    expect(r.emitir.map((a) => a.id)).toEqual(["1", "3"]);
    expect(r.bloqueados.map((b) => b.item.id)).toEqual(["2"]);
  });

  it("lote vazio nao inventa bloqueio", () => {
    expect(loteDeCertificados({ aprovados: [], statusDaTurma: "CONCLUIDA", hoje: HOJE }))
      .toEqual({ emitir: [], bloqueados: [] });
  });
});
