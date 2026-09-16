import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { calcularRevisao } from "@/utils/sgsstPgrRevisao";

/**
 * O painel e o documento dizem a mesma coisa sobre a revisão do PGR?
 *
 * POR QUE ESTE TESTE EXISTE
 *
 * A regra de vencimento da revisão vive em DOIS lugares: em TypeScript
 * (`sgsstPgrRevisao.ts`, que o documento e as telas usam) e em SQL (o bloco de
 * alerta do painel). Foi assim que precisou ser: o painel é uma função do banco,
 * e chamar TypeScript de dentro dela não existe.
 *
 * Duas regras parecidas em dois lugares divergem com o tempo. Já divergiram
 * neste projeto — os status dos incidentes ficaram diferentes entre a coluna e o
 * filtro do painel, e um acidente em tratamento sumiu do resumo por meses.
 *
 * Aqui o preço de divergir é o painel dizer "PGR em dia" enquanto o documento do
 * mesmo PGR o marca vencido. Quem lê um dos dois não tem como desconfiar.
 *
 * O QUE ELE PEGA
 *
 * Mudança em UM dos lados: alguém troca a periodicidade padrão no TypeScript e
 * não no SQL, ou acrescenta um status que não vence e esquece o outro lado.
 *
 * NÃO executa o SQL — isso é feito em Postgres, à parte. Este teste compara as
 * DECISÕES que os dois textos codificam.
 */

const RAIZ = path.resolve(__dirname, "../../../..");
const MIGRATIONS = path.join(RAIZ, "supabase/migrations");

/** A migration mais recente que define o bloco de alerta do PGR. */
function sqlDoAlertaDoPgr(): string {
  const arquivos = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .filter((f) => readFileSync(path.join(MIGRATIONS, f), "utf8").includes("'pgr-rev-' || pg.id"));

  expect(
    arquivos.length,
    "nenhuma migration define o alerta de PGR — o painel voltou a calar sobre revisão vencida"
  ).toBeGreaterThan(0);

  const sql = readFileSync(path.join(MIGRATIONS, arquivos[arquivos.length - 1]), "utf8");
  const inicio = sql.indexOf("'pgr-rev-' || pg.id");
  const fim = sql.indexOf("UNION ALL", inicio);
  return sql.slice(inicio, fim > 0 ? fim : undefined);
}

describe("revisão do PGR: painel e documento seguem a mesma regra", () => {
  const bloco = sqlDoAlertaDoPgr();

  it("a base é data_revisao, e na falta dela data_inicio", () => {
    // É o que `calcularRevisao` faz: `const base = dataRevisao || dataInicio`.
    expect(bloco).toMatch(/COALESCE\(\s*pg\.data_revisao,\s*pg\.data_inicio\s*\)/);
  });

  it("a periodicidade padrão do SQL é a mesma do TypeScript", () => {
    // O TS usa 24 quando a periodicidade não vem (`periodicidadeMeses ?? 24`).
    // Descobre o número pelo próprio módulo, em vez de repetir a constante aqui:
    // um PGR sem periodicidade tem de vencer na mesma data nos dois lados.
    const semPeriodicidade = calcularRevisao({
      dataInicio: "2020-01-01",
      periodicidadeMeses: null,
      hoje: new Date("2020-01-02"),
    });
    const mesesDoTs =
      (semPeriodicidade.vencimento!.getFullYear() - 2020) * 12 +
      semPeriodicidade.vencimento!.getMonth();

    const noSql = bloco.match(/COALESCE\(\s*pg\.periodicidade_revisao_meses,\s*(\d+)\s*\)/);
    expect(noSql, "o SQL não tem fallback de periodicidade").not.toBeNull();
    expect(Number(noSql![1])).toBe(mesesDoTs);
  });

  it("PGR encerrado não vence nos dois lados", () => {
    expect(
      calcularRevisao({
        dataInicio: "2020-01-01",
        periodicidadeMeses: 12,
        status: "ENCERRADO",
        hoje: new Date("2026-01-01"),
      }).situacao
    ).toBe("NAO_APLICAVEL");

    expect(bloco).toMatch(/status\s*<>\s*'ENCERRADO'/);
  });

  it("os demais status vencem nos dois lados", () => {
    // Se alguém excluir RASCUNHO ou EM_REVISAO de um dos lados, este caso cai.
    for (const status of ["RASCUNHO", "ATIVO", "EM_REVISAO"]) {
      expect(
        calcularRevisao({
          dataInicio: "2020-01-01",
          periodicidadeMeses: 12,
          status,
          hoje: new Date("2026-01-01"),
        }).situacao,
        `${status} deveria vencer no TypeScript`
      ).toBe("VENCIDO");
    }

    const statusExcluidos = [...bloco.matchAll(/status\s*<>\s*'([A-Z_]+)'/g)].map((m) => m[1]);
    expect(statusExcluidos).toEqual(["ENCERRADO"]);
  });

  it("vencido é DEPOIS do dia, não no dia", () => {
    // Errar esta borda invalida o PGR no último dia em que ele ainda vale.
    expect(
      calcularRevisao({
        dataRevisao: "2025-01-01",
        periodicidadeMeses: 12,
        hoje: new Date("2026-01-01"),
      }).situacao
    ).not.toBe("VENCIDO");

    expect(bloco).toMatch(/vencimento\s*<\s*CURRENT_DATE/);
  });
});
