// Regras visuais de "cotação atrasada" (sem resposta do fornecedor).
// Ajuste esta constante para calibrar o alerta.
export const DIAS_COTACAO_ATRASADA = 3;

/**
 * Retorna quantos dias a cotação está atrasada.
 * Se `validade` existe -> atrasada se hoje > validade (dias = hoje - validade).
 * Caso contrário -> atrasada se (hoje - created_at) > DIAS_COTACAO_ATRASADA.
 * Retorna 0 quando não está atrasada.
 */
export function diasCotacaoAtrasada(
  cotacao: { status?: string | null; created_at?: string | null; validade?: string | null },
  hoje: Date = new Date()
): number {
  if (!cotacao || cotacao.status !== "pendente") return 0;

  const ms = 24 * 60 * 60 * 1000;
  const today = new Date(hoje);
  today.setHours(0, 0, 0, 0);

  if (cotacao.validade) {
    const val = new Date(cotacao.validade);
    val.setHours(0, 0, 0, 0);
    const diff = Math.floor((today.getTime() - val.getTime()) / ms);
    return diff > 0 ? diff : 0;
  }

  if (!cotacao.created_at) return 0;
  const created = new Date(cotacao.created_at);
  created.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - created.getTime()) / ms);
  return diff > DIAS_COTACAO_ATRASADA ? diff : 0;
}

export function isCotacaoAtrasada(
  cotacao: { status?: string | null; created_at?: string | null; validade?: string | null },
  hoje: Date = new Date()
): boolean {
  return diasCotacaoAtrasada(cotacao, hoje) > 0;
}
