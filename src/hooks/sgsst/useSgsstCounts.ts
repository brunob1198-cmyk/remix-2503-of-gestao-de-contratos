import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Subconjunto do construtor de filtros do PostgREST usado nas contagens.
 *
 * Declarado à mão em vez de `any`: os tipos gerados do Supabase ainda não
 * conhecem as tabelas SGSST, e esta interface dá autocomplete no `build` de cada
 * indicador sem abrir mão da checagem de tipos.
 */
export interface SgsstCountQuery {
  eq(column: string, value: unknown): SgsstCountQuery;
  neq(column: string, value: unknown): SgsstCountQuery;
  gt(column: string, value: unknown): SgsstCountQuery;
  gte(column: string, value: unknown): SgsstCountQuery;
  lt(column: string, value: unknown): SgsstCountQuery;
  lte(column: string, value: unknown): SgsstCountQuery;
  is(column: string, value: unknown): SgsstCountQuery;
  in(column: string, values: readonly unknown[]): SgsstCountQuery;
  not(column: string, operator: string, value: unknown): SgsstCountQuery;
  ilike(column: string, pattern: string): SgsstCountQuery;
}

/** O que interessa na resposta: o total do cabeçalho, não as linhas. */
interface CountResult {
  count: number | null;
  error: { message?: string; code?: string } | null;
}

export interface SgsstCountSpec {
  /** Chave de leitura no objeto retornado. */
  key: string;
  /** Filtros adicionais aplicados à contagem. Omitir conta a tabela inteira. */
  build?: (query: SgsstCountQuery) => SgsstCountQuery;
}

/** Contagem de um indicador, ou o erro que impediu de calculá-la. */
interface ResultadoContagem {
  key: string;
  count: number | null;
  erro: { message?: string; code?: string } | null;
}

/**
 * Contadores para os cartões de indicador das telas SGSST.
 *
 * As telas calculavam indicadores com `rows.filter(...).length` sobre a página
 * corrente, então "Total de PGRs" mostrava 25 quando havia 300 registros — e,
 * pior, "ASOs vencidos" e "EPIs abaixo do mínimo" subestimavam justamente os
 * números que disparam ação. Aqui cada indicador vira uma consulta
 * `head: true`, que devolve só a contagem e sempre sobre a base inteira.
 *
 * O RLS já restringe as linhas à empresa do usuário, então não é necessário
 * (nem correto) filtrar empresa_id manualmente aqui.
 */
export function useSgsstCounts(
  table: string,
  specs: SgsstCountSpec[],
  options?: { enabled?: boolean; staleTime?: number }
) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const specKeys = specs.map((s) => s.key).join(",");

  const { data, isLoading, error, refetch } = useQuery({
    // O nome da tabela vem primeiro de propósito: o react-query casa chaves por
    // prefixo, então os `invalidateQueries({ queryKey: ["sgsst_pgr"] })` que as
    // mutations já fazem também revalidam estes contadores, sem plumbing extra.
    queryKey: [table, "counts", specKeys, empresaId],
    enabled: !!empresaId && options?.enabled !== false,
    staleTime: options?.staleTime ?? 1000 * 60,
    queryFn: async (): Promise<ResultadoContagem[]> =>
      // Cada indicador é isolado: antes um `throw` aqui derrubava a consulta
      // inteira, e as telas — que só recebem `isLoading` — passavam a exibir
      // zero em TODOS os cartões. Zero é uma resposta plausível, então o
      // usuário não tinha como distinguir "não há nenhum" de "não deu para
      // contar". É a mesma confusão que a lista vazia causava antes do
      // resolveTableState. Acontece de verdade na janela entre subir o código e
      // rodar a migration: a coluna que o filtro usa ainda não existe.
      Promise.all(
        specs.map(async (spec): Promise<ResultadoContagem> => {
          // Sem `head: true`, e com `limit(1)` no lugar dele.
          //
          // Com `head: true` o supabase-js faz um HEAD e le o total do cabecalho
          // `Content-Range`. Na tela de Riscos isso voltava `count` nulo — e o
          // hook, corretamente, mostrava o fallback 0 — enquanto a MESMA tabela,
          // na mesma sessao, devolvia 25 na consulta da lista, que usa
          // `count: "exact"` sem head. A unica diferenca entre as duas era o
          // head, entao ele saiu.
          //
          // O `limit(1)` mantem o trafego baixo: vem uma linha de uma coluna, e
          // o total continua vindo no cabecalho.
          const base = supabase
            .from(table as never)
            .select("id", { count: "exact" })
            .limit(1) as unknown as SgsstCountQuery;

          const query = spec.build ? spec.build(base) : base;
          const { count, error: countError } = await (query as unknown as PromiseLike<CountResult>);

          if (countError) return { key: spec.key, count: null, erro: countError };
          return { key: spec.key, count: count ?? 0, erro: null };
        })
      ),
  });

  const resultados = data ?? [];
  const porChave = new Map(resultados.map((r) => [r.key, r]));

  const counts: Record<string, number> = Object.fromEntries(
    resultados.filter((r) => r.count !== null).map((r) => [r.key, r.count as number])
  );

  /** Chaves que falharam. Vazio quando tudo foi contado. */
  const indisponiveis = resultados.filter((r) => r.erro !== null).map((r) => r.key);

  return {
    /**
     * Devolve 0 para chave ausente ou não carregada. Use junto de
     * `indisponivel(key)` quando o cartão precisar distinguir zero de falha.
     */
    count: (key: string) => counts[key] ?? 0,
    /** True quando a contagem falhou — o cartão deve mostrar "—", não zero. */
    indisponivel: (key: string) => porChave.get(key)?.erro != null,
    /**
     * Valor pronto para o cartão: o número, ou "—" quando não deu para contar.
     * Enquanto carrega devolve 0, porque o cartão já mostra skeleton.
     */
    valorExibivel: (key: string): number | string =>
      porChave.get(key)?.erro != null ? "—" : (counts[key] ?? 0),
    indisponiveis,
    counts,
    isLoading,
    error,
    refetch,
  };
}
