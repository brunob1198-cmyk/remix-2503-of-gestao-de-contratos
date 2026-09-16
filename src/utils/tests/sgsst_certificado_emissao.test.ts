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

/**
 * Roteiro 12.8 — teste NEGATIVO, reproduzido no app publicado.
 *
 * Turma CONCLUÍDA, participante REPROVADO, botão individual de emitir: o sistema
 * emitia, e avisava "Certificado com 5 pendência(s) — Participante não está
 * aprovado". O certificado saía.
 *
 * Havia dois caminhos para o mesmo documento, com regras diferentes: o botão do
 * LOTE filtrava os reprovados antes de chamar; o individual não.
 *
 * A pendência impressa é a política certa para o que está incompleto — PGR sem
 * medida, PCMSO sem agravos, PT em rascunho. Não serve aqui, e o motivo já
 * estava escrito neste módulo para o caso da turma não concluída: quando a
 * lacuna É a afirmação central, não há lacuna a marcar.
 */
describe("certificado exige aprovação do participante", () => {
  const HOJE = "2026-09-16";

  it("reprovado não emite, mesmo com a turma concluída", () => {
    const r = emissaoDoCertificado({
      statusDaTurma: "CONCLUIDA",
      dataConclusao: "2026-09-10",
      resultado: "REPROVADO",
      hoje: HOJE,
    });
    expect(r.emite).toBe(false);
    if (r.emite === false) {
      expect(r.motivo).toContain("reprovado");
      // A saída existe e é dita: nova turma, e a pendência continua no dossiê.
      expect(r.comoResolver).toContain("nova turma");
    }
  });

  it("resultado ainda pendente não emite", () => {
    // Certificado para quem ninguém avaliou afirma uma aprovação inexistente.
    const r = emissaoDoCertificado({
      statusDaTurma: "CONCLUIDA",
      dataConclusao: "2026-09-10",
      resultado: "PENDENTE",
      hoje: HOJE,
    });
    expect(r.emite).toBe(false);
  });

  it("aprovado emite normalmente", () => {
    expect(
      emissaoDoCertificado({
        statusDaTurma: "CONCLUIDA",
        dataConclusao: "2026-09-10",
        resultado: "APROVADO",
        hoje: HOJE,
      }).emite
    ).toBe(true);
  });

  it("caixa e espaço não driblam a regra", () => {
    for (const r of [" reprovado ", "Reprovado", "rePRovado"]) {
      expect(
        emissaoDoCertificado({
          statusDaTurma: "CONCLUIDA",
          dataConclusao: "2026-09-10",
          resultado: r,
          hoje: HOJE,
        }).emite
      ).toBe(false);
    }
  });

  it("a reprovação vem antes do status da turma na mensagem", () => {
    // Turma planejada E reprovado: dizer primeiro o que o usuário não vai
    // resolver concluindo a turma evita a ida e volta.
    const r = emissaoDoCertificado({
      statusDaTurma: "PLANEJADA",
      resultado: "REPROVADO",
      hoje: HOJE,
    });
    expect(r.emite).toBe(false);
    if (r.emite === false) expect(r.motivo).toContain("reprovado");
  });

  it("quem não informa o resultado não muda de comportamento", () => {
    // Chamador antigo: sem o campo, a regra não dispara e a decisão continua
    // sendo só sobre a turma.
    expect(
      emissaoDoCertificado({ statusDaTurma: "CONCLUIDA", dataConclusao: "2026-09-10", hoje: HOJE })
        .emite
    ).toBe(true);
    expect(emissaoDoCertificado({ statusDaTurma: "PLANEJADA", hoje: HOJE }).emite).toBe(false);
  });
});
