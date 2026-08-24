import { describe, it, expect } from "vitest";
import {
  previsaoTroca,
  situacaoDoCa,
  somarMeses,
  diasEntreDatas,
  saldoDaEntrega,
  SITUACAO_VIDA_UTIL_LABEL,
  SITUACAO_CA_LABEL,
  JANELA_TROCA_DIAS,
} from "@/utils/sgsstEpiVidaUtil";

/**
 * Duas datas do módulo de EPI eram confundidas: a validade do CA (do modelo) e a
 * vida útil (da peça entregue). A confusão faz o sistema liberar entrega de peça
 * velha e barrar entrega de peça nova. Estes testes mantêm as duas separadas — e
 * cobram que sem prazo cadastrado nenhum prazo seja inventado.
 */

const HOJE = new Date(2026, 7, 22); // 22/08/2026

describe("somarMeses — o fim do mês não pode adiantar a troca", () => {
  it("soma meses simples", () => {
    expect(somarMeses("2026-01-15", 6)).toBe("2026-07-15");
  });

  it("31 de janeiro + 1 mês é 28 de fevereiro, não 3 de março", () => {
    // O JavaScript transborda para 03/03, o que adiantaria a troca em dois dias.
    expect(somarMeses("2026-01-31", 1)).toBe("2026-02-28");
  });

  it("respeita o ano bissexto", () => {
    expect(somarMeses("2028-01-31", 1)).toBe("2028-02-29");
  });

  it("31 de maio + 1 mês é 30 de junho", () => {
    expect(somarMeses("2026-05-31", 1)).toBe("2026-06-30");
  });

  it("atravessa o ano", () => {
    expect(somarMeses("2026-11-10", 4)).toBe("2027-03-10");
  });

  it("vida útil longa não perde o dia", () => {
    expect(somarMeses("2026-03-15", 60)).toBe("2031-03-15");
  });
});

describe("previsaoTroca", () => {
  it("calcula a data pela entrega mais a vida útil", () => {
    const r = previsaoTroca({
      dataEntrega: "2026-03-10",
      vidaUtilMeses: 12,
      hoje: HOJE,
    });
    expect(r.dataPrevista).toBe("2027-03-10");
    expect(r.situacao).toBe("EM_USO");
  });

  it("sem vida útil cadastrada não inventa prazo", () => {
    // Um padrao de doze meses aplicado a tudo cobraria troca de cinto de seguranca
    // no ritmo de luva de raspa, e o usuario aprenderia a ignorar o aviso.
    const r = previsaoTroca({ dataEntrega: "2026-03-10", vidaUtilMeses: null, hoje: HOJE });
    expect(r.situacao).toBe("SEM_PRAZO");
    expect(r.dataPrevista).toBeNull();
    expect(r.diasRestantes).toBeNull();
  });

  it("vida útil zero é sem prazo, não troca imediata", () => {
    const r = previsaoTroca({ dataEntrega: "2026-03-10", vidaUtilMeses: 0, hoje: HOJE });
    expect(r.situacao).toBe("SEM_PRAZO");
  });

  it("vida útil negativa também é sem prazo", () => {
    const r = previsaoTroca({ dataEntrega: "2026-03-10", vidaUtilMeses: -6, hoje: HOJE });
    expect(r.situacao).toBe("SEM_PRAZO");
  });

  it("sem data de entrega não há de onde contar", () => {
    const r = previsaoTroca({ dataEntrega: null, vidaUtilMeses: 12, hoje: HOJE });
    expect(r.situacao).toBe("SEM_PRAZO");
  });

  it("prazo já passado é troca vencida, com dias negativos", () => {
    const r = previsaoTroca({
      dataEntrega: "2025-01-10",
      vidaUtilMeses: 6,
      hoje: HOJE,
    });
    expect(r.situacao).toBe("VENCIDO");
    expect(r.diasRestantes).toBeLessThan(0);
  });

  it("dentro da janela de aviso é próximo da troca", () => {
    // Entrega em 22/08/2025 + 12 meses = 22/08/2026, que e hoje.
    const r = previsaoTroca({
      dataEntrega: "2025-08-22",
      vidaUtilMeses: 12,
      hoje: HOJE,
    });
    expect(r.situacao).toBe("PROXIMO_DA_TROCA");
    expect(r.diasRestantes).toBe(0);
  });

  it("exatamente no limite da janela, ainda avisa", () => {
    // Entrega 21/08/2026 + 1 mes = 21/09/2026, que e HOJE + 30 dias.
    const r = previsaoTroca({ dataEntrega: "2026-08-21", vidaUtilMeses: 1, hoje: HOJE });
    expect(r.diasRestantes).toBe(JANELA_TROCA_DIAS);
    expect(r.situacao).toBe("PROXIMO_DA_TROCA");
  });

  it("um dia fora da janela ainda está em uso", () => {
    // Entrega 22/08/2026 + 1 mes = 22/09/2026, que e HOJE + 31 dias.
    const r = previsaoTroca({ dataEntrega: "2026-08-22", vidaUtilMeses: 1, hoje: HOJE });
    expect(r.diasRestantes).toBe(JANELA_TROCA_DIAS + 1);
    expect(r.situacao).toBe("EM_USO");
  });

  it("janela customizada é respeitada", () => {
    const r = previsaoTroca({
      dataEntrega: "2026-08-22",
      vidaUtilMeses: 2,
      hoje: HOJE,
      janelaDias: 90,
    });
    expect(r.situacao).toBe("PROXIMO_DA_TROCA");
  });

  it("cada situação tem rótulo próprio", () => {
    const rotulos = Object.values(SITUACAO_VIDA_UTIL_LABEL);
    expect(new Set(rotulos).size).toBe(rotulos.length);
  });
});

describe("situacaoDoCa — pergunta diferente da vida útil", () => {
  it("CA distante do vencimento é válido", () => {
    expect(situacaoDoCa("2028-01-01", HOJE).situacao).toBe("VALIDO");
  });

  it("CA vencido é vencido", () => {
    const r = situacaoDoCa("2026-01-01", HOJE);
    expect(r.situacao).toBe("VENCIDO");
    expect(r.diasRestantes).toBeLessThan(0);
  });

  it("CA que vence dentro da janela avisa", () => {
    expect(situacaoDoCa("2026-09-15", HOJE).situacao).toBe("PROXIMO_DO_VENCIMENTO");
  });

  it("CA que vence hoje ainda é válido, não vencido", () => {
    // Vale o dia todo. Antecipar em um dia barraria entrega regular.
    const r = situacaoDoCa("2026-08-22", HOJE);
    expect(r.situacao).toBe("PROXIMO_DO_VENCIMENTO");
    expect(r.diasRestantes).toBe(0);
  });

  it("sem validade cadastrada não afirma nem valida nem vencida", () => {
    const r = situacaoDoCa(null, HOJE);
    expect(r.situacao).toBe("SEM_VALIDADE");
    expect(r.diasRestantes).toBeNull();
  });

  it("a janela do CA é maior que a da vida útil, e isso é intencional", () => {
    // CA vencido barra a COMPRA e a entrega de todo o lote; precisa de mais
    // antecedencia que a troca de uma peca.
    const dentroDoCa = situacaoDoCa("2026-10-10", HOJE);
    const forcaVidaUtil = previsaoTroca({
      dataEntrega: "2025-10-10",
      vidaUtilMeses: 12,
      hoje: HOJE,
    });
    expect(dentroDoCa.situacao).toBe("PROXIMO_DO_VENCIMENTO");
    expect(forcaVidaUtil.situacao).toBe("EM_USO");
  });

  it("cada situação tem rótulo próprio", () => {
    const rotulos = Object.values(SITUACAO_CA_LABEL);
    expect(new Set(rotulos).size).toBe(rotulos.length);
  });
});

describe("diasEntreDatas", () => {
  it("ignora a hora do dia", () => {
    const manha = new Date(2026, 7, 22, 7, 0, 0);
    const noite = new Date(2026, 7, 22, 23, 30, 0);
    expect(diasEntreDatas(manha, noite)).toBe(0);
  });

  it("conta negativo para o passado", () => {
    expect(diasEntreDatas(new Date(2026, 7, 22), new Date(2026, 7, 12))).toBe(-10);
  });

  it("atravessa a mudança de horário sem perder um dia", () => {
    const antes = new Date(2026, 9, 17, 12, 0, 0);
    const depois = new Date(2026, 9, 18, 12, 0, 0);
    expect(diasEntreDatas(antes, depois)).toBe(1);
  });
});

describe("saldoDaEntrega", () => {
  it("sem devolução, o saldo é a quantidade entregue", () => {
    expect(saldoDaEntrega(3, [])).toBe(3);
  });

  it("desconta as devoluções", () => {
    expect(saldoDaEntrega(3, [{ quantidade_devolvida: 1 }, { quantidade_devolvida: 1 }])).toBe(1);
  });

  it("devolução maior que a entrega não vira saldo negativo", () => {
    // O banco passou a barrar isso, mas registros anteriores a regra existem, e a
    // ficha nao deve transformar erro de lancamento em divida do trabalhador.
    expect(saldoDaEntrega(2, [{ quantidade_devolvida: 9 }])).toBe(0);
  });

  it("quantidade zero não quebra", () => {
    expect(saldoDaEntrega(0, [])).toBe(0);
  });
});
