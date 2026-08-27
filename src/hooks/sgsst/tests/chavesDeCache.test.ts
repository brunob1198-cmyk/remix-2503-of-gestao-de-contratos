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
 * As 32 chaves coladas que TÊM invalidação própria funcionam e não aparecem aqui.
 * As que faltam estão na lista `DIVIDA_CONHECIDA` — é uma catraca, no mesmo
 * espírito do `lint-ratchet`: chave nova nesse formato quebra o teste na hora, e
 * consertar uma das antigas exige tirá-la da lista, o que fica visível no diff.
 */

const RAIZ = path.join(process.cwd(), "src", "hooks");

/**
 * Consultas que hoje não são invalidadas por ninguém. Ficam obsoletas na tela até
 * o refetch por foco de janela ou nova montagem — o mesmo sintoma que o cartão de
 * colaboradores tinha.
 *
 * Não foram corrigidas junto porque trocar a chave de uma consulta muda a
 * identidade do cache dela, e mexer em quinze de uma vez no meio de uma campanha
 * de testes trocaria um defeito conhecido por vários desconhecidos. Cada uma
 * pede a base certa: `_detail` costuma pertencer à lista da entidade, `_historico`
 * também, mas quem confirma é quem mexe no módulo.
 */
const DIVIDA_CONHECIDA = [
  "cotacoes_mestre_detalhe",
  "projetos_analise",
  "sgsst_apr_arvore",
  "sgsst_apr_detail",
  "sgsst_documentos_historico",
  "sgsst_hht_sugerido",
  "sgsst_incidentes_detail",
  "sgsst_inspecoes_detail",
  "sgsst_nao_conformidades_detail",
  "sgsst_pcmso_detail",
  "sgsst_pgr_detail",
  "sgsst_pgr_historico",
  "sgsst_pt_detail",
  "sgsst_pt_medidas_da_pt",
  "sgsst_treinamentos_historico",
].sort();

function arquivosDeHook(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const p = path.join(dir, nome);
    if (statSync(p).isDirectory()) return nome === "tests" ? [] : arquivosDeHook(p);
    return /\.tsx?$/.test(nome) ? [p] : [];
  });
}

function coletar() {
  const consultadas = new Set<string>();
  const invalidadas = new Set<string>();

  for (const arq of arquivosDeHook(RAIZ)) {
    const fonte = readFileSync(arq, "utf8");
    for (const m of fonte.matchAll(/queryKey:\s*\[\s*"([a-zA-Z0-9_]+)"/g)) consultadas.add(m[1]);
    for (const m of fonte.matchAll(/invalidateQueries\(\{\s*queryKey:\s*\[\s*"([a-zA-Z0-9_]+)"/g)) {
      invalidadas.add(m[1]);
    }
  }
  return { consultadas, invalidadas };
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
});
