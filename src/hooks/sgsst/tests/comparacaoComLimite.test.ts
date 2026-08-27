import { describe, it, expect } from "vitest";
import {
  compararComLimite,
  textoDaComparacao,
  contradizComparacao,
} from "@/utils/sgsstRiscoLimite";

/**
 * A posição da medição em relação ao limite de tolerância.
 *
 * Este arquivo existe porque a versão anterior do módulo se RECUSAVA a comparar,
 * com o argumento de que para oxigênio em espaço confinado a NR-33 admite entrada
 * só entre 19,5% e 23% — logo um `medicao > limite` diria "conforme" no caso que
 * mata. O argumento vale para CONFORMIDADE; posição é aritmética, e é só isso que
 * estas funções devolvem.
 */

describe("compararComLimite", () => {
  it("acima: 91 contra limite 84", () => {
    const c = compararComLimite(91, 84);
    expect(c.posicao).toBe("ACIMA");
    expect(c.percentual).toBeCloseTo(8.33, 1);
  });

  it("abaixo: 80 contra limite 85", () => {
    const c = compararComLimite(80, 85);
    expect(c.posicao).toBe("ABAIXO");
    expect(c.percentual).toBeCloseTo(-5.88, 1);
  });

  it("exatamente no limite NÃO é acima", () => {
    // A NR-15 trata o limite de tolerância como o máximo admissível: o valor
    // exato ainda está dentro dele. Classificar como "acima" reprovaria uma
    // medição que a norma aceita.
    const c = compararComLimite(85, 85);
    expect(c.posicao).toBe("IGUAL");
    expect(c.percentual).toBe(0);
  });

  it("indeterminada quando falta a medição ou o limite", () => {
    for (const par of [
      [null, 85],
      [91, null],
      [undefined, 85],
      [91, undefined],
      [null, null],
    ] as const) {
      expect(compararComLimite(par[0], par[1]).posicao).toBe("INDETERMINADA");
    }
  });

  it("indeterminada para valor não finito, em vez de produzir NaN", () => {
    expect(compararComLimite(Number.NaN, 85).posicao).toBe("INDETERMINADA");
    expect(compararComLimite(91, Number.POSITIVE_INFINITY).posicao).toBe("INDETERMINADA");
  });

  it("limite zero: diz a posição e não inventa percentual", () => {
    // Dividir por zero daria Infinity, e "Infinity% acima" não informa nada.
    const c = compararComLimite(3, 0);
    expect(c.posicao).toBe("ACIMA");
    expect(c.percentual).toBeNull();
  });

  it("aceita medição zero, que é dado e não ausência", () => {
    const c = compararComLimite(0, 85);
    expect(c.posicao).toBe("ABAIXO");
  });
});

describe("textoDaComparacao", () => {
  it("arredonda para uma casa abaixo de 10% e para inteiro acima", () => {
    // Duas casas dariam falsa precisão sobre uma medição de campo.
    expect(textoDaComparacao(compararComLimite(91, 84))).toBe("8,3% acima do limite");
    expect(textoDaComparacao(compararComLimite(170, 85))).toBe("100% acima do limite");
  });

  it("diz o lado abaixo sem sinal negativo", () => {
    expect(textoDaComparacao(compararComLimite(80, 85))).toBe("5,9% abaixo do limite");
  });

  it("no limite tem frase própria", () => {
    expect(textoDaComparacao(compararComLimite(85, 85))).toBe("exatamente no limite de tolerância");
  });

  it("sem dado devolve null, para a tela não mostrar nada", () => {
    expect(textoDaComparacao(compararComLimite(null, 85))).toBeNull();
  });

  it("nunca usa a palavra conforme nem o veredito", () => {
    // O ponto central: a frase é factual. Quem decide se estar acima reprova é
    // quem preenche, porque depende do agente.
    for (const par of [
      [91, 84],
      [80, 85],
      [85, 85],
      [3, 0],
    ] as const) {
      const t = textoDaComparacao(compararComLimite(par[0], par[1])) ?? "";
      expect(t.toLowerCase()).not.toContain("conforme");
      expect(t.toLowerCase()).not.toContain("aprovad");
      expect(t.toLowerCase()).not.toContain("reprovad");
    }
  });
});

describe("contradizComparacao", () => {
  it("acusa quando o declarado é o oposto da aritmética", () => {
    expect(contradizComparacao("ABAIXO_LIMITE", compararComLimite(91, 84))).toBe(true);
    expect(contradizComparacao("ACIMA_LIMITE", compararComLimite(80, 85))).toBe(true);
  });

  it("não acusa quando declarado e aritmética concordam", () => {
    expect(contradizComparacao("ACIMA_LIMITE", compararComLimite(91, 84))).toBe(false);
    expect(contradizComparacao("ABAIXO_LIMITE", compararComLimite(80, 85))).toBe(false);
  });

  it("não acusa 'não aplicável' — é uma decisão, não uma contradição", () => {
    expect(contradizComparacao("NAO_APLICAVEL", compararComLimite(91, 84))).toBe(false);
  });

  it("não acusa quando não há conclusão declarada ainda", () => {
    expect(contradizComparacao(null, compararComLimite(91, 84))).toBe(false);
    expect(contradizComparacao(undefined, compararComLimite(91, 84))).toBe(false);
  });

  it("não acusa no limite exato, onde 'abaixo' é leitura legítima", () => {
    expect(contradizComparacao("ABAIXO_LIMITE", compararComLimite(85, 85))).toBe(false);
    expect(contradizComparacao("ACIMA_LIMITE", compararComLimite(85, 85))).toBe(false);
  });

  it("não acusa sem medição: sem dado não há contradição", () => {
    expect(contradizComparacao("ACIMA_LIMITE", compararComLimite(null, 85))).toBe(false);
  });
});
