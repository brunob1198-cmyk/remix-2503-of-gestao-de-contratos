import { describe, it, expect } from 'vitest';
import { 
  extractFlashType, 
  normalizeFlashTransaction, 
  type FlashRawTransactionLike,
  type FlashCategoryMappingLike
} from '../flashNormalization';

// Mapeamentos de teste básicos
const mockMappings: FlashCategoryMappingLike[] = [
  {
    flash_type: "Cartão Corporativo",
    conta_azul_category_id: "cat-1",
    conta_azul_category_name: "Despesas Corporativas",
    conta_azul_account_id: "acc-1",
    conta_azul_account_name: "Flash",
    tipo_operacao: "despesa"
  },
  {
    flash_type: "Combustível",
    conta_azul_category_id: "cat-2",
    conta_azul_category_name: "Combustível",
    conta_azul_account_id: "acc-1",
    conta_azul_account_name: "Flash",
    tipo_operacao: "despesa"
  },
  {
    flash_type: "Refeição",
    conta_azul_category_id: "cat-3",
    conta_azul_category_name: "Alimentação",
    conta_azul_account_id: "acc-1",
    conta_azul_account_name: "Flash",
    tipo_operacao: "despesa"
  }
];

describe('Flash Normalization - Cost Center Extraction', () => {
  it('deve extrair centro de custo em CORPORATE_CARD via employee.costCenter (formato objeto)', () => {
    const payload = {
      id: "N4QR_cZc65GdJqKMQBCwe",
      amount: 16466,
      type: "CORPORATE_CARD",
      employee: {
        id: "emp-1",
        name: "JOAO SILVA",
        costCenter: {
          id: "cc-123",
          name: "VENDAS",
          code: "1001"
        }
      }
    };

    const transaction: FlashRawTransactionLike = {
      id: "tx-1",
      payload_json: payload
    };

    const result = normalizeFlashTransaction(transaction, mockMappings);
    
    expect(result.flash_type).toBe("Cartão Corporativo");
    expect(result.conta_azul_payload?.cost_center).toBe("VENDAS");
  });

  it('deve extrair centro de custo quando costCenter está no nível raiz (formato string)', () => {
    const payload = {
      amount: 5000,
      type: "Refeição",
      costCenter: "MARKETING"
    };

    const transaction: FlashRawTransactionLike = {
      id: "tx-2",
      payload_json: payload,
      flash_type: "Refeição"
    };

    const result = normalizeFlashTransaction(transaction, mockMappings);
    expect(result.conta_azul_payload?.cost_center).toBe("MARKETING");
  });

  it('deve extrair centro de custo via expense.costCenter.name', () => {
    const payload = {
      amount: 3000,
      type: "Combustível",
      expense: {
        costCenter: {
          name: "LOGÍSTICA"
        }
      }
    };

    const transaction: FlashRawTransactionLike = {
      id: "tx-3",
      payload_json: payload
    };

    const result = normalizeFlashTransaction(transaction, mockMappings);
    expect(result.conta_azul_payload?.cost_center).toBe("LOGÍSTICA");
  });

  it('deve extrair comentários de diferentes campos (comments, justification, memo)', () => {
    const scenarios = [
      { payload: { comments: "Almoço com cliente", type: "Refeição" }, expected: "Almoço com cliente" },
      { payload: { justification: "Viagem técnica", type: "Combustível" }, expected: "Viagem técnica" },
      { payload: { memo: "Reembolso km", type: "Combustível" }, expected: "Reembolso km" },
      { payload: { expense: { comments: "Via expense" }, type: "Combustível" }, expected: "Via expense" }
    ];

    scenarios.forEach(({ payload, expected }) => {
      const transaction: FlashRawTransactionLike = {
        id: "tx-comm",
        payload_json: payload
      };
      const result = normalizeFlashTransaction(transaction, mockMappings);
      expect(result.conta_azul_payload?.comentarios).toBe(expected);
    });
  });

  it('deve lidar com falhas graciosamente retornando null ou "—" quando não encontrado', () => {
    const payload = { amount: 1000, type: "Combustível" };
    const transaction: FlashRawTransactionLike = { id: "tx-none", payload_json: payload };
    const result = normalizeFlashTransaction(transaction, mockMappings);
    
    expect(result.conta_azul_payload?.cost_center).toBeNull();
  });

  it('deve anexar o nome do usuario na descricao usando " - "', () => {
    const payload = {
      amount: 2050,
      type: "Refeição",
      employee: { name: "Rodrigo Tiago Santos" },
      merchant: "rp3*ROUTE 60 SALGADOS ABADIANIA BRA"
    };

    const transaction: FlashRawTransactionLike = {
      id: "tx-desc-user",
      payload_json: payload,
      descricao: "rp3*ROUTE 60 SALGADOS ABADIANIA BRA",
      usuario: "Rodrigo Tiago Santos"
    };

    const result = normalizeFlashTransaction(transaction, mockMappings);
    expect(result.conta_azul_payload?.description).toBe("rp3*ROUTE 60 SALGADOS ABADIANIA BRA - Rodrigo Tiago Santos");
  });
});
