import { describe, it, expect } from "vitest";
import {
  situacaoHigienizacao,
  proximaPrevista,
  somarDias,
  ultimaExecucao,
  foiDescartado,
  higienizacaoPendente,
  consolidarHigienizacao,
  SITUACAO_HIGIENIZACAO_LABEL,
  TIPO_MANUTENCAO_LABEL,
  RESULTADO_MANUTENCAO_LABEL,
  JANELA_HIGIENIZACAO_DIAS,
  type ExecucaoManutencao,
  type SituacaoHigienizacao,
} from "@/utils/sgsstEpiHigienizacao";

/**
 * A NR-06 6.6.1 alínea "f" cobra higienização e manutenção PERIÓDICA. O que estes
 * testes protegem é a distinção entre estados que parecem o mesmo problema e não
 * são: descartável não é "sem prazo", "sem prazo" não é "nunca feita", e "nunca
 * feita" não é "atrasada". Juntá-los num só esconde qual é a ação que resolve.
 */

const HOJE = new Date(2026, 7, 23); // 23/08/2026

function execucao(over: Partial<ExecucaoManutencao> = {}): ExecucaoManutencao {
  return {
    data_execucao: "2026-08-20",
    tipo: "HIGIENIZACAO",
    resultado: "APROVADO",
    ...over,
  };
}

function situacao(over: {
  exigeHigienizacao?: boolean | null;
  periodicidadeDias?: number | null;
  execucoes?: readonly ExecucaoManutencao[];
  janelaDias?: number;
} = {}) {
  return situacaoHigienizacao({
    exigeHigienizacao: true,
    periodicidadeDias: 30,
    execucoes: [execucao()],
    hoje: HOJE,
    ...over,
  });
}

describe("somarDias", () => {
  it("soma dias simples", () => {
    expect(somarDias("2026-08-20", 15)).toBe("2026-09-04");
  });

  it("atravessa o mês", () => {
    expect(somarDias("2026-08-25", 10)).toBe("2026-09-04");
  });

  it("atravessa o ano", () => {
    expect(somarDias("2026-12-28", 7)).toBe("2027-01-04");
  });

  it("respeita o ano bissexto", () => {
    expect(somarDias("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("ano não bissexto pula para março", () => {
    expect(somarDias("2026-02-28", 1)).toBe("2026-03-01");
  });
});

describe("proximaPrevista", () => {
  it("soma a periodicidade à data da execução", () => {
    expect(proximaPrevista("2026-08-20", 30)).toBe("2026-09-19");
  });

  it("sem periodicidade devolve nulo, não a própria data", () => {
    // Preencher com a data da execucao faria a tela cobrar de novo no mesmo dia.
    expect(proximaPrevista("2026-08-20", null)).toBeNull();
    expect(proximaPrevista("2026-08-20", 0)).toBeNull();
    expect(proximaPrevista("2026-08-20", -5)).toBeNull();
  });

  it("sem data de execução devolve nulo", () => {
    expect(proximaPrevista(null, 30)).toBeNull();
  });
});

describe("ultimaExecucao", () => {
  it("devolve a mais recente, não a primeira da lista", () => {
    const r = ultimaExecucao([
      execucao({ data_execucao: "2026-01-10" }),
      execucao({ data_execucao: "2026-08-20" }),
      execucao({ data_execucao: "2026-05-02" }),
    ]);
    expect(r?.data_execucao).toBe("2026-08-20");
  });

  it("lista vazia devolve nulo", () => {
    expect(ultimaExecucao([])).toBeNull();
  });

  it("uma só execução é a mais recente", () => {
    expect(ultimaExecucao([execucao()])?.data_execucao).toBe("2026-08-20");
  });
});

describe("foiDescartado", () => {
  it("verdadeiro quando alguma execução condenou o equipamento", () => {
    expect(foiDescartado([execucao(), execucao({ resultado: "DESCARTADO" })])).toBe(true);
  });

  it("reprovado não é descartado — aguarda decisão", () => {
    expect(foiDescartado([execucao({ resultado: "REPROVADO" })])).toBe(false);
  });

  it("lista vazia é falso", () => {
    expect(foiDescartado([])).toBe(false);
  });
});

describe("situacaoHigienizacao — os estados que não podem se confundir", () => {
  it("descartável não se aplica, mesmo sem execução nenhuma", () => {
    // Cobrar higienizacao de mascara PFF1 e ruido, e ruido ensina o usuario a
    // ignorar o aviso verdadeiro.
    const r = situacao({ exigeHigienizacao: false, execucoes: [] });
    expect(r.situacao).toBe("NAO_SE_APLICA");
  });

  it("reutilizável sem periodicidade cadastrada não está atrasado", () => {
    // Sem prazo nao existe atraso: nao ha o que comparar.
    const r = situacao({ periodicidadeDias: null, execucoes: [] });
    expect(r.situacao).toBe("SEM_PERIODICIDADE");
    expect(r.diasRestantes).toBeNull();
  });

  it("periodicidade zero conta como sem periodicidade", () => {
    expect(situacao({ periodicidadeDias: 0 }).situacao).toBe("SEM_PERIODICIDADE");
  });

  it("com prazo e sem execução nenhuma é NUNCA_REGISTRADA, não ATRASADA", () => {
    // Cadastro em falta e prazo perdido pedem acoes diferentes.
    const r = situacao({ execucoes: [] });
    expect(r.situacao).toBe("NUNCA_REGISTRADA");
    expect(r.ultimaEm).toBeNull();
  });

  it("equipamento descartado não é cobrado por higienização", () => {
    const r = situacao({ execucoes: [execucao({ resultado: "DESCARTADO" })] });
    expect(r.situacao).toBe("DESCARTADO");
  });

  it("o descarte vence até o 'não se aplica'", () => {
    // A ordem das checagens e deliberada: descarte primeiro.
    const r = situacao({
      exigeHigienizacao: false,
      execucoes: [execucao({ resultado: "DESCARTADO" })],
    });
    expect(r.situacao).toBe("DESCARTADO");
  });

  it("cada situação tem rótulo próprio, sem dois dizerem a mesma coisa", () => {
    const rotulos = Object.values(SITUACAO_HIGIENIZACAO_LABEL);
    expect(new Set(rotulos).size).toBe(rotulos.length);
  });
});

describe("situacaoHigienizacao — o cálculo do prazo", () => {
  it("execução recente com prazo folgado está em dia", () => {
    // 20/08 + 30 dias = 19/09, faltam 27 dias.
    const r = situacao();
    expect(r.situacao).toBe("EM_DIA");
    expect(r.proximaEm).toBe("2026-09-19");
    expect(r.diasRestantes).toBe(27);
  });

  it("prazo já passado está atrasado, com dias negativos", () => {
    const r = situacao({ execucoes: [execucao({ data_execucao: "2026-01-10" })] });
    expect(r.situacao).toBe("ATRASADA");
    expect(r.diasRestantes).toBeLessThan(0);
  });

  it("dentro da janela de aviso é PROXIMA", () => {
    // 20/08 + 7 dias = 27/08, faltam 4 dias — dentro da janela de 7.
    const r = situacao({ periodicidadeDias: 7 });
    expect(r.situacao).toBe("PROXIMA");
    expect(r.diasRestantes).toBe(4);
  });

  it("exatamente no limite da janela ainda avisa", () => {
    // 23/08 + 7 = 30/08, que e HOJE + 7 dias.
    const r = situacao({
      execucoes: [execucao({ data_execucao: "2026-08-23" })],
      periodicidadeDias: 7,
    });
    expect(r.diasRestantes).toBe(JANELA_HIGIENIZACAO_DIAS);
    expect(r.situacao).toBe("PROXIMA");
  });

  it("um dia fora da janela está em dia", () => {
    const r = situacao({
      execucoes: [execucao({ data_execucao: "2026-08-24" })],
      periodicidadeDias: 7,
    });
    expect(r.diasRestantes).toBe(JANELA_HIGIENIZACAO_DIAS + 1);
    expect(r.situacao).toBe("EM_DIA");
  });

  it("vencer hoje é PROXIMA, não ATRASADA", () => {
    // Ainda vale hoje. Antecipar em um dia cobraria um atraso que nao ocorreu.
    const r = situacao({
      execucoes: [execucao({ data_execucao: "2026-07-24" })],
      periodicidadeDias: 30,
    });
    expect(r.diasRestantes).toBe(0);
    expect(r.situacao).toBe("PROXIMA");
  });

  it("o prazo conta da execução MAIS RECENTE", () => {
    // Uma higienizacao antiga nao pode puxar o prazo para tras quando houve uma
    // nova depois.
    const r = situacao({
      execucoes: [
        execucao({ data_execucao: "2025-01-01" }),
        execucao({ data_execucao: "2026-08-20" }),
      ],
      periodicidadeDias: 30,
    });
    expect(r.situacao).toBe("EM_DIA");
    expect(r.ultimaEm).toBe("2026-08-20");
  });

  it("janela customizada é respeitada", () => {
    const r = situacao({ janelaDias: 60 });
    expect(r.situacao).toBe("PROXIMA");
  });
});

describe("higienizacaoPendente", () => {
  it("atrasada e nunca registrada cobram ação", () => {
    expect(higienizacaoPendente("ATRASADA")).toBe(true);
    expect(higienizacaoPendente("NUNCA_REGISTRADA")).toBe(true);
  });

  it("próxima do prazo NÃO é pendência", () => {
    // E aviso de antecedencia. Contar o que ainda esta no prazo como pendente
    // inflaria o numero que deveria alarmar.
    expect(higienizacaoPendente("PROXIMA")).toBe(false);
  });

  it("em dia, sem periodicidade, não se aplica e descartado não cobram ação", () => {
    expect(higienizacaoPendente("EM_DIA")).toBe(false);
    expect(higienizacaoPendente("SEM_PERIODICIDADE")).toBe(false);
    expect(higienizacaoPendente("NAO_SE_APLICA")).toBe(false);
    expect(higienizacaoPendente("DESCARTADO")).toBe(false);
  });
});

describe("consolidarHigienizacao", () => {
  it("conta cada situação em linha própria", () => {
    const lista: SituacaoHigienizacao[] = [
      "EM_DIA",
      "EM_DIA",
      "ATRASADA",
      "NUNCA_REGISTRADA",
      "PROXIMA",
      "DESCARTADO",
      "SEM_PERIODICIDADE",
      "NAO_SE_APLICA",
    ];

    const r = consolidarHigienizacao(lista);
    expect(r.emDia).toBe(2);
    expect(r.atrasadas).toBe(1);
    expect(r.nuncaRegistradas).toBe(1);
    expect(r.proximas).toBe(1);
    expect(r.descartados).toBe(1);
    expect(r.semPeriodicidade).toBe(1);
    expect(r.naoSeAplica).toBe(1);
  });

  it("não soma o que é diferente num só total", () => {
    // "Sem periodicidade" e "nao se aplica" ficam fora da conta e separados: um e
    // cadastro incompleto, o outro e caracteristica do equipamento.
    const r = consolidarHigienizacao(["SEM_PERIODICIDADE", "NAO_SE_APLICA"]);
    expect(r.semPeriodicidade).toBe(1);
    expect(r.naoSeAplica).toBe(1);
    expect(r.emDia).toBe(0);
    expect(r.atrasadas).toBe(0);
  });

  it("lista vazia devolve tudo zerado", () => {
    const r = consolidarHigienizacao([]);
    expect(Object.values(r).every((v) => v === 0)).toBe(true);
  });
});

describe("rótulos", () => {
  it("os três tipos de execução têm rótulo próprio", () => {
    expect(TIPO_MANUTENCAO_LABEL.HIGIENIZACAO).toBe("Higienização");
    expect(TIPO_MANUTENCAO_LABEL.MANUTENCAO).toBe("Manutenção");
    expect(TIPO_MANUTENCAO_LABEL.INSPECAO).toBe("Inspeção");
  });

  it("o resultado diz a consequência, não só o veredito", () => {
    // "Reprovado" sozinho nao diz o que fazer; "aguarda decisao" diz.
    expect(RESULTADO_MANUTENCAO_LABEL.APROVADO).toContain("volta ao uso");
    expect(RESULTADO_MANUTENCAO_LABEL.REPROVADO).toContain("aguarda decisão");
    expect(RESULTADO_MANUTENCAO_LABEL.DESCARTADO).toContain("condenado");
  });
});
