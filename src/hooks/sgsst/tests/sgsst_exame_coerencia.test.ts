import { describe, it, expect } from "vitest";
import {
  incoerenciaDoExame,
  podeGravarExame,
  realizadosSemData,
} from "@/utils/sgsstExameCoerencia";

/**
 * O caso real que originou isto: um exame gravado como REALIZADO sem data. A lista
 * mostrava "REALIZADO" e a fila de convocação dizia "vencido, nunca realizado",
 * porque o cálculo da periodicidade só conta exame com status REALIZADO E data.
 * Duas telas afirmando o oposto sobre o mesmo exame, sem nada explicando.
 */
describe("incoerenciaDoExame", () => {
  it("REALIZADO sem data IMPEDE a gravação", () => {
    // Não é informação pendente, é contradição: não existe saber que aconteceu e
    // não saber quando.
    const inc = incoerenciaDoExame({ status: "REALIZADO", dataRealizacao: null });
    expect(inc?.gravidade).toBe("IMPEDE");
    expect(podeGravarExame({ status: "REALIZADO", dataRealizacao: null })).toBe(false);
  });

  it("a mensagem diz o que fazer, não só o que está errado", () => {
    const inc = incoerenciaDoExame({ status: "REALIZADO", dataRealizacao: "" });
    expect(inc?.comoResolver).toContain("Pendente ou Agendado");
    expect(inc?.comoResolver).toContain("convocação");
  });

  it("REALIZADO com data está coerente", () => {
    expect(
      incoerenciaDoExame({ status: "REALIZADO", dataRealizacao: "2026-08-28" })
    ).toBeNull();
  });

  it("PENDENTE sem data está coerente — é o estado normal antes do exame", () => {
    expect(incoerenciaDoExame({ status: "PENDENTE", dataRealizacao: null })).toBeNull();
    expect(incoerenciaDoExame({ status: "AGENDADO", dataRealizacao: null })).toBeNull();
  });

  it("data preenchida com status PENDENTE apenas AVISA", () => {
    // Menos grave: a data existe, então o cálculo da periodicidade tem base. O que
    // falta é alguém confirmar o status — e por isso não bloqueia.
    const inc = incoerenciaDoExame({ status: "PENDENTE", dataRealizacao: "2026-08-28" });
    expect(inc?.gravidade).toBe("AVISA");
    expect(podeGravarExame({ status: "PENDENTE", dataRealizacao: "2026-08-28" })).toBe(true);
  });

  it("CANCELADO com data não é incoerência", () => {
    // O exame foi feito e depois a solicitação foi cancelada; nada a corrigir.
    expect(
      incoerenciaDoExame({ status: "CANCELADO", dataRealizacao: "2026-08-28" })
    ).toBeNull();
  });

  it("espaço em branco na data conta como ausente", () => {
    expect(
      incoerenciaDoExame({ status: "REALIZADO", dataRealizacao: "   " })?.gravidade
    ).toBe("IMPEDE");
  });

  it("status em caixa baixa é tratado igual", () => {
    // Vem assim de importação e de dado antigo; ignorar a caixa evitaria o alerta
    // justamente na linha que mais precisa dele.
    expect(
      incoerenciaDoExame({ status: "realizado", dataRealizacao: null })?.gravidade
    ).toBe("IMPEDE");
  });

  it("status ausente não gera alarme falso", () => {
    expect(incoerenciaDoExame({ status: null, dataRealizacao: null })).toBeNull();
  });
});

describe("realizadosSemData", () => {
  it("conta só os que impedem, não os que avisam", () => {
    const n = realizadosSemData([
      { status: "REALIZADO", data_realizacao: null },
      { status: "REALIZADO", data_realizacao: "2026-08-01" },
      { status: "PENDENTE", data_realizacao: "2026-08-01" },
      { status: "PENDENTE", data_realizacao: null },
    ]);
    expect(n).toBe(1);
  });

  it("lista vazia conta zero", () => {
    expect(realizadosSemData([])).toBe(0);
  });
});

/**
 * Roteiro R4 — encontrado nos dados reais do usuário.
 *
 * Um exame PENDENTE, sem data de realização, gravado com classificação NORMAL:
 * um laudo para um exame que não aconteceu.
 *
 * Hoje o relatório analítico da NR-07 não é contaminado, porque ele só conta os
 * realizados. O dano é adiado: no dia em que alguém marcar aquele exame como
 * realizado, a classificação velha vai junto, e a estatística de achados passa a
 * incluir um "normal" que nenhum médico leu.
 */
describe("classificação de resultado exige exame realizado", () => {
  it("classificar sem data de realização IMPEDE a gravação", () => {
    const r = incoerenciaDoExame({
      status: "PENDENTE",
      dataRealizacao: null,
      classificacao: "NORMAL",
    });
    expect(r?.gravidade).toBe("IMPEDE");
    expect(r?.resumo).toContain("sem data de realização");
  });

  it.each(["NORMAL", "ALTERADO", "INCONCLUSIVO"])(
    "vale para qualquer classificação (%s)",
    (c) => {
      expect(
        incoerenciaDoExame({ status: "AGENDADO", dataRealizacao: null, classificacao: c })
          ?.gravidade
      ).toBe("IMPEDE");
    }
  );

  it("com data de realização, classificar é o esperado", () => {
    expect(
      incoerenciaDoExame({
        status: "REALIZADO",
        dataRealizacao: "2026-09-10",
        classificacao: "ALTERADO",
      })
    ).toBeNull();
  });

  it("exame pendente SEM classificação continua coerente", () => {
    // É o estado normal antes do exame — não pode virar alarme falso.
    expect(
      incoerenciaDoExame({ status: "PENDENTE", dataRealizacao: null, classificacao: null })
    ).toBeNull();
    expect(
      incoerenciaDoExame({ status: "PENDENTE", dataRealizacao: null, classificacao: "  " })
    ).toBeNull();
  });

  it("a mensagem diz as duas saídas, não só que está errado", () => {
    const r = incoerenciaDoExame({
      status: "PENDENTE",
      dataRealizacao: null,
      classificacao: "NORMAL",
    });
    expect(r?.comoResolver).toContain("Informe a data");
    expect(r?.comoResolver).toContain("deixe a classificação em branco");
  });

  it("quem não informa classificação não muda de comportamento", () => {
    // `realizadosSemData` e a fila de convocação chamam sem o campo novo: a
    // regra não pode disparar para eles, ou a convocação mudaria de sentido.
    expect(incoerenciaDoExame({ status: "PENDENTE", dataRealizacao: null })).toBeNull();
    expect(
      incoerenciaDoExame({ status: "REALIZADO", dataRealizacao: null })?.resumo
    ).toContain("realizado sem data");
  });
});
