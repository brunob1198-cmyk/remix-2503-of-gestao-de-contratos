import { useEffect, useMemo, useState, useCallback } from "react";
import { debounce } from "lodash";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
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
      // Se for um objeto mas não achamos campos conhecidos, não retornamos [object Object]
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
      const n = Number(cur.replace(/[^0-9.,-]/g, "").replace(",", "."));
      if (!isNaN(n)) return n;
    }
  }
  return 0;
};

/**
 * Parse a date string preserving the LOCAL date as-is (no UTC shift).
 * Flash returns dates like "2026-04-07T03:00:00.000Z" which, in UTC-3,
 * should be treated as April 7th. We extract only the date part from
 * the ISO string without timezone conversion.
 */
const parseFlashDate = (raw: string | null): string | null => {
  if (!raw) return null;
  // Se já for yyyy-mm-dd (ex: vindo da coluna transaction_date formatada), usa direto
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  
  // Se for ISO ou tiver tempo, extraímos a parte da data
  // Flash envia 2026-04-07T03:00:00.000Z. Se o browser for UTC-3, Date.parse subtrai 3h, 
  // virando 2026-04-07T00:00:00.000, o que ainda é dia 07.
  // Mas se for 2026-04-07T02:00:00.000Z, vira 2026-04-06T23:00:00 no browser.
  
  // A solução robusta é ignorar o tempo e o "Z" se presente para datas de transação
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  
  return null;
};

let _debugCount = 0;
const mapTransactionRow = (raw: any): FlashTransactionRow => {
  const p = raw.payload_json || {};
  
  // LOG: Diagnóstico para transações sem centro de custo ou comentários
  const hasCC = pickPayloadValue(p, ["costCenter.name", "costCenter", "centro_custo"]) !== null;
  const hasComm = pickPayloadValue(p, ["comments", "justification", "memo"]) !== null;
  
  if (!hasCC || !hasComm) {
    console.warn(`[DIAGNOSTICO] Transação ${raw.id} (Ext: ${raw.external_id}) faltando dados:`, {
      hasCostCenter: hasCC,
      hasComments: hasComm,
      keys: Object.keys(p),
      // Mostra apenas os primeiros 100 caracteres dos valores para não poluir demais o log
      sample: Object.fromEntries(
        Object.entries(p).slice(0, 10).map(([k, v]) => [k, typeof v === 'object' ? 'object' : String(v).substring(0, 50)])
      )
    });
  }
  
  // DEBUG: Log dos primeiros 5 payloads para diagnóstico inicial (mantido para compatibilidade)
  if (_debugCount < 5) {
    _debugCount++;
    console.log(`[DEBUG mapTransactionRow #${_debugCount}]`, {
      id: raw.id,
      external_id: raw.external_id,
      topLevelKeys: Object.keys(p).join(", "),
      costCenter: p.costCenter,
      costCenterId: p.costCenterId,
      comments: p.comments,
      category: typeof p.category === 'object' ? p.category : p.category,
      type: p.type,
      description: typeof p.description === 'string' ? p.description.substring(0, 50) : p.description,
      "establishment.name": p.establishment?.name,
      "employee.costCenter": p.employee?.costCenter,
      "employee.costCenterId": p.employee?.costCenterId,
      justification: p.justification,
      "accounting.comments": p.accounting?.comments,
      "receipt.comments": p.receipt?.comments,
    });
  }
  
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

  const flash_type = typeTranslations[flash_type_raw] || (flash_type_raw === "CORPORATE_CARD" ? "Cartão Corporativo" : flash_type_raw);

  const flash_category_raw = pickPayloadValue(p, [
    "category.name", 
    "transaction.category", 
    "categoria.nome", 
    "category", 
    "categoria",
    "transaction.categoryName", // Novo
  ]) || "—";
  let flash_category = flash_category_raw;
  
  // Padronização para português
  const categoryTranslations: Record<string, string> = {
    "Refeição": "Refeição",
    "MEAL": "Refeição",
    "Alimentação": "Alimentação",
    "FOOD": "Alimentação",
    "Combustível": "Combustível",
    "FUEL": "Combustível",
    "Mobilidade": "Mobilidade",
    "MOBILITY": "Mobilidade",
    "Saúde": "Saúde",
    "HEALTH": "Saúde",
    "Cultura": "Cultura",
    "CULTURE": "Cultura",
    "Educação": "Educação",
    "EDUCATION": "Educação",
    "Outros": "Outros",
    "OTHERS": "Outros",
    "Toll": "Pedágio",
    "TOLL": "Pedágio",
    "Parking": "Estacionamento",
    "PARKING": "Estacionamento",
  };

  if (categoryTranslations[flash_category_raw]) {
    flash_category = categoryTranslations[flash_category_raw];
  } else if (flash_category_raw.toUpperCase() === "TOLL") {
    flash_category = "Pedágio";
  }

  // Coluna de Prestação de contas vinda do Flash
  const flash_prestacao_contas_raw =
    pickPayloadValue(p, [
      "status", // Nível raiz da despesa na Flash costuma ter o status (Aprovado, etc)
      "accountabilityStatus",
      "accountability_status",
      "prestacao_de_contas",
      "prestacaoDeContas",
      "accountability",
      "expenseStatus",
      "expense_status",
    ]) || "—";

  const statusMap: Record<string, string> = {
    "DRAFT": "Em fechamento",
    "PENDING_ACCOUNTING": "Em aprovação",
    "PENDING": "Pendente",
    "APPROVED": "Aprovado",
    "COMPLETED": "Concluído",
    "REJECTED": "Rejeitado",
    "FINISHED": "Finalizado",
    "CANCELLED": "Cancelado",
    "PAID": "Pago",
    "OPEN": "Aberto",
    "IN_REVIEW": "Em revisão",
    "REFUNDED": "Reembolsado",
    "EXPIRED": "Expirado",
    "OVERDUE": "Atrasado",
    "REIMBURSED": "Reembolsado",
    "IN_ACCOUNTABILITY": "Em prestação de contas",
    "ACCOUNTABILITY_DRAFT": "Rascunho de prestação",
    "SUBMITTED": "Enviado",
    "SETTLED": "Liquidado",
    "PENDING_APPROVAL": "Aguardando aprovação",
    "REQUIRE_CHANGES": "Necessita alterações"
  };

  const flash_prestacao_contas = statusMap[flash_prestacao_contas_raw] || flash_prestacao_contas_raw;

  // Date: prioritize transaction_date from table, then payload values
  const rawDate = raw.transaction_date || pickPayloadValue(p, ["date", "data", "transaction_date", "created_at", "datetime"]);

  return {
    id: raw.id,
    external_id: raw.external_id,
    payload_json: p,
    created_at: raw.created_at,
    data: parseFlashDate(rawDate),
    descricao: pickPayloadValue(p, ["transaction.description", "description", "descricao", "merchant", "establishment.name", "establishment", "name"]) || "—",
    valor: pickPayloadNumber(p, ["amount", "value", "valor", "total"]) / 100,
    usuario:
      pickPayloadValue(p, ["employee.name", "user.name", "user.email", "usuario", "user_name"]) || "—",
    flash_type,
    flash_category,
    flash_cost_center: pickPayloadValue(p, [
      // Prioridade: Campos diretos de centro de custo (objetos ou strings)
      "costCenter.name", 
      "cost_center.name", 
      "costCenter.code",
      "costCenter.externalId",
      "costCenter.id",
      "costCenterId",
      "cost_center_id",
      // Objeto dentro de employee/user
      "employee.costCenter.name", 
      "user.costCenter.name",
      "employee.cost_center.name",
      "user.cost_center.name",
      "employee.costCenter.code",
      "user.costCenter.code",
      "employee.costCenter.externalId",
      "user.costCenter.externalId",
      "employee.costCenter.id",
      "user.costCenter.id",
      // Novos caminhos baseados em payloads reais da Flash (aninhados em despesa ou prestação)
      "expense.costCenter.name",
      "expense.cost_center.name",
      "expense.costCenter.code",
      "expense.costCenterId",
      "accountability.costCenter.name",
      "accountability.cost_center.name",
      "accountability.costCenterId",
      "transaction.costCenter.name",
      "transaction.costCenterId",
      // Campos de nível superior
      "centro_custo",
      "centroCusto",
      "costCenter", 
      "cost_center",
      // Campos dentro de employee em payloads CORPORATE_CARD
      "employee.costCenter",
      "employee.cost_center",
      "employee.centro_custo",
      "employee.centroCusto",
      "employee.cost_center_id",
      // Fallback para campos de funcionário
      "user.costCenter",
      "user.cost_center"
    ]) || "—",
    comentarios: pickPayloadValue(p, [
      // Prioridade: Comentários e Observações
      "comments",
      "comment",
      "observacao",
      "observation",
      "note",
      "notes",
      "memo",
      "remarks",
      "remark",
      // Justificativa e motivos
      "justification",
      "justificativa",
      "reason",
      "motivo",
      // Campos aninhados (contabilização/comprovante/memo)
      "accounting.comments",
      "accounting.notes",
      "accounting.observation",
      "accounting.memo",
      "receipt.comments",
      "receipt.notes",
      "receipt.observation",
      "receipt.memo",
      // Novos caminhos baseados em payloads reais da Flash
      "expense.comments",
      "expense.notes",
      "expense.description",
      "expense.justification",
      "accountability.comments",
      "accountability.notes",
      "accountability.description",
      "transaction.comments",
      "transaction.comment",
      "transaction.description",
      "transaction.memo",
      "transaction.notes",
      // Array de comentários
      "comment_list",
      "comments_list",
      "notes_list"
    ]) || "—",
    flash_prestacao_contas,
  };
};

export function useFlashNormalizacao() {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const [loading, setLoading] = useState(false); 
  const [savingId, setSavingId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<FlashTransactionRow[]>([]);
  const [mappings, setMappings] = useState<CategoryMapping[]>([]);
  const [categorias, setCategorias] = useState<ContaAzulOption[]>([]);
  const [contas, setContas] = useState<ContaAzulOption[]>([]);
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [saasCostCenters, setSaasCostCenters] = useState<string[]>([]);

  const fetchDataRaw = useCallback(
    async (forceRefresh = false) => {
      if (!empresaId) {
        console.log("fetchData skip: no empresaId");
        setLoading(false);
        return;
      }
      
      // Evitar chamadas duplicadas se já estiver carregando
      if (loading && !forceRefresh) return;
      
      setLoading(true);
      console.count("fetchData executado");
      
      if (forceRefresh) {
        toast.info("Recarregando dados do banco...", { id: "refresh-flash" });
        console.log("Forcing database refresh for empresaId:", empresaId);
      }
      
      try {
        console.log("Fetching data for empresaId:", empresaId);
        
        // 1. Fetch raw transactions in batches
        let allTransactions: any[] = [];
        let lastCount = 0;
        let rangeStart = 0;
        const BATCH_SIZE = 1000;
        
        do {
          const { data, error } = await supabase
            .from("flash_transactions_raw")
            .select("id, external_id, payload_json, created_at, transaction_date")
            .eq("empresa_id", empresaId)
            .order("created_at", { ascending: false })
            .range(rangeStart, rangeStart + BATCH_SIZE - 1);

          if (error) throw error;

          if (data) {
            allTransactions = [...allTransactions, ...data];
            lastCount = data.length;
            rangeStart += BATCH_SIZE;
          } else {
            lastCount = 0;
          }
        } while (lastCount === BATCH_SIZE && allTransactions.length < 100000);

        const txRes = { data: allTransactions };

        // 2. Fetch normalization records in batches
        let allNormalizations: any[] = [];
        rangeStart = 0;
        
        do {
          const { data, error } = await supabase
            .from("flash_normalizacao")
            .select("*")
            .eq("empresa_id", empresaId)
            .range(rangeStart, rangeStart + BATCH_SIZE - 1);

          if (error) throw error;

          if (data) {
            allNormalizations = [...allNormalizations, ...data];
            lastCount = data.length;
            rangeStart += BATCH_SIZE;
          } else {
            lastCount = 0;
          }
        } while (lastCount === BATCH_SIZE && allNormalizations.length < 100000);

        const normRes = { data: allNormalizations };

        const mapRes = await supabase
          .from("flash_category_mapping")
          .select("*")
          .eq("empresa_id", empresaId);

        if (mapRes.error) throw mapRes.error;

        const normByTx = new Map<string, any>();
        (normRes.data || []).forEach((n: any) => normByTx.set(n.flash_transaction_id, n));

        const mappingList = (mapRes.data || []) as CategoryMapping[];
        const flashAccount = contas.find(c => c.name?.toLowerCase().includes("flash"));
        const normIds = new Set((normRes.data || []).map((n: any) => n.flash_transaction_id));
        const autoNormPayloads: any[] = [];

        const rows = (txRes.data || []).map((raw: any) => {
          const base = mapTransactionRow(raw);
          const n = normByTx.get(raw.id);
          
          if (n) {
            base.norm_id = n.id;
            base.conta_azul_category_id = n.conta_azul_category_id;
            base.conta_azul_category_name = n.conta_azul_category_name;
            base.conta_azul_account_id = n.conta_azul_account_id;
            base.conta_azul_account_name = n.conta_azul_account_name;
            base.tipo_operacao = n.tipo_operacao;
            base.status = n.status;
            base.motivo = n.motivo;
            base.flash_type_detectado = n.flash_type_detectado || base.flash_type;
            base.mapping_id_usado = n.mapping_id_usado;
            base.conta_azul_payload = n.conta_azul_payload;
            base.enviado_at = n.enviado_at;

            // PRIORIDADE: Se o usuário editou o centro de custo manualmente, ele está no payload da normalização.
            // Sobrescrevemos o valor extraído da Flash (base.flash_cost_center) pelo valor manual se ele existir.
            if (n.conta_azul_payload?.cost_center) {
              base.flash_cost_center = n.conta_azul_payload.cost_center;
            }

            if (!base.conta_azul_account_id && flashAccount) {
              base.conta_azul_account_id = flashAccount.id;
              base.conta_azul_account_name = flashAccount.name;
            }

            return base;
          }

          const normalized = normalizeFlashTransaction(
            { 
              id: raw.id, 
              external_id: raw.external_id, 
              payload_json: raw.payload_json, 
              flash_type: base.flash_type,
              flash_category: base.flash_category,
              flash_cost_center: base.flash_cost_center,
              descricao: base.descricao
            },
            mappingList as FlashCategoryMappingLike[]
          );

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

          if (!normIds.has(raw.id)) {
            autoNormPayloads.push({
              empresa_id: empresaId,
              flash_transaction_id: raw.id,
              conta_azul_category_id: base.conta_azul_category_id,
              conta_azul_category_name: base.conta_azul_category_name,
              conta_azul_account_id: base.conta_azul_account_id,
              conta_azul_account_name: base.conta_azul_account_name,
              tipo_operacao: base.tipo_operacao,
              status: base.status,
              normalizado_at: (base.status === "normalizado") ? new Date().toISOString() : null,
              motivo: base.motivo,
              flash_type_detectado: base.flash_type_detectado,
              mapping_id_usado: base.mapping_id_usado,
              conta_azul_payload: base.conta_azul_payload,
            });
          }

          return base;
        });

        setTransactions(rows);
        setMappings(mappingList);

        const UPSERT_LIMIT = 100;
        if (autoNormPayloads.length > 0) {
          for (let i = 0; i < autoNormPayloads.length; i += UPSERT_LIMIT) {
            const batch = autoNormPayloads.slice(i, i + UPSERT_LIMIT);
            await supabase
              .from("flash_normalizacao")
              .upsert(batch, { onConflict: "flash_transaction_id" });
          }
        }
        
        if (forceRefresh) {
          toast.success(`Dados atualizados: ${rows.length} lançamentos encontrados.`, { id: "refresh-flash" });
        }
      } catch (e: any) {
        console.error("fetchData error:", e);
        toast.error("Erro ao carregar dados", { 
          description: e.message,
          id: "refresh-flash" 
        });
      } finally {
        setLoading(false);
      }
    },
    [empresaId, contas, loading]
  );

  const fetchData = useMemo(() => debounce(fetchDataRaw, 300), [fetchDataRaw]);

  const fetchMetadata = useCallback(async (force = false) => {
    if (loadingMetadata) {
      console.log("fetchMetadata skip: already loading");
      return;
    }
    
    // Check if we already have data and not forcing, to avoid redundant calls
    if (!force && categorias.length > 0 && contas.length > 0) {
      console.log("fetchMetadata skip: already have data and not forcing");
      return;
    }

    console.log("fetchMetadata starting, force:", force);
    setLoadingMetadata(true);
    setMetadataError(null);
    try {
      const { data, error } = await supabase.functions.invoke("contaazul-metadata", { body: { force } });
      if (error) throw error;
      setCategorias(data?.categorias || []);
      setContas(data?.contas_financeiras || []);
      if (!(data?.categorias?.length || 0) && !(data?.contas_financeiras?.length || 0)) {
        setMetadataError("Nenhum dado retornado do Conta Azul. Verifique a conexão.");
      }
    } catch (e: any) {
      console.error(e);
      const msg = e?.message || "Erro ao buscar metadata Conta Azul";
      setMetadataError(msg);
      toast.error("Erro Conta Azul", { description: msg, id: "ca-metadata" });
    } finally {
      setLoadingMetadata(false);
    }
  }, [loadingMetadata, categorias.length, contas.length]);

  useEffect(() => {
    if (empresaId) {
      fetchDataRaw().catch(err => console.error("Initial fetchData failed:", err));
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  useEffect(() => {
    // Only fetch automatically on first mount or if empresaId changes
    // We avoid calling this if it's already loading or if we have data
    if (!loadingMetadata && categorias.length === 0 && empresaId) {
      console.log("Initial fetchMetadata triggered by useEffect");
      fetchMetadata().catch(err => console.error("Initial fetchMetadata failed:", err));
    }
  }, [empresaId, fetchMetadata, loadingMetadata, categorias.length]);

  // Buscar centros de custo do SaaS (tabela areas) para comparação
  useEffect(() => {
    if (!empresaId) return;
    const fetchSaasData = async () => {
      try {
        // Buscar áreas
        const { data: areasData, error: areasError } = await supabase
          .from("areas")
          .select("nome")
          .eq("empresa_id", empresaId);
        
        if (areasError) {
          console.error("Erro ao buscar áreas (centros de custo do SaaS):", areasError);
        }

        // Buscar projetos
        const { data: projectsData, error: projectsError } = await supabase
          .from("projetos")
          .select("nome")
          .eq("empresa_id", empresaId);

        if (projectsError) {
          console.error("Erro ao buscar projetos:", projectsError);
        }

        const areaNames = (areasData || []).map((a: any) => a.nome).filter(Boolean);
        const projectNames = (projectsData || []).map((p: any) => p.nome).filter(Boolean);
        
        // Unir ambos como centros de custo válidos
        const allNames = Array.from(new Set([...areaNames, ...projectNames])).sort();
        
        console.log(`[SaaS Metadata] Encontrados: ${areaNames.length} áreas e ${projectNames.length} projetos`);
        setSaasCostCenters(allNames);
      } catch (e) {
        console.error("Erro ao buscar metadados do SaaS:", e);
      }
    };
    fetchSaasData();
  }, [empresaId]);

  // Mantemos o mappingByType apenas para retrocompatibilidade simples se necessário,
  // mas o ideal é usar a lista completa com a lógica do flashNormalization.ts
  const mappingByType = useMemo(() => {
    const map = new Map<string, CategoryMapping>();
    // No caso de conflito de tipo simples, o mais recente ou específico ganha no Map simples
    // Mas agora usamos a lista completa no fetchData para matching inteligente
    mappings.forEach((m) => {
      // Usamos apenas o tipo como chave para manter compatibilidade com UI legada
      // Mas o ideal é o matching por granularidade
      map.set(m.flash_type, m);
    });
    return map;
  }, [mappings]);

  const saveNormalization = useCallback(
    async (
      row: FlashTransactionRow,
      patch: Partial<{
        conta_azul_category_id: string | null;
        conta_azul_category_name: string | null;
        conta_azul_account_id: string | null;
        conta_azul_account_name: string | null;
        tipo_operacao: "receita" | "despesa";
        status: "pendente" | "normalizado" | "enviado";
        motivo: string | null;
      }>,
      opts?: { saveMapping?: boolean; allowEditEnviado?: boolean }
    ) => {
      if (!empresaId) return;
      // Bloqueio padrão para enviado, salvo flag explícita
      if (row.status === "enviado" && !opts?.allowEditEnviado) {
        toast.error("Lançamento enviado", {
          description: 'Use "Reabrir para correção" antes de editar.',
        });
        return;
      }
      setSavingId(row.id);
      try {
        // Busca a conta Flash por nome (qualquer nome contendo 'flash')
        const flashAccount = contas.find(c => c.name?.toLowerCase() === "flash" || c.name?.toLowerCase().includes("flash"));

        const merged = {
          conta_azul_category_id: patch.conta_azul_category_id ?? row.conta_azul_category_id ?? null,
          conta_azul_category_name: patch.conta_azul_category_name ?? row.conta_azul_category_name ?? null,
          conta_azul_account_id: flashAccount?.id ?? patch.conta_azul_account_id ?? row.conta_azul_account_id ?? null,
          conta_azul_account_name: flashAccount?.name ?? patch.conta_azul_account_name ?? row.conta_azul_account_name ?? null,
          tipo_operacao: patch.tipo_operacao ?? row.tipo_operacao ?? "despesa",
          status: patch.status ?? row.status ?? "pendente",
        };

        // Auto-promote para normalizado quando categoria + conta estão definidas
        let autoPromoted = false;
        if (
          merged.status === "pendente" &&
          merged.conta_azul_category_id &&
          merged.conta_azul_account_id
        ) {
          merged.status = "normalizado";
          autoPromoted = true;
        }

        const normalizedMatch = normalizeFlashTransaction(
          { 
            id: row.id, 
            flash_type: row.flash_type, 
            flash_category: row.flash_category, 
            flash_cost_center: row.flash_cost_center,
            descricao: row.descricao
          },
          mappings as any[]
        );

        const motivo =
          patch.motivo !== undefined
            ? patch.motivo
            : merged.status === "normalizado"
            ? autoPromoted
              ? `Normalizado manualmente: categoria e conta preenchidas pelo usuário em ${new Date().toLocaleString("pt-BR")}.`
              : normalizedMatch.mapping_id_usado
              ? `Normalizado via mapping inteligente → ${merged.conta_azul_category_name} / ${merged.conta_azul_account_name}.`
              : `Normalizado manualmente (sem mapping aplicado) em ${new Date().toLocaleString("pt-BR")}.`
            : merged.status === "enviado"
            ? `Enviado ao Conta Azul em ${new Date().toLocaleString("pt-BR")}.`
            : `Pendente: aguardando definição de categoria e/ou conta financeira.`;

        const payloadSnapshot = buildContaAzulPayload({
          descricao: row.descricao,
          valor: row.valor,
          data: row.data,
          tipo_operacao: merged.tipo_operacao,
          conta_azul_category_id: merged.conta_azul_category_id,
          conta_azul_category_name: merged.conta_azul_category_name,
          conta_azul_account_id: merged.conta_azul_account_id,
          conta_azul_account_name: merged.conta_azul_account_name,
          external_id: row.external_id,
          flash_type: row.flash_type,
          comentarios: row.comentarios !== "—" ? row.comentarios : null,
          cost_center: row.flash_cost_center !== "—" ? row.flash_cost_center : null,
        });

        const upsertPayload: any = {
          empresa_id: empresaId,
          flash_transaction_id: row.id,
          ...merged,
          motivo,
          flash_type_detectado: row.flash_type,
          mapping_id_usado: opts?.saveMapping ? null : row.mapping_id_usado ?? null,
          conta_azul_payload: payloadSnapshot,
          normalizado_at:
            merged.status === "normalizado" || merged.status === "enviado"
              ? new Date().toISOString()
              : null,
        };

        const { data, error } = await supabase
          .from("flash_normalizacao")
          .upsert(upsertPayload, { onConflict: "flash_transaction_id" })
          .select()
          .single();
        if (error) throw error;

        setTransactions((prev) =>
          prev.map((t) =>
            t.id === row.id
              ? {
                  ...t,
                  ...merged,
                  norm_id: data.id,
                  motivo,
                  flash_type_detectado: row.flash_type,
                  conta_azul_payload: payloadSnapshot,
                  enviado_at: data.enviado_at,
                }
              : t
          )
        );

        if (opts?.saveMapping && row.flash_type && merged.conta_azul_category_id && merged.conta_azul_account_id) {
          // Salva um mapeamento mais inteligente baseado nos detalhes da transação atual
          const { data: mData, error: mError } = await supabase
            .from("flash_category_mapping")
            .upsert(
              {
                empresa_id: empresaId,
                flash_type: row.flash_type,
                flash_category: row.flash_category,
                flash_cost_center: row.flash_cost_center,
                conta_azul_category_id: merged.conta_azul_category_id,
                conta_azul_category_name: merged.conta_azul_category_name,
                conta_azul_account_id: merged.conta_azul_account_id,
                conta_azul_account_name: merged.conta_azul_account_name,
                tipo_operacao: merged.tipo_operacao,
              },
              { onConflict: "empresa_id,flash_type,flash_category,flash_cost_center" }
            )
            .select()
            .single();
            
          if (mError) {
            console.error("Erro ao salvar mapeamento:", mError);
            toast.error("Erro ao salvar mapeamento", { description: mError.message });
            // Não lançamos erro aqui para não travar a normalização da transação individual
            // mas logamos para depuração.
          } else if (mData) {
            setMappings((prev) => {
              const others = prev.filter((m) => m.id !== mData.id);
              return [...others, mData as CategoryMapping];
            });
          }
          
          toast.success("Mapeamento inteligente salvo", { 
            description: `Tipo "${row.flash_type}" com categoria "${row.flash_category}" agora será mapeado automaticamente.` 
          });
        }
      } catch (e: any) {
        console.error(e);
        toast.error("Erro ao salvar", { description: e.message });
      } finally {
        setSavingId(null);
      }
    },
    [empresaId, mappings, contas]
  );

  // Use a more efficient approach for applyMappingToAllPending
  const applyMappingToAllPending = useCallback(async () => {
    if (!empresaId || mappings.length === 0) return;
    
    const pendingRows = transactions.filter(t => t.status === "pendente");
    
    if (!pendingRows.length) {
      toast.info("Nenhum lançamento pendente encontrado.");
      return;
    }

    setLoading(true); // Show general loader
    
    let count = 0;
    try {
      // Process in small chunks to avoid UI lock and massive concurrent requests
      const CHUNK_SIZE = 5;
      for (let i = 0; i < pendingRows.length; i += CHUNK_SIZE) {
        const chunk = pendingRows.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk.map(async (row) => {
          const normalized = normalizeFlashTransaction(
            { 
              id: row.id, 
              external_id: row.external_id, 
              payload_json: row.payload_json, 
              flash_type: row.flash_type,
              flash_category: row.flash_category,
              flash_cost_center: row.flash_cost_center,
              descricao: row.descricao
            },
            mappings as any[]
          );

          if (normalized.status === "normalizado") {
            await saveNormalization(row, {
              conta_azul_category_id: normalized.conta_azul_category_id,
              conta_azul_category_name: normalized.conta_azul_category_name,
              conta_azul_account_id: normalized.conta_azul_account_id,
              conta_azul_account_name: normalized.conta_azul_account_name,
              tipo_operacao: normalized.tipo_operacao,
              status: "normalizado",
            });
            count += 1;
          }
        }));
      }
      
      if (count > 0) {
        toast.success(`${count} lançamento(s) normalizado(s) automaticamente usando mapeamento inteligente.`);
      } else {
        toast.info("Nenhum mapeamento compatível encontrado para os lançamentos pendentes.");
      }
    } finally {
      setLoading(false);
    }
  }, [empresaId, mappings, transactions, saveNormalization]);

  /**
   * Aplica em lote categoria/conta a um conjunto de transações pendentes.
   * Útil para a tela de revisão em lote de pendentes.
   */
  const bulkApplyToPending = useCallback(
    async (
      rowIds: string[],
      values: {
        conta_azul_category_id: string;
        conta_azul_category_name: string;
        conta_azul_account_id: string;
        conta_azul_account_name: string;
        tipo_operacao: "receita" | "despesa";
        saveMappingPerType?: boolean;
      }
    ) => {
      if (!empresaId || !rowIds.length) return;
      const targets = transactions.filter((t) => rowIds.includes(t.id) && t.status === "pendente");
      if (!targets.length) {
        toast.info("Nenhuma transação pendente selecionada.");
        return;
      }
      let count = 0;
      const seenTypes = new Set<string>();
      for (const row of targets) {
        const isFirstOfType = values.saveMappingPerType && !seenTypes.has(row.flash_type);
        seenTypes.add(row.flash_type);
        await saveNormalization(
          row,
          {
            conta_azul_category_id: values.conta_azul_category_id,
            conta_azul_category_name: values.conta_azul_category_name,
            conta_azul_account_id: values.conta_azul_account_id,
            conta_azul_account_name: values.conta_azul_account_name,
            tipo_operacao: values.tipo_operacao,
            status: "normalizado",
          },
          { saveMapping: !!isFirstOfType }
        );
        count += 1;
      }
      toast.success(`${count} pendente(s) atualizado(s) em lote.`);
    },
    [empresaId, transactions, saveNormalization]
  );

  /**
   * Reabre um lançamento "enviado" para correção, voltando-o para "normalizado".
   * Também "invalida" logs anteriores de sucesso para permitir um re-envio (forçar).
   */
  const reopenEnviado = useCallback(
    async (row: FlashTransactionRow) => {
      if (row.status !== "enviado") return;
      
      setSavingId(row.id);
      try {
        // 1. Atualiza o status na tabela de normalização
        const { error: normError } = await supabase
          .from("flash_normalizacao")
          .update({ 
            status: "normalizado",
            enviado_at: null,
            motivo: `Reaberto para correção/re-envio em ${new Date().toLocaleString("pt-BR")} (estava enviado).`,
          })
          .eq("flash_transaction_id", row.id)
          .eq("empresa_id", empresaId);

        if (normError) throw normError;

        // 2. "Invalida" logs de sucesso anteriores para permitir que a edge function envie de novo
        // Isso é o que permite o "forçar lançamento"
        const { error: logError } = await supabase
          .from("flash_integration_logs")
          .update({ status: "REABERTO" })
          .eq("flash_transaction_id", row.id)
          .eq("status", "ENVIADO")
          .eq("empresa_id", empresaId);

        if (logError) {
          console.error("Erro ao invalidar logs antigos:", logError);
          // Não travamos o processo se falhar o log, mas avisamos no console
        }

        // 3. Atualiza estado local
        setTransactions((prev) =>
          prev.map((t) => (t.id === row.id ? { 
            ...t, 
            status: "normalizado", 
            enviado_at: null,
            motivo: `Reaberto para correção/re-envio em ${new Date().toLocaleString("pt-BR")} (estava enviado).`
          } : t))
        );

        toast.success("Lançamento reaberto", {
          description: "Agora você pode editá-lo ou enviá-lo novamente ao Conta Azul."
        });
      } catch (e: any) {
        console.error(e);
        toast.error("Erro ao reabrir lançamento", { description: e.message });
      } finally {
        setSavingId(null);
      }
    },
    [empresaId, saveNormalization]
  );

  /**
   * Atualiza o centro de custo de um lançamento.
   * Persiste no campo conta_azul_payload.cost_center da tabela flash_normalizacao.
   */
  const updateCostCenter = useCallback(
    async (row: FlashTransactionRow, newCostCenter: string) => {
      if (!empresaId) return;
      if (row.status === "enviado") {
        toast.error("Lançamento enviado", {
          description: 'Use "Reabrir para correção" antes de editar.',
        });
        return;
      }

      const cleanValue = newCostCenter.trim() || null;
      const updatedPayload = row.conta_azul_payload
        ? { ...row.conta_azul_payload, cost_center: cleanValue }
        : null;

      // Persist to database
      const { error } = await supabase
        .from("flash_normalizacao")
        .update({ conta_azul_payload: updatedPayload })
        .eq("flash_transaction_id", row.id)
        .eq("empresa_id", empresaId);

      if (error) {
        console.error("Erro ao atualizar centro de custo:", error);
        toast.error("Erro ao salvar centro de custo", { description: error.message });
        return;
      }

      // Update local state
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === row.id
            ? {
                ...t,
                flash_cost_center: cleanValue || "—",
                conta_azul_payload: updatedPayload,
              }
            : t
        )
      );

      toast.success("Centro de custo atualizado", {
        description: cleanValue ? `Alterado para: ${cleanValue}` : "Centro de custo removido",
      });
    },
    [empresaId]
  );

  /**
   * Atualiza o centro de custo de vários lançamentos em lote.
   */
  const bulkUpdateCostCenter = useCallback(
    async (rowIds: string[], newCostCenter: string) => {
      if (!empresaId || !rowIds.length) return;
      
      const eligibleRows = transactions.filter(
        t => rowIds.includes(t.id) && t.status !== "enviado"
      );

      if (eligibleRows.length === 0) {
        toast.error("Nenhum lançamento elegível para atualização em massa", {
          description: "Lançamentos já enviados não podem ser editados."
        });
        return;
      }

      setLoading(true);
      try {
        const cleanValue = newCostCenter.trim() || null;
        
        // Atualiza no banco de dados
        // Como o update do Supabase .in() é para uma coluna igual para todos, 
        // mas aqui o payload_json pode variar (manter as outras chaves), precisamos ter cuidado.
        // Se o flash_normalizacao for apenas para o payload Conta Azul, podemos fazer o merge.
        
        // Vamos fazer o update individual para garantir a integridade do JSON de cada linha
        // ou processar no cliente e enviar um bulk update se possível.
        // O Supabase não suporta merge de JSON em bulk nativamente via .update().
        
        const updates = eligibleRows.map(row => {
          const updatedPayload = row.conta_azul_payload
            ? { ...row.conta_azul_payload, cost_center: cleanValue }
            : { cost_center: cleanValue };
            
          return supabase
            .from("flash_normalizacao")
            .update({ conta_azul_payload: updatedPayload })
            .eq("flash_transaction_id", row.id)
            .eq("empresa_id", empresaId);
        });

        await Promise.all(updates);

        // Update local state
        setTransactions((prev) =>
          prev.map((t) => {
            if (rowIds.includes(t.id) && t.status !== "enviado") {
              const updatedPayload = t.conta_azul_payload
                ? { ...t.conta_azul_payload, cost_center: cleanValue }
                : { cost_center: cleanValue };
              return {
                ...t,
                flash_cost_center: cleanValue || "—",
                conta_azul_payload: updatedPayload,
              };
            }
            return t;
          })
        );

        toast.success(`Centro de custo atualizado em ${eligibleRows.length} lançamentos`);
      } catch (error: any) {
        console.error("Erro no bulkUpdateCostCenter:", error);
        toast.error("Erro ao atualizar em massa", { description: error.message });
      } finally {
        setLoading(false);
      }
    },
    [empresaId, transactions]
  );

  const [sending, setSending] = useState(false);

  /**
   * Envia um ou mais lançamentos normalizados ao Conta Azul
   * via edge function `contaazul-send-transaction`.
   */
  const sendToContaAzul = useCallback(
    async (rowIds: string[]) => {
      if (!empresaId || !rowIds.length) return null;
      const eligible = transactions.filter(
        (t) =>
          rowIds.includes(t.id) &&
          t.status === "normalizado" &&
          t.conta_azul_category_id &&
          t.conta_azul_account_id
      );
      if (!eligible.length) {
        toast.error("Nada para enviar", {
          description: "Selecione lançamentos com status Normalizado.",
        });
        return null;
      }
      setSending(true);
      try {
        const { data, error } = await supabase.functions.invoke(
          "contaazul-send-transaction",
          { body: { flash_transaction_ids: eligible.map((t) => t.id) } }
        );
        if (error) throw error;

        const sucesso = data?.sucesso ?? 0;
        const erro = data?.erro ?? 0;
        const skipped = data?.skipped ?? 0;

        if (sucesso > 0) {
          toast.success(`${sucesso} lançamento(s) enviado(s) ao Conta Azul.`);
        }
        if (erro > 0) {
          toast.error(`${erro} lançamento(s) falharam`, {
            description: "Veja a aba 'Logs' ou os detalhes da linha.",
          });
        }
        if (skipped > 0 && sucesso === 0 && erro === 0) {
          toast.info(`${skipped} lançamento(s) ignorado(s).`);
        }

        await fetchData();
        return data;
      } catch (e: any) {
        console.error(e);
        toast.error("Erro ao enviar ao Conta Azul", { description: e.message });
        return null;
      } finally {
        setSending(false);
      }
    },
    [empresaId, transactions, fetchData]
  );

  /**
   * Verifica se uma transação já foi integrada via logs (controle de duplicidade).
   */
  const isAlreadyIntegrated = useCallback(async (flashId: string) => {
    const { data, error } = await supabase
      .from("flash_integration_logs")
      .select("id")
      .eq("flash_transaction_id", flashId)
      .eq("status", "ENVIADO")
      .maybeSingle();

    if (error) {
      console.error("Erro ao verificar duplicidade:", error);
      return false;
    }
    return !!data;
  }, []);

  return {
    loading,
    savingId,
    sending,
    transactions,
    categorias,
    contas,
    mappings,
    mappingByType,
    loadingMetadata,
    metadataError,
    refresh: async (force = true) => {
      console.log("Hook refresh called with force:", force);
      return await fetchDataRaw(force);
    },
    refreshMetadata: async () => {
      console.log("Manual refreshMetadata called");
      return await fetchMetadata(true);
    },
    saveNormalization,
    applyMappingToAllPending,
    bulkApplyToPending,
    reopenEnviado,
    sendToContaAzul,
    isAlreadyIntegrated,
    updateCostCenter,
    saasCostCenters,
    bulkUpdateCostCenter,
    reprocessAll: async () => {
      if (!empresaId) return;
      setLoading(true);
      try {
        toast.info("Reprocessando todas as transações...", { id: "reprocess-flash" });
        // Simplesmente re-mapeia as transações atuais com as regras atualizadas
        const rows = transactions.map(t => {
          const raw = {
            id: t.id,
            external_id: t.external_id,
            payload_json: t.payload_json,
            transaction_date: t.data,
            // Passamos as propriedades extraídas se o payload original sumiu, mas mapTransactionRow prioriza o payload
          };
          const base = mapTransactionRow(raw);
          // Se já estava enviado, mantemos o status, se não, re-normalizamos
          if (t.status === 'enviado') return t;
          
          const norm = normalizeFlashTransaction({
            id: t.id,
            external_id: t.external_id,
            payload_json: t.payload_json,
            flash_type: base.flash_type,
            flash_category: base.flash_category,
            flash_cost_center: base.flash_cost_center,
            descricao: base.descricao,
            valor: base.valor,
            data: base.data
          }, mappings);

          return {
            ...base,
            norm_id: t.norm_id,
            conta_azul_category_id: norm.conta_azul_category_id,
            conta_azul_category_name: norm.conta_azul_category_name,
            conta_azul_account_id: norm.conta_azul_account_id,
            conta_azul_account_name: norm.conta_azul_account_name,
            tipo_operacao: norm.tipo_operacao,
            status: norm.status,
            motivo: norm.motivo,
            flash_type_detectado: norm.flash_type,
            mapping_id_usado: norm.mapping_id_usado,
            conta_azul_payload: norm.conta_azul_payload,
          };
        });
        setTransactions(rows);
        toast.success("Reprocessamento local concluído. Lembre-se de salvar se necessário.", { id: "reprocess-flash" });
      } catch (e: any) {
        toast.error("Erro ao reprocessar: " + e.message);
      } finally {
        setLoading(false);
      }
    }
  };
}
