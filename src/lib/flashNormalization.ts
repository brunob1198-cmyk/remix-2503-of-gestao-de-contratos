/**
 * Lógica de normalização automática de transações da Flash.
 *
 * Sempre que um lançamento da Flash é carregado, tentamos:
 *   1. Identificar o `flash_type` da transação.
 *   2. Procurar um mapeamento existente em `flash_category_mapping`.
 *   3. Se houver mapping → status = "normalizado" e dados prontos para envio.
 *   4. Caso contrário     → status = "pendente" (intervenção manual).
 *
 * Esta função NÃO envia nada para o Conta Azul — apenas prepara o payload.
 */

export interface FlashCategoryMappingLike {
  id?: string;
  flash_type: string;
  conta_azul_category_id: string | null;
  conta_azul_category_name: string | null;
  conta_azul_account_id: string | null;
  conta_azul_account_name: string | null;
  tipo_operacao: "receita" | "despesa";
}

export interface FlashRawTransactionLike {
  id: string;
  external_id?: string;
  payload_json?: any;
  // Se vier já parseado de uma row "derivada":
  flash_type?: string | null;
  descricao?: string | null;
  valor?: number | null;
  data?: string | null;
  usuario?: string | null;
}

export interface NormalizedFlashTransaction {
  flash_transaction_id: string;
  external_id: string | null;
  flash_type: string;
  status: "pendente" | "normalizado";
  tipo_operacao: "receita" | "despesa";
  conta_azul_category_id: string | null;
  conta_azul_category_name: string | null;
  conta_azul_account_id: string | null;
  conta_azul_account_name: string | null;
  /** ID do mapping aplicado, quando houver */
  mapping_id_usado: string | null;
  /** Dados auxiliares prontos para envio futuro ao Conta Azul */
  conta_azul_payload: {
    description: string;
    amount: number;
    date: string | null;
    type: "receita" | "despesa";
    category_id: string | null;
    category_name: string | null;
    account_id: string | null;
    account_name: string | null;
    external_id: string | null;
    flash_type: string;
  } | null;
  /** Quando true → requer intervenção manual antes de enviar */
  requires_manual_review: boolean;
  /** Motivo detalhado (sempre preenchido) */
  motivo: string;
  reason?: string;
}

const pickValue = (payload: any, paths: string[]): string | null => {
  if (!payload) return null;
  for (const p of paths) {
    const parts = p.split(".");
    let cur: any = payload;
    for (const k of parts) {
      cur = cur?.[k];
      if (cur == null) break;
    }
    if (typeof cur === "string" && cur.trim()) return cur.trim();
    if (typeof cur === "number") return String(cur);
  }
  return null;
};

const pickNumber = (payload: any, paths: string[]): number => {
  if (!payload) return 0;
  for (const p of paths) {
    const parts = p.split(".");
    let cur: any = payload;
    for (const k of parts) {
      cur = cur?.[k];
      if (cur == null) break;
    }
    if (typeof cur === "number") return cur;
    if (typeof cur === "string") {
      const n = Number(cur.replace(/[^0-9.,-]/g, "").replace(",", "."));
      if (!isNaN(n)) return n;
    }
  }
  return 0;
};

export const extractFlashType = (transaction: FlashRawTransactionLike): string => {
  if (transaction.flash_type && transaction.flash_type.trim()) {
    const type = transaction.flash_type.trim();
    if (type === "CORPORATE_CARD") return "Cartão Corporativo";
    return type;
  }
  const fromPayload = pickValue(transaction.payload_json, [
    "type",
    "tipo",
    "category",
    "categoria",
    "transaction_type",
    "expense_type",
  ]);
  
  if (fromPayload === "CORPORATE_CARD") return "Cartão Corporativo";
  return fromPayload || "indefinido";
};

/**
 * Indexa uma lista de mapeamentos por flash_type para lookup O(1).
 */
export const buildMappingIndex = (
  mappings: FlashCategoryMappingLike[]
): Map<string, FlashCategoryMappingLike> => {
  const idx = new Map<string, FlashCategoryMappingLike>();
  for (const m of mappings) {
    if (m.flash_type) idx.set(m.flash_type, m);
  }
  return idx;
};

/**
 * Normaliza uma transação individual da Flash usando o índice de mapeamentos.
 *
 * Retorna um objeto pronto para `upsert` em `flash_normalizacao` e, se possível,
 * o `conta_azul_payload` que será enviado futuramente ao Conta Azul.
 */
export const normalizeFlashTransaction = (
  transaction: FlashRawTransactionLike,
  mappingIndex: Map<string, FlashCategoryMappingLike>
): NormalizedFlashTransaction => {
  const flash_type = extractFlashType(transaction);
  const mapping = mappingIndex.get(flash_type);

  const payload = transaction.payload_json || {};
  const descricao =
    transaction.descricao ||
    pickValue(payload, ["description", "descricao", "merchant", "establishment", "name"]) ||
    "—";
  const valor =
    typeof transaction.valor === "number"
      ? transaction.valor
      : pickNumber(payload, ["amount", "value", "valor", "total"]);
  const data =
    transaction.data ||
    pickValue(payload, ["date", "data", "transaction_date", "created_at", "datetime"]);

  if (!mapping) {
    const motivo = `Pendente: nenhum mapeamento encontrado para o tipo Flash "${flash_type}". Defina manualmente categoria e conta financeira.`;
    return {
      flash_transaction_id: transaction.id,
      external_id: transaction.external_id ?? null,
      flash_type,
      status: "pendente",
      tipo_operacao: "despesa",
      conta_azul_category_id: null,
      conta_azul_category_name: null,
      conta_azul_account_id: null,
      conta_azul_account_name: null,
      mapping_id_usado: null,
      conta_azul_payload: null,
      requires_manual_review: true,
      motivo,
      reason: motivo,
    };
  }

  const hasFullMapping =
    !!mapping.conta_azul_category_id && !!mapping.conta_azul_account_id;

  const motivo = hasFullMapping
    ? `Normalizado automaticamente via mapping do tipo "${flash_type}" → ${mapping.conta_azul_category_name || mapping.conta_azul_category_id} / ${mapping.conta_azul_account_name || mapping.conta_azul_account_id}.`
    : `Pendente: mapping para "${flash_type}" existe mas está incompleto (faltando ${!mapping.conta_azul_category_id ? "categoria" : ""}${!mapping.conta_azul_category_id && !mapping.conta_azul_account_id ? " e " : ""}${!mapping.conta_azul_account_id ? "conta financeira" : ""}).`;

  return {
    flash_transaction_id: transaction.id,
    external_id: transaction.external_id ?? null,
    flash_type,
    status: hasFullMapping ? "normalizado" : "pendente",
    tipo_operacao: mapping.tipo_operacao,
    conta_azul_category_id: mapping.conta_azul_category_id,
    conta_azul_category_name: mapping.conta_azul_category_name,
    conta_azul_account_id: mapping.conta_azul_account_id,
    conta_azul_account_name: mapping.conta_azul_account_name,
    mapping_id_usado: mapping.id ?? null,
    conta_azul_payload: hasFullMapping
      ? {
          description: descricao,
          amount: valor,
          date: data,
          type: mapping.tipo_operacao,
          category_id: mapping.conta_azul_category_id,
          category_name: mapping.conta_azul_category_name,
          account_id: mapping.conta_azul_account_id,
          account_name: mapping.conta_azul_account_name,
          external_id: transaction.external_id ?? null,
          flash_type,
        }
      : null,
    requires_manual_review: !hasFullMapping,
    motivo,
    reason: hasFullMapping ? undefined : motivo,
  };
};

/**
 * Constrói o payload pronto para envio ao Conta Azul a partir de uma linha já normalizada.
 * Retorna null se a linha não tem dados suficientes.
 */
export const buildContaAzulPayload = (params: {
  descricao: string;
  valor: number;
  data: string | null;
  tipo_operacao: "receita" | "despesa";
  conta_azul_category_id: string | null;
  conta_azul_category_name: string | null;
  conta_azul_account_id: string | null;
  conta_azul_account_name: string | null;
  external_id: string | null;
  flash_type: string;
}) => {
  if (!params.conta_azul_category_id || !params.conta_azul_account_id) return null;
  return {
    description: params.descricao,
    amount: params.valor,
    date: params.data,
    type: params.tipo_operacao,
    category_id: params.conta_azul_category_id,
    category_name: params.conta_azul_category_name,
    account_id: params.conta_azul_account_id,
    account_name: params.conta_azul_account_name,
    external_id: params.external_id,
    flash_type: params.flash_type,
  };
};

/**
 * Normaliza um lote de transações de uma vez.
 */
export const normalizeFlashTransactionBatch = (
  transactions: FlashRawTransactionLike[],
  mappings: FlashCategoryMappingLike[]
): NormalizedFlashTransaction[] => {
  const idx = buildMappingIndex(mappings);
  return transactions.map((tx) => normalizeFlashTransaction(tx, idx));
};
