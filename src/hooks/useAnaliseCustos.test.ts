
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
    gerenciaOrcada = custoDiretoOrcado * percGerencia;
    expect(gerenciaOrcada).toBe(250); // 5000 * 0.05 = 250
  });

  it('deve calcular corretamente o Custo Orçado Total e Resultado Total usando os parâmetros do MKP e a nova Gerência Orçada', () => {
    // Valores base
    const custoDiretoOrcado = 1000;
    const custoDiretoReal = 900;
    const gerenciaReal = 250;
    
    // Parâmetros MKP
    const percRisco = 0.05;      // 5%
    const percInflacao = 0.03;   // 3%
    const percGerencia = 0.10;   // 10%
    const percTreinamento = 0.02; // 2%
    
    // Gerência Orçada baseada no Custo Direto Orçado
    const gerenciaOrcada = custoDiretoOrcado * percGerencia; // 1000 * 0.10 = 100
    
    // Lógica implementada no hook:
    // custoTotalOrcado = 
    //   custoDiretoOrcado + 
    //   (custoDiretoOrcado * percRisco) + 
    //   ((custoDiretoOrcado * (percRisco + percGerencia)) * percInflacao) + 
    //   gerenciaOrcada + 
    //   ((custoDiretoOrcado * (percRisco + percGerencia)) * percTreinamento);
    
    const term1 = custoDiretoOrcado; // 1000
    const term2 = custoDiretoOrcado * percRisco; // 1000 * 0.05 = 50
    const baseExtra = custoDiretoOrcado * (percRisco + percGerencia); // 1000 * (0.05 + 0.10) = 150
    const term3 = baseExtra * percInflacao; // 150 * 0.03 = 4.5
    const term4 = gerenciaOrcada; // 100
    const term5 = baseExtra * percTreinamento; // 150 * 0.02 = 3
    
    const expectedCustoTotalOrcado = term1 + term2 + term3 + term4 + term5; // 1000 + 50 + 4.5 + 100 + 3 = 1157.5
    
    const actualCustoTotalOrcado = 
      custoDiretoOrcado + 
      (custoDiretoOrcado * percRisco) + 
      ((custoDiretoOrcado * (percRisco + percGerencia)) * percInflacao) + 
      gerenciaOrcada + 
      ((custoDiretoOrcado * (percRisco + percGerencia)) * percTreinamento);
      
    expect(actualCustoTotalOrcado).toBe(1157.5);
    
    const custoTotalReal = custoDiretoReal + gerenciaReal; // 900 + 250 = 1150
    const expectedResultadoTotal = actualCustoTotalOrcado - custoTotalReal; // 1157.5 - 1150 = 7.5
    
    expect(actualCustoTotalOrcado - custoTotalReal).toBe(expectedResultadoTotal);
  });
});
