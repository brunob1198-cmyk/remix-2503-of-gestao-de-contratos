import { describe, expect, it } from "vitest";
import {
  impedimentoDaPromocao,
  payloadDaPromocao,
  tituloDoAchado,
  type InspecaoDeOrigem,
  type NcDeInspecao,
} from "../promocaoDaNcDeInspecao";

/**
 * Roteiro 9.10: "Promover uma NC da inspeção para não conformidade independente
 * → Vira registro na R10 com a origem 'inspeção' preservada."
 *
 * Metade da ponte já existia: o banco aceita `origem_tipo = 'INSPECAO'` e tem
 * `origem_id`, e a tela de detalhe da NC já renderiza o botão "voltar para a
 * inspeção de origem". O que não existia era quem gravasse — então aquele botão
 * nunca podia aparecer.
 */

const NC: NcDeInspecao = {
  id: "nc1",
  descricao: "Guarda-corpo ausente no perímetro do 3º pavimento",
  evidencia: "Foto 2 — vão aberto de 4 m",
  criticidade: "ALTA",
  responsavel_id: "u1",
  prazo: "2026-09-30",
};

const INSPECAO: InspecaoDeOrigem = {
  id: "insp1",
  codigo: "INSP-2026-0012",
  titulo: "Inspeção planejada — torre B",
  projeto_id: "proj1",
  area_id: "area1",
  data_execucao: "2026-08-20T14:00:00.000Z",
};

const HOJE = "2026-09-16";

describe("impedimentoDaPromocao", () => {
  it("achado novo pode ser promovido", () => {
    expect(impedimentoDaPromocao(NC)).toBeNull();
  });

  it("achado já promovido não vai de novo", () => {
    // Duas NCs para o mesmo desvio contam duas vezes nos indicadores — e é onde
    // a segurança é lida.
    expect(impedimentoDaPromocao({ ...NC, nc_sgsst_id: "existente" })).toBe("JA_PROMOVIDA");
  });

  it("achado sem descrição não vira NC", () => {
    expect(impedimentoDaPromocao({ ...NC, descricao: "   " })).toBe("SEM_DESCRICAO");
  });

  it("a trava é por dado, não por botão", () => {
    // O bloqueio vive no `nc_sgsst_id` gravado; dois cliques rápidos passam por
    // qualquer trava que exista só na tela.
    const promovida = { ...NC, nc_sgsst_id: "x", descricao: "" };
    expect(impedimentoDaPromocao(promovida)).toBe("JA_PROMOVIDA");
  });
});

describe("tituloDoAchado", () => {
  it("usa a descrição inteira quando ela cabe", () => {
    expect(tituloDoAchado("Guarda-corpo ausente")).toBe("Guarda-corpo ausente");
  });

  it("normaliza espaço e quebra de linha", () => {
    expect(tituloDoAchado("  Guarda-corpo\n  ausente  ")).toBe("Guarda-corpo ausente");
  });

  it("corta em espaço, não no meio da palavra", () => {
    const longo =
      "Guarda-corpo ausente no perímetro do terceiro pavimento junto à fachada norte do bloco B, trecho entre os eixos 4 e 7";
    const titulo = tituloDoAchado(longo);
    expect(titulo.length).toBeLessThanOrEqual(91);
    expect(titulo.endsWith("…")).toBe(true);
    expect(titulo).not.toMatch(/\s…$/);
    // O pedaço mantido tem de ser palavra inteira.
    expect(longo.startsWith(titulo.slice(0, -1))).toBe(true);
  });

  it("texto longo sem espaço nenhum ainda é cortado", () => {
    const semEspaco = "A".repeat(200);
    expect(tituloDoAchado(semEspaco).length).toBeLessThanOrEqual(91);
  });
});

describe("payloadDaPromocao", () => {
  const payload = payloadDaPromocao({ nc: NC, inspecao: INSPECAO, hojeIso: HOJE });

  it("preserva a origem — é o que o roteiro pede e o que o botão de volta usa", () => {
    expect(payload.origem_tipo).toBe("INSPECAO");
    expect(payload.origem_id).toBe("insp1");
  });

  it("herda obra e área da inspeção", () => {
    // `projeto_id` é NOT NULL na NC do SGSST, e NOT NULL também na inspeção —
    // então a promoção nunca fica sem obra.
    expect(payload.projeto_id).toBe("proj1");
    expect(payload.area_id).toBe("area1");
  });

  it("data de identificação é a da inspeção, não a de hoje", () => {
    // Promover um achado de três semanas atrás com a data de hoje apagaria três
    // semanas de atraso do indicador.
    expect(payload.data_identificacao).toBe("2026-08-20");
  });

  it("cai para a data planejada quando a inspeção não registrou execução", () => {
    const p = payloadDaPromocao({
      nc: NC,
      inspecao: { ...INSPECAO, data_execucao: null, data_planejada: "2026-08-18" },
      hojeIso: HOJE,
    });
    expect(p.data_identificacao).toBe("2026-08-18");
  });

  it("sem data nenhuma na inspeção, usa hoje", () => {
    const p = payloadDaPromocao({
      nc: NC,
      inspecao: { ...INSPECAO, data_execucao: null, data_planejada: null },
      hojeIso: HOJE,
    });
    expect(p.data_identificacao).toBe(HOJE);
  });

  it("a descrição carrega evidência e a inspeção de origem", () => {
    expect(payload.descricao).toContain("Guarda-corpo ausente");
    expect(payload.descricao).toContain("Foto 2");
    expect(payload.descricao).toContain("INSP-2026-0012");
  });

  it("não inventa rótulo para campo vazio", () => {
    const p = payloadDaPromocao({
      nc: { ...NC, evidencia: null, observacao: "   " },
      inspecao: INSPECAO,
      hojeIso: HOJE,
    });
    expect(p.descricao).not.toContain("Evidência:");
    expect(p.descricao).not.toContain("Observação:");
  });

  it("criticidade atravessa sem tradução", () => {
    // Os dois módulos usam BAIXA/MEDIA/ALTA/CRITICA. Traduzir aqui criaria um
    // mapeamento para manter em dois lugares.
    for (const c of ["BAIXA", "MEDIA", "ALTA", "CRITICA"]) {
      expect(payloadDaPromocao({ nc: { ...NC, criticidade: c }, inspecao: INSPECAO, hojeIso: HOJE }).criticidade).toBe(c);
    }
  });

  it("responsável e prazo do achado são mantidos", () => {
    expect(payload.responsavel_id).toBe("u1");
    expect(payload.prazo).toBe("2026-09-30");
    const semDono = payloadDaPromocao({
      nc: { ...NC, responsavel_id: null, prazo: null },
      inspecao: INSPECAO,
      hojeIso: HOJE,
    });
    expect(semDono.responsavel_id).toBeNull();
    expect(semDono.prazo).toBeNull();
  });
});
