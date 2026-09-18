import { describe, expect, it } from "vitest";
import {
  ESPACO_PARA_ASSINAR,
  ancoraDoCampo,
  geometriaDoBloco,
} from "../blocoDeAssinaturaPdf";
import { alturaDeLinhas } from "@/utils/pdfTexto";
import { ancoraDe, chaveDoTexto } from "@/utils/ancoraDeAssinatura";

/**
 * Relatado: o instrutor assinou pelo link, o nome dele saiu na folha de
 * assinaturas do fim, e a linha dele dentro do documento continuou em branco.
 *
 * Eram dois defeitos encaixados: o bloco não registrava âncora, e não tinha
 * espaço livre para uma âncora ser.
 */

const METRICAS = { corpo: 8.25, nota: 7, entreBlocos: 9 };

describe("geometriaDoBloco", () => {
  it("reserva espaço de assinar ACIMA do traço", () => {
    // O defeito original: o nome era impresso colado no traço e não sobrava
    // onde assinar — nem à mão, nem por carimbo.
    const g = geometriaDoBloco(METRICAS);
    expect(g.topoDaLinha).toBe(ESPACO_PARA_ASSINAR);
    expect(g.topoDaLinha).toBeGreaterThan(0);
  });

  it("nome e papel ficam abaixo do traço, sem invadir o espaço de assinar", () => {
    const g = geometriaDoBloco(METRICAS);
    expect(g.topoDoNome).toBeGreaterThan(g.topoDaLinha);
    expect(g.topoDoPapel).toBeGreaterThan(g.topoDoNome);
  });

  it("o espaço de assinar cabe uma assinatura de próprio punho", () => {
    // ~10 mm. Menos que isso e a pessoa escreve por cima do traço.
    expect(ESPACO_PARA_ASSINAR).toBeGreaterThanOrEqual(25);
  });

  it("a altura cobre tudo o que foi desenhado", () => {
    // Antes a altura era um número escolhido à parte, e sobravam ~22pt DEPOIS
    // do papel — folga no lugar onde ninguém assina.
    const g = geometriaDoBloco(METRICAS);
    const fimDoPapel = g.topoDoPapel + alturaDeLinhas(1, METRICAS.nota);
    expect(g.altura).toBeGreaterThanOrEqual(fimDoPapel);
    // E não sobra mais que a folga declarada entre blocos.
    expect(g.altura - fimDoPapel).toBeCloseTo(METRICAS.entreBlocos, 5);
  });
});

describe("ancoraDoCampo", () => {
  const base = { jaUsadas: [], pagina: 0, x: 100, y: 500, largura: 190 };

  it("campo com nome ganha âncora no espaço acima do traço", () => {
    const a = ancoraDoCampo({ ...base, nome: "Bruno Souza" });
    expect(a).not.toBeNull();
    expect(a?.chave).toBe(chaveDoTexto("Bruno Souza"));
    // A base do retângulo é o próprio traço, e ele sobe daí.
    expect(a?.y).toBe(500);
    expect(a?.altura).toBe(ESPACO_PARA_ASSINAR);
    expect(a?.largura).toBe(190);
  });

  it("campo sem nome não ganha âncora", () => {
    // Turma sem responsável técnico cadastrado existe: a linha sai em branco e
    // não há a quem casar carimbo nenhum.
    expect(ancoraDoCampo({ ...base, nome: null })).toBeNull();
    expect(ancoraDoCampo({ ...base, nome: "   " })).toBeNull();
  });

  it("nome já ancorado na tabela não ganha segunda âncora", () => {
    // Se o instrutor também está na lista como participante, a célula dele já
    // registrou a posição. Duas âncoras com a mesma chave fariam `ancoraDe`
    // devolver nulo para AS DUAS, e o documento sairia sem carimbo nenhum.
    const a = ancoraDoCampo({
      ...base,
      nome: "Bruno Souza",
      jaUsadas: [chaveDoTexto("bruno souza")],
    });
    expect(a).toBeNull();
  });

  it("o acento e a caixa não criam uma âncora paralela", () => {
    expect(
      ancoraDoCampo({ ...base, nome: "JOÃO DA SILVA", jaUsadas: [chaveDoTexto("joao da silva")] })
    ).toBeNull();
  });

  it("a âncora criada é encontrável pelo nome do signatário", () => {
    // O elo entre as duas pontas: o carimbo procura por `ancoraDe`, e o nome do
    // signatário vem do mesmo campo da turma que o documento imprime.
    const a = ancoraDoCampo({ ...base, nome: "Marina Reis" });
    expect(a).not.toBeNull();
    expect(ancoraDe([a!], "Marina Reis")).toEqual(a);
  });
});
