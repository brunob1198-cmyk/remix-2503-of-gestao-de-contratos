import { describe, expect, it } from "vitest";
import {
  sugestaoDaCategoria,
  sugestaoDeRiscosDoAso,
  type ItemInventariadoParaSugestao,
} from "../sugestaoDeRiscosDoAso";

/**
 * Decisão 8 do dono: "sugerir sem marcar, e quem preenche decide quais valem".
 *
 * O ASO é do TRABALHADOR e o inventário é da OBRA. Pré-marcar empurraria o
 * médico a aceitar uma lista que não é exatamente a daquela pessoa — e a
 * assinatura no ASO é dele.
 */

const item = (
  perigo: string | null,
  categoria?: string | null,
  nomeCatalogo?: string
): ItemInventariadoParaSugestao => ({
  perigo,
  risco_catalogo:
    categoria === undefined && nomeCatalogo === undefined
      ? null
      : { categoria: categoria ?? null, nome: nomeCatalogo ?? null },
});

describe("sugestaoDeRiscosDoAso — agrupamento", () => {
  it("agrupa pela categoria do catálogo", () => {
    const s = sugestaoDeRiscosDoAso([
      item("Ruído da serra", "Físico"),
      item("Queda de altura", "Acidente"),
      item("Poeira de sílica", "Químico"),
    ]);

    expect(sugestaoDaCategoria(s, "FISICO")).toEqual(["Ruído da serra"]);
    expect(sugestaoDaCategoria(s, "ACIDENTE")).toEqual(["Queda de altura"]);
    expect(sugestaoDaCategoria(s, "QUIMICO")).toEqual(["Poeira de sílica"]);
  });

  it("segue a ordem das categorias da ficha, não a de chegada", () => {
    // Quem lê está percorrendo a grade de cima a baixo.
    const s = sugestaoDeRiscosDoAso([
      item("Queda", "Acidente"),
      item("Ruído", "Físico"),
    ]);
    expect(s.porCategoria.map((g) => g.categoria)).toEqual(["FISICO", "ACIDENTE"]);
  });

  it("categoria sem risco nenhum não aparece", () => {
    const s = sugestaoDeRiscosDoAso([item("Ruído", "Físico")]);
    expect(s.porCategoria).toHaveLength(1);
    expect(sugestaoDaCategoria(s, "BIOLOGICO")).toEqual([]);
  });

  it("aceita categoria com e sem acento", () => {
    // O dado vem de cadastro antigo e de digitação.
    const s = sugestaoDeRiscosDoAso([
      item("A", "Ergonômico"),
      item("B", "ergonomico"),
      item("C", "QUÍMICO"),
    ]);
    expect(sugestaoDaCategoria(s, "ERGONOMICO")).toEqual(["A", "B"]);
    expect(sugestaoDaCategoria(s, "QUIMICO")).toEqual(["C"]);
  });
});

describe("sugestaoDeRiscosDoAso — o que não tem categoria na ficha", () => {
  it("'Outros' do catálogo sai à parte, e não some", () => {
    // Descartar calado esconderia um risco que o PGR listou.
    const s = sugestaoDeRiscosDoAso([
      item("Ruído", "Físico"),
      item("Risco psicossocial", "Outros"),
    ]);

    expect(s.semCategoria).toEqual(["Risco psicossocial"]);
    expect(sugestaoDaCategoria(s, "FISICO")).toEqual(["Ruído"]);
  });

  it("item sem vínculo com o catálogo também sai à parte", () => {
    const s = sugestaoDeRiscosDoAso([item("Perigo digitado à mão")]);
    expect(s.semCategoria).toEqual(["Perigo digitado à mão"]);
    expect(s.porCategoria).toHaveLength(0);
  });

  it("categoria desconhecida não vira categoria inventada", () => {
    const s = sugestaoDeRiscosDoAso([item("X", "Radiológico")]);
    expect(s.semCategoria).toEqual(["X"]);
    expect(s.porCategoria).toHaveLength(0);
  });
});

describe("sugestaoDeRiscosDoAso — o nome exibido", () => {
  it("usa o texto do item, que é o que está escrito no PGR", () => {
    const s = sugestaoDeRiscosDoAso([item("Ruído da serra do pátio B", "Físico", "Ruído")]);
    expect(sugestaoDaCategoria(s, "FISICO")).toEqual(["Ruído da serra do pátio B"]);
  });

  it("sem texto próprio, cai no nome do catálogo", () => {
    const s = sugestaoDeRiscosDoAso([item("", "Físico", "Ruído")]);
    expect(sugestaoDaCategoria(s, "FISICO")).toEqual(["Ruído"]);
  });

  it("item sem nome nenhum é ignorado, e não vira linha em branco", () => {
    const s = sugestaoDeRiscosDoAso([item("   ", "Físico"), item(null, "Físico")]);
    expect(s.total).toBe(0);
    expect(s.porCategoria).toHaveLength(0);
  });

  it("o mesmo risco em várias atividades aparece uma vez só", () => {
    // O inventário repete o perigo por atividade; a sugestão é uma lista de
    // leitura, e repetir três vezes "Ruído" só atrapalha.
    const s = sugestaoDeRiscosDoAso([
      item("Ruído", "Físico"),
      item("Ruído", "Físico"),
      item("Calor", "Físico"),
    ]);
    expect(sugestaoDaCategoria(s, "FISICO")).toEqual(["Calor", "Ruído"]);
  });

  it("em ordem alfabética, com acento no lugar certo", () => {
    const s = sugestaoDeRiscosDoAso([
      item("Umidade", "Físico"),
      item("Água", "Físico"),
      item("Calor", "Físico"),
    ]);
    expect(sugestaoDaCategoria(s, "FISICO")).toEqual(["Água", "Calor", "Umidade"]);
  });
});

describe("sugestaoDeRiscosDoAso — bordas", () => {
  it("inventário vazio, nulo ou indefinido não quebra", () => {
    for (const entrada of [[], null, undefined]) {
      const s = sugestaoDeRiscosDoAso(entrada);
      expect(s.total).toBe(0);
      expect(s.porCategoria).toEqual([]);
      expect(s.semCategoria).toEqual([]);
    }
  });

  it("o total soma as duas listas", () => {
    const s = sugestaoDeRiscosDoAso([
      item("Ruído", "Físico"),
      item("Calor", "Físico"),
      item("Psicossocial", "Outros"),
    ]);
    expect(s.total).toBe(3);
  });
});
