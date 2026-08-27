import { describe, it, expect } from "vitest";
import {
  periodoDoPgr,
  dentroDoPeriodo,
  resumoAcidentesPgr,
  achadosDosAcidentes,
  hhtDoPeriodo,
  type IncidenteDoPgr,
} from "@/utils/sgsstPgrAcidentes";

const PGR = "pgr-1";

const inc = (over: Partial<IncidenteDoPgr>): IncidenteDoPgr => ({
  id: over.id ?? "i1",
  titulo: over.titulo ?? "Ocorrencia",
  tipo: over.tipo ?? "Acidente",
  data_ocorrencia: over.data_ocorrencia ?? "2026-05-10",
  ...over,
});

describe("periodo do PGR", () => {
  it("vai do inicio declarado ate a data de apuracao", () => {
    expect(periodoDoPgr("2026-01-15", "2026-08-27")).toEqual({
      de: "2026-01-15",
      ate: "2026-08-27",
    });
  });

  it("nao usa a proxima revisao como fim: ela e futuro", () => {
    // O documento nao pode listar acidente que ainda nao aconteceu como se o
    // periodo estivesse fechado.
    const p = periodoDoPgr("2026-01-15", "2026-08-27");
    expect(p.ate).toBe("2026-08-27");
  });

  it("aceita timestamp e corta na data", () => {
    expect(periodoDoPgr("2026-01-15T03:00:00Z", "2026-08-27T21:40:00Z").de).toBe("2026-01-15");
  });

  it("inclui as datas das pontas", () => {
    const p = periodoDoPgr("2026-01-15", "2026-08-27");
    expect(dentroDoPeriodo("2026-01-15", p)).toBe(true);
    expect(dentroDoPeriodo("2026-08-27", p)).toBe(true);
    expect(dentroDoPeriodo("2026-01-14", p)).toBe(false);
    expect(dentroDoPeriodo("2026-08-28", p)).toBe(false);
  });
});

describe("resumo dos acidentes", () => {
  it("separa acidente de quase-acidente", () => {
    const r = resumoAcidentesPgr({
      pgrId: PGR,
      incidentes: [
        inc({ id: "a", tipo: "Acidente com Afastamento", dias_perdidos: 10 }),
        inc({ id: "b", tipo: "Acidente sem Afastamento" }),
        inc({ id: "c", tipo: "Quase Acidente" }),
      ],
    });
    expect(r.acidentes).toBe(2);
    expect(r.quaseAcidentes).toBe(1);
    expect(r.comAfastamento).toBe(1);
    expect(r.semAfastamento).toBe(1);
  });

  it("conta como afastamento o que tem dias perdidos, mesmo com tipo genérico", () => {
    // Reaproveita a regra de `comAfastamento`: deixar de contar subestimaria a
    // taxa, que e o erro que faz o indicador mentir para melhor.
    const r = resumoAcidentesPgr({
      pgrId: PGR,
      incidentes: [inc({ tipo: "Acidente", dias_perdidos: 15 })],
    });
    expect(r.comAfastamento).toBe(1);
  });

  it("separa o que estava previsto NESTE PGR do que nao tinha vinculo", () => {
    const r = resumoAcidentesPgr({
      pgrId: PGR,
      incidentes: [
        inc({ id: "a", pgr_id: PGR }),
        inc({ id: "b", pgr_id: "outro-pgr" }),
        inc({ id: "c", pgr_id: null }),
      ],
    });
    expect(r.comRiscoPrevisto).toBe(1);
    expect(r.semVinculo).toBe(2);
  });

  it("cobra CAT so de quem afastou", () => {
    const r = resumoAcidentesPgr({
      pgrId: PGR,
      incidentes: [
        inc({ id: "a", tipo: "Acidente com Afastamento", dias_perdidos: 5, cat_emitida: false }),
        inc({ id: "b", tipo: "Acidente sem Afastamento", cat_emitida: false }),
      ],
    });
    expect(r.semCat).toBe(1);
  });

  it("sem HHT as taxas ficam NULAS, e nao zero", () => {
    // Zero afirmaria "nenhum acidente por milhao de horas". Nulo diz "nao da
    // para calcular", que e a verdade.
    const r = resumoAcidentesPgr({
      pgrId: PGR,
      incidentes: [inc({ tipo: "Acidente com Afastamento", dias_perdidos: 10 })],
    });
    expect(r.taxaFrequencia).toBeNull();
    expect(r.taxaGravidade).toBeNull();
    expect(r.semHht).toBe(true);
  });

  it("com HHT calcula as duas taxas na base de um milhao de horas", () => {
    const r = resumoAcidentesPgr({
      pgrId: PGR,
      hht: 200000,
      incidentes: [inc({ tipo: "Acidente com Afastamento", dias_perdidos: 20, dias_debitados: 0 })],
    });
    expect(r.taxaFrequencia).toBeCloseTo(5, 5);
    expect(r.taxaGravidade).toBeCloseTo(100, 5);
    expect(r.semHht).toBe(false);
  });

  it("soma dias debitados na gravidade", () => {
    // A NBR 14280 atribui dias fixos a perda permanente; ignora-los faria um
    // obito pesar menos que um afastamento longo.
    const r = resumoAcidentesPgr({
      pgrId: PGR,
      hht: 1000000,
      incidentes: [inc({ tipo: "Acidente com Afastamento", dias_perdidos: 10, dias_debitados: 6000 })],
    });
    expect(r.taxaGravidade).toBeCloseTo(6010, 5);
  });

  it("periodo sem ocorrencia devolve tudo zerado, sem taxa inventada", () => {
    const r = resumoAcidentesPgr({ pgrId: PGR, incidentes: [], hht: 100000 });
    expect(r.total).toBe(0);
    expect(r.taxaFrequencia).toBe(0);
    expect(achadosDosAcidentes(r)).toEqual([]);
  });
});

describe("achados", () => {
  it("nao conclui que falta risco no inventario", () => {
    // O ponto central do arquivo: vinculo ausente pode ser cadastro que ninguem
    // ligou. Acusar falha de inventario seria afirmar mais que o dado sustenta.
    const r = resumoAcidentesPgr({
      pgrId: PGR,
      incidentes: [inc({ pgr_id: null })],
    });
    const texto = achadosDosAcidentes(r).join(" ");
    expect(texto).toContain("sem vínculo");
    expect(texto).toMatch(/vale conferir|pode ser/);
    expect(texto).not.toMatch(/risco ausente do inventário|falta no inventário/);
  });

  it("aponta a medida, e nao o inventario, quando o risco estava previsto", () => {
    const r = resumoAcidentesPgr({ pgrId: PGR, incidentes: [inc({ pgr_id: PGR })] });
    expect(achadosDosAcidentes(r).join(" ")).toContain("medida de controle");
  });

  it("explica por que a taxa fica em branco sem HHT", () => {
    const r = resumoAcidentesPgr({ pgrId: PGR, incidentes: [inc({})] });
    expect(achadosDosAcidentes(r).join(" ")).toContain("em branco em vez de zero");
  });

  it("silencio total quando nao houve ocorrencia", () => {
    expect(achadosDosAcidentes(resumoAcidentesPgr({ pgrId: PGR, incidentes: [] }))).toEqual([]);
  });
});

describe("HHT do periodo", () => {
  const registros = [
    { projeto_id: "p1", ano: 2026, mes: 1, horas: 10000 },
    { projeto_id: "p1", ano: 2026, mes: 2, horas: 12000 },
    { projeto_id: "p1", ano: 2026, mes: 9, horas: 9000 },
    { projeto_id: "p2", ano: 2026, mes: 1, horas: 50000 },
  ];

  it("soma so os meses dentro do periodo e do projeto", () => {
    const { horas, meses } = hhtDoPeriodo(
      registros,
      periodoDoPgr("2026-01-15", "2026-02-20"),
      "p1"
    );
    expect(horas).toBe(22000);
    expect(meses).toEqual(["01/2026", "02/2026"]);
  });

  it("ignora outro projeto, mesmo no mesmo mes", () => {
    const { horas } = hhtDoPeriodo(registros, periodoDoPgr("2026-01-01", "2026-01-31"), "p1");
    expect(horas).toBe(10000);
  });

  it("mes de ponta entra inteiro, e os meses somados sao devolvidos", () => {
    // O periodo comeca no dia 15, mas o HHT e mensal: nao existe meio mes para
    // somar. A base fica a vista para quem confere a taxa.
    const { meses } = hhtDoPeriodo(registros, periodoDoPgr("2026-01-15", "2026-01-20"), "p1");
    expect(meses).toEqual(["01/2026"]);
  });

  it("sem registro devolve NULL, e nao zero", () => {
    // Zero dividiria e produziria taxa infinita, ou uma taxa que parece
    // calculada. Nulo diz que nao ha base.
    const { horas, meses } = hhtDoPeriodo([], periodoDoPgr("2026-01-01", "2026-12-31"), "p1");
    expect(horas).toBeNull();
    expect(meses).toEqual([]);
  });

  it("atravessa a virada do ano", () => {
    const r = [
      { projeto_id: "p1", ano: 2025, mes: 12, horas: 8000 },
      { projeto_id: "p1", ano: 2026, mes: 1, horas: 9000 },
    ];
    expect(hhtDoPeriodo(r, periodoDoPgr("2025-12-01", "2026-01-31"), "p1").horas).toBe(17000);
  });
});
