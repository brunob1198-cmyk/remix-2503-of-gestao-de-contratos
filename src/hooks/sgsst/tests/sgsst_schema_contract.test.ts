import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Contrato entre os hooks SGSST e o schema das migrations.
 *
 * A suíte anterior tinha 36 testes verdes enquanto 42 das 48 tabelas não
 * existiam, porque nenhum teste olhava para o schema: eles declaravam um objeto
 * literal e afirmavam sobre esse literal. Estes testes leem o código de verdade.
 *
 * O que é coberto aqui:
 *  - toda tabela usada em `.from("...")` existe em alguma migration;
 *  - toda coluna usada em filtro `.or(...)` existe em uma das tabelas do arquivo
 *    (foi exatamente assim que passou o filtro por `codigo` em sgsst_documentos,
 *    tabela que não tem essa coluna);
 *  - toda dica de join `profiles!<tabela>_<coluna>_fkey` corresponde a uma FK
 *    declarada, já que o nome depende da convenção de nomes do Postgres.
 *
 * O que NÃO é coberto: se as migrations foram aplicadas no ambiente. Isso é
 * estado do banco, não do repositório — ver sgsst_schema_live.test.ts.
 */

const ROOT = path.resolve(__dirname, "../../../..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase/migrations");
const HOOKS_DIR = path.join(ROOT, "src/hooks/sgsst");

interface TabelaSchema {
  colunas: Set<string>;
  fks: Set<string>;
}

function lerSchemaDasMigrations(): Map<string, TabelaSchema> {
  const tabelas = new Map<string, TabelaSchema>();
  const arquivos = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const arquivo of arquivos) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, arquivo), "utf8");

    // Blocos CREATE TABLE [IF NOT EXISTS] [public.]<nome> ( ... );
    const criacoes = sql.matchAll(
      /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z0-9_]+)\s*\(([\s\S]*?)\n\s*\);/gi
    );

    for (const match of criacoes) {
      const nome = match[1].toLowerCase();
      const corpo = match[2];

      if (!tabelas.has(nome)) {
        tabelas.set(nome, { colunas: new Set(), fks: new Set() });
      }
      const tabela = tabelas.get(nome)!;

      for (const linhaBruta of corpo.split("\n")) {
        const linha = linhaBruta.trim();
        // Ignora linhas de constraint de tabela e comentários.
        if (
          !linha ||
          linha.startsWith("--") ||
          /^(constraint|primary\s+key|unique|foreign\s+key|check)\b/i.test(linha)
        ) {
          continue;
        }
        const coluna = linha.match(/^([a-z0-9_]+)\s+/i);
        if (coluna) {
          tabela.colunas.add(coluna[1].toLowerCase());
          if (/references\s+(public\.)?profiles/i.test(linha)) {
            tabela.fks.add(coluna[1].toLowerCase());
          }
        }
      }
    }

    // Colunas adicionadas depois via ALTER TABLE ... ADD COLUMN.
    // Um mesmo ALTER pode declarar várias colunas separadas por vírgula, então
    // primeiro isolamos o comando e depois varremos todos os ADD COLUMN dele.
    const alteracoes = sql.matchAll(
      /alter\s+table\s+(?:public\.)?([a-z0-9_]+)([\s\S]*?);/gi
    );
    for (const match of alteracoes) {
      const nome = match[1].toLowerCase();
      const corpo = match[2];

      if (!tabelas.has(nome)) {
        tabelas.set(nome, { colunas: new Set(), fks: new Set() });
      }
      const tabela = tabelas.get(nome)!;

      for (const add of corpo.matchAll(
        /add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z0-9_]+)([^,]*)/gi
      )) {
        tabela.colunas.add(add[1].toLowerCase());
        if (/references\s+(public\.)?profiles/i.test(add[2] ?? "")) {
          tabela.fks.add(add[1].toLowerCase());
        }
      }
    }
  }

  return tabelas;
}

function arquivosDeHooks(): string[] {
  return fs
    .readdirSync(HOOKS_DIR)
    .filter((f) => f.startsWith("useSgsst") && f.endsWith(".ts"))
    .map((f) => path.join(HOOKS_DIR, f));
}

const schema = lerSchemaDasMigrations();
const hooks = arquivosDeHooks();

describe("schema SGSST: leitura das migrations", () => {
  it("encontra as migrations e extrai as tabelas SGSST", () => {
    const sgsst = [...schema.keys()].filter((t) => t.startsWith("sgsst_"));
    // Guarda contra um parser que silenciosamente pare de casar nada.
    expect(sgsst.length).toBeGreaterThan(30);
    expect(schema.has("sgsst_documentos")).toBe(true);
    expect(schema.get("sgsst_pgr")!.colunas.has("titulo")).toBe(true);
  });

  it("lê colunas adicionadas por ALTER TABLE", () => {
    // abaixo_minimo é coluna gerada, criada em migration separada.
    expect(schema.get("sgsst_epis")!.colunas.has("abaixo_minimo")).toBe(true);
  });

  it("encontra os arquivos de hooks", () => {
    expect(hooks.length).toBeGreaterThan(10);
  });
});

describe("schema SGSST: tabelas usadas pelos hooks existem", () => {
  it("toda tabela em .from(...) está declarada em alguma migration", () => {
    const faltando: string[] = [];

    for (const arquivo of hooks) {
      const src = fs.readFileSync(arquivo, "utf8");
      for (const m of src.matchAll(/\.from\(\s*["']([a-z0-9_]+)["']/g)) {
        const tabela = m[1];
        if (!schema.has(tabela)) {
          faltando.push(`${path.basename(arquivo)} -> ${tabela}`);
        }
      }
    }

    expect(faltando, `Tabelas sem migration:\n${faltando.join("\n")}`).toEqual([]);
  });
});

describe("schema SGSST: colunas usadas em filtros existem", () => {
  it("toda coluna de filtro .or(...) existe numa tabela do mesmo hook", () => {
    const problemas: string[] = [];

    for (const arquivo of hooks) {
      const src = fs.readFileSync(arquivo, "utf8");

      const tabelasDoArquivo = [...src.matchAll(/\.from\(\s*["']([a-z0-9_]+)["']/g)].map(
        (m) => m[1]
      );

      // União das colunas de todas as tabelas tocadas pelo arquivo. É uma
      // heurística deliberada: atribuir cada filtro à sua tabela exigiria
      // rastrear o encadeamento da query, e a união já pega o caso real
      // (coluna que não existe em nenhuma tabela do módulo).
      const colunasDisponiveis = new Set<string>();
      for (const t of tabelasDoArquivo) {
        for (const c of schema.get(t)?.colunas ?? []) colunasDisponiveis.add(c);
      }
      if (colunasDisponiveis.size === 0) continue;

      for (const orMatch of src.matchAll(/\.or\(\s*`([^`]+)`/g)) {
        for (const cond of orMatch[1].split(",")) {
          const coluna = cond.trim().match(/^([a-z0-9_]+)\./);
          if (!coluna) continue;
          const nome = coluna[1].toLowerCase();
          // Ignora interpolações de template (${...}).
          if (nome.includes("$")) continue;
          if (!colunasDisponiveis.has(nome)) {
            problemas.push(`${path.basename(arquivo)} -> coluna "${nome}" não existe`);
          }
        }
      }
    }

    expect(problemas, `Filtros por coluna inexistente:\n${problemas.join("\n")}`).toEqual([]);
  });
});

describe("schema SGSST: dicas de join batem com as FKs declaradas", () => {
  it("todo profiles!<tabela>_<coluna>_fkey corresponde a uma FK real", () => {
    const problemas: string[] = [];

    for (const arquivo of hooks) {
      const src = fs.readFileSync(arquivo, "utf8");

      for (const m of src.matchAll(/profiles!([a-z0-9_]+)_fkey/g)) {
        const base = m[1];

        // O nome padrão do Postgres é <tabela>_<coluna>_fkey; testa todas as
        // divisões possíveis porque tabela e coluna contêm underscores.
        const partes = base.split("_");
        let encontrado = false;
        for (let i = partes.length - 1; i > 0 && !encontrado; i--) {
          const tabela = partes.slice(0, i).join("_");
          const coluna = partes.slice(i).join("_");
          if (schema.get(tabela)?.fks.has(coluna)) encontrado = true;
        }

        if (!encontrado) {
          problemas.push(`${path.basename(arquivo)} -> ${base}_fkey sem FK correspondente`);
        }
      }
    }

    expect(problemas, `Dicas de join inválidas:\n${problemas.join("\n")}`).toEqual([]);
  });
});
