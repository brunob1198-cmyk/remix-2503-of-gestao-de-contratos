/**
 * Virgulas, parenteses e aspas sao separadores na sintaxe do filtro `or` do
 * PostgREST. Sem escapar, uma busca por "laudo, 2026" e interpretada como duas
 * condicoes e a query inteira falha com erro de sintaxe (400).
 *
 * Tambem neutraliza os curingas do LIKE (% e _), que de outro modo deixariam o
 * usuario alterar o padrao de busca sem perceber.
 */
export function escapeSearchTerm(term: string): string {
  return term
    .replace(/[,()"\\]/g, " ")
    .replace(/[%_]/g, (m) => `\\${m}`)
    .trim();
}
