import { describe, expect, it } from "vitest";
import { divergenciaDoCatalogo } from "../textoDoCatalogo";

/**
 * Roteiro 1.9. A tela do PGR mostrava o `perigo` congelado e, logo abaixo e sem
 * rótulo, o nome VIVO do catálogo. Depois de renomear, o mesmo item aparecia com
 * dois nomes e nada dizia qual ia para o PDF.
 */

describe("divergenciaDoCatalogo", () => {
  it("aponta quando o catálogo foi renomeado depois", () => {
    const r = divergenciaDoCatalogo({
      textoDoDocumento: "Ruído",
      nomeNoCatalogo: "Ruído contínuo acima de 85 dB(A)",
    });

    expect(r.divergente).toBe(true);
    expect(r.aviso).toContain("Ruído contínuo acima de 85 dB(A)");
    expect(r.aviso).toContain("Ruído");
  });

  it("textos iguais não divergem", () => {
    expect(
      divergenciaDoCatalogo({ textoDoDocumento: "Ruído", nomeNoCatalogo: "Ruído" }).divergente
    ).toBe(false);
  });

  it("caixa e espaço de sobra não contam como divergência", () => {
    // "Ruído " e "ruído" são o mesmo nome; avisar aqui seria ruído de verdade.
    expect(
      divergenciaDoCatalogo({ textoDoDocumento: " Ruído  contínuo ", nomeNoCatalogo: "ruído contínuo" })
        .divergente
    ).toBe(false);
  });

  it("item sem vínculo com o catálogo não gera aviso", () => {
    // Digitar o perigo à mão é escolha legítima, e não uma divergência.
    expect(
      divergenciaDoCatalogo({ textoDoDocumento: "Queda de andaime", nomeNoCatalogo: null })
        .divergente
    ).toBe(false);
  });

  it("documento sem texto não gera aviso", () => {
    expect(
      divergenciaDoCatalogo({ textoDoDocumento: "", nomeNoCatalogo: "Ruído" }).divergente
    ).toBe(false);
  });

  it("sem divergência o aviso sai vazio, e não com frase neutra", () => {
    expect(divergenciaDoCatalogo({ textoDoDocumento: "Ruído", nomeNoCatalogo: "Ruído" }).aviso).toBe(
      ""
    );
  });

  it("o aviso diz que o documento manda, e não só que os textos diferem", () => {
    // A pessoa precisa saber qual dos dois sai no papel, que é a pergunta que a
    // tela deixava sem resposta.
    const r = divergenciaDoCatalogo({ textoDoDocumento: "Ruído", nomeNoCatalogo: "Ruído novo" });
    expect(r.aviso).toMatch(/documento sai com/i);
  });
});
