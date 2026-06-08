/**
 * Lógica de normalização automática de transações da Flash.
 * PROMPT DE APRENDIZADO CONTÍNUO (REFORÇADO):
 * 1. PRIORIDADE ESPECÍFICA: Sempre buscar o mapeamento mais específico (Descrição > Cat+CC > Cat > CC > Tipo).
 * 2. ADAPTABILIDADE: Se houver múltiplos mapeamentos para o mesmo tipo, usar o histórico de frequência e data de atualização.
 * 3. PADRÕES DINÂMICOS: Identificar padrões em descrições (ex: "UBER", "IFOOD") mesmo sem mapeamento exato, sugerindo categorias com base em similaridade.
 * 4. FEEDBACK LOOP: Cada ajuste manual do usuário reforça o mapeamento para aquela combinação de atributos, servindo de "ground truth" para normalizações futuras.
 */


export interface FlashCategoryMappingLike {
  id?: string;
  flash_type: string;
  flash_category?: string | null;
  flash_cost_center?: string | null;
  flash_description_pattern?: string | null;
  conta_azul_category_id: string | null;
  conta_azul_category_name: string | null;
  conta_azul_account_id: string | null;
  conta_azul_account_name: string | null;
  tipo_operacao: "receita" | "despesa";
  updated_at?: string | null;
}


export interface FlashRawTransactionLike {
  id: string;
  external_id?: string;
  payload_json?: any;
  // Se vier já parseado de uma row "derivada":
  flash_type?: string | null;
  flash_category?: string | null;
  flash_cost_center?: string | null;
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
  mapping_id_usado: string | null;
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
    comentarios: string | null;
    cost_center: string | null;
  } | null;
  requires_manual_review: boolean;
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
    
    // Se cur for um array, tenta pegar o primeiro item se for string ou tiver .name
    if (Array.isArray(cur) && cur.length > 0) {
      const first = cur[0];
      if (typeof first === 'string' && first.trim()) return first.trim();
      if (first && typeof first === 'object') {
        if (first.name && typeof first.name === 'string' && first.name.trim()) return first.name.trim();
        if (first.text && typeof first.text === 'string' && first.text.trim()) return first.text.trim();
      }
    }

    // Se cur for um objeto (ex: {name: "Marketing", code: "123"}), tenta pegar campos comuns de texto
    if (cur !== null && typeof cur === 'object' && !Array.isArray(cur)) {
      const candidates = ["name", "text", "description", "value", "code", "label", "display_name", "title"];
      for (const cand of candidates) {
        if (cur[cand] && typeof cur[cand] === 'string' && cur[cand].trim()) {
          return cur[cand].trim();
        }
      }
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
      const clean = cur.replace(/[^0-9.,-]/g, "").replace(",", ".");
      const n = parseFloat(clean);
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
 * Normaliza uma transação individual da Flash usando o índice de mapeamentos.
 * Implementa lógica de matching prioritária (mais específico para menos específico).
 */
export const normalizeFlashTransaction = (
  transaction: FlashRawTransactionLike,
  mappings: FlashCategoryMappingLike[]
): NormalizedFlashTransaction => {
  const flash_type = extractFlashType(transaction);
  const payload = transaction.payload_json || {};
  
  // Extrair metadados para matching inteligente
  const flash_category = transaction.flash_category || pickValue(payload, [
    "category.name", 
    "transaction.category", 
    "categoria.nome", 
    "category", 
    "categoria",
    "transaction.categoryName",
  ]) || "—";
  const flash_cost_center = transaction.flash_cost_center || pickValue(payload, [
    // Prioridade: Campos diretos de centro de custo
    "costCenter.name", 
    "cost_center.name", 
    "costCenter.code", 
    "costCenter.externalId", 
    "costCenterId", 
    "cost_center_id", 
    // Objeto dentro de employee/user
    "employee.costCenter.name", 
    "user.costCenter.name", 
    "employee.cost_center.name", 
    "user.cost_center.name", 
    // Nível superior
    "centro_custo", 
    "centroCusto",
    "costCenter", 
    "cost_center",
    // Aninhados em expense/accountability
    "expense.costCenter.name", 
    "expense.cost_center.name",
    "accountability.costCenter.name",
    "accountability.cost_center.name",
    // CORPORATE_CARD fallbacks
    "employee.costCenter",
    "employee.cost_center",
    "employee.centro_custo",
    "employee.centroCusto"
  ]) || "—";
  const descricao = transaction.descricao || pickValue(payload, ["description", "descricao", "merchant", "establishment", "name", "comments"]) || "—";
  const comentarios = pickValue(payload, [
    "comments", "comment", "observacao", "observation", "note", "notes", 
    "justification", "justificativa", "reason", "motivo", "memo",
    "expense.comments", "accountability.comments", "expense.justification",
    "expense.description", "transaction.description", "transaction.comments",
    "receipt.comments", "accounting.comments"
  ]) || null;
  
  // Flash API retorna amounts em centavos (inteiros). Ex: 4680 = R$46,80.
  // Se transaction.valor já foi pré-processado (dividido por 100 no hook), usamos direto.
  // Caso contrário, pegamos do payload (centavos) e dividimos por 100.
  const valor = typeof transaction.valor === "number"
    ? transaction.valor  // Já está em reais (pré-processado pelo hook)
    : pickNumber(payload, ["amount", "value", "valor", "total"]) / 100;  // Centavos → reais
  const data = transaction.data || pickValue(payload, ["date", "data", "transaction_date", "created_at", "datetime"]);

  // A conta financeira correta para o Conta Azul é apenas "Flash"
  // Vamos buscar dinamicamente no hook, mas deixamos um ID fallback aqui se necessário
  const fallbackAccountId = "679d675b-006f-474a-be93-b68480396557"; 
  const fallbackAccountName = "Flash";

  // Encontrar o melhor mapping baseado em especificidade e reforço de aprendizado
  const sortedMappings = [...mappings].sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;
    
    // Critérios de pontuação (REFORÇADO):
    // 1. Descrição exata ou padrão (mais específico)
    // 2. Categoria + Centro de Custo
    // 3. Categoria
    // 4. Centro de Custo
    // 5. Recência (ajustes mais novos têm peso maior no aprendizado)
    
    if (a.flash_description_pattern) scoreA += 100;
    if (a.flash_category && a.flash_cost_center) scoreA += 50;
    else if (a.flash_category) scoreA += 30;
    else if (a.flash_cost_center) scoreA += 20;
    
    if (b.flash_description_pattern) scoreB += 100;
    if (b.flash_category && b.flash_cost_center) scoreB += 50;
    else if (b.flash_category) scoreB += 30;
    else if (b.flash_cost_center) scoreB += 20;

    // Critério de desempate: recência (aprendizado contínuo)
    if (scoreA === scoreB) {
      const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return dateB - dateA;
    }
    
    return scoreB - scoreA;
  });

  const mapping = sortedMappings.find(m => {
    if (m.flash_type !== flash_type) return false;
    
    // Se o mapping define padrão de descrição, ele tem precedência absoluta
    if (m.flash_description_pattern) {
      const pattern = m.flash_description_pattern.toLowerCase().trim();
      const descLower = descricao.toLowerCase();
      // Match inteligente: permite match se o padrão estiver contido na descrição
      if (descLower.includes(pattern)) return true;
    }
    
    // Mapeamento por Categoria e/ou Centro de Custo
    const catMatch = m.flash_category ? m.flash_category === flash_category : true;
    const ccMatch = m.flash_cost_center ? m.flash_cost_center === flash_cost_center : true;
    
    // Para um match ser válido, ele deve bater em todos os campos definidos no mapping
    // Se o mapping define apenas tipo, CC e Cat devem ser nulos no mapping para bater aqui (ou baterem com os da tx)
    return catMatch && ccMatch;
  });


  if (!mapping) {
    const motivo = `Pendente: nenhum mapeamento encontrado para o tipo "${flash_type}" [Cat: ${flash_category} | CC: ${flash_cost_center}].`;
    return {
      flash_transaction_id: transaction.id,
      external_id: transaction.external_id ?? null,
      flash_type,
      status: "pendente",
      tipo_operacao: "despesa",
      conta_azul_category_id: null,
      conta_azul_category_name: null,
      conta_azul_account_id: fallbackAccountId,
      conta_azul_account_name: fallbackAccountName,
      mapping_id_usado: null,
      conta_azul_payload: null,
      requires_manual_review: true,
      motivo,
      reason: motivo,
    };
  }

  const categoryId = mapping.conta_azul_category_id;
  const categoryName = mapping.conta_azul_category_name;
  const finalAccountId = mapping.conta_azul_account_id || fallbackAccountId;
  const finalAccountName = mapping.conta_azul_account_name || fallbackAccountName;
  const hasFullMapping = !!categoryId && !!finalAccountId;

  const motivo = hasFullMapping
    ? `Normalizado automaticamente via mapping inteligente ("${flash_type}" + detalhes) → ${categoryName || categoryId}.`
    : `Pendente: mapping encontrado mas incompleto.`;

  return {
    flash_transaction_id: transaction.id,
    external_id: transaction.external_id ?? null,
    flash_type,
    status: hasFullMapping ? "normalizado" : "pendente",
    tipo_operacao: mapping.tipo_operacao,
    conta_azul_category_id: categoryId,
    conta_azul_category_name: categoryName,
    conta_azul_account_id: finalAccountId,
    conta_azul_account_name: finalAccountName,
    mapping_id_usado: mapping.id ?? null,
    conta_azul_payload: hasFullMapping
      ? {
          description: descricao,
          amount: valor,
          date: data,
          type: mapping.tipo_operacao,
          category_id: categoryId,
          category_name: categoryName,
          account_id: finalAccountId,
          account_name: finalAccountName,
          external_id: transaction.external_id ?? null,
          flash_type,
          comentarios,
          cost_center: flash_cost_center !== "—" ? flash_cost_center : null,
        }
      : null,
    requires_manual_review: !hasFullMapping,
    motivo,
    reason: hasFullMapping ? undefined : motivo,
  };
};

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
  comentarios?: string | null;
  cost_center?: string | null;
  force_pago?: boolean;
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
    comentarios: params.comentarios ?? null,
    cost_center: params.cost_center ?? null,
    force_pago: true,
  };
};

export const normalizeFlashTransactionBatch = (
  transactions: FlashRawTransactionLike[],
  mappings: FlashCategoryMappingLike[]
): NormalizedFlashTransaction[] => {
  return transactions.map((tx) => normalizeFlashTransaction(tx, mappings));
};

export const buildMappingIndex = (
  mappings: FlashCategoryMappingLike[]
): Map<string, FlashCategoryMappingLike> => {
  const idx = new Map<string, FlashCategoryMappingLike>();
  for (const m of mappings) {
    if (m.flash_type) idx.set(m.flash_type, m);
  }
  return idx;
};
