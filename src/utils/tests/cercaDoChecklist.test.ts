import { describe, expect, it } from "vitest";
import { cercaEstaConfigurada, problemaNaCerca } from "../cercaDoChecklist";

/**
 * Roteiro 15.10 — teste NEGATIVO.
 *
 * "Ativar exigir geolocalização sem informar latitude e longitude" tinha de ser
 * recusado, e não era: salvava, e na aplicação a conferência do raio era pulada
 * em silêncio porque o alvo não existia.
 */

describe("cercaEstaConfigurada", () => {
  it("reconhece uma cerca completa", () => {
    expect(
      cercaEstaConfigurada({
        latitude_alvo: -16.6799,
        longitude_alvo: -49.255,
        raio_permitido_metros: 100,
      })
    ).toBe(true);
  });

  it("aceita coordenada vinda como texto, que é o que a tela produz", () => {
    expect(
      cercaEstaConfigurada({
        latitude_alvo: "-16.6799",
        longitude_alvo: "-49.255",
        raio_permitido_metros: 100,
      })
    ).toBe(true);
  });

  it("não é cerca sem ponto alvo — era este o caso que passava batido", () => {
    expect(
      cercaEstaConfigurada({
        latitude_alvo: null,
        longitude_alvo: null,
        raio_permitido_metros: 100,
      })
    ).toBe(false);
  });

  it("não é cerca com meia coordenada", () => {
    expect(
      cercaEstaConfigurada({
        latitude_alvo: -16.6799,
        longitude_alvo: null,
        raio_permitido_metros: 100,
      })
    ).toBe(false);
  });

  it("não é cerca com raio zero — todo ponto ficaria fora", () => {
    expect(
      cercaEstaConfigurada({
        latitude_alvo: -16.6799,
        longitude_alvo: -49.255,
        raio_permitido_metros: 0,
      })
    ).toBe(false);
  });

  it("latitude zero é coordenada válida, não ausência", () => {
    // O equador existe. Testar com `if (lat)` descartaria o zero.
    expect(
      cercaEstaConfigurada({
        latitude_alvo: 0,
        longitude_alvo: 0,
        raio_permitido_metros: 50,
      })
    ).toBe(true);
  });
});

describe("problemaNaCerca", () => {
  it("deixa salvar a configuração completa", () => {
    expect(
      problemaNaCerca({ latitude: "-16.6799", longitude: "-49.255", bloquearForaRaio: true })
    ).toBeNull();
  });

  it("deixa salvar sem alvo quando não se promete bloquear nada", () => {
    // Registrar a coordenada sem conferir área é uso legítimo.
    expect(
      problemaNaCerca({ latitude: "", longitude: "", bloquearForaRaio: false })
    ).toBeNull();
  });

  it("recusa bloquear fora do raio sem ponto alvo", () => {
    const p = problemaNaCerca({ latitude: "", longitude: "", bloquearForaRaio: true });
    expect(p?.titulo).toContain("latitude e longitude");
  });

  it("recusa meia coordenada, mesmo sem bloqueio", () => {
    expect(
      problemaNaCerca({ latitude: "-16.6799", longitude: "", bloquearForaRaio: false })
    ).not.toBeNull();
    expect(
      problemaNaCerca({ latitude: "", longitude: "-49.255", bloquearForaRaio: false })
    ).not.toBeNull();
  });

  it("espaço em branco não é coordenada", () => {
    expect(
      problemaNaCerca({ latitude: "   ", longitude: "   ", bloquearForaRaio: true })
    ).not.toBeNull();
  });
});
