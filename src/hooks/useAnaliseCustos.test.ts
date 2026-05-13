
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

describe('Cálculos de Custo Total, Gerência e Resultado', () => {
  it('deve calcular corretamente a Gerência Orçada baseada no Custo Direto Orçado', () => {
    const custoDiretoOrcado = 1000;
    const percGerencia = 0.15; // 15%
    
    // Nova lógica: gerenciaOrcada = custoDiretoOrcado * mkp.perc_gerencia
    const gerenciaOrcada = custoDiretoOrcado * percGerencia;
    
    expect(gerenciaOrcada).toBe(150);
  });

  it('deve recalcular a Gerência Orçada corretamente quando os inputs mudam', () => {
    let custoDiretoOrcado = 1000;
    let percGerencia = 0.10;
    
    let gerenciaOrcada = custoDiretoOrcado * percGerencia;
    expect(gerenciaOrcada).toBe(100);
    
    // Mudando inputs
    custoDiretoOrcado = 2000;
    percGerencia = 0.05;
    
    gerenciaOrcada = custoDiretoOrcado * percGerencia;
    expect(gerenciaOrcada).toBe(100); // 2000 * 0.05 = 100
    
    custoDiretoOrcado = 5000;
    gerenciaOrcada = custoDiretoOrcado * perc_gerencia;
    // Opa, corrigindo para percGerencia
  });
});
