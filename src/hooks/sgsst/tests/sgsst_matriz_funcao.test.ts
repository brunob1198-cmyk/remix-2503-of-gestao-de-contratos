import { describe, it, expect } from "vitest";
import {
  calcularMatriz,
  situacaoEpi,
  situacaoTreinamento,
  ordenarPendencias,
  SITUACAO_ITEM_LABEL,
  type ColaboradorMatriz,
  type EntregaEpi,
  type ParticipacaoTreinamento,
} from "@/utils/sgsstMatrizFuncao";

const HOJE = new Date("2026-08-20T00:00:00");

describe("situacaoTreinamento", () => {
  it("sem participacao nenhuma, nunca foi feito", () => {
    expect(situacaoTreinamento([], "t1", HOJE)).toEqual({
      situacao: "NUNCA_FEITO",
      vencimento: null,
    });
  });

  it("aprovado sem validade nao expira", () => {
    const p: ParticipacaoTreinamento[] = [
      { colaboradorId: "c1", treinamentoId: "t1", resultado: "APROVADO", validade: null },
    ];
    expect(situacaoTreinamento(p, "t1", HOJE)).toEqual({ situacao: "OK", vencimento: null });
  });

  it("aprovado com validade futura esta em dia", () => {
    const p: ParticipacaoTreinamento[] = [
      { colaboradorId: "c1", treinamentoId: "t1", resultado: "APROVADO", validade: "2027-01-10" },
    ];
    expect(situacaoTreinamento(p, "t1", HOJE)).toEqual({
      situacao: "OK",
      vencimento: "2027-01-10",
    });
  });

  it("aprovado com validade passada esta vencido", () => {
    const p: ParticipacaoTreinamento[] = [
      { colaboradorId: "c1", treinamentoId: "t1", resultado: "APROVADO", validade: "2026-01-10" },
    ];
    expect(situacaoTreinamento(p, "t1", HOJE)).toEqual({
      situacao: "VENCIDO",
      vencimento: "2026-01-10",
    });
  });

  it("reprovado nao conta: presenca sem aprovacao nao capacita", () => {
    const p: ParticipacaoTreinamento[] = [
      { colaboradorId: "c1", treinamentoId: "t1", resultado: "REPROVADO", validade: "2027-01-10" },
    ];
    expect(situacaoTreinamento(p, "t1", HOJE).situacao).toBe("NUNCA_FEITO");
  });

  it("pendente nao conta", () => {
    const p: ParticipacaoTreinamento[] = [
      { colaboradorId: "c1", treinamentoId: "t1", resultado: "PENDENTE", validade: "2027-01-10" },
    ];
    expect(situacaoTreinamento(p, "t1", HOJE).situacao).toBe("NUNCA_FEITO");
  });

  it("com varias aprovacoes, a que vence mais tarde manda", () => {
    const p: ParticipacaoTreinamento[] = [
      { colaboradorId: "c1", treinamentoId: "t1", resultado: "APROVADO", validade: "2026-01-10" },
      { colaboradorId: "c1", treinamentoId: "t1", resultado: "APROVADO", validade: "2027-05-01" },
    ];
    // A reciclagem mais nova nao pode ser ignorada por causa da antiga vencida.
    expect(situacaoTreinamento(p, "t1", HOJE)).toEqual({
      situacao: "OK",
      vencimento: "2027-05-01",
    });
  });

  it("aprovacao perpetua vence aprovacao vencida", () => {
    const p: ParticipacaoTreinamento[] = [
      { colaboradorId: "c1", treinamentoId: "t1", resultado: "APROVADO", validade: "2026-01-10" },
      { colaboradorId: "c1", treinamentoId: "t1", resultado: "APROVADO", validade: null },
    ];
    expect(situacaoTreinamento(p, "t1", HOJE).situacao).toBe("OK");
  });

  it("ignora participacao de outro treinamento", () => {
    const p: ParticipacaoTreinamento[] = [
      { colaboradorId: "c1", treinamentoId: "OUTRO", resultado: "APROVADO", validade: null },
    ];
    expect(situacaoTreinamento(p, "t1", HOJE).situacao).toBe("NUNCA_FEITO");
  });
});

describe("situacaoEpi", () => {
  it("sem entrega, nunca recebeu", () => {
    expect(situacaoEpi([], "e1", 6, HOJE)).toEqual({
      situacao: "NUNCA_FEITO",
      vencimento: null,
    });
  });

  it("entregue sem periodicidade de troca vale para sempre", () => {
    const e: EntregaEpi[] = [
      { colaboradorId: "c1", epiId: "e1", dataEntrega: "2020-01-01" },
    ];
    expect(situacaoEpi(e, "e1", null, HOJE)).toEqual({ situacao: "OK", vencimento: null });
  });

  it("entregue dentro da periodicidade esta em dia", () => {
    const e: EntregaEpi[] = [
      { colaboradorId: "c1", epiId: "e1", dataEntrega: "2026-07-01" },
    ];
    expect(situacaoEpi(e, "e1", 6, HOJE)).toEqual({
      situacao: "OK",
      vencimento: "2027-01-01",
    });
  });

  it("entrega antiga com periodicidade vence: nao vale para sempre", () => {
    const e: EntregaEpi[] = [
      { colaboradorId: "c1", epiId: "e1", dataEntrega: "2023-01-01" },
    ];
    expect(situacaoEpi(e, "e1", 6, HOJE)).toEqual({
      situacao: "VENCIDO",
      vencimento: "2023-07-01",
    });
  });

  it("com varias entregas, a mais recente manda", () => {
    const e: EntregaEpi[] = [
      { colaboradorId: "c1", epiId: "e1", dataEntrega: "2023-01-01" },
      { colaboradorId: "c1", epiId: "e1", dataEntrega: "2026-08-01" },
    ];
    expect(situacaoEpi(e, "e1", 6, HOJE).situacao).toBe("OK");
  });

  it("periodicidade zero e tratada como sem troca programada", () => {
    const e: EntregaEpi[] = [
      { colaboradorId: "c1", epiId: "e1", dataEntrega: "2020-01-01" },
    ];
    expect(situacaoEpi(e, "e1", 0, HOJE).situacao).toBe("OK");
  });

  it("a data de vencimento nao escorrega um dia por causa de fuso", () => {
    // toISOString() daria o dia anterior em fuso positivo. Este teste falha se
    // alguem voltar a usa-lo.
    const e: EntregaEpi[] = [
      { colaboradorId: "c1", epiId: "e1", dataEntrega: "2026-08-15" },
    ];
    expect(situacaoEpi(e, "e1", 1, HOJE).vencimento).toBe("2026-09-15");
  });

  it("ignora entrega de outro EPI", () => {
    const e: EntregaEpi[] = [
      { colaboradorId: "c1", epiId: "OUTRO", dataEntrega: "2026-08-01" },
    ];
    expect(situacaoEpi(e, "e1", 6, HOJE).situacao).toBe("NUNCA_FEITO");
  });
});

describe("calcularMatriz", () => {
  const pedreiro: ColaboradorMatriz = {
    id: "c1",
    nome: "Ana Pedreira",
    funcaoId: "f1",
    funcaoNome: "Pedreiro",
    obra: "Obra Norte",
  };

  const base = {
    treinamentosPorFuncao: {
      f1: [
        { treinamentoId: "t-nr35", nome: "NR-35 Trabalho em Altura", obrigatorio: true },
        { treinamentoId: "t-opc", nome: "Curso opcional", obrigatorio: false },
      ],
    },
    episPorFuncao: {
      f1: [{ epiId: "e-capacete", nome: "Capacete", obrigatorio: true, periodicidadeTrocaMeses: 12 }],
    },
    hoje: HOJE,
  };

  it("acusa treinamento obrigatorio nunca feito e EPI nunca entregue", () => {
    const r = calcularMatriz({
      ...base,
      colaboradores: [pedreiro],
      participacoes: [],
      entregas: [],
    });

    expect(r.pendencias.map((p) => p.itemNome).sort()).toEqual([
      "Capacete",
      "NR-35 Trabalho em Altura",
    ]);
    expect(r.resumo.comPendencia).toBe(1);
    expect(r.resumo.emDia).toBe(0);
  });

  it("nao acusa item marcado como nao obrigatorio", () => {
    const r = calcularMatriz({
      ...base,
      colaboradores: [pedreiro],
      participacoes: [],
      entregas: [],
    });
    // "Curso opcional" e exigencia da funcao, mas nao obrigatoria: recomendacao
    // aparecendo como falta viraria ruido e a lista perderia credibilidade.
    expect(r.pendencias.some((p) => p.itemNome === "Curso opcional")).toBe(false);
  });

  it("colaborador com tudo em dia nao gera pendencia", () => {
    const r = calcularMatriz({
      ...base,
      colaboradores: [pedreiro],
      participacoes: [
        { colaboradorId: "c1", treinamentoId: "t-nr35", resultado: "APROVADO", validade: null },
      ],
      entregas: [{ colaboradorId: "c1", epiId: "e-capacete", dataEntrega: "2026-08-01" }],
    });

    expect(r.pendencias).toEqual([]);
    expect(r.resumo.emDia).toBe(1);
    expect(r.resumo.comPendencia).toBe(0);
  });

  it("colaborador sem funcao entra na lista, nao passa como em dia", () => {
    // Deixar de apontar e o erro caro: o trabalhador vai a campo e o sistema diz
    // que esta tudo bem.
    const r = calcularMatriz({
      ...base,
      colaboradores: [{ id: "c2", nome: "Sem Funcao", funcaoId: null }],
      participacoes: [],
      entregas: [],
    });

    expect(r.resumo.semFuncao).toBe(1);
    expect(r.resumo.emDia).toBe(0);
    expect(r.pendencias).toHaveLength(1);
    expect(r.pendencias[0].situacao).toBe("SEM_FUNCAO");
  });

  it("funcao sem exigencia cadastrada nao inventa pendencia", () => {
    const r = calcularMatriz({
      ...base,
      colaboradores: [{ id: "c3", nome: "Outra Funcao", funcaoId: "f-vazia", funcaoNome: "Servente" }],
      participacoes: [],
      entregas: [],
    });

    expect(r.pendencias).toEqual([]);
    expect(r.resumo.emDia).toBe(1);
  });

  it("participacao de outro colaborador nao cobre a pendencia deste", () => {
    const r = calcularMatriz({
      ...base,
      colaboradores: [pedreiro],
      participacoes: [
        { colaboradorId: "OUTRO", treinamentoId: "t-nr35", resultado: "APROVADO", validade: null },
      ],
      entregas: [{ colaboradorId: "OUTRO", epiId: "e-capacete", dataEntrega: "2026-08-01" }],
    });

    expect(r.pendencias).toHaveLength(2);
  });

  it("conta pendencias por tipo separadamente", () => {
    const r = calcularMatriz({
      ...base,
      colaboradores: [pedreiro],
      participacoes: [],
      entregas: [],
    });

    expect(r.resumo.pendenciasTreinamento).toBe(1);
    expect(r.resumo.pendenciasEpi).toBe(1);
  });

  it("comPendencia conta colaboradores, nao itens", () => {
    const r = calcularMatriz({
      ...base,
      colaboradores: [pedreiro],
      participacoes: [],
      entregas: [],
    });
    // Duas faltas, uma pessoa.
    expect(r.pendencias).toHaveLength(2);
    expect(r.resumo.comPendencia).toBe(1);
  });

  it("sem funcao nao entra em comPendencia, que e sobre exigencia da funcao", () => {
    const r = calcularMatriz({
      ...base,
      colaboradores: [{ id: "c2", nome: "Sem Funcao", funcaoId: null }],
      participacoes: [],
      entregas: [],
    });
    expect(r.resumo.comPendencia).toBe(0);
    expect(r.resumo.semFuncao).toBe(1);
  });

  it("chaves das pendencias sao unicas", () => {
    const r = calcularMatriz({
      ...base,
      colaboradores: [pedreiro, { ...pedreiro, id: "c9", nome: "Bruno Pedreiro" }],
      participacoes: [],
      entregas: [],
    });

    const chaves = r.pendencias.map((p) => p.chave);
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it("treinamento vencido aparece com a data de vencimento", () => {
    const r = calcularMatriz({
      ...base,
      colaboradores: [pedreiro],
      participacoes: [
        { colaboradorId: "c1", treinamentoId: "t-nr35", resultado: "APROVADO", validade: "2026-02-01" },
      ],
      entregas: [{ colaboradorId: "c1", epiId: "e-capacete", dataEntrega: "2026-08-01" }],
    });

    expect(r.pendencias).toHaveLength(1);
    expect(r.pendencias[0]).toMatchObject({
      situacao: "VENCIDO",
      vencimento: "2026-02-01",
      itemNome: "NR-35 Trabalho em Altura",
    });
  });
});

describe("ordenarPendencias", () => {
  it("nunca feito vem antes de vencido", () => {
    const ordenado = ordenarPendencias([
      { situacao: "VENCIDO" as const, colaborador: "Ana" },
      { situacao: "NUNCA_FEITO" as const, colaborador: "Bruno" },
    ]);
    expect(ordenado.map((i) => i.situacao)).toEqual(["NUNCA_FEITO", "VENCIDO"]);
  });

  it("dentro da mesma situacao, ordena por nome", () => {
    const ordenado = ordenarPendencias([
      { situacao: "VENCIDO" as const, colaborador: "Zeca" },
      { situacao: "VENCIDO" as const, colaborador: "Ana" },
    ]);
    expect(ordenado.map((i) => i.colaborador)).toEqual(["Ana", "Zeca"]);
  });

  it("nao muta a lista recebida", () => {
    const original = [
      { situacao: "VENCIDO" as const, colaborador: "Zeca" },
      { situacao: "NUNCA_FEITO" as const, colaborador: "Ana" },
    ];
    ordenarPendencias(original);
    expect(original[0].colaborador).toBe("Zeca");
  });
});

describe("rotulos", () => {
  it("toda situacao tem rotulo em portugues", () => {
    const situacoes = ["OK", "NUNCA_FEITO", "VENCIDO", "SEM_FUNCAO"] as const;
    for (const s of situacoes) {
      expect(SITUACAO_ITEM_LABEL[s]).toBeTruthy();
    }
  });
});
