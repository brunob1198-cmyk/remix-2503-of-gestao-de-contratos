import { describe, expect, it } from "vitest";
import {
  buscarLocalidade,
  localidadeDaResposta,
  rotuloDaLocalidade,
  ufDoCodigoIso,
} from "../localidadeDaFoto";

/**
 * O selo da foto trazia só a coordenada, e coordenada não se lê: ninguém abre
 * uma folha de inspeção e reconhece `-14.524700, -49.140800` como Uruaçu.
 */

describe("rotuloDaLocalidade", () => {
  it("junta município e UF com hífen", () => {
    expect(rotuloDaLocalidade({ municipio: "Uruaçu", uf: "GO" })).toBe("Uruaçu-GO");
  });

  it("sem UF, o município sozinho ainda informa", () => {
    // Acontece fora do Brasil: há cidade, não há unidade federativa.
    expect(rotuloDaLocalidade({ municipio: "Lisboa", uf: null })).toBe("Lisboa");
  });

  it("sem município não há rótulo, mesmo havendo UF", () => {
    // Um selo que diz apenas "GO" ao lado da coordenada não acrescenta nada ao
    // que a coordenada já diz, e parece defeito para quem lê.
    expect(rotuloDaLocalidade({ municipio: "", uf: "GO" })).toBeNull();
    expect(rotuloDaLocalidade({ municipio: "   ", uf: "GO" })).toBeNull();
    expect(rotuloDaLocalidade(null)).toBeNull();
  });

  it("a sigla sai em maiúsculas", () => {
    expect(rotuloDaLocalidade({ municipio: "Uruaçu", uf: "go" })).toBe("Uruaçu-GO");
  });
});

describe("ufDoCodigoIso", () => {
  it("recorta a sigla do código brasileiro", () => {
    expect(ufDoCodigoIso("BR-GO")).toBe("GO");
    expect(ufDoCodigoIso("br-sp")).toBe("SP");
  });

  it("recusa código de outro país", () => {
    // "US-CA" viraria "CA" — que num documento brasileiro se lê como uma UF que
    // não existe.
    expect(ufDoCodigoIso("US-CA")).toBeNull();
    expect(ufDoCodigoIso("PT-11")).toBeNull();
  });

  it("recusa lixo e vazio", () => {
    expect(ufDoCodigoIso("")).toBeNull();
    expect(ufDoCodigoIso(null)).toBeNull();
    expect(ufDoCodigoIso("Goiás")).toBeNull();
    expect(ufDoCodigoIso("BR-GOI")).toBeNull();
  });
});

describe("localidadeDaResposta", () => {
  it("lê a resposta de uma cidade", () => {
    expect(
      localidadeDaResposta({
        countryCode: "BR",
        principalSubdivisionCode: "BR-GO",
        city: "Uruaçu",
        locality: "Uruaçu",
      })
    ).toEqual({ municipio: "Uruaçu", uf: "GO" });
  });

  it("cai para locality quando city vem vazio", () => {
    // Ponto de zona rural: o serviço devolve `city` vazio e o município em
    // `locality`.
    expect(
      localidadeDaResposta({
        countryCode: "BR",
        principalSubdivisionCode: "BR-GO",
        city: "",
        locality: "Amaralina",
      })
    ).toEqual({ municipio: "Amaralina", uf: "GO" });
  });

  it("ponto no mar não vira município", () => {
    // O serviço devolve `locality: "Oceano Atlântico"` e país vazio. Sem país
    // não há divisão administrativa, e o que veio é nome de acidente geográfico.
    expect(
      localidadeDaResposta({
        countryCode: "",
        principalSubdivisionCode: "",
        city: "",
        locality: "Oceano Atlântico",
      })
    ).toBeNull();
  });

  it("fora do Brasil fica sem UF, e não com uma inventada", () => {
    expect(
      localidadeDaResposta({
        countryCode: "PT",
        principalSubdivisionCode: "PT-11",
        city: "Lisboa",
        locality: "Lisboa",
      })
    ).toEqual({ municipio: "Lisboa", uf: null });
  });

  it("resposta ausente ou sem nome nenhum devolve nulo", () => {
    expect(localidadeDaResposta(null)).toBeNull();
    expect(localidadeDaResposta({ countryCode: "BR", city: "", locality: "" })).toBeNull();
  });
});

describe("buscarLocalidade", () => {
  const resposta = (corpo: unknown, ok = true) =>
    ({ ok, json: async () => corpo }) as Response;

  it("devolve o município quando o serviço responde", async () => {
    const r = await buscarLocalidade({
      latitude: -14.5247,
      longitude: -49.1408,
      buscar: async () =>
        resposta({ countryCode: "BR", principalSubdivisionCode: "BR-GO", city: "Uruaçu" }),
    });
    expect(r).toEqual({ municipio: "Uruaçu", uf: "GO" });
  });

  it("serviço fora do ar não quebra a foto", async () => {
    // A ausência do nome é um estado normal deste selo, e não uma exceção: quem
    // chama não trata erro.
    const r = await buscarLocalidade({
      latitude: -14.5247,
      longitude: -49.1408,
      buscar: async () => {
        throw new Error("sem rede");
      },
    });
    expect(r).toBeNull();
  });

  it("resposta de erro HTTP devolve nulo", async () => {
    const r = await buscarLocalidade({
      latitude: -14.5247,
      longitude: -49.1408,
      buscar: async () => resposta({ erro: "limite" }, false),
    });
    expect(r).toBeNull();
  });

  it("corpo ilegível devolve nulo", async () => {
    const r = await buscarLocalidade({
      latitude: -14.5247,
      longitude: -49.1408,
      buscar: async () =>
        ({
          ok: true,
          json: async () => {
            throw new Error("não é json");
          },
        }) as unknown as Response,
    });
    expect(r).toBeNull();
  });

  it("coordenada inválida nem chega a consultar", async () => {
    let chamou = false;
    const r = await buscarLocalidade({
      latitude: Number.NaN,
      longitude: -49.1408,
      buscar: async () => {
        chamou = true;
        return resposta({});
      },
    });
    expect(r).toBeNull();
    expect(chamou).toBe(false);
  });

  it("a consulta leva as duas coordenadas", async () => {
    let url = "";
    await buscarLocalidade({
      latitude: -14.5247,
      longitude: -49.1408,
      buscar: async (entrada) => {
        url = String(entrada);
        return resposta({ countryCode: "BR", city: "Uruaçu" });
      },
    });
    expect(url).toContain("latitude=-14.5247");
    expect(url).toContain("longitude=-49.1408");
  });
});
