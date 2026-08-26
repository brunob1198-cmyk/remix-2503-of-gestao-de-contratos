import { describe, it, expect } from "vitest";
import {
  calcularMatriz,
  situacaoEpi,
  situacaoTreinamento,
  ordenarPendencias,
  estadoDaContagem,
  SITUACAO_ITEM_LABEL,
  type ColaboradorMatriz,
  type ResumoDaFuncao,
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

/**
 * Recorte por função.
 *
 * O `funcaoId` na pendência e o mapa `porFuncao` existem para uma tela de função
 * responder "quem exerce isto está regular?" sem agrupar pelo NOME. Agrupar por
 * nome parece funcionar e erra em silêncio — é o que os dois últimos testes
 * daqui travam.
 */
describe("recorte por função", () => {
  const HOJE_R = new Date("2026-08-26T00:00:00");

  const exigencias = {
    treinamentosPorFuncao: {
      fA: [{ treinamentoId: "t1", nome: "NR-35", obrigatorio: true }],
      fB: [{ treinamentoId: "t1", nome: "NR-35", obrigatorio: true }],
    },
    episPorFuncao: {
      fA: [{ epiId: "e1", nome: "Cinto", obrigatorio: true, periodicidadeTrocaMeses: null }],
      fB: [],
    },
    hoje: HOJE_R,
  };

  const naFuncaoA = (id: string, nome: string): ColaboradorMatriz => ({
    id,
    nome,
    funcaoId: "fA",
    funcaoNome: "Montador",
  });

  it("conta os colaboradores de cada função separadamente", () => {
    const r = calcularMatriz({
      ...exigencias,
      colaboradores: [
        naFuncaoA("c1", "Ana"),
        naFuncaoA("c2", "Bruno"),
        { id: "c3", nome: "Carla", funcaoId: "fB", funcaoNome: "Eletricista" },
      ],
      participacoes: [],
      entregas: [],
    });

    expect(r.porFuncao.fA.colaboradores).toBe(2);
    expect(r.porFuncao.fB.colaboradores).toBe(1);
  });

  it("separa em dia de com pendência dentro da mesma função", () => {
    const r = calcularMatriz({
      ...exigencias,
      colaboradores: [naFuncaoA("c1", "Ana"), naFuncaoA("c2", "Bruno")],
      // Ana tem os dois itens; Bruno não tem nada.
      participacoes: [
        { colaboradorId: "c1", treinamentoId: "t1", resultado: "APROVADO", validade: null },
      ],
      entregas: [{ colaboradorId: "c1", epiId: "e1", dataEntrega: "2026-01-10" }],
    });

    expect(r.porFuncao.fA.emDia).toBe(1);
    expect(r.porFuncao.fA.comPendencia).toBe(1);
    expect(r.porFuncao.fA.pendenciasTreinamento).toBe(1);
    expect(r.porFuncao.fA.pendenciasEpi).toBe(1);
  });

  it("função sem ninguém não aparece no mapa — ausência que a tela lê como zero", () => {
    const r = calcularMatriz({
      ...exigencias,
      colaboradores: [naFuncaoA("c1", "Ana")],
      participacoes: [],
      entregas: [],
    });

    expect(r.porFuncao.fA).toBeDefined();
    expect(r.porFuncao.fB).toBeUndefined();
  });

  it("carrega o funcaoId em toda pendência de quem tem função", () => {
    const r = calcularMatriz({
      ...exigencias,
      colaboradores: [naFuncaoA("c1", "Ana")],
      participacoes: [],
      entregas: [],
    });

    const comFuncao = r.pendencias.filter((p) => p.situacao !== "SEM_FUNCAO");
    expect(comFuncao.length).toBeGreaterThan(0);
    for (const p of comFuncao) expect(p.funcaoId).toBe("fA");
  });

  it("pendência de colaborador sem função tem funcaoId nulo, e não um id inventado", () => {
    const r = calcularMatriz({
      ...exigencias,
      colaboradores: [{ id: "c9", nome: "Sem cargo", funcaoId: null, funcaoNome: null }],
      participacoes: [],
      entregas: [],
    });

    const item = r.pendencias.find((p) => p.situacao === "SEM_FUNCAO");
    expect(item?.funcaoId).toBeNull();
    // E não entra no recorte de nenhuma função: não se sabe qual seria.
    expect(Object.keys(r.porFuncao)).toHaveLength(0);
  });

  it("não confunde duas funções de nomes parecidos", () => {
    // O motivo de existir o funcaoId. Agrupar por nome juntaria as duas, ou o
    // `includes` de uma pegaria a outra.
    const r = calcularMatriz({
      treinamentosPorFuncao: {
        fA: [{ treinamentoId: "t1", nome: "NR-35", obrigatorio: true }],
        fB: [{ treinamentoId: "t1", nome: "NR-35", obrigatorio: true }],
      },
      episPorFuncao: { fA: [], fB: [] },
      hoje: HOJE_R,
      colaboradores: [
        { id: "c1", nome: "Ana", funcaoId: "fA", funcaoNome: "Montador" },
        { id: "c2", nome: "Bruno", funcaoId: "fB", funcaoNome: "Montador de Estruturas" },
        { id: "c3", nome: "Carla", funcaoId: "fB", funcaoNome: "Montador de Estruturas" },
      ],
      participacoes: [],
      entregas: [],
    });

    expect(r.porFuncao.fA.colaboradores).toBe(1);
    expect(r.porFuncao.fB.colaboradores).toBe(2);
  });

  it("renomear a função não muda o recorte, porque ele não usa o nome", () => {
    const comum = { ...exigencias, participacoes: [], entregas: [] };

    const antes = calcularMatriz({
      ...comum,
      colaboradores: [{ id: "c1", nome: "Ana", funcaoId: "fA", funcaoNome: "Montador" }],
    });
    const depois = calcularMatriz({
      ...comum,
      colaboradores: [{ id: "c1", nome: "Ana", funcaoId: "fA", funcaoNome: "Montador Sênior" }],
    });

    expect(depois.porFuncao.fA).toEqual(antes.porFuncao.fA);
  });
});

describe("estadoDaContagem", () => {
  const cheio: ResumoDaFuncao = {
    colaboradores: 3,
    emDia: 2,
    comPendencia: 1,
    pendenciasTreinamento: 1,
    pendenciasEpi: 0,
  };

  it("carregando vence tudo: nao se afirma nada durante a consulta", () => {
    // O caso que importa. Sem esta precedencia a tela diria "nenhum colaborador
    // nesta funcao" enquanto a matriz ainda esta sendo calculada.
    expect(estadoDaContagem({ isLoading: true, temErro: false, resumo: undefined }).tipo).toBe(
      "CALCULANDO"
    );
    expect(estadoDaContagem({ isLoading: true, temErro: true, resumo: cheio }).tipo).toBe(
      "CALCULANDO"
    );
  });

  it("erro vence zero: falhar em contar nao e contar zero", () => {
    expect(estadoDaContagem({ isLoading: false, temErro: true, resumo: undefined }).tipo).toBe(
      "ERRO"
    );
  });

  it("sem o recorte no mapa, e sem colaborador — mas so com a consulta pronta", () => {
    expect(estadoDaContagem({ isLoading: false, temErro: false, resumo: undefined }).tipo).toBe(
      "SEM_COLABORADOR"
    );
  });

  it("com recorte, devolve a contagem", () => {
    const e = estadoDaContagem({ isLoading: false, temErro: false, resumo: cheio });
    expect(e.tipo).toBe("CONTAGEM");
    if (e.tipo === "CONTAGEM") expect(e.resumo.colaboradores).toBe(3);
  });

  it("zero colaborador declarado no mapa nao vira SEM_COLABORADOR", () => {
    // Diferente de ausente: o recorte existe e diz zero. Nao deveria acontecer
    // hoje (o mapa so ganha entrada quando ha alguem), mas se passar a
    // acontecer, a tela mostra o numero em vez de trocar de estado.
    const zerado = { ...cheio, colaboradores: 0, emDia: 0, comPendencia: 0 };
    expect(estadoDaContagem({ isLoading: false, temErro: false, resumo: zerado }).tipo).toBe(
      "CONTAGEM"
    );
  });
});
