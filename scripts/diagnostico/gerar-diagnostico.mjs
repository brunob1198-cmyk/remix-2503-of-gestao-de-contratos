/**
 * Gera as duas consultas de diagnostico a partir das migrations do repositorio.
 *
 * POR QUE ISTO EXISTE
 *
 * O banco nao registra todas as 238 migrations como aplicadas, e ja falhou em
 * producao tres vezes por isso: `signature_signers`, as colunas de
 * geolocalizacao de `checklist_modelos` e `checklist_qrcodes`. Nas tres, a
 * descoberta foi clicando na tela e recebendo erro, um por vez.
 *
 * As consultas geradas aqui respondem de uma vez o que falta. Elas nao alteram
 * nada: so leem o catalogo do Postgres.
 *
 * Uso:
 *   node scripts/diagnostico/gerar-diagnostico.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(import.meta.dirname, "../..");
const MIGRATIONS = path.join(RAIZ, "supabase/migrations");
const SAIDA = path.join(RAIZ, "scripts/diagnostico");

const arquivos = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .sort();

/** Tira comentarios de linha, para nao confundir SQL com prosa. */
function semComentarios(sql) {
  return sql
    .split("\n")
    .map((l) => l.replace(/--.*$/, ""))
    .join("\n");
}

/**
 * Palavras que nunca sao nome de coluna e que aparecem por retrocesso do regex
 * quando o SQL e dinamico. Ver o comentario em `add column`.
 */
const PALAVRAS_RESERVADAS = new Set(["if", "not", "exists", "column", "table"]);

const tabelasCriadas = new Set();
const tabelasRemovidas = new Set();
/** Chave "tabela.coluna". */
const colunasAdicionadas = new Set();

for (const arquivo of arquivos) {
  const sql = semComentarios(readFileSync(path.join(MIGRATIONS, arquivo), "utf8"));

  for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z0-9_]+)"?/gi)) {
    tabelasCriadas.add(m[1].toLowerCase());
  }

  // Tabela removida de proposito nao e ausencia: `timeline_eventos` foi apagada
  // por uma migration, e listar isso como defeito so gera ruido.
  for (const m of sql.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?"?([a-z0-9_]+)"?/gi)) {
    tabelasRemovidas.add(m[1].toLowerCase());
  }

  // Um `ALTER TABLE x ADD COLUMN a, ADD COLUMN b` acrescenta DUAS colunas na
  // mesma instrucao — ler so a primeira era o que deixava passar justamente o
  // caso das cinco colunas de geolocalizacao.
  for (const m of sql.matchAll(
    /alter\s+table\s+(?:only\s+)?(?:public\.)?"?([a-z0-9_]+)"?([\s\S]*?);/gi
  )) {
    const tabela = m[1].toLowerCase();
    for (const c of m[2].matchAll(/add\s+column\s+(?:if\s+not\s+exists\s+)?"?([a-z0-9_]+)"?/gi)) {
      const coluna = c[1].toLowerCase();
      // `ADD COLUMN IF NOT EXISTS %I` — SQL dinamico, com o nome da coluna vindo
      // de uma variavel. O `%I` nao casa com [a-z0-9_], o grupo opcional
      // retrocede e a captura vira a palavra "if". Foi assim que o diagnostico
      // acusou uma coluna chamada `if` em `sgsst_asos`.
      //
      // Coluna criada por EXECUTE format() fica FORA desta checagem: o nome so
      // existe em tempo de execucao. Hoje e um caso so (as tres colunas de
      // aptidao do ASO, na 20260829100000).
      if (PALAVRAS_RESERVADAS.has(coluna)) continue;
      colunasAdicionadas.add(`${tabela}.${coluna}`);
    }
  }
}

const tabelas = [...tabelasCriadas].filter((t) => !tabelasRemovidas.has(t)).sort();
// Coluna de tabela que nao existe mais nao tem o que conferir.
const colunas = [...colunasAdicionadas]
  .filter((c) => !tabelasRemovidas.has(c.split(".")[0]))
  .sort();

const cabecalho = (titulo, explicacao) => `-- ${titulo}
--
-- Gerado por scripts/diagnostico/gerar-diagnostico.mjs a partir das
-- ${arquivos.length} migrations do repositorio. Para atualizar, rode o script.
--
-- ${explicacao}
--
-- NAO ALTERA NADA: so le o catalogo do Postgres.
-- Tabelas apagadas de proposito por alguma migration ficam de fora da conta.
`;

writeFileSync(
  path.join(SAIDA, "tabelas-ausentes.sql"),
  `${cabecalho(
    "DIAGNOSTICO: tabelas que as migrations declaram e este banco nao tem",
    "Cada linha do resultado e uma tabela que alguma migration cria e que nao\n-- existe aqui. Resultado vazio = nao falta tabela nenhuma."
  )}
WITH esperadas(nome) AS (VALUES
${tabelas.map((t) => `  ('${t}')`).join(",\n")}
)
SELECT e.nome AS tabela_ausente
  FROM esperadas e
  LEFT JOIN pg_tables t
    ON t.schemaname = 'public' AND t.tablename = e.nome
 WHERE t.tablename IS NULL
 ORDER BY 1;
`
);

writeFileSync(
  path.join(SAIDA, "colunas-ausentes.sql"),
  `${cabecalho(
    "DIAGNOSTICO: colunas que as migrations acrescentam e este banco nao tem",
    "E a checagem que faltava: o defeito do checklist era uma COLUNA ausente\n" +
      "-- (`checklist_modelos.exigir_geolocalizacao`), e nenhuma verificacao de tabela\n" +
      "-- pegaria isso. Tabela inteira ausente aparece na outra consulta, entao aqui ela\n" +
      "-- e ignorada para o resultado nao repetir o mesmo problema.\n" +
      "--\n" +
      "-- LIMITE CONHECIDO: coluna criada por SQL dinamico (`EXECUTE format('ALTER\n" +
      "-- TABLE ... ADD COLUMN IF NOT EXISTS %I', v)`) fica de fora, porque o nome so\n" +
      "-- existe em tempo de execucao. Hoje e um caso so: as tres colunas de aptidao\n" +
      "-- do ASO (apto_altura, apto_espaco_confinado, apto_maquinas), na migration\n" +
      "-- 20260829100000."
  )}
WITH esperadas(tabela, coluna) AS (VALUES
${colunas
  .map((c) => {
    const [t, col] = c.split(".");
    return `  ('${t}', '${col}')`;
  })
  .join(",\n")}
)
SELECT e.tabela, e.coluna
  FROM esperadas e
  JOIN pg_tables t
    ON t.schemaname = 'public' AND t.tablename = e.tabela
  LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public'
   AND c.table_name = e.tabela
   AND c.column_name = e.coluna
 WHERE c.column_name IS NULL
 ORDER BY 1, 2;
`
);

console.log(`tabelas esperadas: ${tabelas.length} (${tabelasRemovidas.size} removidas de proposito, fora da conta)`);
console.log(`colunas esperadas: ${colunas.length}`);
