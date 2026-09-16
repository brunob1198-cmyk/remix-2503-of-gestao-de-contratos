import { describe, expect, it } from "vitest";
import { resumoDosTamanhos, tamanhoSugerido } from "../tamanhoDoEpi";

/**
 * Roteiro 2.4: "Preencher os tamanhos de calçado, camisa e calça → Salvam e
 * REAPARECEM NA ENTREGA DE EPI."
 *
 * Salvavam. Apareciam na lista, no detalhe e no dossiê. Não chegavam à tela de
 * entrega, que tinha um campo de texto livre em branco.
 */

const BRUNO = { calcado: "41", camisa: "G", calca: "42" };

describe("tamanhoSugerido", () => {
  it("sugere o calçado para EPI de proteção dos pés", () => {
    expect(tamanhoSugerido("Proteção dos Pés", BRUNO)).toBe("41");
  });

  it.each([
    "Proteção do Corpo",
    "Proteção da Cabeça",
    "Proteção das Mãos",
    "Proteção Contra Quedas",
    "Outros",
  ])("não adivinha para %s", (categoria) => {
    // "Proteção do Corpo" é o caso perigoso: cobre camisa, calça e macacão.
    // Escolher uma delas seria o sistema inventando um número que ninguém
    // informou — o erro que este projeto já corrigiu em outros lugares.
    expect(tamanhoSugerido(categoria, BRUNO)).toBeNull();
  });

  it("sem calçado cadastrado não inventa", () => {
    expect(tamanhoSugerido("Proteção dos Pés", { camisa: "G" })).toBeNull();
    expect(tamanhoSugerido("Proteção dos Pés", { calcado: "   " })).toBeNull();
    expect(tamanhoSugerido("Proteção dos Pés", null)).toBeNull();
  });

  it("categoria ausente não sugere nada", () => {
    expect(tamanhoSugerido(null, BRUNO)).toBeNull();
    expect(tamanhoSugerido(undefined, BRUNO)).toBeNull();
    expect(tamanhoSugerido("", BRUNO)).toBeNull();
  });

  it("a comparação é exata, não por pedaço do texto", () => {
    // Evita que uma categoria nova tipo "Proteção dos Pés e Pernas" herde a
    // regra por acidente de substring.
    expect(tamanhoSugerido("Proteção dos Pés e Pernas", BRUNO)).toBeNull();
    expect(tamanhoSugerido("proteção dos pés", BRUNO)).toBeNull();
  });
});

describe("resumoDosTamanhos", () => {
  it("lista os três, na ordem em que a ficha os pede", () => {
    expect(resumoDosTamanhos(BRUNO)).toBe("calçado 41 · camisa G · calça 42");
  });

  it("mostra só o que existe", () => {
    expect(resumoDosTamanhos({ calcado: "41" })).toBe("calçado 41");
    expect(resumoDosTamanhos({ camisa: "G", calca: "42" })).toBe("camisa G · calça 42");
  });

  it("nada cadastrado devolve null, não uma linha de traços", () => {
    expect(resumoDosTamanhos({})).toBeNull();
    expect(resumoDosTamanhos({ calcado: "", camisa: null, calca: undefined })).toBeNull();
    expect(resumoDosTamanhos({ calcado: "  " })).toBeNull();
    expect(resumoDosTamanhos(null)).toBeNull();
  });
});
