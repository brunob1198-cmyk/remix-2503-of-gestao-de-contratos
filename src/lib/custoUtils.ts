
/**
 * Calcula o custo direto orçado baseado no BDI de cada item produzido.
 * Garante que percentuais de Risco e Inflação não sejam somados ao custo direto,
 * conforme solicitação do usuário.
 * 
 * Fórmula: Custo = Valor Venda / BDI
 */
export function calculateCustoDiretoOrcado(
  producaoItens: { valor_total: number; bdi_item?: number }[], 
  mkp?: { bdi_venda?: number; perc_risco?: number; perc_inflacao?: number }
): number {
  return producaoItens.reduce((sum, p) => {
    // Se o item tem BDI próprio (do LPU), usa ele. 
    // Caso contrário, tenta usar o BDI global do projeto (MKP).
    // Se nenhum existir, assume 1 (custo = venda).
    const bdiItem = p.bdi_item || mkp?.bdi_venda || 1;
    
    // O custo é o valor de venda dividido pelo multiplicador BDI.
    // Ex: Se vendeu por 140 e o BDI é 1.4, o custo foi 100.
    const percCustoBase = bdiItem > 0 ? (1 / bdiItem) : 0;
    
    return sum + (p.valor_total * percCustoBase);
  }, 0);
}
