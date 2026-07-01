/**
 * Regra única de decisão real vs forecast por mês.
 * - Meses passados: usa produção real (`mensal`).
 * - Mês corrente e futuros (`col.isFuture === true`): usa o forecast manual
 *   (`forecast_data`, com fallback para `forecast`).
 *
 * Usar este helper em TODOS os locais (tabela, subtotais, cards) para evitar
 * divergências como dupla contagem no mês corrente.
 */
export type ForecastColumn = { key: string; isFuture: boolean };

export function pickForecastValue(projeto: any, col: ForecastColumn): number {
  if (col.isFuture) {
    const fd = projeto?.forecast_data?.[col.key];
    const f = projeto?.forecast?.[col.key];
    return Number(fd ?? f ?? 0);
  }
  return Number(projeto?.mensal?.[col.key] ?? 0);
}

export function sumForecastValues(
  projetos: any[],
  cols: ForecastColumn[],
): number {
  return projetos.reduce(
    (acc, p) => acc + cols.reduce((s, c) => s + pickForecastValue(p, c), 0),
    0,
  );
}
