
import { describe, it, expect } from 'vitest';
import { calculateCustoDiretoOrcado } from '../lib/custoUtils';

describe('calculateCustoDiretoOrcado', () => {
  it('deve calcular o custo base usando o BDI do item', () => {
    const producaoItens = [
      { valor_total: 100, bdi_item: 2.0 }, // Custo esperado: 50
      { valor_total: 150, bdi_item: 1.5 }, // Custo esperado: 100
    ];
    const mkp = { bdi_venda: 1.4, perc_risco: 0.1, perc_inflacao: 0.05 };
    
    const result = calculateCustoDiretoOrcado(producaoItens, mkp);
    
    // O resultado deve ser 50 + 100 = 150.
    // Risco (0.1) e Inflação (0.05) do MKP devem ser ignorados.
    expect(result).toBe(150);
  });

  it('deve usar o BDI do MKP quando o item não tiver BDI', () => {
    const producaoItens = [
      { valor_total: 200 }, // Usa BDI 2.0 do MKP -> 100
    ];
    const mkp = { bdi_venda: 2.0 };
    
    const result = calculateCustoDiretoOrcado(producaoItens, mkp);
    expect(result).toBe(100);
  });

  it('deve retornar o próprio valor se BDI for 1 ou indefinido', () => {
    const producaoItens = [
      { valor_total: 100 },
    ];
    // Sem mkp ou mkp sem bdi_venda, bdiItem será 1
    const result = calculateCustoDiretoOrcado(producaoItens, undefined);
    expect(result).toBe(100); // 100 / 1
  });

  it('deve garantir que perc_risco e perc_inflacao não alterem o custo direto orçado', () => {
    const producaoItens = [{ valor_total: 100, bdi_item: 1.0 }];
    
    const mkpSemExtras = { bdi_venda: 1.0, perc_risco: 0, perc_inflacao: 0 };
    const mkpComExtras = { bdi_venda: 1.0, perc_risco: 0.5, perc_inflacao: 0.5 };
    
    const resultSem = calculateCustoDiretoOrcado(producaoItens, mkpSemExtras);
    const resultCom = calculateCustoDiretoOrcado(producaoItens, mkpComExtras);
    
    expect(resultSem).toBe(100);
    expect(resultCom).toBe(100);
    expect(resultSem).toBe(resultCom);
  });
});
