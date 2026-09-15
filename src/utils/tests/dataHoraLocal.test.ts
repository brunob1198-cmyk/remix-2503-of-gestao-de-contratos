import { describe, expect, it } from "vitest";
import { campoLocalDoIso, dataLocalDoIso, isoDoCampoLocal } from "../dataHoraLocal";

/**
 * Roteiro 8.2 — a validade da PT perdia um dia.
 *
 * Reproduzido no aplicativo publicado, no mesmo registro: o formulário de edição
 * mostrava "2026-09-04" e a tela de detalhe, "03/09/2026 21:00".
 *
 * OS TESTES NÃO FIXAM UM FUSO
 *
 * Seria fácil escrever `expect(iso).toBe("2026-09-04T03:00:00.000Z")` — e o teste
 * passaria só em GMT-3, quebrando no CI se ele rodar em UTC. O que estes casos
 * cobram são as propriedades que precisam valer em QUALQUER fuso:
 *
 *   - o dia local que entrou é o dia local que sai;
 *   - ida e volta não mudam o valor.
 *
 * O bug original falha nas duas em todo fuso a oeste de Greenwich.
 */

/** Como o navegador do usuário exibiria o instante — é o que ele lê na tela. */
function diaLocal(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

describe("isoDoCampoLocal", () => {
  it("preserva o dia digitado quando o campo é só data", () => {
    // O defeito: `new Date("2026-09-04")` é meia-noite UTC, e em GMT-3 volta
    // como dia 3. Aqui o dia local tem de continuar sendo o 4.
    const iso = isoDoCampoLocal("2026-09-04");
    expect(iso).not.toBeNull();
    expect(diaLocal(iso!)).toBe("2026-09-04");
  });

  it("preserva dia e hora quando o campo tem hora", () => {
    const iso = isoDoCampoLocal("2026-09-04T07:30");
    expect(campoLocalDoIso(iso)).toBe("2026-09-04T07:30");
  });

  it("meia-noite local continua sendo o mesmo dia", () => {
    // A virada do dia é onde o erro de fuso aparece; testar 12:00 esconderia.
    expect(campoLocalDoIso(isoDoCampoLocal("2026-01-01T00:00"))).toBe("2026-01-01T00:00");
    expect(campoLocalDoIso(isoDoCampoLocal("2026-12-31T23:59"))).toBe("2026-12-31T23:59");
  });

  it("vazio é ausência, não erro", () => {
    expect(isoDoCampoLocal("")).toBeNull();
    expect(isoDoCampoLocal("   ")).toBeNull();
    expect(isoDoCampoLocal(null)).toBeNull();
    expect(isoDoCampoLocal(undefined)).toBeNull();
  });

  it("texto inválido não vira uma data qualquer", () => {
    // Devolver `Invalid Date` adiante gravaria "Invalid Date" ou lançaria longe
    // daqui, onde ninguém liga o erro ao campo.
    expect(isoDoCampoLocal("quando der")).toBeNull();
    expect(isoDoCampoLocal("2026-13-45")).toBeNull();
  });
});

describe("campoLocalDoIso", () => {
  it("ida e volta não mudam o valor", () => {
    for (const texto of [
      "2026-09-04T07:30",
      "2026-03-01T00:00",
      "2026-07-15T23:45",
      "2027-02-28T12:00",
    ]) {
      expect(campoLocalDoIso(isoDoCampoLocal(texto))).toBe(texto);
    }
  });

  it("ausência vira campo vazio, não 'Invalid Date'", () => {
    expect(campoLocalDoIso(null)).toBe("");
    expect(campoLocalDoIso(undefined)).toBe("");
    expect(campoLocalDoIso("")).toBe("");
    expect(campoLocalDoIso("nao é data")).toBe("");
  });

  it("não recorta o ISO — o texto sai em hora local", () => {
    // `iso.slice(0, 16)` era o que o formulário fazia, e é o que devolvia a hora
    // UTC para um campo que o navegador exibe como local.
    const iso = isoDoCampoLocal("2026-09-04T07:30")!;
    const recortado = iso.slice(0, 16);
    const correto = campoLocalDoIso(iso);

    expect(correto).toBe("2026-09-04T07:30");
    // Em UTC os dois coincidem; em qualquer outro fuso, não. O teste vale nos dois.
    if (new Date().getTimezoneOffset() !== 0) expect(recortado).not.toBe(correto);
  });
});

describe("dataLocalDoIso", () => {
  it("devolve o dia local, que é o que o campo `date` espera", () => {
    expect(dataLocalDoIso(isoDoCampoLocal("2026-09-04"))).toBe("2026-09-04");
    expect(dataLocalDoIso(null)).toBe("");
  });
});
