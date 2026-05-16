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
      type: "MEAL",
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
      type: "FUEL",
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

  it('deve extrair centro de custo via accountability.costCenter.name', () => {
    const payload = {
      amount: 4500,
      type: "OTHER",
      accountability: {
        costCenter: {
          name: "ADMINISTRATIVO"
        }
      }
    };

    const transaction: FlashRawTransactionLike = {
      id: "tx-4",
      payload_json: payload
    };

    const result = normalizeFlashTransaction(transaction, []); // Mapping vazio para testar só extração
    // No normalizeFlashTransaction, se não houver mapping o payload_conta_azul é null, 
    // então precisamos checar a extração interna se possível ou garantir um mapping.
    
    const mappingWithOther: FlashCategoryMappingLike[] = [{
      flash_type: "other",
      conta_azul_category_id: "c1",
      conta_azul_category_name: "C1",
      conta_azul_account_id: "a1",
      conta_azul_account_name: "A1",
      tipo_operacao: "despesa"
    }];

    const resultWithMapping = normalizeFlashTransaction(transaction, mappingWithOther);
    expect(resultWithMapping.conta_azul_payload?.cost_center).toBe("ADMINISTRATIVO");
  });

  it('deve extrair comentários de diferentes campos (comments, justification, memo)', () => {
    const scenarios = [
      { payload: { comments: "Almoço com cliente" }, expected: "Almoço com cliente" },
      { payload: { justification: "Viagem técnica" }, expected: "Viagem técnica" },
      { payload: { memo: "Reembolso km" }, expected: "Reembolso km" },
      { payload: { expense: { comments: "Via expense" } }, expected: "Via expense" }
    ];

    scenarios.forEach(({ payload, expected }) => {
      const transaction: FlashRawTransactionLike = {
        id: "tx-comm",
        payload_json: { type: "FUEL", ...payload }
      };
      const result = normalizeFlashTransaction(transaction, mockMappings);
      expect(result.conta_azul_payload?.comentarios).toBe(expected);
    });
  });

  it('deve lidar com falhas graciosamente retornando null ou "—" quando não encontrado', () => {
    const payload = { amount: 1000, type: "FUEL" };
    const transaction: FlashRawTransactionLike = { id: "tx-none", payload_json: payload };
    const result = normalizeFlashTransaction(transaction, mockMappings);
    
    expect(result.conta_azul_payload?.cost_center).toBeNull();
  });
});
