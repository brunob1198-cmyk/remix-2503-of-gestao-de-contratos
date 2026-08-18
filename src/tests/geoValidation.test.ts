import { describe, it, expect } from "vitest";
import { isPointInUF } from "../lib/geoUtils";

/**
 * Testes de regressão para ambiguidade de município x UF:
 * coordenadas de cidades homônimas não devem validar na UF errada.
 */
describe("isPointInUF", () => {
  it("valida Montes Claros/MG na própria UF", () => {
    expect(isPointInUF(-16.7269, -43.8609, "MG")).toBe(true);
  });

  it("não valida Montes Claros/MG no ES", () => {
    expect(isPointInUF(-16.7269, -43.8609, "ES")).toBe(false);
  });

  it("valida Bocaiúva/MG na própria UF", () => {
    expect(isPointInUF(-17.1078, -43.8135, "MG")).toBe(true);
  });

  it("valida Bocaiúva do Sul/PR na própria UF", () => {
    expect(isPointInUF(-25.2049, -49.1153, "PR")).toBe(true);
  });

  it("não valida Bocaiúva/MG no PR (municípios homônimos)", () => {
    expect(isPointInUF(-17.1078, -43.8135, "PR")).toBe(false);
  });
});
