import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { debounce } from "lodash";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  buildContaAzulPayload,
  normalizeFlashTransaction,
  translateFlashCategory,
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
  flash_category?: string | null;
  flash_cost_center?: string | null;
  flash_description_pattern?: string | null;
  conta_azul_category_id: string | null;
  conta_azul_category_name: string | null;
  conta_azul_account_id: string | null;
  conta_azul_account_name: string | null;
  tipo_operacao: "receita" | "despesa";
  manual_confirmations?: number | null;
  learned?: boolean | null;
  last_feedback_at?: string | null;
  last_feedback_source?: string | null;
  updated_at?: string | null;
}

type SaveNormalizationOptions = {
  allowEditEnviado?: boolean;
  saveMapping?: boolean;
  saveMappingPerType?: boolean;
  learnFromEdit?: boolean;
};

const LEARNING_THRESHOLD = 3;

const normalizeMappingDimension = (value?: string | null): string => {
  const clean = value?.trim();
  return clean && clean !== "—" ? clean : "*";
};

const isSameMappingDimension = (left?: string | null, right?: string | null): boolean => {
  return normalizeMappingDimension(left).toLowerCase() === normalizeMappingDimension(right).toLowerCase();
};

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
  const flash_category = translateFlashCategory(flash_category_raw) || "—";
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
  const transactionsRef = useRef<FlashTransactionRow[]>([]);

  useEffect(() => {
    transactionsRef.current = transactions;
  }, [transactions]);

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

  const mappingByType = useMemo(() => {
    const index = new Map<string, CategoryMapping[]>();
    (mappings as CategoryMapping[]).forEach((mapping) => {
      if (!mapping.learned && (mapping.manual_confirmations ?? 0) < LEARNING_THRESHOLD) return;
      const current = index.get(mapping.flash_type) || [];
      current.push(mapping);
      index.set(mapping.flash_type, current);
    });
    return index;
  }, [mappings]);

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
        
        // Se já existe uma normalização no banco, ela TEM prioridade sobre o mapeamento automático
        // para garantir que edições manuais persistam.
        if (n.conta_azul_category_id) {
          base.conta_azul_category_id = n.conta_azul_category_id;
        }
        if (n.conta_azul_category_name) {
          base.conta_azul_category_name = n.conta_azul_category_name;
        }
        if (n.tipo_operacao) {
          base.tipo_operacao = n.tipo_operacao;
        }

        if (n.conta_azul_payload?.cost_center) {
          base.flash_cost_center = n.conta_azul_payload.cost_center;
        }
        return base;
      }

      // Se NÃO existe no banco, aí sim aplicamos o mapeamento automático
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
          empresa_id: empresaId, 
          flash_transaction_id: rawTx.id,
          conta_azul_category_id: base.conta_azul_category_id ?? null,
          conta_azul_category_name: base.conta_azul_category_name ?? null,
          conta_azul_account_id: base.conta_azul_account_id ?? null,
          conta_azul_account_name: base.conta_azul_account_name ?? null,
          tipo_operacao: base.tipo_operacao ?? "despesa",
          status: base.status ?? "pendente",
          conta_azul_payload: base.conta_azul_payload,
          normalizado_at: (base.status === "normalizado") ? new Date().toISOString() : null,
        });
        processedRef.current.add(rawTx.id);
      }
      return base;
    });

    setTransactions(rows);

    if (autoNormPayloads.length > 0) {
      const UPSERT_LIMIT = 50;
      const runUpserts = async () => {
        for (let i = 0; i < autoNormPayloads.length; i += UPSERT_LIMIT) {
          await supabase.from("flash_normalizacao").upsert(autoNormPayloads.slice(i, i + UPSERT_LIMIT), { onConflict: "flash_transaction_id" });
        }
      };
      runUpserts();
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

  const learnCategoryMapping = useCallback(async (
    row: FlashTransactionRow,
    merged: FlashTransactionRow,
    opts: SaveNormalizationOptions = {}
  ) => {
    if (!empresaId || !row.flash_type || !merged.conta_azul_category_id) return;

    const flashCategory = normalizeMappingDimension(row.flash_category);
    const flashCostCenter = normalizeMappingDimension(merged.flash_cost_center || row.flash_cost_center);
    const forceLearned = !!opts.saveMapping;
    const now = new Date().toISOString();

    const localExisting = (mappings as CategoryMapping[]).find((mapping) =>
      mapping.flash_type === row.flash_type &&
      isSameMappingDimension(mapping.flash_category, flashCategory) &&
      isSameMappingDimension(mapping.flash_cost_center, flashCostCenter)
    );

    const { data: databaseExisting, error: existingError } = await supabase
      .from("flash_category_mapping")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("flash_type", row.flash_type)
      .eq("flash_category", flashCategory)
      .eq("flash_cost_center", flashCostCenter)
      .maybeSingle();

    if (existingError) throw existingError;

    const existing = (databaseExisting as CategoryMapping | null) ?? localExisting;

    const nextConfirmations = Math.max(existing?.manual_confirmations ?? 0, forceLearned ? LEARNING_THRESHOLD - 1 : 0) + 1;
    const learned = forceLearned || nextConfirmations >= LEARNING_THRESHOLD;
    const payload = {
      empresa_id: empresaId,
      flash_type: row.flash_type,
      flash_category: flashCategory,
      flash_cost_center: flashCostCenter,
      conta_azul_category_id: merged.conta_azul_category_id,
      conta_azul_category_name: merged.conta_azul_category_name,
      conta_azul_account_id: merged.conta_azul_account_id,
      conta_azul_account_name: merged.conta_azul_account_name,
      tipo_operacao: merged.tipo_operacao ?? "despesa",
      manual_confirmations: nextConfirmations,
      learned,
      last_feedback_at: now,
      last_feedback_source: forceLearned ? "save_mapping_button" : "category_edit",
      updated_at: now,
    };

    const result = existing?.id
      ? await supabase.from("flash_category_mapping").update(payload).eq("id", existing.id)
      : await supabase.from("flash_category_mapping").upsert(payload, {
          onConflict: "empresa_id,flash_type,flash_category,flash_cost_center",
        });

    if (result.error) throw result.error;
    await queryClient.invalidateQueries({ queryKey: ["flash_mappings", empresaId] });

    if (forceLearned) {
      toast.success("Mapeamento salvo", {
        description: `Novos lançamentos de ${row.flash_category} usarão ${merged.conta_azul_category_name}.`,
      });
    } else if (nextConfirmations === LEARNING_THRESHOLD) {
      toast.success("Aprendizado incorporado", {
        description: `Após ${LEARNING_THRESHOLD} ajustes, ${row.flash_category} passará a sugerir ${merged.conta_azul_category_name}.`,
      });
    }
  }, [empresaId, mappings, queryClient]);

  const saveNormalization = useCallback(async (row: FlashTransactionRow, patch: any, opts: SaveNormalizationOptions = {}) => {
    if (!empresaId || (row.status === "enviado" && !opts?.allowEditEnviado)) return;
    setSavingId(row.id);
    try {
      const currentRow = transactionsRef.current.find((transaction) => transaction.id === row.id) ?? row;
      const flashAccount = contas.find(c => c.name?.toLowerCase().includes("flash"));
      const merged = { 
        ...currentRow, 
        ...patch, 
        conta_azul_account_id: flashAccount?.id ?? patch.conta_azul_account_id ?? currentRow.conta_azul_account_id,
        enviado_at: patch.status === "enviado" ? (currentRow.enviado_at || new Date().toISOString()) : (patch.status === "normalizado" ? null : currentRow.enviado_at)
      };
      if (merged.status === "pendente" && merged.conta_azul_category_id && merged.conta_azul_account_id) merged.status = "normalizado";

      setTransactions(prev => {
        const next = prev.map(t => t.id === currentRow.id ? { ...t, ...merged } : t);
        transactionsRef.current = next;
        return next;
      });

      const payload = buildContaAzulPayload({
        descricao: currentRow.descricao, valor: currentRow.valor, data: currentRow.data, tipo_operacao: merged.tipo_operacao,
        conta_azul_category_id: merged.conta_azul_category_id, conta_azul_category_name: merged.conta_azul_category_name,
        conta_azul_account_id: merged.conta_azul_account_id, conta_azul_account_name: merged.conta_azul_account_name,
        external_id: currentRow.external_id, flash_type: currentRow.flash_type,
        comentarios: merged.comentarios !== "—" ? merged.comentarios : (currentRow.comentarios !== "—" ? currentRow.comentarios : null),
        cost_center: merged.flash_cost_center !== "—" ? merged.flash_cost_center : (currentRow.flash_cost_center !== "—" ? currentRow.flash_cost_center : null),
        force_pago: true
      });

      const { data: normData, error } = await supabase.from("flash_normalizacao").upsert({
        empresa_id: empresaId,
        flash_transaction_id: currentRow.id,
        conta_azul_category_id: merged.conta_azul_category_id ?? null,
        conta_azul_category_name: merged.conta_azul_category_name ?? null,
        conta_azul_account_id: merged.conta_azul_account_id ?? null,
        conta_azul_account_name: merged.conta_azul_account_name ?? null,
        tipo_operacao: merged.tipo_operacao ?? "despesa",
        status: merged.status ?? "pendente",
        conta_azul_payload: payload,
        normalizado_at: (merged.status === "normalizado" || merged.status === "enviado") ? new Date().toISOString() : null,
        enviado_at: merged.status === "enviado" ? (currentRow.enviado_at || new Date().toISOString()) : (merged.status === "normalizado" ? null : currentRow.enviado_at),
        flash_type_detectado: currentRow.flash_type,
        mapping_id_usado: merged.mapping_id_usado ?? currentRow.mapping_id_usado ?? null,
        motivo: opts.saveMapping
          ? `Normalizado manualmente e mapeamento salvo para Categoria Flash "${currentRow.flash_category}" e Centro de Custo "${merged.flash_cost_center || currentRow.flash_cost_center}".`
          : (currentRow.motivo ?? null),
      }, { onConflict: "flash_transaction_id" }).select().single();
      if (error) throw error;

      setTransactions(prev => {
        const next = prev.map(t => t.id === currentRow.id ? {
        ...t,
        ...merged,
        norm_id: normData.id,
        conta_azul_payload: payload,
        flash_type_detectado: currentRow.flash_type,
        motivo: normData.motivo ?? t.motivo,
        } : t);
        transactionsRef.current = next;
        return next;
      });

      if ((opts.saveMapping || opts.saveMappingPerType || opts.learnFromEdit) && currentRow.flash_type) {
        await learnCategoryMapping(currentRow, { ...currentRow, ...merged, conta_azul_payload: payload }, opts);
      }
    } catch (e: any) {
      toast.error("Erro ao salvar", { description: e.message });
    } finally {
      setSavingId(null);
    }
  }, [empresaId, contas, learnCategoryMapping]);

  const sendToContaAzul = async (ids: string[]) => {
    setSending(true);
    try {
      toast.info(`Iniciando envio de ${ids.length} lançamentos...`);
      
      const CHUNK_SIZE = 10;
      let successCount = 0;
      let errorCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE);
        const batchNum = Math.floor(i / CHUNK_SIZE) + 1;
        const totalBatches = Math.ceil(ids.length / CHUNK_SIZE);
        
        toast.loading(`Enviando lote ${batchNum} de ${totalBatches}...`, { id: "ca_send_progress" });
        
        // O nome correto da function é contaazul-send-transaction e o parâmetro é flash_transaction_ids
        const { data, error } = await supabase.functions.invoke("contaazul-send-transaction", { 
          body: { flash_transaction_ids: chunk } 
        });
        
        if (error) throw error;
        
        if (data?.error) {
          throw new Error(data.error);
        }
        
        if (data) {
          successCount += (data.sucesso || 0);
          errorCount += (data.erro || 0);
          skippedCount += (data.skipped || 0);
        }
      }
      
      toast.dismiss("ca_send_progress");
      queryClient.invalidateQueries({ queryKey: ["flash_transactions", empresaId] });
      toast.success(`Envio concluído! Sucesso: ${successCount}, Erros: ${errorCount}, Pulados: ${skippedCount}`);
      
    } catch (e: any) {
      toast.dismiss("ca_send_progress");
      console.error("Erro sendToContaAzul:", e);
      let errorDesc = e.message || "Erro desconhecido";
      
      // Try to parse the Edge Function response body to get the real error message
      if (e.context && typeof e.context.json === 'function') {
        try {
          const errData = await e.context.json();
          if (errData && errData.error) {
            errorDesc = errData.error;
          }
        } catch (_) {
          // ignore parsing error
        }
      } else if (e.name === 'FunctionsHttpError' && e.message === 'Edge Function returned a non-2xx status code') {
          // Sometimes context is not available easily, but we know it's a backend failure
          errorDesc = "Falha interna no servidor (500). Verifique os logs da Edge Function.";
      }

      toast.error("Falha ao enviar", { description: errorDesc });
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

  const bulkUpdateCategoriaCA = async (ids: string[], categoria: { id: string; name: string }) => {
    for (const id of ids) {
      const row = transactions.find(t => t.id === id);
      if (row) {
        await saveNormalization(
          row,
          { conta_azul_category_id: categoria.id, conta_azul_category_name: categoria.name },
          { allowEditEnviado: true, learnFromEdit: true }
        );
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
    updateStatus, mappingByType,
    applyMappingToAllPending, bulkApplyToPending, reopenEnviado, reprocessAll, bulkUpdateCostCenter, bulkUpdateCategoriaCA
  };
}

