import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth } from "date-fns";

export interface MapeamentoErp {
  id: string;
  categoria_erp: string;
  categoria_interna: string;
}

export interface CustoErp {
  id: string;
  erp_id: string;
  descricao: string;
  valor: number;
  data_competencia: string | null;
  data_pagamento: string | null;
  status_erp: string;
  categoria_erp: string;
  categoria_interna: string;
  centro_custo: string | null;
  projeto_id: string | null;
  site_id: string | null;
}

export interface OrcamentoProjeto {
  id: string;
  projeto_id: string;
  site_id: string | null;
  mes_referencia: string;
  mao_de_obra: number;
  materiais: number;
  equipamentos: number;
  transporte: number;
  indiretos: number;
  financeiros: number;
}

export function useAnaliseCustos(projetoId: string, siteId?: string, month?: Date) {
  const queryClient = useQueryClient();

  const startDate = month ? format(startOfMonth(month), "yyyy-MM-dd") : null;
  const endDate = month ? format(endOfMonth(month), "yyyy-MM-dd") : null;

  // 1. Orçamento
  const { data: orcamentos = [], isLoading: loadOrc } = useQuery({
    queryKey: ["orcamento_projetos", projetoId, siteId, startDate],
    queryFn: async () => {
      let q = (supabase as any).from("orcamento_projetos").select("*").eq("projeto_id", projetoId);
      if (siteId) q = q.eq("site_id", siteId);
      if (startDate) q = q.gte("mes_referencia", startDate).lte("mes_referencia", endDate);
      
      const { data, error } = await q;
      if (error) throw error;
      return data as OrcamentoProjeto[];
    },
    enabled: !!projetoId
  });

  const saveOrcamento = useMutation({
    mutationFn: async (orcamento: Partial<OrcamentoProjeto>) => {
      const { data, error } = await (supabase as any)
        .from("orcamento_projetos")
        .upsert(orcamento, { onConflict: "projeto_id, site_id, mes_referencia" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orcamento_projetos"] });
      toast.success("Orçamento salvo com sucesso.");
    },
    onError: (e: any) => toast.error(`Erro ao salvar orçamento: ${e.message}`)
  });

  // 2. Custos Pagos (ERP)
  const { data: custosErp = [], isLoading: loadCustos } = useQuery({
    queryKey: ["custos_erp", projetoId, siteId, startDate],
    queryFn: async () => {
      let q = (supabase.from("custo_real_erp") as any).select("*").eq("projeto_id", projetoId);
      if (siteId) q = q.eq("site_id", siteId);
      if (startDate) {
        q = q.gte("data_pagamento", startDate).lte("data_pagamento", endDate);
      }
      
      const { data, error } = await q;
      if (error) throw error;
      return data as CustoErp[];
    },
    enabled: !!projetoId
  });

  // 3. Produzido Físico e Equipes Locais do Diário (Apropriado)
  const { data: fisico = { maoDeObra: 0, materiais: 0, transporte: 0, equipamentos: 0, total_produzido: 0 }, isLoading: loadFisico } = useQuery({
    queryKey: ["fisico_apropriado", projetoId, siteId, startDate],
    queryFn: async () => {
      let qDiarios = supabase.from("diarios_obra").select("id").eq("site_id", siteId);
      if (startDate) qDiarios = qDiarios.gte("data", startDate).lte("data", endDate);
      const { data: diariosIdList } = await qDiarios;
      
      if (!diariosIdList || diariosIdList.length === 0) {
        return { maoDeObra: 0, materiais: 0, transporte: 0, equipamentos: 0, total_produzido: 0 };
      }
      
      const dids = diariosIdList.map(d => d.id);
      
      const [eq, equip, veic, prods] = await Promise.all([
        supabase.from("diario_equipe").select("custo_total").in("diario_id", dids),
        supabase.from("diario_equipamentos").select("custo_total").in("diario_id", dids),
        supabase.from("diario_veiculos").select("custo_diaria").in("diario_id", dids),
        supabase.from("diario_producao").select("valor_total").in("diario_id", dids)
      ]);

      return {
        maoDeObra: (eq.data || []).reduce((acc, curr) => acc + Number(curr.custo_total || 0), 0),
        equipamentos: (equip.data || []).reduce((acc, curr) => acc + Number(curr.custo_total || 0), 0),
        transporte: (veic.data || []).reduce((acc, curr) => acc + Number(curr.custo_diaria || 0), 0),
        materiais: 0, // Materiais são controlados no estoque e faturados diretamente,
        total_produzido: (prods.data || []).reduce((acc, curr) => acc + Number(curr.valor_total || 0), 0)
      };
    },
    enabled: !!projetoId && !!siteId
  });

  const updateCategoria = useMutation({
    mutationFn: async ({ erpId, newCategoria }: { erpId: string, newCategoria: string }) => {
      const { error } = await (supabase.from("custo_real_erp") as any)
         .update({ categoria_interna: newCategoria })
         .eq("erp_id", erpId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custos_erp"] });
      toast.success("Categoria atualizada.");
    }
  });

  const syncErpMock = useMutation({
    mutationFn: async () => {
      // Calls edge function mock
      const { data, error } = await supabase.functions.invoke("sync-contaazul", {
         body: { action: "sync_contaazul" }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custos_erp"] });
      toast.success("ERP Sincronizado!");
    },
    onError: (e: any) => toast.error("Falha ao syncar ERP: " + e.message)
  });

  return { 
    orcamentos, loadOrc, saveOrcamento,
    custosErp, loadCustos, updateCategoria, syncErpMock,
    fisico, loadFisico
  };
}
