import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { debounce } from "lodash";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  buildContaAzulPayload,
  buildMappingIndex,
  normalizeFlashTransaction,
  type FlashCategoryMappingLike,
} from "@/lib/flashNormalization";

export interface ContaAzulOption {
  id: string;
  name: string;
  tipo?: string | null;
}

export interface FlashTransactionRow {
  id: string;
  external_id: string;
  payload_json: any;
  created_at: string;
  // derived
  data: string | null;
  descricao: string;
  valor: number;
  usuario: string;
  flash_type: string;
  flash_category: string;
  flash_cost_center: string;
  comentarios: string;
  flash_prestacao_contas: string;
  // normalization
  norm_id?: string;
  conta_azul_category_id?: string | null;
  conta_azul_category_name?: string | null;
  conta_azul_account_id?: string | null;
  conta_azul_account_name?: string | null;
  tipo_operacao?: "receita" | "despesa";
  status?: "pendente" | "normalizado" | "enviado";
  motivo?: string | null;
  flash_type_detectado?: string | null;
  mapping_id_usado?: string | null;
  conta_azul_payload?: any | null;
  enviado_at?: string | null;
}

interface CategoryMapping {
  id: string;
  flash_type: string;
  conta_azul_category_id: string | null;
  conta_azul_category_name: string | null;
  conta_azul_account_id: string | null;
  conta_azul_account_name: string | null;
  tipo_operacao: "receita" | "despesa";
}

const pickPayloadValue = (payload: any, paths: string[]): string | null => {
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

const pickPayloadNumber = (payload: any, paths: string[]): number => {
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

const parseFlashDate = (raw: string | null): string | null => {
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  return null;
};

const mapTransactionRow = (raw: any): FlashTransactionRow => {
  const p = raw.payload_json || {};
  const flash_type_raw = pickPayloadValue(p, ["type", "tipo", "category", "categoria", "transaction_type"]) || "indefinido";
  const typeTranslations: Record<string, string> = {
    "CORPORATE_CARD": "Cartão Corporativo",
    "MEAL": "Refeição",
    "FOOD": "Alimentação",
    "FUEL": "Combustível",
    "MOBILITY": "Mobilidade",
    "HEALTH": "Saúde",
    "CULTURE": "Cultura",
    "EDUCATION": "Educação",
    "GIFT": "Presente",
    "FLEXIBLE": "Flexível",
    "REWARD": "Recompensa",
    "EXPENSE_REFUND": "Reembolso",
  };
  const flash_type = typeTranslations[flash_type_raw] || flash_type_raw;
  const flash_category_raw = pickPayloadValue(p, ["category.name", "transaction.category", "categoria.nome", "category", "categoria", "transaction.categoryName"]) || "—";
  let flash_category = flash_category_raw;
  const categoryTranslations: Record<string, string> = {
    "Refeição": "Refeição", "MEAL": "Refeição", "Alimentação": "Alimentação", "FOOD": "Alimentação",
    "Combustível": "Combustível", "FUEL": "Combustível", "Mobilidade": "Mobilidade", "MOBILITY": "Mobilidade",
    "Saúde": "Saúde", "HEALTH": "Saúde", "Cultura": "Cultura", "CULTURE": "Cultura", "Educação": "Educação",
    "EDUCATION": "Educação", "Outros": "Outros", "OTHERS": "Outros", "Toll": "Pedágio", "TOLL": "Pedágio",
    "Parking": "Estacionamento", "PARKING": "Estacionamento"
  };
  if (categoryTranslations[flash_category_raw]) flash_category = categoryTranslations[flash_category_raw];
  const flash_prestacao_contas_raw = pickPayloadValue(p, ["status", "accountabilityStatus", "accountability_status", "prestacao_de_contas", "prestacaoDeContas", "accountability", "expenseStatus", "expense_status"]) || "—";
  const statusMap: Record<string, string> = {
    "DRAFT": "Em fechamento", "PENDING_ACCOUNTING": "Em aprovação", "PENDING": "Pendente", "APPROVED": "Aprovado",
    "COMPLETED": "Concluído", "REJECTED": "Rejeitado", "FINISHED": "Finalizado", "CANCELLED": "Cancelado",
    "PAID": "Pago", "OPEN": "Aberto", "IN_REVIEW": "Em revisão", "REFUNDED": "Reembolsado", "EXPIRED": "Expirado",
    "OVERDUE": "Atrasado", "REIMBURSED": "Reembolsado", "IN_ACCOUNTABILITY": "Em prestação de contas",
    "ACCOUNTABILITY_DRAFT": "Rascunho de prestação", "SUBMITTED": "Enviado", "SETTLED": "Liquidado",
    "PENDING_APPROVAL": "Aguardando aprovação", "REQUIRE_CHANGES": "Necessita alterações"
  };
  const flash_prestacao_contas = statusMap[flash_prestacao_contas_raw] || flash_prestacao_contas_raw;
  const rawDate = raw.transaction_date || pickPayloadValue(p, ["date", "data", "transaction_date", "created_at", "datetime"]);
  return {
    id: raw.id, external_id: raw.external_id, payload_json: p, created_at: raw.created_at, data: parseFlashDate(rawDate),
    descricao: pickPayloadValue(p, ["transaction.description", "description", "descricao", "merchant", "establishment.name", "establishment", "name"]) || "—",
    valor: pickPayloadNumber(p, ["amount", "value", "valor", "total"]) / 100,
    usuario: pickPayloadValue(p, ["employee.name", "user.name", "user.email", "usuario", "user_name"]) || "—",
    flash_type, flash_category, flash_prestacao_contas,
    flash_cost_center: pickPayloadValue(p, ["costCenter.name", "cost_center.name", "costCenter.code", "costCenter.externalId", "costCenter.id", "costCenterId", "cost_center_id", "employee.costCenter.name", "user.costCenter.name", "expense.costCenter.name", "accountability.costCenter.name", "transaction.costCenter.name", "centro_custo", "centroCusto", "costCenter", "cost_center", "employee.costCenter"]) || "—",
    comentarios: pickPayloadValue(p, ["comments", "comment", "observacao", "note", "notes", "memo", "remarks", "justification", "justificativa", "reason", "motivo", "accounting.comments", "receipt.comments", "expense.comments", "accountability.comments", "transaction.comments"]) || "—",
  };
};

export function useFlashNormalizacao() {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const queryClient = useQueryClient();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [transactions, setTransactions] = useState<FlashTransactionRow[]>([]);
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [categorias, setCategorias] = useState<ContaAzulOption[]>([]);
  const [contas, setContas] = useState<ContaAzulOption[]>([]);
  const [saasCostCenters, setSaasCostCenters] = useState<string[]>([]);
  const processedRef = useRef<Set<string>>(new Set());

  // 1. Query para buscar transações e normalizações (dados brutos do banco)
  const { data: rawData, isLoading: loadingRaw, refetch: refetchRaw } = useQuery({
    queryKey: ["flash_transactions", empresaId],
    queryFn: async () => {
      if (!empresaId) return { tx: [], norm: [] };
      const BATCH_SIZE = 1000;
      let allTx: any[] = [];
      let rangeStart = 0;
      let lastCount = 0;
      do {
        const { data, error } = await supabase.from("flash_transactions_raw").select("id, external_id, payload_json, created_at, transaction_date").eq("empresa_id", empresaId).order("created_at", { ascending: false }).range(rangeStart, rangeStart + BATCH_SIZE - 1);
        if (error) throw error;
        if (data) { allTx = [...allTx, ...data]; lastCount = data.length; rangeStart += BATCH_SIZE; } else { lastCount = 0; }
      } while (lastCount === BATCH_SIZE && allTx.length < 50000);

      let allNorm: any[] = [];
      rangeStart = 0;
      do {
        const { data, error } = await supabase.from("flash_normalizacao").select("*").eq("empresa_id", empresaId).range(rangeStart, rangeStart + BATCH_SIZE - 1);
        if (error) throw error;
        if (data) { allNorm = [...allNorm, ...data]; lastCount = data.length; rangeStart += BATCH_SIZE; } else { lastCount = 0; }
      } while (lastCount === BATCH_SIZE && allNorm.length < 50000);
      return { tx: allTx, norm: allNorm };
    },
    enabled: !!empresaId,
    staleTime: 10 * 60 * 1000,
  });

  // 2. Query para mapeamentos
  const { data: mappings = [], isLoading: loadingMappings } = useQuery({
    queryKey: ["flash_mappings", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await supabase.from("flash_category_mapping").select("*").eq("empresa_id", empresaId);
      if (error) throw error;
      return (data || []) as CategoryMapping[];
    },
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
  });

  // 3. Transformação e Normalização Automática (gera o estado mutável transactions)
  useEffect(() => {
    if (!rawData || !empresaId || loadingRaw || loadingMappings) return;

    const { tx, norm } = rawData;
    const normByTx = new Map();
    norm.forEach((n: any) => normByTx.set(n.flash_transaction_id, n));
    const flashAccount = contas.find(c => c.name?.toLowerCase().includes("flash"));
    const autoNormPayloads: any[] = [];

    const rows = tx.map((rawTx: any) => {
      const base = mapTransactionRow(rawTx);
      const n = normByTx.get(rawTx.id);
      if (n) {
        base.norm_id = n.id;
        base.conta_azul_category_id = n.conta_azul_category_id;
        base.conta_azul_category_name = n.conta_azul_category_name;
        base.conta_azul_account_id = n.conta_azul_account_id || (flashAccount?.id ?? null);
        base.conta_azul_account_name = n.conta_azul_account_name || (flashAccount?.name ?? null);
        base.tipo_operacao = n.tipo_operacao;
        base.status = n.status;
        base.motivo = n.motivo;
        base.flash_type_detectado = n.flash_type_detectado || base.flash_type;
        base.mapping_id_usado = n.mapping_id_usado;
        base.conta_azul_payload = n.conta_azul_payload;
        base.enviado_at = n.enviado_at;
        if (n.conta_azul_payload?.cost_center) base.flash_cost_center = n.conta_azul_payload.cost_center;
        return base;
      }

      const normalized = normalizeFlashTransaction({
        id: rawTx.id, external_id: rawTx.external_id, payload_json: rawTx.payload_json,
        flash_type: base.flash_type, flash_category: base.flash_category,
        flash_cost_center: base.flash_cost_center, descricao: base.descricao
      }, mappings as any[]);

      base.tipo_operacao = normalized.tipo_operacao;
      base.status = normalized.status;
      base.conta_azul_category_id = normalized.conta_azul_category_id;
      base.conta_azul_category_name = normalized.conta_azul_category_name;
      base.conta_azul_account_id = flashAccount?.id ?? normalized.conta_azul_account_id;
      base.conta_azul_account_name = flashAccount?.name ?? normalized.conta_azul_account_name;
      base.motivo = normalized.motivo;
      base.flash_type_detectado = normalized.flash_type;
      base.mapping_id_usado = normalized.mapping_id_usado;
      base.conta_azul_payload = normalized.conta_azul_payload;

      if (!processedRef.current.has(rawTx.id)) {
        autoNormPayloads.push({
          empresa_id: empresaId, flash_transaction_id: rawTx.id, ...base,
          normalizado_at: (base.status === "normalizado") ? new Date().toISOString() : null,
        });
        processedRef.current.add(rawTx.id);
      }
      return base;
    });

    setTransactions(rows);

    if (autoNormPayloads.length > 0) {
      const UPSERT_LIMIT = 100;
      for (let i = 0; i < autoNormPayloads.length; i += UPSERT_LIMIT) {
        supabase.from("flash_normalizacao").upsert(autoNormPayloads.slice(i, i + UPSERT_LIMIT), { onConflict: "flash_transaction_id" });
      }
    }
  }, [rawData, mappings, empresaId, contas, loadingRaw, loadingMappings]);

  const fetchMetadata = useCallback(async (force = false) => {
    setLoadingMetadata(true);
    try {
      const { data, error } = await supabase.functions.invoke("contaazul-metadata", { body: { force } });
      if (error) throw error;
      setCategorias(data?.categorias || []);
      setContas(data?.contas_financeiras || []);
    } catch (e: any) {
      setMetadataError(e.message);
      toast.error("Erro Conta Azul", { description: e.message });
    } finally {
      setLoadingMetadata(false);
    }
  }, []);

  useEffect(() => {
    if (empresaId) fetchMetadata();
  }, [empresaId, fetchMetadata]);

  // Buscar centros de custo do SaaS
  useEffect(() => {
    if (!empresaId) return;
    const fetchSaasData = async () => {
      const { data: areasData } = await supabase.from("areas").select("nome").eq("empresa_id", empresaId);
      const { data: projectsData } = await supabase.from("projetos").select("nome").eq("empresa_id", empresaId);
      const allNames = Array.from(new Set([...(areasData || []).map(a => a.nome), ...(projectsData || []).map(p => p.nome)])).filter(Boolean).sort();
      setSaasCostCenters(allNames);
    };
    fetchSaasData();
  }, [empresaId]);

  const saveNormalization = useCallback(async (row: FlashTransactionRow, patch: any, opts?: any) => {
    if (!empresaId || (row.status === "enviado" && !opts?.allowEditEnviado)) return;
    setSavingId(row.id);
    try {
      const flashAccount = contas.find(c => c.name?.toLowerCase().includes("flash"));
      const merged = { 
        ...row, 
        ...patch, 
        conta_azul_account_id: flashAccount?.id ?? patch.conta_azul_account_id ?? row.conta_azul_account_id,
        enviado_at: patch.status === "enviado" ? (row.enviado_at || new Date().toISOString()) : (patch.status === "normalizado" ? null : row.enviado_at)
      };
      if (merged.status === "pendente" && merged.conta_azul_category_id && merged.conta_azul_account_id) merged.status = "normalizado";

      const payload = buildContaAzulPayload({
        descricao: row.descricao, valor: row.valor, data: row.data, tipo_operacao: merged.tipo_operacao,
        conta_azul_category_id: merged.conta_azul_category_id, conta_azul_category_name: merged.conta_azul_category_name,
        conta_azul_account_id: merged.conta_azul_account_id, conta_azul_account_name: merged.conta_azul_account_name,
        external_id: row.external_id, flash_type: row.flash_type,
        comentarios: row.comentarios !== "—" ? row.comentarios : null,
        cost_center: row.flash_cost_center !== "—" ? row.flash_cost_center : null,
        force_pago: true
      });

      const { data: normData, error } = await supabase.from("flash_normalizacao").upsert({
        empresa_id: empresaId,
        flash_transaction_id: row.id,
        conta_azul_category_id: merged.conta_azul_category_id ?? null,
        conta_azul_category_name: merged.conta_azul_category_name ?? null,
        conta_azul_account_id: merged.conta_azul_account_id ?? null,
        conta_azul_account_name: merged.conta_azul_account_name ?? null,
        tipo_operacao: merged.tipo_operacao ?? "despesa",
        status: merged.status ?? "pendente",
        conta_azul_payload: payload,
        normalizado_at: (merged.status === "normalizado" || merged.status === "enviado") ? new Date().toISOString() : null,
        enviado_at: merged.status === "enviado" ? (row.enviado_at || new Date().toISOString()) : (merged.status === "normalizado" ? null : row.enviado_at),
      }, { onConflict: "flash_transaction_id" }).select().single();
      if (error) throw error;

      setTransactions(prev => prev.map(t => t.id === row.id ? { ...t, ...merged, norm_id: normData.id, conta_azul_payload: payload } : t));

      if (opts?.saveMapping && row.flash_type) {
        await supabase.from("flash_category_mapping").upsert({
          empresa_id: empresaId, flash_type: row.flash_type, flash_category: row.flash_category, flash_cost_center: row.flash_cost_center,
          conta_azul_category_id: merged.conta_azul_category_id, conta_azul_category_name: merged.conta_azul_category_name,
          conta_azul_account_id: merged.conta_azul_account_id, conta_azul_account_name: merged.conta_azul_account_name,
          tipo_operacao: merged.tipo_operacao,
        }, { onConflict: "empresa_id,flash_type,flash_category,flash_cost_center" });
        queryClient.invalidateQueries({ queryKey: ["flash_mappings", empresaId] });
      }
    } catch (e: any) {
      toast.error("Erro ao salvar", { description: e.message });
    } finally {
      setSavingId(null);
    }
  }, [empresaId, contas, queryClient]);

  const sendToContaAzul = async (ids: string[]) => {
    setSending(true);
    try {
      toast.info(`Enviando ${ids.length} lançamentos...`);
      // O nome correto da function é contaazul-send-transaction e o parâmetro é flash_transaction_ids
      const { data, error } = await supabase.functions.invoke("contaazul-send-transaction", { 
        body: { flash_transaction_ids: ids } 
      });
      if (error) throw error;
      
      if (data?.error) {
        toast.error("Erro no envio", { description: data.error });
      } else {
        queryClient.invalidateQueries({ queryKey: ["flash_transactions", empresaId] });
        toast.success("Envio concluído!");
      }
    } catch (e: any) {
      console.error("Erro sendToContaAzul:", e);
      toast.error("Falha ao enviar", { description: e.message || "Erro desconhecido" });
    } finally {
      setSending(false);
    }
  };

  const updateCostCenter = async (row: FlashTransactionRow, newVal: string) => {
    await saveNormalization(row, { flash_cost_center: newVal }, { allowEditEnviado: true });
  };

  const updateStatus = async (row: FlashTransactionRow, status: any) => {
    await saveNormalization(row, { status }, { allowEditEnviado: true });
  };

  const refresh = async (force = false) => {
    if (force) {
      processedRef.current.clear();
      await refetchRaw();
    }
  };

  const reopenEnviado = async (row: FlashTransactionRow) => {
    await saveNormalization(row, { status: "normalizado" }, { allowEditEnviado: true });
  };

  const bulkUpdateCostCenter = async (ids: string[], costCenter: string) => {
    for (const id of ids) {
      const row = transactions.find(t => t.id === id);
      if (row) {
        await saveNormalization(row, { flash_cost_center: costCenter }, { allowEditEnviado: true });
      }
    }
  };

  const bulkApplyToPending = async (ids: string[], params: any) => {
    for (const id of ids) {
      const row = transactions.find(t => t.id === id);
      if (row) {
        await saveNormalization(row, params);
      }
    }
  };

  const applyMappingToAllPending = async () => {
    const pending = transactions.filter(t => t.status === "pendente");
    for (const row of pending) {
      const normalized = normalizeFlashTransaction({
        id: row.id, flash_type: row.flash_type, flash_category: row.flash_category,
        flash_cost_center: row.flash_cost_center, descricao: row.descricao
      }, mappings as any[]);
      if (normalized.status === "normalizado") {
        await saveNormalization(row, normalized);
      }
    }
  };

  const reprocessAll = async () => {
    processedRef.current.clear();
    await refetchRaw();
  };

  return {
    loading: loadingRaw || loadingMappings, savingId, sending, transactions, mappings, categorias, contas, loadingMetadata, metadataError,
    refresh, refreshMetadata: fetchMetadata, saveNormalization, sendToContaAzul, updateCostCenter, saasCostCenters,
    updateStatus, mappingByType: new Map(),
    applyMappingToAllPending, bulkApplyToPending, reopenEnviado, reprocessAll, bulkUpdateCostCenter
  };
}

