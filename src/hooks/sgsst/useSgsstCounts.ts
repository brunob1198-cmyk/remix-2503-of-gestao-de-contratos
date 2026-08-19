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

/** Resultado de uma consulta `head: true`: só a contagem, sem linhas. */
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
    queryFn: async (): Promise<Record<string, number>> => {
      const results = await Promise.all(
        specs.map(async (spec) => {
          const base = supabase
            .from(table as never)
            .select("id", { count: "exact", head: true }) as unknown as SgsstCountQuery;

          const query = spec.build ? spec.build(base) : base;
          const { count, error: countError } = (await (query as unknown as PromiseLike<CountResult>));

          if (countError) throw countError;
          return [spec.key, count ?? 0] as const;
        })
      );

      return Object.fromEntries(results);
    },
  });

  const counts: Record<string, number> = data ?? {};

  return {
    /** Devolve 0 para chaves ainda não carregadas, evitando `undefined` na UI. */
    count: (key: string) => counts[key] ?? 0,
    counts,
    isLoading,
    error,
    refetch,
  };
}
