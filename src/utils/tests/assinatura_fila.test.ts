import { describe, expect, it } from "vitest";
import {
  progressoDaFila,
  proximosDaVez,
  situacaoDaFila,
  vezDeAssinar,
  type SignatarioDaFila,
} from "@/utils/assinaturaFila";

const AGORA = "2026-09-11";

const s = (
  id: string,
  ordem: number,
  status: SignatarioDaFila["status"] = "PENDENTE"
): SignatarioDaFila => ({ id, nome: `Signatário ${id}`, ordem, status });

describe("situacaoDaFila", () => {
  it("fila vazia nao e nem concluida nem aguardando", () => {
    // "Todos assinaram" numa lista vazia seria verdade vacua: o documento nao
    // esta assinado, esta sem signatario.
    expect(situacaoDaFila([])).toBe("SEM_SIGNATARIOS");
  });

  it("todos assinados conclui", () => {
    expect(situacaoDaFila([s("1", 1, "ASSINADO"), s("2", 2, "ASSINADO")])).toBe("CONCLUIDA");
  });

  it("uma recusa vence ate a conclusao dos outros", () => {
    // Documento assinado por tres e recusado por um nao e assinado nem recusado.
    expect(
      situacaoDaFila([s("1", 1, "ASSINADO"), s("2", 2, "ASSINADO"), s("3", 3, "RECUSADO")])
    ).toBe("RECUSADA");
  });

  it("com pendente, aguarda", () => {
    expect(situacaoDaFila([s("1", 1, "ASSINADO"), s("2", 2)])).toBe("AGUARDANDO");
  });

  it("status desconhecido conta como pendente", () => {
    expect(situacaoDaFila([{ ...s("1", 1), status: "QUALQUER" as never }])).toBe("AGUARDANDO");
  });
});

describe("proximosDaVez", () => {
  it("um por vez na fila sequencial", () => {
    expect(proximosDaVez([s("1", 1), s("2", 2), s("3", 3)]).map((x) => x.id)).toEqual(["1"]);
  });

  it("avanca conforme assinam", () => {
    expect(
      proximosDaVez([s("1", 1, "ASSINADO"), s("2", 2), s("3", 3)]).map((x) => x.id)
    ).toEqual(["2"]);
  });

  it("ordem repetida libera os dois ao mesmo tempo", () => {
    // As duas testemunhas: exigir que a B espere a A nao representa nada do
    // mundo real e trava o documento por nada.
    expect(
      proximosDaVez([s("1", 1, "ASSINADO"), s("2", 2), s("3", 2)]).map((x) => x.id)
    ).toEqual(["2", "3"]);
  });

  it("fila concluida ou recusada nao tem proximo", () => {
    expect(proximosDaVez([s("1", 1, "ASSINADO")])).toEqual([]);
    expect(proximosDaVez([s("1", 1, "RECUSADO"), s("2", 2)])).toEqual([]);
  });

  it("ordem fora de sequencia funciona igual", () => {
    // Nada garante que venham 1,2,3 -- podem ser 10, 20, 30.
    expect(proximosDaVez([s("1", 30), s("2", 10), s("3", 20)]).map((x) => x.id)).toEqual(["2"]);
  });
});

describe("vezDeAssinar", () => {
  const fila = [s("1", 1), s("2", 2), s("3", 3)];

  it("o primeiro pode assinar", () => {
    const r = vezDeAssinar({ signatarios: fila, signatarioId: "1", agora: AGORA });
    expect(r.pode).toBe(true);
  });

  it("o segundo espera, e a mensagem diz de quem", () => {
    const r = vezDeAssinar({ signatarios: fila, signatarioId: "2", agora: AGORA });
    expect(r.pode).toBe(false);
    if (r.pode !== false) throw new Error("esperava bloqueio");
    expect(r.motivo).toContain("Ainda não é a sua vez");
    expect(r.comoResolver).toContain("Signatário 1");
  });

  it("token de quem nao esta na fila e recusado com frase propria", () => {
    const r = vezDeAssinar({ signatarios: fila, signatarioId: "inexistente", agora: AGORA });
    if (r.pode !== false) throw new Error("esperava bloqueio");
    expect(r.motivo).toContain("não corresponde");
  });

  it("quem ja assinou nao assina de novo", () => {
    const r = vezDeAssinar({
      signatarios: [s("1", 1, "ASSINADO"), s("2", 2)],
      signatarioId: "1",
      agora: AGORA,
    });
    if (r.pode !== false) throw new Error("esperava bloqueio");
    expect(r.motivo).toContain("já assinou");
  });

  it("recusa de um interrompe para os demais", () => {
    const r = vezDeAssinar({
      signatarios: [s("1", 1, "RECUSADO"), s("2", 2)],
      signatarioId: "2",
      agora: AGORA,
    });
    if (r.pode !== false) throw new Error("esperava bloqueio");
    expect(r.motivo).toContain("recusou");
  });

  it("prazo vencido impede a vez", () => {
    const r = vezDeAssinar({
      signatarios: fila,
      signatarioId: "1",
      expiraEm: "2026-09-01",
      agora: AGORA,
    });
    if (r.pode !== false) throw new Error("esperava bloqueio");
    expect(r.motivo).toContain("prazo");
  });

  it("quem assinou ANTES do prazo nao recebe mensagem de vencido", () => {
    // Vencimento derruba a vez, nao o passado: invalidar o que ja foi feito por
    // causa do relogio apagaria ato de terceiro.
    const r = vezDeAssinar({
      signatarios: [s("1", 1, "ASSINADO"), s("2", 2)],
      signatarioId: "1",
      expiraEm: "2026-09-01",
      agora: AGORA,
    });
    if (r.pode !== false) throw new Error("esperava bloqueio");
    expect(r.motivo).toContain("já assinou");
    expect(r.motivo).not.toContain("prazo");
  });

  it("prazo no futuro nao atrapalha", () => {
    expect(
      vezDeAssinar({ signatarios: fila, signatarioId: "1", expiraEm: "2026-12-31", agora: AGORA })
        .pode
    ).toBe(true);
  });

  it("prazo vazio nao vence nunca", () => {
    expect(
      vezDeAssinar({ signatarios: fila, signatarioId: "1", expiraEm: "  ", agora: AGORA }).pode
    ).toBe(true);
  });

  it("empate de ordem libera os dois", () => {
    const comEmpate = [s("1", 1, "ASSINADO"), s("2", 2), s("3", 2)];
    expect(vezDeAssinar({ signatarios: comEmpate, signatarioId: "2", agora: AGORA }).pode).toBe(true);
    expect(vezDeAssinar({ signatarios: comEmpate, signatarioId: "3", agora: AGORA }).pode).toBe(true);
  });
});

describe("progressoDaFila", () => {
  it("resume a fila para a tela do solicitante", () => {
    const r = progressoDaFila([
      s("1", 1, "ASSINADO"),
      s("2", 2),
      s("3", 2),
      s("4", 3),
    ]);
    expect(r).toEqual({
      total: 4,
      assinados: 1,
      pendentes: 3,
      recusados: 0,
      situacao: "AGUARDANDO",
      aguardando: ["Signatário 2", "Signatário 3"],
    });
  });

  it("fila concluida nao lista ninguem aguardando", () => {
    const r = progressoDaFila([s("1", 1, "ASSINADO")]);
    expect(r.situacao).toBe("CONCLUIDA");
    expect(r.aguardando).toEqual([]);
  });

  it("fila vazia nao afirma conclusao", () => {
    expect(progressoDaFila([]).situacao).toBe("SEM_SIGNATARIOS");
  });
});
