import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * Todo status filtrado no painel existe de verdade na coluna?
 *
 * POR QUE ESTE TESTE EXISTE
 *
 * Três vezes o painel ficou subnotificando porque um filtro citava um status que a
 * coluna não aceita, ou esquecia um que ela aceita:
 *
 *   `inspecoesPendentes` filtrava 'EM_ANDAMENTO' — a coluna só tem 'EM_EXECUCAO'
 *   `examesPendentes`    filtrava 'SOLICITADO'   — não existe no CHECK
 *   `incidentesAbertos`  listava dois dos quatro estados abertos
 *
 * Nos três casos o painel mostrava um número plausível e menor que a verdade.
 * Nenhum teste podia falhar, porque não havia teste: a conta estava em SQL, e o
 * SQL só é executado no banco do usuário.
 *
 * Este teste lê os arquivos do próprio repositório — o CHECK de cada tabela e os
 * filtros das funções do painel — e cruza os dois. Não precisa de banco.
 *
 * O QUE ELE PEGA, E O QUE NÃO PEGA
 *
 * Pega status INVÁLIDO: valor citado que a coluna nunca aceita. É o erro que já
 * aconteceu duas vezes.
 *
 * NÃO pega status FALTANDO: `IN ('REGISTRADO')` é tecnicamente válido mesmo que
 * existam outros estados abertos. Contra isso vale a regra escrita na migration:
 * "aberto" se define excluindo os terminais (`NOT IN`), e não listando os
 * intermediários um a um.
 */

const RAIZ = path.resolve(__dirname, "../../../..");
const MIGRATIONS = path.join(RAIZ, "supabase/migrations");

function semComentarios(sql: string): string {
  return sql
    .split("\n")
    .map((l) => l.replace(/--.*$/, ""))
    .join("\n");
}

/** Vocabulário de `status` por tabela, lido dos CHECK das migrations. */
function vocabularioDeStatus(): Map<string, Set<string>> {
  const vocabulario = new Map<string, Set<string>>();

  for (const arquivo of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = semComentarios(readFileSync(path.join(MIGRATIONS, arquivo), "utf8"));

    for (const m of sql.matchAll(
      /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z0-9_]+)"?\s*\(([\s\S]*?)\n\)\s*;/gi
    )) {
      const tabela = m[1].toLowerCase();
      const corpo = m[2];

      const check = corpo.match(/status[^,]*?check\s*\(\s*status\s+in\s*\(([^)]*)\)/i);
      if (!check) continue;

      const valores = [...check[1].matchAll(/'([^']+)'/g)].map((v) => v[1]);
      if (valores.length > 0) vocabulario.set(tabela, new Set(valores));
    }
  }

  return vocabulario;
}

/** A migration mais recente que define as funções do painel. */
function sqlDoPainel(): string {
  const arquivos = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .filter((f) =>
      readFileSync(path.join(MIGRATIONS, f), "utf8").includes(
        "CREATE OR REPLACE FUNCTION public.sgsst_dashboard_metrics"
      )
    );

  expect(arquivos.length).toBeGreaterThan(0);
  return semComentarios(readFileSync(path.join(MIGRATIONS, arquivos[arquivos.length - 1]), "utf8"));
}

interface UsoDeStatus {
  tabela: string;
  valor: string;
}

/**
 * Os status citados nas funções do painel, já atribuídos à tabela certa.
 *
 * Cada consulta é recortada a partir do `FROM public.<tabela>`; dentro do recorte,
 * os `JOIN` registram os apelidos, para que `a.status` de um `LEFT JOIN` não seja
 * cobrado da tabela do `FROM`.
 */
function statusUsadosNoPainel(sql: string): UsoDeStatus[] {
  const usos: UsoDeStatus[] = [];
  const pedacos = sql.split(/\bfrom\s+public\./i).slice(1);

  for (const pedaco of pedacos) {
    const cabeca = pedaco.match(/^([a-z0-9_]+)\s+(?:as\s+)?([a-z][a-z0-9_]*)?/i);
    if (!cabeca) continue;

    const tabela = cabeca[1].toLowerCase();
    const apelidos = new Map<string, string>();
    const palavrasReservadas = new Set(["where", "on", "left", "inner", "join", "group", "order"]);
    if (cabeca[2] && !palavrasReservadas.has(cabeca[2].toLowerCase())) {
      apelidos.set(cabeca[2].toLowerCase(), tabela);
    }

    for (const j of pedaco.matchAll(/join\s+public\.([a-z0-9_]+)\s+(?:as\s+)?([a-z][a-z0-9_]*)/gi)) {
      apelidos.set(j[2].toLowerCase(), j[1].toLowerCase());
    }

    // Só o trecho até o fim desta subconsulta interessa.
    const corpo = pedaco.split(/\bfrom\s+public\./i)[0];

    for (const s of corpo.matchAll(
      /(?:([a-z][a-z0-9_]*)\.)?status\s+(?:not\s+)?in\s*\(([^)]*)\)/gi
    )) {
      const dona = s[1] ? apelidos.get(s[1].toLowerCase()) ?? tabela : tabela;
      for (const v of s[2].matchAll(/'([^']+)'/g)) usos.push({ tabela: dona, valor: v[1] });
    }

    for (const s of corpo.matchAll(/(?:([a-z][a-z0-9_]*)\.)?status\s*=\s*'([^']+)'/gi)) {
      const dona = s[1] ? apelidos.get(s[1].toLowerCase()) ?? tabela : tabela;
      usos.push({ tabela: dona, valor: s[2] });
    }
  }

  return usos;
}

describe("vocabulário de status do painel do SGSST", () => {
  const vocabulario = vocabularioDeStatus();
  const usos = statusUsadosNoPainel(sqlDoPainel());

  it("as migrations declaram o vocabulário das tabelas do SGSST", () => {
    // Se isto falhar, o parser parou de enxergar os CHECK e o teste abaixo
    // passaria vazio — dando a impressão de que está tudo certo.
    expect(vocabulario.get("sgsst_incidentes")).toBeDefined();
    expect(vocabulario.get("sgsst_nao_conformidades")).toBeDefined();
    expect(vocabulario.get("sgsst_inspecoes")).toBeDefined();
  });

  it("o painel filtra status em várias tabelas", () => {
    // Mesma proteção: uso vazio faria a asserção principal passar à toa.
    expect(usos.length).toBeGreaterThan(8);
    expect(new Set(usos.map((u) => u.tabela)).size).toBeGreaterThan(3);
  });

  it("todo status filtrado existe no CHECK da coluna", () => {
    const invalidos = usos.filter((u) => {
      const permitidos = vocabulario.get(u.tabela);
      // Tabela sem CHECK de status não tem contra o que conferir.
      return permitidos ? !permitidos.has(u.valor) : false;
    });

    expect(
      invalidos.map((u) => `${u.tabela}.status = '${u.valor}'`),
      "o painel filtra um status que a coluna nunca aceita — ele conta zero para sempre"
    ).toEqual([]);
  });

  it("incidente aberto é definido excluindo os estados terminais", () => {
    // A regressão concreta: o painel listava dois dos quatro estados abertos, e
    // o incidente sumia justamente quando alguém começava a tratá-lo.
    const sql = sqlDoPainel();
    expect(sql).not.toMatch(/status\s+IN\s*\(\s*'REGISTRADO',\s*'EM_INVESTIGACAO'\s*\)/i);
    expect(sql).toMatch(/status\s+NOT\s+IN\s*\(\s*'ENCERRADO',\s*'CANCELADO'\s*\)/i);
  });
});
