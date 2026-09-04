import { describe, it, expect } from "vitest";
import {
  chaveDoRisco,
  importacaoDaApr,
  textoDaImportacao,
  validarRiscoDaPt,
  type RiscoDaApr,
} from "@/utils/sgsstPtRiscos";

const apr = (p: Partial<RiscoDaApr>): RiscoDaApr => ({
  id: p.id ?? "r1",
  perigo: p.perigo ?? "Queda de altura",
  risco: p.risco ?? "Trabalho em telhado",
  consequencia: p.consequencia ?? "Óbito",
  probabilidade: p.probabilidade ?? 3,
  severidade: p.severidade ?? 5,
  risco_catalogo_id: p.risco_catalogo_id ?? null,
});

describe("chaveDoRisco", () => {
  it("compara sem caixa e sem espaço repetido", () => {
    expect(chaveDoRisco("Queda  de Altura", "Telhado")).toBe(
      chaveDoRisco("queda de altura", "telhado")
    );
  });

  it("consequência não entra na chave", () => {
    // O mesmo perigo com a consequência redigida de outro jeito continua sendo o
    // mesmo risco; diferenciá-lo produziria linha duplicada na folha.
    expect(chaveDoRisco("Choque", "Rede energizada")).toBe(
      chaveDoRisco("Choque", "Rede energizada")
    );
  });

  it("perigos diferentes não colidem", () => {
    expect(chaveDoRisco("Choque", "Rede")).not.toBe(chaveDoRisco("Queda", "Rede"));
  });
});

describe("importacaoDaApr", () => {
  it("traz os riscos da APR que faltam na PT", () => {
    const imp = importacaoDaApr({
      riscosDaApr: [apr({ id: "a" }), apr({ id: "b", perigo: "Choque elétrico" })],
      riscosDaPt: [],
    });
    expect(imp.aImportar).toHaveLength(2);
    expect(imp.jaNaPt).toBe(0);
  });

  it("ignora o que já está na PT, em vez de recusar a importação toda", () => {
    // O caso comum: a APR ganhou um risco novo depois de a PT já ter importado os
    // primeiros. Importar só a diferença é o que se quer.
    const imp = importacaoDaApr({
      riscosDaApr: [
        apr({ id: "a", perigo: "Queda de altura", risco: "Telhado" }),
        apr({ id: "b", perigo: "Choque elétrico", risco: "Rede" }),
      ],
      riscosDaPt: [{ id: "p1", perigo: "queda de altura", risco: "telhado" }],
    });
    expect(imp.aImportar.map((r) => r.id)).toEqual(["b"]);
    expect(imp.jaNaPt).toBe(1);
  });

  it("deduplica DENTRO da APR", () => {
    // O mesmo perigo pode estar mapeado em duas etapas da APR. A PT não tem
    // etapas, então importar as duas geraria linha repetida.
    const imp = importacaoDaApr({
      riscosDaApr: [
        apr({ id: "a", perigo: "Queda", risco: "Telhado" }),
        apr({ id: "b", perigo: "Queda", risco: "Telhado" }),
      ],
      riscosDaPt: [],
    });
    expect(imp.aImportar).toHaveLength(1);
    // Repetido DENTRO da APR nao e "ja na PT": a PT esta vazia neste caso.
    expect(imp.duplicadosNaApr).toBe(1);
    expect(imp.jaNaPt).toBe(0);
  });

  it("APR sem risco não tem o que importar", () => {
    const imp = importacaoDaApr({ riscosDaApr: [], riscosDaPt: [] });
    expect(imp.aImportar).toHaveLength(0);
  });
});

describe("textoDaImportacao", () => {
  it("diz quantos vai importar antes do clique", () => {
    const t = textoDaImportacao({ aImportar: [apr({}), apr({ id: "2" })], jaNaPt: 0, duplicadosNaApr: 0 });
    expect(t).toContain("2 riscos");
  });

  it("no singular, não diz '1 riscos'", () => {
    expect(textoDaImportacao({ aImportar: [apr({})], jaNaPt: 0, duplicadosNaApr: 0 })).toContain("1 risco da");
  });

  it("avisa quando parte já está na PT", () => {
    expect(textoDaImportacao({ aImportar: [apr({})], jaNaPt: 3, duplicadosNaApr: 0 })).toContain("3 já na PT");
  });

  it("distingue 'todos já importados' de 'APR sem risco'", () => {
    // São situações diferentes e o usuário precisa saber qual é a dele: numa não há
    // nada a fazer, na outra falta mapear a APR.
    expect(textoDaImportacao({ aImportar: [], jaNaPt: 2, duplicadosNaApr: 0 })).toContain("já estão nesta PT");
    expect(textoDaImportacao({ aImportar: [], jaNaPt: 0, duplicadosNaApr: 0 })).toContain("não tem risco mapeado");
  });
});

describe("validarRiscoDaPt", () => {
  const base = { perigo: "Queda", risco: "Telhado", probabilidade: 3, severidade: 4 };

  it("aceita o preenchimento completo", () => {
    expect(validarRiscoDaPt(base).ok).toBe(true);
  });

  it("exige perigo e risco", () => {
    expect(validarRiscoDaPt({ ...base, perigo: "  " }).ok).toBe(false);
    expect(validarRiscoDaPt({ ...base, risco: "" }).ok).toBe(false);
  });

  it("recusa probabilidade e severidade fora de 1 a 5", () => {
    // Fora da faixa a matriz do projeto não sabe nomear a classificação.
    for (const v of [0, 6, -1, 2.5]) {
      expect(validarRiscoDaPt({ ...base, probabilidade: v }).ok, `P=${v}`).toBe(false);
      expect(validarRiscoDaPt({ ...base, severidade: v }).ok, `S=${v}`).toBe(false);
    }
  });

  it("a mensagem diz qual campo está errado", () => {
    const r = validarRiscoDaPt({ ...base, severidade: 9 });
    if (r.ok !== false) throw new Error("deveria recusar");
    expect(r.erro).toContain("Severidade");
  });
});

/**
 * O erro que a verificação no navegador pegou.
 *
 * O botão dizia "Importar 1 risco da APR (1 já na PT)" com a PT VAZIA. Os dois
 * casos estavam somados num contador só: o risco estava repetido em duas etapas da
 * APR, e a mensagem culpava a PT por algo que era da APR.
 */
describe("repetido na APR não é 'já na PT'", () => {
  it("com a PT vazia, jaNaPt é zero e o duplicado é contado à parte", () => {
    const imp = importacaoDaApr({
      riscosDaApr: [
        apr({ id: "a", perigo: "Choque", risco: "Rede" }),
        apr({ id: "b", perigo: "Choque", risco: "Rede" }),
      ],
      riscosDaPt: [],
    });
    expect(imp.jaNaPt).toBe(0);
    expect(imp.duplicadosNaApr).toBe(1);
    expect(textoDaImportacao(imp)).toContain("repetido(s) na APR");
    expect(textoDaImportacao(imp)).not.toContain("já na PT");
  });

  it("os dois casos juntos aparecem os dois, separados", () => {
    const imp = importacaoDaApr({
      riscosDaApr: [
        apr({ id: "a", perigo: "Queda", risco: "Telhado" }),
        apr({ id: "b", perigo: "Choque", risco: "Rede" }),
        apr({ id: "c", perigo: "Choque", risco: "Rede" }),
      ],
      riscosDaPt: [{ id: "p", perigo: "Queda", risco: "Telhado" }],
    });
    expect(imp.jaNaPt).toBe(1);
    expect(imp.duplicadosNaApr).toBe(1);
    const t = textoDaImportacao(imp);
    expect(t).toContain("1 já na PT");
    expect(t).toContain("1 repetido(s) na APR");
  });

  it("APR só com repetição distingue-se de APR sem risco", () => {
    const soRepetido = { aImportar: [], jaNaPt: 0, duplicadosNaApr: 2 };
    expect(textoDaImportacao(soRepetido)).toContain("repetidos entre etapas");
    expect(textoDaImportacao({ aImportar: [], jaNaPt: 0, duplicadosNaApr: 0 })).toContain(
      "não tem risco mapeado"
    );
  });
});

/**
 * O defeito que só apareceu conferindo o número no banco.
 *
 * Numa APR real, "Choque elétrico / Energia elétrica" estava mapeado duas vezes com
 * avaliações DIFERENTES: 3×2 = MODERADO numa etapa e 3×4 = ALTO em outra. O dedup
 * ficava com o primeiro que aparecia, levava o MODERADO para a PT e descartava em
 * silêncio a avaliação mais severa do mesmo perigo — a folha do executante passaria
 * a subestimar o risco.
 */
describe("repetido com avaliação diferente: vence o mais grave", () => {
  it("leva o de maior P × S, não o primeiro da lista", () => {
    const imp = importacaoDaApr({
      riscosDaApr: [
        apr({ id: "moderado", perigo: "Choque", risco: "Rede", probabilidade: 3, severidade: 2 }),
        apr({ id: "alto", perigo: "Choque", risco: "Rede", probabilidade: 3, severidade: 4 }),
      ],
      riscosDaPt: [],
    });
    expect(imp.aImportar).toHaveLength(1);
    expect(imp.aImportar[0].id).toBe("alto");
    expect(imp.aImportar[0].severidade).toBe(4);
  });

  it("também quando o mais grave vem PRIMEIRO", () => {
    // Sem esta, a correção poderia ter virado "vence o último" — que erra na outra
    // ordem e passaria pelo teste anterior.
    const imp = importacaoDaApr({
      riscosDaApr: [
        apr({ id: "alto", perigo: "Choque", risco: "Rede", probabilidade: 5, severidade: 5 }),
        apr({ id: "baixo", perigo: "Choque", risco: "Rede", probabilidade: 1, severidade: 1 }),
      ],
      riscosDaPt: [],
    });
    expect(imp.aImportar[0].id).toBe("alto");
  });

  it("empate mantém o primeiro, para a importação ser estável", () => {
    const imp = importacaoDaApr({
      riscosDaApr: [
        apr({ id: "primeiro", perigo: "Choque", risco: "Rede", probabilidade: 2, severidade: 3 }),
        apr({ id: "segundo", perigo: "Choque", risco: "Rede", probabilidade: 3, severidade: 2 }),
      ],
      riscosDaPt: [],
    });
    expect(imp.aImportar[0].id).toBe("primeiro");
  });

  it("preserva a ordem original dos riscos distintos", () => {
    const imp = importacaoDaApr({
      riscosDaApr: [
        apr({ id: "a", perigo: "Queda", risco: "Telhado" }),
        apr({ id: "b", perigo: "Choque", risco: "Rede" }),
        apr({ id: "c", perigo: "Queda", risco: "Telhado", probabilidade: 5, severidade: 5 }),
      ],
      riscosDaPt: [],
    });
    // "Queda" continua na frente, mesmo tendo sido substituído pelo mais grave.
    expect(imp.aImportar.map((r) => r.perigo)).toEqual(["Queda", "Choque"]);
    expect(imp.aImportar[0].id).toBe("c");
  });
});
