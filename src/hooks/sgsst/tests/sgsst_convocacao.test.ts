import { describe, it, expect } from "vitest";
import {
  idadeEm,
  faixaSeAplica,
  somarMeses,
  calcularConvocacao,
  ordenarPorUrgencia,
  JANELA_AVISO_DIAS,
  type SituacaoConvocacao,
} from "@/utils/sgsstConvocacao";

/**
 * Aritmética de calendário com consequência: um erro aqui deixa trabalhador sem
 * exame e a empresa sem defesa. Os testes usam data fixa — a lógica recebe `hoje`
 * por parâmetro justamente para ser testável.
 */

const HOJE = new Date(2026, 7, 20); // 20/08/2026

describe("idadeEm", () => {
  it("calcula anos completos", () => {
    expect(idadeEm("1990-08-20", HOJE)).toBe(36);
    expect(idadeEm("1990-01-01", HOJE)).toBe(36);
  });

  it("não conta o ano quando o aniversário ainda não chegou", () => {
    expect(idadeEm("1990-08-21", HOJE)).toBe(35);
    expect(idadeEm("1990-12-31", HOJE)).toBe(35);
  });

  it("conta o ano no próprio dia do aniversário", () => {
    expect(idadeEm("2000-08-20", HOJE)).toBe(26);
  });

  it("devolve null sem data de nascimento", () => {
    expect(idadeEm(null, HOJE)).toBeNull();
    expect(idadeEm(undefined, HOJE)).toBeNull();
    expect(idadeEm("", HOJE)).toBeNull();
  });

  it("devolve null para data inválida, em vez de NaN", () => {
    expect(idadeEm("data-ruim", HOJE)).toBeNull();
  });
});

describe("faixaSeAplica", () => {
  it("TODAS e faixa ausente valem para qualquer idade", () => {
    expect(faixaSeAplica("TODAS", 30)).toBe(true);
    expect(faixaSeAplica(null, 30)).toBe(true);
    expect(faixaSeAplica(undefined, 70)).toBe(true);
  });

  it("respeita os cortes da NR-07 7.5.4.2", () => {
    expect(faixaSeAplica("MENOR_18", 17)).toBe(true);
    expect(faixaSeAplica("MENOR_18", 18)).toBe(false);

    expect(faixaSeAplica("ENTRE_18_45", 18)).toBe(true);
    expect(faixaSeAplica("ENTRE_18_45", 45)).toBe(true);
    expect(faixaSeAplica("ENTRE_18_45", 46)).toBe(false);
    expect(faixaSeAplica("ENTRE_18_45", 17)).toBe(false);

    expect(faixaSeAplica("MAIOR_45", 46)).toBe(true);
    expect(faixaSeAplica("MAIOR_45", 45)).toBe(false);
  });

  it("sem idade cadastrada, convoca em vez de presumir que não se aplica", () => {
    // Deixar de convocar por falta de cadastro é o erro mais caro dos dois.
    expect(faixaSeAplica("MAIOR_45", null)).toBe(true);
    expect(faixaSeAplica("MENOR_18", null)).toBe(true);
  });
});

describe("somarMeses", () => {
  it("soma meses preservando o dia", () => {
    expect(somarMeses(new Date(2026, 0, 15), 12)).toEqual(new Date(2027, 0, 15));
    expect(somarMeses(new Date(2026, 0, 15), 6)).toEqual(new Date(2026, 6, 15));
  });

  it("não transborda para o mês seguinte quando o dia não existe", () => {
    // 31/01 + 1 mês tem de ser 28/02, não 03/03.
    expect(somarMeses(new Date(2026, 0, 31), 1)).toEqual(new Date(2026, 1, 28));
    // 2028 é bissexto: 29/02.
    expect(somarMeses(new Date(2028, 0, 31), 1)).toEqual(new Date(2028, 1, 29));
  });

  it("atravessa o ano corretamente", () => {
    expect(somarMeses(new Date(2026, 10, 30), 3)).toEqual(new Date(2027, 1, 28));
  });
});

describe("calcularConvocacao", () => {
  const calc = (ultima: string | null, meses: number | null) =>
    calcularConvocacao({ ultimaRealizacao: ultima, periodicidadeMeses: meses, hoje: HOJE });

  it("marca como vencido quem passou da data", () => {
    // Exame anual feito em 01/2025 venceu em 01/2026.
    const r = calc("2025-01-15", 12);
    expect(r.situacao).toBe("VENCIDO");
    expect(r.diasRestantes).toBeLessThan(0);
  });

  it("trata quem nunca fez o exame como vencido, não como sem base", () => {
    // Quem nunca fez é justamente quem mais precisa aparecer na convocação.
    const r = calc(null, 12);
    expect(r.situacao).toBe("VENCIDO");
    expect(r.proximoVencimento).toBeNull();
  });

  it("identifica quem vence no mês corrente", () => {
    // Feito em 08/2025, anual: vence em 08/2026, que é o mês de HOJE.
    expect(calc("2025-08-28", 12).situacao).toBe("VENCE_ESTE_MES");
  });

  it("coloca na janela de aviso quem vence dentro do prazo de antecedência", () => {
    // Vence em 10/2026, ~51 dias à frente: dentro dos 60 dias.
    const r = calc("2025-10-10", 12);
    expect(r.situacao).toBe("A_VENCER");
    expect(r.diasRestantes).toBeGreaterThan(0);
    expect(r.diasRestantes).toBeLessThanOrEqual(JANELA_AVISO_DIAS);
  });

  it("considera em dia quem está além da janela de aviso", () => {
    const r = calc("2026-06-01", 12);
    expect(r.situacao).toBe("EM_DIA");
    expect(r.diasRestantes).toBeGreaterThan(JANELA_AVISO_DIAS);
  });

  it("devolve SEM_BASE apenas quando a periodicidade não foi informada", () => {
    expect(calc("2025-01-01", null).situacao).toBe("SEM_BASE");
    expect(calc("2025-01-01", 0).situacao).toBe("SEM_BASE");
  });

  it("respeita periodicidade bienal, que é o caso de 18 a 45 anos", () => {
    // Feito em 09/2025 com 24 meses vence em 09/2027: ainda em dia.
    expect(calc("2025-09-01", 24).situacao).toBe("EM_DIA");
    // Feito em 01/2024 com 24 meses venceu em 01/2026.
    expect(calc("2024-01-01", 24).situacao).toBe("VENCIDO");
  });

  it("trata data inválida como sem base, em vez de calcular sobre NaN", () => {
    expect(calc("nao-e-data", 12).situacao).toBe("SEM_BASE");
  });
});

describe("ordenarPorUrgencia", () => {
  const item = (situacao: SituacaoConvocacao, diasRestantes: number | null, id: string) => ({
    situacao,
    diasRestantes,
    id,
  });

  it("abre pelo vencido e fecha pelo em dia", () => {
    const ordenado = ordenarPorUrgencia([
      item("EM_DIA", 200, "d"),
      item("A_VENCER", 40, "c"),
      item("VENCIDO", -10, "a"),
      item("VENCE_ESTE_MES", 5, "b"),
    ]);
    expect(ordenado.map((i) => i.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("dentro da mesma situação, mostra o mais atrasado primeiro", () => {
    const ordenado = ordenarPorUrgencia([
      item("VENCIDO", -5, "menos"),
      item("VENCIDO", -200, "mais"),
    ]);
    expect(ordenado.map((i) => i.id)).toEqual(["mais", "menos"]);
  });

  it("põe quem nunca fez o exame à frente dos demais vencidos", () => {
    // diasRestantes null = nunca realizado, o caso mais urgente.
    const ordenado = ordenarPorUrgencia([
      item("VENCIDO", -30, "atrasado"),
      item("VENCIDO", null, "nunca-fez"),
    ]);
    expect(ordenado[0].id).toBe("nunca-fez");
  });

  it("não altera o array recebido", () => {
    const original = [item("EM_DIA", 100, "x"), item("VENCIDO", -1, "y")];
    const copia = [...original];
    ordenarPorUrgencia(original);
    expect(original).toEqual(copia);
  });
});
