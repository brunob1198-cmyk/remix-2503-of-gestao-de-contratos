import { useEffect, useMemo, useState, useCallback } from "react";
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

const mapTransactionRow = (raw: any): FlashTransactionRow => {
  const p = raw.payload_json || {};
  return {
    id: raw.id,
    external_id: raw.external_id,
    payload_json: p,
    created_at: raw.created_at,
    data: pickPayloadValue(p, ["date", "data", "transaction_date", "created_at", "datetime"]),
    descricao: pickPayloadValue(p, ["description", "descricao", "merchant", "establishment", "name"]) || "—",
    valor: pickPayloadNumber(p, ["amount", "value", "valor", "total"]),
    usuario:
      pickPayloadValue(p, ["user.name", "user.email", "employee.name", "usuario", "user_name"]) || "—",
    flash_type:
      pickPayloadValue(p, ["type", "tipo", "category", "categoria", "transaction_type"]) || "indefinido",
  };
};

export function useFlashNormalizacao() {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<FlashTransactionRow[]>([]);
  const [mappings, setMappings] = useState<CategoryMapping[]>([]);
  const [categorias, setCategorias] = useState<ContaAzulOption[]>([]);
  const [contas, setContas] = useState<ContaAzulOption[]>([]);
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const [txRes, normRes, mapRes] = await Promise.all([
        supabase
          .from("flash_transactions_raw")
          .select("id, external_id, payload_json, created_at")
          .eq("empresa_id", empresaId)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("flash_normalizacao")
          .select("*")
          .eq("empresa_id", empresaId),
        supabase
          .from("flash_category_mapping")
          .select("*")
          .eq("empresa_id", empresaId),
      ]);

      if (txRes.error) throw txRes.error;
      if (normRes.error) throw normRes.error;
      if (mapRes.error) throw mapRes.error;

      const normByTx = new Map<string, any>();
      (normRes.data || []).forEach((n: any) => normByTx.set(n.flash_transaction_id, n));

      const mappingList = (mapRes.data || []) as CategoryMapping[];
      const mappingIdx = buildMappingIndex(mappingList as FlashCategoryMappingLike[]);

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
          return base;
        }

        const normalized = normalizeFlashTransaction(
          { id: raw.id, external_id: raw.external_id, payload_json: raw.payload_json, flash_type: base.flash_type },
          mappingIdx
        );
        base.tipo_operacao = normalized.tipo_operacao;
        base.status = normalized.status;
        base.conta_azul_category_id = normalized.conta_azul_category_id;
        base.conta_azul_category_name = normalized.conta_azul_category_name;
        base.conta_azul_account_id = normalized.conta_azul_account_id;
        base.conta_azul_account_name = normalized.conta_azul_account_name;
        base.motivo = normalized.motivo;
        base.flash_type_detectado = normalized.flash_type;
        base.mapping_id_usado = normalized.mapping_id_usado;
        base.conta_azul_payload = normalized.conta_azul_payload;

        if (normalized.status === "normalizado") {
          autoNormPayloads.push({
            empresa_id: empresaId,
            flash_transaction_id: raw.id,
            conta_azul_category_id: normalized.conta_azul_category_id,
            conta_azul_category_name: normalized.conta_azul_category_name,
            conta_azul_account_id: normalized.conta_azul_account_id,
            conta_azul_account_name: normalized.conta_azul_account_name,
            tipo_operacao: normalized.tipo_operacao,
            status: "normalizado",
            normalizado_at: new Date().toISOString(),
            motivo: normalized.motivo,
            flash_type_detectado: normalized.flash_type,
            mapping_id_usado: normalized.mapping_id_usado,
            conta_azul_payload: normalized.conta_azul_payload,
          });
        }
        return base;
      });

      setTransactions(rows);
      setMappings(mappingList);

      if (autoNormPayloads.length > 0) {
        supabase
          .from("flash_normalizacao")
          .upsert(autoNormPayloads, { onConflict: "flash_transaction_id" })
          .then(({ error }) => {
            if (error) console.error("Auto-normalização falhou:", error);
          });
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao carregar dados", { description: e.message });
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  const fetchMetadata = useCallback(async () => {
    setLoadingMetadata(true);
    setMetadataError(null);
    try {
      const { data, error } = await supabase.functions.invoke("contaazul-metadata", { body: {} });
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
      toast.error("Erro Conta Azul", { description: msg });
    } finally {
      setLoadingMetadata(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  const mappingByType = useMemo(() => {
    const map = new Map<string, CategoryMapping>();
    mappings.forEach((m) => map.set(m.flash_type, m));
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
        const merged = {
          conta_azul_category_id: patch.conta_azul_category_id ?? row.conta_azul_category_id ?? null,
          conta_azul_category_name: patch.conta_azul_category_name ?? row.conta_azul_category_name ?? null,
          conta_azul_account_id: patch.conta_azul_account_id ?? row.conta_azul_account_id ?? null,
          conta_azul_account_name: patch.conta_azul_account_name ?? row.conta_azul_account_name ?? null,
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

        const mappingMatch = mappingByType.get(row.flash_type);
        const motivo =
          patch.motivo !== undefined
            ? patch.motivo
            : merged.status === "normalizado"
            ? autoPromoted
              ? `Normalizado manualmente: categoria e conta preenchidas pelo usuário em ${new Date().toLocaleString("pt-BR")}.`
              : mappingMatch && mappingMatch.id === (row.mapping_id_usado || mappingMatch.id)
              ? `Normalizado via mapping do tipo "${row.flash_type}" → ${merged.conta_azul_category_name} / ${merged.conta_azul_account_name}.`
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
          const { data: mData, error: mError } = await supabase
            .from("flash_category_mapping")
            .upsert(
              {
                empresa_id: empresaId,
                flash_type: row.flash_type,
                conta_azul_category_id: merged.conta_azul_category_id,
                conta_azul_category_name: merged.conta_azul_category_name,
                conta_azul_account_id: merged.conta_azul_account_id,
                conta_azul_account_name: merged.conta_azul_account_name,
                tipo_operacao: merged.tipo_operacao,
              },
              { onConflict: "empresa_id,flash_type" }
            )
            .select()
            .single();
          if (mError) throw mError;
          setMappings((prev) => {
            const filtered = prev.filter((m) => m.flash_type !== row.flash_type);
            return [...filtered, mData as CategoryMapping];
          });
          toast.success("Mapeamento salvo", { description: `Tipo "${row.flash_type}" será aplicado automaticamente.` });
        }
      } catch (e: any) {
        console.error(e);
        toast.error("Erro ao salvar", { description: e.message });
      } finally {
        setSavingId(null);
      }
    },
    [empresaId, mappingByType]
  );

  const applyMappingToAllPending = useCallback(async () => {
    if (!empresaId || mappingByType.size === 0) return;
    const pendingRows = transactions.filter(
      (t) => t.status === "pendente" && mappingByType.has(t.flash_type)
    );
    if (!pendingRows.length) {
      toast.info("Nenhum lançamento pendente com mapeamento disponível.");
      return;
    }
    let count = 0;
    for (const row of pendingRows) {
      const m = mappingByType.get(row.flash_type)!;
      await saveNormalization(row, {
        conta_azul_category_id: m.conta_azul_category_id,
        conta_azul_category_name: m.conta_azul_category_name,
        conta_azul_account_id: m.conta_azul_account_id,
        conta_azul_account_name: m.conta_azul_account_name,
        tipo_operacao: m.tipo_operacao,
        status: "normalizado",
      });
      count += 1;
    }
    toast.success(`${count} lançamento(s) normalizado(s) automaticamente.`);
  }, [empresaId, mappingByType, transactions, saveNormalization]);

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
   */
  const reopenEnviado = useCallback(
    async (row: FlashTransactionRow) => {
      if (row.status !== "enviado") return;
      await saveNormalization(
        row,
        {
          status: "normalizado",
          motivo: `Reaberto para correção em ${new Date().toLocaleString("pt-BR")} (estava enviado).`,
        },
        { allowEditEnviado: true }
      );
      // Limpa enviado_at
      if (empresaId) {
        await supabase
          .from("flash_normalizacao")
          .update({ enviado_at: null })
          .eq("flash_transaction_id", row.id)
          .eq("empresa_id", empresaId);
        setTransactions((prev) =>
          prev.map((t) => (t.id === row.id ? { ...t, enviado_at: null } : t))
        );
      }
      toast.success("Lançamento reaberto para correção");
    },
    [empresaId, saveNormalization]
  );

  return {
    loading,
    savingId,
    transactions,
    categorias,
    contas,
    mappings,
    mappingByType,
    loadingMetadata,
    metadataError,
    refresh: fetchData,
    refreshMetadata: fetchMetadata,
    saveNormalization,
    applyMappingToAllPending,
    bulkApplyToPending,
    reopenEnviado,
  };
}
