import { describe, it, expect } from "vitest";
import {
  cicloDaNc,
  cicloExigeAcao,
  mensagemDoCiclo,
  acoesPendentes,
  podeEncerrar,
  mensagemBloqueioEncerramento,
  podeTransicionar,
  isStatusTerminal,
  TRANSICOES_INCIDENTE,
} from "@/utils/sgsstWorkflow";

/**
 * Substitui sgsst_incidentes.test.ts e sgsst_nao_conformidades.test.ts, que
 * declaravam as regras dentro do próprio teste e afirmavam sobre esse literal —
 * passavam mesmo com os módulos inexistentes. As regras agora vivem em
 * src/utils/sgsstWorkflow.ts, usadas por IncidentesDetail e
 * NaoConformidadesDetail, e é esse código que os testes abaixo exercitam.
 */

describe("regra de encerramento: ações pendentes bloqueiam", () => {
  const abertas = [
    { id: "1", status: "CONCLUIDA" },
    { id: "2", status: "EM_ANDAMENTO" },
  ];

  it("considera ABERTA e EM_ANDAMENTO como pendentes", () => {
    const pendentes = acoesPendentes([
      { status: "ABERTA" },
      { status: "EM_ANDAMENTO" },
      { status: "CONCLUIDA" },
      { status: "CANCELADA" },
    ]);
    expect(pendentes).toHaveLength(2);
    expect(pendentes.map((a) => a.status)).toEqual(["ABERTA", "EM_ANDAMENTO"]);
  });

  it("não trata CANCELADA como pendente — ação cancelada não deve travar o encerramento", () => {
    expect(podeEncerrar([{ status: "CANCELADA" }, { status: "CONCLUIDA" }])).toBe(true);
  });

  it("bloqueia quando há ao menos uma ação em andamento", () => {
    expect(podeEncerrar(abertas)).toBe(false);
    expect(acoesPendentes(abertas)).toHaveLength(1);
  });

  it("permite encerrar quando não há nenhuma ação", () => {
    expect(podeEncerrar([])).toBe(true);
  });

  it("preserva o objeto original, para a tela poder listar o que está bloqueando", () => {
    const pendentes = acoesPendentes(abertas);
    expect(pendentes[0]).toBe(abertas[1]);
  });
});

describe("mensagem de bloqueio", () => {
  it("concorda em número no singular", () => {
    expect(mensagemBloqueioEncerramento(1, "encerrar o incidente")).toContain("1 ação");
    expect(mensagemBloqueioEncerramento(1, "encerrar o incidente")).not.toContain("1 ações");
  });

  it("usa plural acima de um", () => {
    expect(mensagemBloqueioEncerramento(3, "solicitar verificação")).toContain("3 ações");
  });

  it("nomeia a ação bloqueada, diferente em cada módulo", () => {
    expect(mensagemBloqueioEncerramento(2, "encerrar o incidente")).toContain(
      "encerrar o incidente"
    );
    expect(mensagemBloqueioEncerramento(2, "solicitar verificação")).toContain(
      "solicitar verificação"
    );
  });
});

describe("transições de status de incidente", () => {
  it("segue o fluxo previsto de investigação até encerramento", () => {
    expect(podeTransicionar("REGISTRADO", "EM_INVESTIGACAO")).toBe(true);
    expect(podeTransicionar("EM_INVESTIGACAO", "PLANO_ACAO")).toBe(true);
    expect(podeTransicionar("PLANO_ACAO", "EM_TRATAMENTO")).toBe(true);
    expect(podeTransicionar("EM_TRATAMENTO", "ENCERRADO")).toBe(true);
  });

  it("permite cancelar de qualquer estado não terminal", () => {
    for (const s of ["REGISTRADO", "EM_INVESTIGACAO", "PLANO_ACAO", "EM_TRATAMENTO"]) {
      expect(podeTransicionar(s, "CANCELADO"), `${s} -> CANCELADO`).toBe(true);
    }
  });

  it("recusa pular etapas do fluxo", () => {
    expect(podeTransicionar("REGISTRADO", "ENCERRADO")).toBe(false);
    expect(podeTransicionar("REGISTRADO", "EM_TRATAMENTO")).toBe(false);
    expect(podeTransicionar("EM_INVESTIGACAO", "ENCERRADO")).toBe(false);
  });

  it("recusa reabrir a partir de estado terminal", () => {
    expect(podeTransicionar("ENCERRADO", "EM_TRATAMENTO")).toBe(false);
    expect(podeTransicionar("CANCELADO", "REGISTRADO")).toBe(false);
    expect(isStatusTerminal("ENCERRADO")).toBe(true);
    expect(isStatusTerminal("CANCELADO")).toBe(true);
  });

  it("não considera terminal um estado no meio do fluxo", () => {
    expect(isStatusTerminal("PLANO_ACAO")).toBe(false);
  });

  it("trata status desconhecido como sem transições, em vez de estourar", () => {
    expect(podeTransicionar("INEXISTENTE", "ENCERRADO")).toBe(false);
    expect(isStatusTerminal("INEXISTENTE")).toBe(true);
  });

  it("todo destino declarado é um status conhecido do mapa", () => {
    const conhecidos = new Set(Object.keys(TRANSICOES_INCIDENTE));
    for (const [de, destinos] of Object.entries(TRANSICOES_INCIDENTE)) {
      for (const para of destinos) {
        expect(conhecidos.has(para), `${de} -> ${para} não é um status declarado`).toBe(true);
      }
    }
  });
});

describe("cicloDaNc — em que ponto a NC realmente esta", () => {
  const acao = (status: string) => ({ status });

  it("todas as acoes concluidas e sem verificacao: AGUARDANDO_VERIFICACAO", () => {
    // O caso do roteiro 10.5. Antes disto a NC continuava mostrando so "ABERTA",
    // igual a uma recem-criada sem plano nenhum.
    expect(
      cicloDaNc({
        statusNc: "ABERTA",
        acoes: [acao("CONCLUIDA"), acao("CONCLUIDA")],
        resultadoVerificacao: null,
      })
    ).toBe("AGUARDANDO_VERIFICACAO");
  });

  it("acao concluida junto com acao cancelada ainda aguarda verificacao", () => {
    // Cancelada nao bloqueia, e houve execucao de verdade na outra.
    expect(
      cicloDaNc({ statusNc: "ABERTA", acoes: [acao("CONCLUIDA"), acao("CANCELADA")] })
    ).toBe("AGUARDANDO_VERIFICACAO");
  });

  it("TODAS canceladas nao e aguardando verificacao", () => {
    // `acoesPendentes` nao considera cancelada como pendente, entao sem uma
    // checagem propria isto diria "tudo executado" quando nada foi feito.
    expect(
      cicloDaNc({ statusNc: "ABERTA", acoes: [acao("CANCELADA"), acao("CANCELADA")] })
    ).toBe("PLANO_SEM_EXECUCAO");
  });

  it.each(["ABERTA", "EM_ANDAMENTO"])("acao %s mantem o plano em andamento", (s) => {
    expect(
      cicloDaNc({ statusNc: "ABERTA", acoes: [acao("CONCLUIDA"), acao(s)] })
    ).toBe("ACOES_EM_ANDAMENTO");
  });

  it("sem acao cadastrada nao ha plano", () => {
    expect(cicloDaNc({ statusNc: "ABERTA", acoes: [] })).toBe("SEM_PLANO");
  });

  it.each([
    ["ACEITA", "VERIFICADA_ACEITA"],
    ["REJEITADA", "VERIFICADA_REJEITADA"],
  ])("verificacao %s encerra a espera", (resultado, esperado) => {
    expect(
      cicloDaNc({
        statusNc: "ABERTA",
        acoes: [acao("CONCLUIDA")],
        resultadoVerificacao: resultado,
      })
    ).toBe(esperado);
  });

  it.each(["CONCLUIDA", "CANCELADA"])("NC %s tem ciclo encerrado", (status) => {
    // Vence tudo: nem verificacao nem estado das acoes importam depois do fim.
    expect(
      cicloDaNc({ statusNc: status, acoes: [acao("ABERTA")], resultadoVerificacao: null })
    ).toBe("ENCERRADA");
  });
});

describe("cicloExigeAcao", () => {
  it("cobra o que depende de alguem", () => {
    expect(cicloExigeAcao("AGUARDANDO_VERIFICACAO")).toBe(true);
    expect(cicloExigeAcao("VERIFICADA_REJEITADA")).toBe(true);
    expect(cicloExigeAcao("PLANO_SEM_EXECUCAO")).toBe(true);
  });

  it("nao cobra o que esta em curso normal ou encerrado", () => {
    for (const c of ["SEM_PLANO", "ACOES_EM_ANDAMENTO", "VERIFICADA_ACEITA", "ENCERRADA"] as const) {
      expect(cicloExigeAcao(c)).toBe(false);
    }
  });
});

describe("mensagemDoCiclo", () => {
  it("diz explicitamente que concluir a acao nao fecha a NC", () => {
    // E a confusao exata que o roteiro 10.5 aponta.
    const m = mensagemDoCiclo("AGUARDANDO_VERIFICACAO");
    expect(m).not.toBeNull();
    expect(m!.comoResolver).toContain("não fecha");
    expect(m!.comoResolver).toContain("Verificação");
  });

  it("cala quando nao ha nada a cobrar", () => {
    expect(mensagemDoCiclo("ACOES_EM_ANDAMENTO")).toBeNull();
    expect(mensagemDoCiclo("VERIFICADA_ACEITA")).toBeNull();
    expect(mensagemDoCiclo("ENCERRADA")).toBeNull();
  });
});
