import { describe, it, expect } from "vitest";
import { comoIsoLocal, hojeIso } from "@/utils/dataLocal";

/**
 * O caso que motivou o arquivo: `toISOString()` converte para UTC, e em fuso
 * negativo isso vira o dia seguinte no fim da noite. Num campo de data de
 * implementacao, grava um dia que nao aconteceu.
 */

describe("comoIsoLocal", () => {
  it("usa o calendario local, e nao UTC", () => {
    // 21:30 em Goiania (UTC-3) ja e o dia seguinte em UTC.
    const noite = new Date(2026, 8, 3, 21, 30, 0); // 03/09/2026, hora local
    expect(comoIsoLocal(noite)).toBe("2026-09-03");
  });

  it("nao adianta o dia na virada da noite", () => {
    const quaseMeiaNoite = new Date(2026, 8, 3, 23, 59, 59);
    expect(comoIsoLocal(quaseMeiaNoite)).toBe("2026-09-03");
  });

  it("nao atrasa o dia na madrugada", () => {
    // O espelho do outro erro: em fuso positivo, meia-noite local vira o dia
    // anterior em UTC.
    const madrugada = new Date(2026, 8, 4, 0, 0, 1);
    expect(comoIsoLocal(madrugada)).toBe("2026-09-04");
  });

  it("preenche mes e dia com zero a esquerda", () => {
    expect(comoIsoLocal(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(comoIsoLocal(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  it("atravessa a virada do ano sem perder o ano", () => {
    expect(comoIsoLocal(new Date(2026, 11, 31, 22, 0))).toBe("2026-12-31");
    expect(comoIsoLocal(new Date(2027, 0, 1, 1, 0))).toBe("2027-01-01");
  });

  it("dia 29 de fevereiro em ano bissexto", () => {
    expect(comoIsoLocal(new Date(2028, 1, 29))).toBe("2028-02-29");
  });
});

describe("hojeIso", () => {
  it("aceita a data injetada, para o teste nao depender do relogio", () => {
    expect(hojeIso(new Date(2026, 8, 3, 21, 30))).toBe("2026-09-03");
  });

  it("sem argumento devolve algo no formato esperado", () => {
    expect(hojeIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("difere do toISOString quando o relogio esta na faixa perigosa", () => {
    // Prova a razao de existir: as duas formas divergem, e uma delas esta errada.
    const noite = new Date(2026, 8, 3, 21, 30);
    const porUtc = noite.toISOString().split("T")[0];
    const local = hojeIso(noite);
    // Em fuso negativo divergem; em UTC ou fuso positivo coincidem. O teste
    // aceita as duas situacoes, mas fixa que o LOCAL e o dia do relogio.
    expect(local).toBe("2026-09-03");
    if (noite.getTimezoneOffset() > 0) expect(porUtc).not.toBe(local);
  });
});
