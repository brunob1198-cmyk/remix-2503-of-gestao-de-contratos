import { describe, expect, it } from "vitest";
import { prazoDaCat, primeiroDiaUtilSeguinte } from "../prazoDaCat";

/**
 * Roteiro 6.3: "Registrar uma CAT com data do acidente 5 dias antes da emissão →
 * A diferença de datas fica visível COMO ATRASO NA COMUNICAÇÃO."
 *
 * O documento imprimia as duas datas lado a lado e nunca as subtraía. O prazo da
 * CAT é o artigo 22 da Lei 8.213/91, com multa: primeiro dia útil seguinte, e de
 * imediato em caso de óbito.
 *
 * 2026-09-14 é uma segunda-feira. As datas dos casos abaixo foram escolhidas a
 * partir dela para que o dia da semana seja verificável a olho.
 */

describe("primeiroDiaUtilSeguinte", () => {
  it("dia de semana passa para o seguinte", () => {
    expect(primeiroDiaUtilSeguinte("2026-09-14")).toBe("2026-09-15"); // seg -> ter
    expect(primeiroDiaUtilSeguinte("2026-09-17")).toBe("2026-09-18"); // qui -> sex
  });

  it("sexta pula o fim de semana", () => {
    expect(primeiroDiaUtilSeguinte("2026-09-18")).toBe("2026-09-21"); // sex -> seg
  });

  it("sábado e domingo caem na segunda", () => {
    expect(primeiroDiaUtilSeguinte("2026-09-19")).toBe("2026-09-21"); // sáb
    expect(primeiroDiaUtilSeguinte("2026-09-20")).toBe("2026-09-21"); // dom
  });

  it("vira o mês e o ano sem tropeçar", () => {
    expect(primeiroDiaUtilSeguinte("2026-09-30")).toBe("2026-10-01");
    expect(primeiroDiaUtilSeguinte("2026-12-31")).toBe("2027-01-01");
  });
});

describe("prazoDaCat — acidente comum", () => {
  it("comunicada no dia seguinte está no prazo", () => {
    const r = prazoDaCat({ dataAcidente: "2026-09-14", dataEmissao: "2026-09-15" });
    expect(r.situacao).toBe("EM_DIA");
    // Em dia não gera texto: documento que anuncia o que está certo ensina a
    // ignorar avisos.
    expect(r.texto).toBeNull();
  });

  it("comunicada no mesmo dia está no prazo", () => {
    expect(
      prazoDaCat({ dataAcidente: "2026-09-14", dataEmissao: "2026-09-14" }).situacao
    ).toBe("EM_DIA");
  });

  it("acidente na sexta, comunicada na segunda, está no prazo", () => {
    // É o caso que uma conta de dias corridos acusaria injustamente.
    const r = prazoDaCat({ dataAcidente: "2026-09-18", dataEmissao: "2026-09-21" });
    expect(r.situacao).toBe("EM_DIA");
    expect(r.diasCorridos).toBe(3);
  });

  it("o caso do roteiro: 5 dias depois, fora do prazo", () => {
    const r = prazoDaCat({ dataAcidente: "2026-09-14", dataEmissao: "2026-09-19" });
    expect(r.situacao).toBe("FORA_DO_PRAZO");
    expect(r.diasCorridos).toBe(5);
    expect(r.limite).toBe("2026-09-15");
    expect(r.texto).toContain("5 dias");
    expect(r.texto).toContain("art. 22");
  });

  it("a mensagem admite que não conta feriado", () => {
    // O sistema não tem calendário de feriados. Acusar atraso sem dizer isso
    // seria afirmar mais do que se sabe, numa conta que termina em multa.
    const r = prazoDaCat({ dataAcidente: "2026-09-14", dataEmissao: "2026-09-19" });
    expect(r.texto).toContain("Feriados não entram");
  });

  it("um dia depois do limite já é atraso", () => {
    expect(
      prazoDaCat({ dataAcidente: "2026-09-14", dataEmissao: "2026-09-16" }).situacao
    ).toBe("FORA_DO_PRAZO");
  });

  it("concorda em número no singular", () => {
    const r = prazoDaCat({ dataAcidente: "2026-09-14", dataEmissao: "2026-09-16" });
    expect(r.texto).toContain("2 dias");
    const obito = prazoDaCat({
      dataAcidente: "2026-09-14",
      dataEmissao: "2026-09-15",
      houveObito: true,
    });
    expect(obito.texto).toContain("1 dia ");
  });
});

describe("prazoDaCat — óbito", () => {
  it("comunicação imediata: o limite é o próprio dia", () => {
    expect(
      prazoDaCat({
        dataAcidente: "2026-09-14",
        dataEmissao: "2026-09-14",
        houveObito: true,
      }).situacao
    ).toBe("EM_DIA");
  });

  it("um dia depois já é atraso, e a mensagem cita o parágrafo", () => {
    const r = prazoDaCat({
      dataAcidente: "2026-09-14",
      dataEmissao: "2026-09-15",
      houveObito: true,
    });
    expect(r.situacao).toBe("FORA_DO_PRAZO");
    expect(r.texto).toContain("imediata");
    expect(r.texto).toContain("§1º");
  });

  it("óbito na sexta comunicado na segunda é atraso, ao contrário do acidente comum", () => {
    // A regra do dia útil NÃO vale para óbito — é a distinção que este caso guarda.
    const comum = prazoDaCat({ dataAcidente: "2026-09-18", dataEmissao: "2026-09-21" });
    const obito = prazoDaCat({
      dataAcidente: "2026-09-18",
      dataEmissao: "2026-09-21",
      houveObito: true,
    });
    expect(comum.situacao).toBe("EM_DIA");
    expect(obito.situacao).toBe("FORA_DO_PRAZO");
  });
});

describe("prazoDaCat — ausências", () => {
  it("sem uma das datas não conclui nada", () => {
    expect(prazoDaCat({ dataAcidente: null, dataEmissao: "2026-09-15" }).situacao).toBe("SEM_DATA");
    expect(prazoDaCat({ dataAcidente: "2026-09-14", dataEmissao: "" }).situacao).toBe("SEM_DATA");
    expect(prazoDaCat({}).texto).toBeNull();
  });

  it("data inválida não vira conclusão", () => {
    expect(
      prazoDaCat({ dataAcidente: "quando deu", dataEmissao: "2026-09-15" }).situacao
    ).toBe("SEM_DATA");
  });

  it("aceita data com hora, como o banco devolve", () => {
    expect(
      prazoDaCat({
        dataAcidente: "2026-09-14T00:00:00.000Z",
        dataEmissao: "2026-09-19T00:00:00.000Z",
      }).situacao
    ).toBe("FORA_DO_PRAZO");
  });
});
