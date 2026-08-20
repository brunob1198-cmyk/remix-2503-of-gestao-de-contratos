import { describe, it, expect } from "vitest";
import {
  calcularRevisao,
  textoPrazoRevisao,
  SITUACAO_REVISAO_LABEL,
  JANELA_AVISO_REVISAO_DIAS,
  type SituacaoRevisao,
} from "@/utils/sgsstPgrRevisao";
import {
  alineasPendentes,
  resumoConformidade,
  type ItemInventarioConformidade,
} from "@/utils/sgsstPgrInventario";

const HOJE = new Date("2026-08-20T00:00:00");

describe("calcularRevisao", () => {
  it("conta da data de inicio quando nunca houve revisao", () => {
    // O prazo corre desde que o PGR passou a valer, nao desde uma revisao que
    // nao aconteceu.
    const r = calcularRevisao({ dataInicio: "2025-01-15", hoje: HOJE });
    expect(r.vencimento?.toISOString().slice(0, 7)).toBe("2027-01");
    expect(r.primeiraRevisao).toBe(true);
    expect(r.situacao).toBe("EM_DIA");
  });

  it("conta da ultima revisao quando ela existe", () => {
    const r = calcularRevisao({
      dataInicio: "2020-01-15",
      dataRevisao: "2026-01-15",
      hoje: HOJE,
    });
    expect(r.vencimento?.toISOString().slice(0, 7)).toBe("2028-01");
    expect(r.primeiraRevisao).toBe(false);
  });

  it("usa 24 meses por padrao", () => {
    const r = calcularRevisao({ dataRevisao: "2026-08-20", hoje: HOJE });
    // 731 e nao 730: de 20/08/2026 a 20/08/2028 passa o 29/02/2028.
    expect(r.diasRestantes).toBe(731);
    expect(r.vencimento?.getFullYear()).toBe(2028);
  });

  it("respeita periodicidade de 36 meses (sistema de gestao certificado)", () => {
    // A norma admite 3 anos nesse caso; travar em 2 acusaria vencimento falso.
    const r = calcularRevisao({
      dataRevisao: "2024-06-01",
      periodicidadeMeses: 36,
      hoje: HOJE,
    });
    expect(r.situacao).toBe("EM_DIA");

    const comPadrao = calcularRevisao({ dataRevisao: "2024-06-01", hoje: HOJE });
    expect(comPadrao.situacao).toBe("VENCIDO");
  });

  it("acusa vencido quando o prazo passou", () => {
    const r = calcularRevisao({ dataRevisao: "2023-01-10", hoje: HOJE });
    expect(r.situacao).toBe("VENCIDO");
    expect(r.diasRestantes).toBeLessThan(0);
  });

  it("avisa dentro da janela de 90 dias", () => {
    // Vence em 2026-09-01: 12 dias.
    const r = calcularRevisao({ dataRevisao: "2024-09-01", hoje: HOJE });
    expect(r.situacao).toBe("VENCE_EM_BREVE");
    expect(r.diasRestantes).toBeLessThanOrEqual(JANELA_AVISO_REVISAO_DIAS);
    expect(r.diasRestantes).toBeGreaterThanOrEqual(0);
  });

  it("vence hoje conta como a vencer, nao como vencido", () => {
    const r = calcularRevisao({ dataRevisao: "2024-08-20", hoje: HOJE });
    expect(r.diasRestantes).toBe(0);
    expect(r.situacao).toBe("VENCE_EM_BREVE");
  });

  it("PGR encerrado nao gera alerta", () => {
    // Cobrar revisao de programa encerrado e ruido.
    const r = calcularRevisao({
      dataRevisao: "2020-01-01",
      status: "ENCERRADO",
      hoje: HOJE,
    });
    expect(r.situacao).toBe("NAO_APLICAVEL");
    expect(r.vencimento).toBeNull();
  });

  it("sem nenhuma data nao inventa vencimento", () => {
    const r = calcularRevisao({ hoje: HOJE });
    expect(r.situacao).toBe("NAO_APLICAVEL");
    expect(r.diasRestantes).toBeNull();
  });

  it("periodicidade zero ou negativa nao gera vencimento", () => {
    expect(calcularRevisao({ dataRevisao: "2020-01-01", periodicidadeMeses: 0, hoje: HOJE })
      .situacao).toBe("NAO_APLICAVEL");
  });

  it("toda situacao tem rotulo", () => {
    const todas: SituacaoRevisao[] = ["VENCIDO", "VENCE_EM_BREVE", "EM_DIA", "NAO_APLICAVEL"];
    for (const s of todas) expect(SITUACAO_REVISAO_LABEL[s]).toBeTruthy();
  });
});

describe("textoPrazoRevisao", () => {
  it("mostra atraso em dias", () => {
    const r = calcularRevisao({ dataRevisao: "2023-01-10", hoje: HOJE });
    expect(textoPrazoRevisao(r)).toMatch(/dias em atraso$/);
  });

  it("mostra 'vence hoje'", () => {
    const r = calcularRevisao({ dataRevisao: "2024-08-20", hoje: HOJE });
    expect(textoPrazoRevisao(r)).toBe("vence hoje");
  });

  it("singulariza um dia", () => {
    const r = calcularRevisao({ dataRevisao: "2024-08-21", hoje: HOJE });
    expect(textoPrazoRevisao(r)).toBe("em 1 dia");
  });

  it("devolve travessao quando nao se aplica", () => {
    expect(textoPrazoRevisao(calcularRevisao({ hoje: HOJE }))).toBe("—");
  });
});

/** Item que atende todas as alíneas, base para variar um campo por teste. */
const ITEM_COMPLETO: ItemInventarioConformidade = {
  atividade: "Corte de concreto",
  perigo: "Poeira de sílica cristalina",
  consequencia: "Silicose",
  fonte_geradora: "Serra de corte",
  descricao_local: "Pavimento térreo, ambiente fechado sem exaustão",
  tipo_exposicao: "HABITUAL",
  tempo_exposicao: "4h/dia",
  totalFuncoes: 2,
  probabilidade: 3,
  severidade: 4,
  medidas_existentes: "Umidificação e máscara PFF2",
  tecnica_avaliacao: "QUALITATIVA",
};

describe("alineasPendentes", () => {
  it("item completo nao acusa nada", () => {
    expect(alineasPendentes(ITEM_COMPLETO)).toEqual([]);
  });

  it("acusa perigo ausente", () => {
    const faltas = alineasPendentes({ ...ITEM_COMPLETO, perigo: "" });
    expect(faltas.map((f) => f.alinea)).toContain("a");
  });

  it("acusa consequencia ausente", () => {
    expect(alineasPendentes({ ...ITEM_COMPLETO, consequencia: null }).map((f) => f.alinea))
      .toContain("b");
  });

  it("acusa fonte geradora ausente", () => {
    expect(alineasPendentes({ ...ITEM_COMPLETO, fonte_geradora: "   " }).map((f) => f.alinea))
      .toContain("c");
  });

  it("aceita area vinculada em vez de descricao do local", () => {
    const faltas = alineasPendentes({
      ...ITEM_COMPLETO,
      descricao_local: null,
      area_id: "area-1",
    });
    expect(faltas.map((f) => f.alinea)).not.toContain("d");
  });

  it("acusa local quando nao ha area nem descricao", () => {
    const faltas = alineasPendentes({
      ...ITEM_COMPLETO,
      descricao_local: null,
      area_id: null,
    });
    expect(faltas.map((f) => f.alinea)).toContain("d");
  });

  it("acusa caracterizacao da exposicao ausente", () => {
    expect(alineasPendentes({ ...ITEM_COMPLETO, tipo_exposicao: null }).map((f) => f.alinea))
      .toContain("e");
  });

  it("aceita grupo descrito em texto quando nao ha funcao vinculada", () => {
    const faltas = alineasPendentes({
      ...ITEM_COMPLETO,
      totalFuncoes: 0,
      grupos_expostos: "Terceiros da empreiteira de fundação",
    });
    expect(faltas.map((f) => f.alinea)).not.toContain("f");
  });

  it("quantidade de expostos nao substitui a identificacao do grupo", () => {
    // A norma pede QUAIS grupos. Um numero nao identifica ninguem.
    const faltas = alineasPendentes({
      ...ITEM_COMPLETO,
      totalFuncoes: 0,
      grupos_expostos: null,
      trabalhadores_expostos: 12,
    });
    expect(faltas.map((f) => f.alinea)).toContain("f");
  });

  it("acusa avaliacao incompleta", () => {
    expect(alineasPendentes({ ...ITEM_COMPLETO, severidade: null }).map((f) => f.alinea))
      .toContain("g");
    expect(alineasPendentes({ ...ITEM_COMPLETO, probabilidade: null }).map((f) => f.alinea))
      .toContain("g");
  });

  it("acusa medidas existentes em branco", () => {
    expect(alineasPendentes({ ...ITEM_COMPLETO, medidas_existentes: "" }).map((f) => f.alinea))
      .toContain("h");
  });

  it("nao cobra medicao de avaliacao qualitativa", () => {
    // Exigir dosimetro para risco de queda seria cobranca indevida, e ensinaria
    // o usuario a ignorar o aviso.
    const faltas = alineasPendentes({
      ...ITEM_COMPLETO,
      tecnica_avaliacao: "QUALITATIVA",
      intensidade_medida: null,
    });
    expect(faltas.map((f) => f.alinea)).not.toContain("i");
  });

  it("cobra medicao de avaliacao quantitativa", () => {
    const faltas = alineasPendentes({
      ...ITEM_COMPLETO,
      tecnica_avaliacao: "QUANTITATIVA",
      intensidade_medida: null,
    });
    expect(faltas.map((f) => f.alinea)).toContain("i");
  });

  it("com intensidade mas sem data, cobra a data", () => {
    const faltas = alineasPendentes({
      ...ITEM_COMPLETO,
      tecnica_avaliacao: "QUANTITATIVA",
      intensidade_medida: 92,
      data_medicao: null,
    });
    expect(faltas.find((f) => f.alinea === "i")?.titulo).toBe("Data da medição");
  });

  it("com intensidade e data mas sem conclusao, cobra a conclusao", () => {
    const faltas = alineasPendentes({
      ...ITEM_COMPLETO,
      tecnica_avaliacao: "QUANTITATIVA",
      intensidade_medida: 92,
      data_medicao: "2026-05-10",
      resultado_avaliacao: null,
    });
    expect(faltas.find((f) => f.alinea === "i")?.titulo).toBe("Conclusão da medição");
  });

  it("quantitativa completa nao acusa nada", () => {
    const faltas = alineasPendentes({
      ...ITEM_COMPLETO,
      tecnica_avaliacao: "QUANTITATIVA",
      intensidade_medida: 92,
      data_medicao: "2026-05-10",
      resultado_avaliacao: "ACIMA_LIMITE",
    });
    expect(faltas).toEqual([]);
  });

  it("intensidade zero conta como medida, nao como ausente", () => {
    const faltas = alineasPendentes({
      ...ITEM_COMPLETO,
      tecnica_avaliacao: "QUANTITATIVA",
      intensidade_medida: 0,
      data_medicao: "2026-05-10",
      resultado_avaliacao: "ABAIXO_LIMITE",
    });
    expect(faltas).toEqual([]);
  });

  it("item vazio acusa varias alineas de uma vez", () => {
    const faltas = alineasPendentes({});
    expect(faltas.length).toBeGreaterThanOrEqual(7);
    // Ordem da norma, para quem confere de norma na mao acompanhar.
    expect(faltas.map((f) => f.alinea)).toEqual([...faltas.map((f) => f.alinea)].sort());
  });
});

describe("resumoConformidade", () => {
  it("inventario vazio nao tem incompleto", () => {
    const r = resumoConformidade([]);
    expect(r).toMatchObject({ total: 0, completos: 0, incompletos: 0 });
    expect(r.alineasMaisAusentes).toEqual([]);
  });

  it("conta completos e incompletos", () => {
    const r = resumoConformidade([ITEM_COMPLETO, { ...ITEM_COMPLETO, perigo: "" }]);
    expect(r).toMatchObject({ total: 2, completos: 1, incompletos: 1 });
  });

  it("ranqueia a alinea mais ausente primeiro", () => {
    const semExposicao = { ...ITEM_COMPLETO, tipo_exposicao: null };
    const r = resumoConformidade([
      semExposicao,
      semExposicao,
      { ...ITEM_COMPLETO, perigo: "" },
    ]);
    expect(r.alineasMaisAusentes[0]).toMatchObject({ alinea: "e", ocorrencias: 2 });
  });

  it("nao conta a mesma alinea duas vezes para o mesmo item", () => {
    const r = resumoConformidade([{ ...ITEM_COMPLETO, tipo_exposicao: null }]);
    const e = r.alineasMaisAusentes.find((a) => a.alinea === "e");
    expect(e?.ocorrencias).toBe(1);
  });
});
