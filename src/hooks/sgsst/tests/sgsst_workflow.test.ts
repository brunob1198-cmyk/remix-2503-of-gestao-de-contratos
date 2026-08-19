import { describe, it, expect } from "vitest";
import {
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
