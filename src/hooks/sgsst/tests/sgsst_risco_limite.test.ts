import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  formatarLimite,
  limitePendente,
  parseLimite,
  TECNICA_LABEL,
  TECNICA_AJUDA,
} from "@/utils/sgsstRiscoLimite";
import { RISCOS_PADRAO } from "@/utils/sgsstRiscosDefaults";

describe("formatarLimite", () => {
  it("junta numero e unidade", () => {
    expect(formatarLimite(85, "dB(A)")).toBe("85 dB(A)");
  });

  it("usa virgula como separador decimal", () => {
    expect(formatarLimite(0.05, "mg/m³")).toBe("0,05 mg/m³");
  });

  it("nao arredonda: limite de tolerancia e dado normativo", () => {
    expect(formatarLimite(20.9, "% O₂")).toBe("20,9 % O₂");
  });

  it("devolve null quando nao ha limite, para a tela decidir o que mostrar", () => {
    expect(formatarLimite(null, "dB(A)")).toBeNull();
    expect(formatarLimite(undefined, "dB(A)")).toBeNull();
  });

  it("aceita limite sem unidade, mesmo sendo cadastro incompleto", () => {
    expect(formatarLimite(85, null)).toBe("85");
  });

  it("trata zero como limite valido, nao como ausencia", () => {
    // Zero e diferente de "nao informado": ha agente cujo limite tolerado e nulo.
    expect(formatarLimite(0, "ppm")).toBe("0 ppm");
  });
});

describe("parseLimite", () => {
  it("aceita ponto e virgula como separador decimal", () => {
    expect(parseLimite("0,05")).toBe(0.05);
    expect(parseLimite("0.05")).toBe(0.05);
  });

  it("texto vazio significa 'sem limite', nao erro", () => {
    expect(parseLimite("")).toBeNull();
    expect(parseLimite("   ")).toBeNull();
  });

  it("devolve undefined em texto invalido, para o formulario avisar", () => {
    // O risco a evitar e gravar 0 silenciosamente quando o usuario digitou algo
    // que nao e numero.
    expect(parseLimite("oitenta e cinco")).toBeUndefined();
    expect(parseLimite("85 dB")).toBeUndefined();
  });

  it("rejeita negativo: nao existe limite de tolerancia negativo", () => {
    expect(parseLimite("-5")).toBeUndefined();
  });

  it("aceita zero", () => {
    expect(parseLimite("0")).toBe(0);
  });

  it("ida e volta preserva o valor", () => {
    const original = "0,05";
    const numero = parseLimite(original);
    expect(formatarLimite(numero as number, "mg/m³")).toBe("0,05 mg/m³");
  });
});

describe("limitePendente", () => {
  it("aponta quantitativo sem limite", () => {
    expect(limitePendente({ tecnica_avaliacao: "QUANTITATIVA", limite_tolerancia: null })).toBe(
      true
    );
  });

  it("quantitativo com limite nao e pendencia", () => {
    expect(limitePendente({ tecnica_avaliacao: "QUANTITATIVA", limite_tolerancia: 85 })).toBe(
      false
    );
  });

  it("qualitativo sem limite nao e pendencia: nao se mede o que se avalia por inspecao", () => {
    expect(limitePendente({ tecnica_avaliacao: "QUALITATIVA", limite_tolerancia: null })).toBe(
      false
    );
  });

  it("tecnica nao definida nao e acusada de pendencia de limite", () => {
    // A pendencia dele e outra (definir a tecnica), e nao deve poluir este indicador.
    expect(limitePendente({ tecnica_avaliacao: null, limite_tolerancia: null })).toBe(false);
    expect(limitePendente({})).toBe(false);
  });

  it("limite zero conta como definido", () => {
    expect(limitePendente({ tecnica_avaliacao: "QUANTITATIVA", limite_tolerancia: 0 })).toBe(
      false
    );
  });
});

describe("catalogo padrao", () => {
  it("todo risco declara a tecnica de avaliacao", () => {
    const sem = RISCOS_PADRAO.filter((r) => !r.tecnica_avaliacao);
    expect(sem.map((r) => r.codigo)).toEqual([]);
  });

  it("todo risco declara a base legal", () => {
    const sem = RISCOS_PADRAO.filter((r) => !r.base_legal?.trim());
    expect(sem.map((r) => r.codigo)).toEqual([]);
  });

  it("todo limite semeado vem acompanhado de unidade", () => {
    // Numero sem unidade imprimiria "85" no PGR sem dizer 85 do que.
    const orfaos = RISCOS_PADRAO.filter(
      (r) => r.limite_tolerancia !== undefined && !r.unidade_medida
    );
    expect(orfaos.map((r) => r.codigo)).toEqual([]);
  });

  it("todo quantitativo tem unidade, mesmo quando o limite depende da substancia", () => {
    const sem = RISCOS_PADRAO.filter(
      (r) => r.tecnica_avaliacao === "QUANTITATIVA" && !r.unidade_medida
    );
    expect(sem.map((r) => r.codigo)).toEqual([]);
  });

  it("qualitativo nao carrega limite numerico", () => {
    const inconsistentes = RISCOS_PADRAO.filter(
      (r) => r.tecnica_avaliacao === "QUALITATIVA" && r.limite_tolerancia !== undefined
    );
    expect(inconsistentes.map((r) => r.codigo)).toEqual([]);
  });

  it("o ruido continuo traz o limite fechado da NR-15 Anexo 1", () => {
    // O unico limite semeado com numero, porque e o unico que a norma fecha sem
    // depender de substancia ou regime de trabalho.
    const ruido = RISCOS_PADRAO.find((r) => r.codigo === "FIS-01");
    expect(ruido?.limite_tolerancia).toBe(85);
    expect(ruido?.unidade_medida).toBe("dB(A)");
    expect(ruido?.base_legal).toContain("NR-15 Anexo 1");
  });

  it("os limites semeados se restringem ao que a norma fecha", () => {
    // Guarda contra alguem semear um numero generico para agente quimico: o
    // limite do Anexo 11 varia por substancia e por tempo de exposicao.
    const comNumero = RISCOS_PADRAO.filter((r) => r.limite_tolerancia !== undefined).map(
      (r) => r.codigo
    );
    expect(comNumero).toEqual(["FIS-01"]);
  });

  it("codigos sao unicos: o seed usa codigo para nao duplicar", () => {
    const codigos = RISCOS_PADRAO.map((r) => r.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
  });

  it("toda tecnica usada tem rotulo e texto de ajuda na interface", () => {
    for (const r of RISCOS_PADRAO) {
      if (!r.tecnica_avaliacao) continue;
      expect(TECNICA_LABEL[r.tecnica_avaliacao]).toBeTruthy();
      expect(TECNICA_AJUDA[r.tecnica_avaliacao]).toBeTruthy();
    }
  });
});

/**
 * O catalogo chega ao banco por dois caminhos: o botao "usar catalogo padrao",
 * que insere RISCOS_PADRAO, e a migration 20260820140000, que enriquece linhas
 * ja existentes. Se os dois divergirem, duas empresas ficam com base legal
 * diferente para o mesmo risco — e ninguem descobre, porque cada tela parece
 * certa isoladamente. Este bloco compara os dois lados.
 */
describe("migration e catalogo padrao coincidem", () => {
  interface ValoresSql {
    limite_tolerancia?: number;
    unidade_medida?: string;
    tecnica_avaliacao?: string;
    base_legal?: string;
  }

  const sql = readFileSync(
    resolve(
      __dirname,
      "../../../../supabase/migrations/20260820140000_catalogo_riscos_limite_tolerancia.sql"
    ),
    "utf-8"
  );

  /** Extrai, por codigo, os valores que a migration semeia. */
  const porCodigo = new Map<string, ValoresSql>();

  for (const bloco of sql.split(/UPDATE\s+public\.sgsst_riscos_catalogo\s+SET/i).slice(1)) {
    // O fim do statement é o primeiro ";" DEPOIS do WHERE — vários textos de
    // base legal contêm ponto-e-vírgula ("...minerais; limite calculado..."),
    // e cortar no primeiro ";" decapitava o WHERE desses blocos.
    const indiceWhere = bloco.search(/\bWHERE\b/i);
    const indiceFim = bloco.indexOf(";", indiceWhere);
    const corpo = indiceFim === -1 ? bloco : bloco.slice(0, indiceFim);

    // Os códigos só existem na cláusula WHERE; buscá-los no corpo inteiro
    // pegaria trechos de texto por acidente.
    const codigos = [...corpo.slice(indiceWhere).matchAll(/'([A-Z]{3}-\d{2})'/g)].map(
      (m) => m[1]
    );

    const texto = (campo: string): string | undefined =>
      corpo.match(new RegExp(`${campo}\\s*=\\s*COALESCE\\(${campo},\\s*'([^']*)'\\)`))?.[1];

    const numero = corpo.match(
      /limite_tolerancia\s*=\s*COALESCE\(limite_tolerancia,\s*([\d.]+)\)/
    )?.[1];

    const valores: ValoresSql = {
      ...(numero !== undefined ? { limite_tolerancia: Number(numero) } : {}),
      ...(texto("unidade_medida") !== undefined
        ? { unidade_medida: texto("unidade_medida") }
        : {}),
      ...(texto("tecnica_avaliacao") !== undefined
        ? { tecnica_avaliacao: texto("tecnica_avaliacao") }
        : {}),
      ...(texto("base_legal") !== undefined ? { base_legal: texto("base_legal") } : {}),
    };

    for (const codigo of codigos) porCodigo.set(codigo, valores);
  }

  it("a migration foi lida e reconhecida (o teste nao passa por vacuidade)", () => {
    expect(porCodigo.size).toBe(RISCOS_PADRAO.length);
  });

  it("cobre todos os codigos do catalogo padrao", () => {
    const faltando = RISCOS_PADRAO.map((r) => r.codigo).filter((c) => !porCodigo.has(c));
    expect(faltando).toEqual([]);
  });

  it("nao semeia codigo que nao existe no catalogo padrao", () => {
    const conhecidos = new Set(RISCOS_PADRAO.map((r) => r.codigo));
    const sobrando = [...porCodigo.keys()].filter((c) => !conhecidos.has(c));
    expect(sobrando).toEqual([]);
  });

  it("os valores sao identicos nos dois caminhos", () => {
    const divergencias: string[] = [];

    for (const risco of RISCOS_PADRAO) {
      const naMigration = porCodigo.get(risco.codigo);
      if (!naMigration) continue;

      const campos: (keyof ValoresSql)[] = [
        "limite_tolerancia",
        "unidade_medida",
        "tecnica_avaliacao",
        "base_legal",
      ];

      for (const campo of campos) {
        const noTs = risco[campo as keyof typeof risco];
        const noSql = naMigration[campo];
        if ((noTs ?? null) !== (noSql ?? null)) {
          divergencias.push(`${risco.codigo}.${campo}: ts=${noTs ?? "—"} sql=${noSql ?? "—"}`);
        }
      }
    }

    expect(divergencias).toEqual([]);
  });
});
