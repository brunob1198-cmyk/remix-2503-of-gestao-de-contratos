import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * A armadilha do prefixo que não é prefixo.
 *
 * `invalidateQueries({ queryKey: ["sgsst_colaboradores"] })` casa por ELEMENTO do
 * array, não por prefixo de string. Então uma consulta registrada como
 *
 *   ["sgsst_colaboradores_resumo", empresaId]
 *
 * NÃO é invalidada por ela: "sgsst_colaboradores_resumo" é outro elemento,
 * diferente de "sgsst_colaboradores". O nome sugere uma cobertura que não existe.
 *
 * Foi assim que o cartão "Trabalhadores Ativos" ficou parado depois de desligar
 * um colaborador — a lista atualizava, o contador não, e só voltava ao certo
 * saindo e entrando na tela.
 *
 * A REGRA que este arquivo cobra: uma chave com sufixo colado precisa OU ser
 * sub-chave de verdade (`["base", "sufixo", ...]`), OU ter invalidação própria.
 * Nome colado sem invalidação nenhuma é consulta que nunca se atualiza.
 *
 * As chaves coladas que TÊM invalidação própria funcionam e não aparecem aqui.
 * `DIVIDA_CONHECIDA` é a catraca, no mesmo espírito do `lint-ratchet`, e hoje está
 * vazia: as quinze pendentes viraram sub-chave, cada uma sob a base que de fato
 * muda o dado. Chave nova nesse formato quebra o teste na hora.
 *
 * Virar sub-chave, porém, não basta por si — a invalidação da base ainda precisa
 * ALCANÇAR a sub-chave. É a mesma armadilha um degrau adiante, e é o que o segundo
 * bloco de testes cobra.
 */

const RAIZ = path.join(process.cwd(), "src", "hooks");

/**
 * Consultas coladas que ninguém invalida. Vazia: as quinze que estavam aqui foram
 * convertidas em sub-chave, em lotes por módulo — `_detail` sob a lista da
 * entidade, `_historico` sob a base cujas mutations escrevem no histórico, e as
 * leituras em bloco da emissão sob a base do dado que elas leem.
 *
 * A lista fica no lugar como catraca, e como o caminho previsto para uma dívida
 * assumida de propósito: adiar um caso exige nomeá-lo aqui, e o nome aparece no
 * diff em vez de virar comentário que ninguém lê.
 */
const DIVIDA_CONHECIDA: string[] = [];

/**
 * Sub-chaves cuja invalidação esta varredura não consegue ler no texto.
 *
 * `useSgsstFuncaoVinculos` invalida `[tabela]`, com o nome da tabela vindo de
 * variável — e `sgsst_funcao_riscos` é uma das tabelas possíveis. Em execução isso
 * é invalidação de base inteira e alcança a sub-chave; parado na fonte, não dá para
 * afirmar. Conferido a olho, fica de fora.
 */
const ALCANCE_NAO_ESTATICO = ["sgsst_funcao_riscos/por_risco"];

function arquivosDeHook(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const p = path.join(dir, nome);
    if (statSync(p).isDirectory()) return nome === "tests" ? [] : arquivosDeHook(p);
    return /\.tsx?$/.test(nome) ? [p] : [];
  });
}

/** Elementos de uma chave, como texto: `["a", b]` devolve `['"a"', "b"]`. */
function elementos(dentroDosColchetes: string): string[] {
  return dentroDosColchetes
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

/**
 * O valor do elemento quando ele é literal de string; `null` quando é expressão.
 *
 * É essa diferença que decide a checagem de alcance: `"da_pt"` é comparável entre
 * consulta e invalidação, `ptRiscoId` não é.
 */
function literalDe(elemento?: string): string | null {
  return elemento && /^"[a-zA-Z0-9_]+"$/.test(elemento) ? elemento.slice(1, -1) : null;
}

interface ChaveNaFonte {
  arquivo: string;
  els: string[];
}

function coletar() {
  const consultadas = new Set<string>();
  const invalidadas = new Set<string>();
  const consultas: ChaveNaFonte[] = [];
  const invalidacoes: ChaveNaFonte[] = [];

  for (const arq of arquivosDeHook(RAIZ)) {
    const fonte = readFileSync(arq, "utf8");
    for (const m of fonte.matchAll(/queryKey:\s*\[\s*"([a-zA-Z0-9_]+)"/g)) consultadas.add(m[1]);
    for (const m of fonte.matchAll(/invalidateQueries\(\{\s*queryKey:\s*\[\s*"([a-zA-Z0-9_]+)"/g)) {
      invalidadas.add(m[1]);
    }

    // As invalidações são colhidas primeiro e apagadas da cópia. Sem isso o
    // `queryKey` de dentro delas entraria na lista de consultas, e cada invalidação
    // passaria a alcançar a si mesma.
    const soConsultas = fonte.replace(
      /invalidateQueries\(\{\s*queryKey:\s*\[([^\]]*)\]/g,
      (_todo, dentro: string) => {
        invalidacoes.push({ arquivo: arq, els: elementos(dentro) });
        return "invalidateQueries({";
      }
    );
    for (const m of soConsultas.matchAll(/queryKey:\s*\[([^\]]*)\]/g)) {
      consultas.push({ arquivo: arq, els: elementos(m[1]) });
    }
  }
  return { consultadas, invalidadas, consultas, invalidacoes };
}

/** Chaves com sufixo colado e SEM invalidação própria. */
function semInvalidacao(): string[] {
  const { consultadas, invalidadas } = coletar();
  return [...consultadas]
    .filter((k) => [...invalidadas].some((base) => k !== base && k.startsWith(`${base}_`)))
    .filter((k) => !invalidadas.has(k))
    .sort();
}

describe("chaves de cache do TanStack Query", () => {
  it("a varredura encontra chaves de verdade na fonte", () => {
    // Sem isto, uma regex quebrada faria o teste passar vazio e parar de guardar.
    const { consultadas, invalidadas } = coletar();
    expect(consultadas.size).toBeGreaterThan(30);
    expect(invalidadas.size).toBeGreaterThan(20);
  });

  it("nenhuma chave nova com sufixo colado fica sem invalidação", () => {
    const atual = semInvalidacao();

    const novas = atual.filter((k) => !DIVIDA_CONHECIDA.includes(k));
    expect(
      novas,
      `Chave com sufixo colado e sem invalidação:\n  ${novas.join("\n  ")}\n\n` +
        `Use sub-chave — ["base", "sufixo", ...] — para a invalidação da base cobrir, ` +
        `ou invalide esta chave explicitamente.`
    ).toEqual([]);

    const consertadas = DIVIDA_CONHECIDA.filter((k) => !atual.includes(k));
    expect(
      consertadas,
      `Estas saíram da dívida: tire-as de DIVIDA_CONHECIDA.\n  ${consertadas.join("\n  ")}`
    ).toEqual([]);
  });

  it("o resumo de colaboradores é sub-chave da lista", () => {
    // O caso que originou o teste, fixado pelo nome para não regredir.
    const fonte = readFileSync(
      path.join(process.cwd(), "src", "hooks", "sgsst", "useSgsstColaboradores.ts"),
      "utf8"
    );
    expect(fonte).toContain('queryKey: ["sgsst_colaboradores", "resumo"');
    expect(fonte).not.toContain('"sgsst_colaboradores_resumo"');
  });

  it("os dois casos irmãos dos checklists também são sub-chaves", () => {
    const fonte = readFileSync(
      path.join(process.cwd(), "src", "hooks", "checklists", "useChecklists.ts"),
      "utf8"
    );
    expect(fonte).toContain('queryKey: ["checklist_planos_acao", "stats"');
    expect(fonte).toContain('queryKey: ["checklist_aplicacoes", "reincidencias"');
    expect(fonte).not.toContain('"checklist_planos_acao_stats"');
  });

  it("o HHT sugerido fica sob a base do dado que ele lê, não a do módulo", () => {
    // `sgsst_hht` passaria a varredura e continuaria errado: o número sai de
    // `diario_equipe`, e é o diário que precisa invalidar. De fora, a escolha parece
    // um descuido — então fica fixada aqui, para não ser "corrigida" de volta.
    const fonte = readFileSync(
      path.join(process.cwd(), "src", "hooks", "sgsst", "useSgsstIndicadores.ts"),
      "utf8"
    );
    expect(fonte).toContain('queryKey: ["diario_equipe", "hht_sugerido"');
  });
});

/**
 * A armadilha um degrau adiante: sub-chave certa, invalidação escopada demais.
 *
 * A varredura de cima compara só o PRIMEIRO elemento. Por ela,
 * `["sgsst_pt_medidas", "da_pt", chave]` está coberta — `sgsst_pt_medidas` é
 * invalidado. Mas a invalidação que existia era `["sgsst_pt_medidas", ptRiscoId]`:
 * dois elementos, e o segundo nunca vale "da_pt". Cobertura aparente outra vez,
 * pelo mesmo motivo, um nível abaixo.
 *
 * Para alcançar `["base", "sufixo", ...]`, a invalidação precisa ser `["base"]`
 * sozinha, ou repetir o mesmo "sufixo" no segundo lugar.
 */
describe("alcance da invalidação nas sub-chaves", () => {
  it("toda sub-chave é alcançada pela invalidação da sua base", () => {
    const { consultas, invalidacoes } = coletar();

    const subChaves = consultas.filter((c) => literalDe(c.els[0]) && literalDe(c.els[1]));
    // Mesma proteção do teste de cima: regex quebrada não pode passar vazia.
    expect(subChaves.length).toBeGreaterThan(10);

    const foraDeAlcance = subChaves
      .filter((c) => {
        const base = literalDe(c.els[0]);
        const sufixo = literalDe(c.els[1]);
        return !invalidacoes.some((i) => {
          if (literalDe(i.els[0]) !== base) return false;
          // `["base"]` sozinha cobre tudo abaixo dela; com mais elementos, o
          // segundo precisa ser o mesmo sufixo.
          return i.els.length === 1 || literalDe(i.els[1]) === sufixo;
        });
      })
      .map((c) => `${literalDe(c.els[0])}/${literalDe(c.els[1])}`)
      .filter((nome) => !ALCANCE_NAO_ESTATICO.includes(nome));

    const nomes = [...new Set(foraDeAlcance)].sort();
    expect(
      nomes,
      `Sub-chave que a invalidação da base não alcança:\n  ${nomes.join("\n  ")}\n\n` +
        `Invalide a base inteira — ["base"] — ou inclua o sufixo na invalidação.`
    ).toEqual([]);
  });
});

/**
 * A semântica que o conserto depende, demonstrada com um QueryClient de verdade.
 *
 * Vale a pena provar em vez de afirmar: foi confiar na leitura errada — "o nome
 * começa igual, então a invalidação pega" — que produziu o defeito.
 */
describe("semântica de invalidação por prefixo", () => {
  it("sub-chave é alcançada pela invalidação da base; nome colado não", async () => {
    const { QueryClient } = await import("@tanstack/react-query");
    const qc = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false } },
    });

    const colada = ["sgsst_colaboradores_resumo", "e1"] as const;
    const subChave = ["sgsst_colaboradores", "resumo", "e1"] as const;
    const lista = ["sgsst_colaboradores", "e1", 0] as const;

    for (const k of [colada, subChave, lista]) {
      qc.setQueryData(k, { ok: true });
    }
    const obsoleta = (k: readonly unknown[]) =>
      qc.getQueryCache().find({ queryKey: k, exact: true })?.isStale();

    // `staleTime: Infinity` deixa tudo fresco antes da invalidação.
    expect(obsoleta(colada)).toBe(false);
    expect(obsoleta(subChave)).toBe(false);
    expect(obsoleta(lista)).toBe(false);

    await qc.invalidateQueries({ queryKey: ["sgsst_colaboradores"] });

    expect(obsoleta(lista), "a lista sempre foi invalidada").toBe(true);
    expect(obsoleta(subChave), "a sub-chave passa a ser invalidada — é o conserto").toBe(true);
    expect(
      obsoleta(colada),
      "o nome colado NÃO é alcançado — era o defeito do cartão de colaboradores"
    ).toBe(false);

    qc.clear();
  });

  it("invalidação escopada não alcança a sub-chave irmã", async () => {
    // Por que a invalidação das medidas da PT é SEM escopo de risco: escopada, ela
    // deixaria a folha da PT sair com as medidas de antes da edição.
    const { QueryClient } = await import("@tanstack/react-query");
    const qc = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false } },
    });

    const doRisco = ["sgsst_pt_medidas", "r1"] as const;
    const daPtInteira = ["sgsst_pt_medidas", "da_pt", "r1,r2"] as const;

    for (const k of [doRisco, daPtInteira]) {
      qc.setQueryData(k, { ok: true });
    }
    const obsoleta = (k: readonly unknown[]) =>
      qc.getQueryCache().find({ queryKey: k, exact: true })?.isStale();

    await qc.invalidateQueries({ queryKey: ["sgsst_pt_medidas", "r1"] });

    expect(obsoleta(doRisco), "a lista do risco editado é alcançada").toBe(true);
    expect(
      obsoleta(daPtInteira),
      "a leitura em bloco NÃO — o segundo elemento nunca vale 'da_pt'"
    ).toBe(false);

    await qc.invalidateQueries({ queryKey: ["sgsst_pt_medidas"] });

    expect(obsoleta(daPtInteira), "sem escopo, a invalidação alcança as duas").toBe(true);

    qc.clear();
  });
});
