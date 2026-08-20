import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifica se as migrations SGSST estão aplicadas no ambiente apontado.
 *
 * Este é o teste que faltava. O contrato estático (sgsst_schema_contract) prova
 * que o repositório está coerente; ele não diz nada sobre o banco. O problema
 * real era exatamente esse: 42 das 48 tabelas existiam no repositório e não no
 * banco, e a suíte seguia verde.
 *
 * Não roda por padrão porque depende de rede e de um projeto Supabase alcançável.
 * Para rodar:
 *
 *   SGSST_CHECK_LIVE_SCHEMA=1 npx vitest run src/hooks/sgsst/tests/sgsst_schema_live.test.ts
 *
 * Use depois de aplicar uma migration para confirmar que subiu tudo, e em
 * pipelines de deploy como verificação pós-migração.
 *
 * ATENÇÃO: neste projeto as migrations são aplicadas manualmente, colando o SQL
 * no editor do Supabase. `supabase db push` NÃO deve ser usado aqui: o histórico
 * está dessincronizado (mais arquivos que versões registradas) e migrations
 * antigas contêm DELETE e DROP TABLE que rodariam contra a base real.
 */

const HABILITADO = process.env.SGSST_CHECK_LIVE_SCHEMA === "1";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? "https://xqdhyukmeklfczwiipen.supabase.co";
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxZGh5dWttZWtsZmN6d2lpcGVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NDczNTksImV4cCI6MjA5MDAyMzM1OX0.DPbyonqvq2xg4Qvpz2qibikX29XLcLMGRCLcZF6TOjY";

const ROOT = path.resolve(__dirname, "../../../..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase/migrations");

function tabelasSgsstDeclaradas(): string[] {
  const nomes = new Set<string>();
  for (const arquivo of fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"))) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, arquivo), "utf8");
    for (const m of sql.matchAll(
      /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(sgsst_[a-z0-9_]+)/gi
    )) {
      nomes.add(m[1].toLowerCase());
    }
  }
  return [...nomes].sort();
}

/** 404 do PostgREST = tabela ausente do schema cache. 200/401/403 = existe. */
async function tabelaExiste(tabela: string): Promise<{ ok: boolean; status: number }> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?select=*&limit=1`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  return { ok: res.status !== 404, status: res.status };
}

/** UUID inexistente, usado só para exercitar a assinatura e a trava de tenant. */
const EMPRESA_INEXISTENTE = "00000000-0000-0000-0000-000000000000";

async function chamarRpc(nome: string, args: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nome}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  return { status: res.status, body: await res.text() };
}

/**
 * O PostgREST resolve a função pelos nomes dos argumentos, e `p_empresa_id` não
 * tem DEFAULT — chamar sem argumento devolve 404/PGRST202 mesmo com a função
 * criada. Por isso o probe precisa mandar o parâmetro obrigatório: só então um
 * 404 significa, de fato, função ausente.
 */
async function funcaoExiste(nome: string): Promise<{ ok: boolean; status: number }> {
  const { status } = await chamarRpc(nome, { p_empresa_id: EMPRESA_INEXISTENTE });
  return { ok: status !== 404, status };
}

describe.skipIf(!HABILITADO)("schema SGSST aplicado no ambiente", () => {
  it(
    "todas as tabelas declaradas nas migrations existem no banco",
    async () => {
      const declaradas = tabelasSgsstDeclaradas();
      expect(declaradas.length).toBeGreaterThan(30);

      const resultados = await Promise.all(
        declaradas.map(async (t) => ({ tabela: t, ...(await tabelaExiste(t)) }))
      );

      const ausentes = resultados.filter((r) => !r.ok).map((r) => r.tabela);

      expect(
        ausentes,
        `${ausentes.length} de ${declaradas.length} tabelas SGSST não existem no banco.\n` +
          `Aplique as migrations pendentes colando o SQL no editor do Supabase — ` +
          `não use 'supabase db push' neste projeto (ver o comentário no topo do arquivo).\n\n` +
          ausentes.join("\n")
      ).toEqual([]);
    },
    60_000
  );

  it(
    "as funções de dashboard existem e recusam empresa de outro tenant",
    async () => {
      for (const fn of ["sgsst_dashboard_metrics", "sgsst_dashboard_alertas"]) {
        const { ok, status } = await funcaoExiste(fn);
        expect(ok, `RPC ${fn} não existe (HTTP ${status}) — migrations pendentes.`).toBe(true);

        // Chamada com empresa arbitrária deve ser recusada pela trava de tenant,
        // nunca devolver métricas. 200 aqui significaria vazamento entre empresas.
        const { status: statusGuarda, body } = await chamarRpc(fn, {
          p_empresa_id: EMPRESA_INEXISTENTE,
        });

        expect(
          statusGuarda,
          `${fn} respondeu 200 para uma empresa arbitrária; a trava de tenant não barrou.`
        ).not.toBe(200);

        // 42501 = insufficient_privilege, o código que a trava levanta. Confere
        // que a recusa vem da trava, e não de outro erro qualquer.
        expect(
          body,
          `${fn} recusou com ${statusGuarda}, mas sem o erro da trava de tenant: ${body.slice(0, 200)}`
        ).toContain("42501");
      }
    },
    60_000
  );
});

describe("aviso sobre o teste de schema ao vivo", () => {
  it("informa como habilitar quando está desligado", () => {
    if (!HABILITADO) {
      // Mantém visível que a checagem existe e está desligada, em vez de
      // simplesmente não aparecer no relatório da suíte.
      expect(HABILITADO).toBe(false);
    } else {
      expect(SUPABASE_URL).toMatch(/^https:\/\//);
    }
  });
});
