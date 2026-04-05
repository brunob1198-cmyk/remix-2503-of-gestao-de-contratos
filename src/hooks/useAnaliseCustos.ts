import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

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

export function useContaAzulConnection() {
  const { empresaId } = useAuth();
  const queryClient = useQueryClient();

  const { data: connectionStatus, isLoading: loadingStatus } = useQuery({
    queryKey: ["contaazul_status", empresaId],
    queryFn: async () => {
      if (!empresaId) return { connected: false, expired: false };
      const { data, error } = await supabase.functions.invoke("contaazul-oauth", {
        body: { action: "check_status", empresa_id: empresaId },
      });
      if (error) throw error;
      return data as { connected: boolean; expired: boolean };
    },
    enabled: !!empresaId,
  });

  const getRedirectUri = () => "https://gcinteligente.lovable.app";

  const getAuthUrl = useMutation({
    mutationFn: async () => {
      const redirectUri = getRedirectUri();
      const { data, error } = await supabase.functions.invoke("contaazul-oauth", {
        body: { action: "get_auth_url", redirect_uri: redirectUri, empresa_id: empresaId },
      });
      if (error) throw error;
      return data.auth_url as string;
    },
    onSuccess: (authUrl) => {
      window.location.href = authUrl;
    },
    onError: (e: Error) => toast.error("Erro ao gerar URL de autenticação: " + e.message),
  });

  const exchangeCode = useMutation({
    mutationFn: async (code: string) => {
      const redirectUri = getRedirectUri();
      const { data, error } = await supabase.functions.invoke("contaazul-oauth", {
        body: { action: "exchange_code", code, redirect_uri: redirectUri, empresa_id: empresaId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contaazul_status"] });
      toast.success("Conta Azul conectada com sucesso!");
    },
    onError: (e: Error) => toast.error("Erro ao conectar Conta Azul: " + e.message),
  });

  const refreshToken = useMutation({
    mutationFn: async (refreshTokenValue?: string) => {
      const { data, error } = await supabase.functions.invoke("contaazul-oauth", {
        body: { action: "refresh_token", empresa_id: empresaId, refresh_token: refreshTokenValue },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["contaazul_status"] });
      toast.success(data?.message || "Token Conta Azul renovado com sucesso!");
    },
    onError: (e: Error) => toast.error("Erro ao renovar token Conta Azul: " + e.message),
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("contaazul-oauth", {
        body: { action: "disconnect", empresa_id: empresaId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contaazul_status"] });
      toast.success("Conta Azul desconectada.");
    },
    onError: (e: Error) => toast.error("Erro ao desconectar: " + e.message),
  });

  return {
    isConnected: connectionStatus?.connected ?? false,
    isExpired: connectionStatus?.expired ?? false,
    loadingStatus,
    getAuthUrl,
    exchangeCode,
    refreshToken,
    disconnect,
  };
}

export function useAnaliseCustos(projetoId: string, siteId?: string, periodoInicio?: Date, periodoFim?: Date) {
  const { empresaId } = useAuth();
  const queryClient = useQueryClient();

  const startDate = periodoInicio ? format(startOfMonth(periodoInicio), "yyyy-MM-dd") : null;
  const endDate = periodoFim ? format(endOfMonth(periodoFim), "yyyy-MM-dd") : null;

  // 1. Custo Orçado e Valor Produzido (baseado em escopo)
  const { data: escopoData = { custoOrcado: 0, valorProduzido: 0 }, isLoading: loadOrc } = useQuery({
    queryKey: ["custo_orcado_escopo", projetoId, siteId],
    queryFn: async () => {
      let qSites = supabase.from("sites").select("id").eq("projeto_id", projetoId);
      const { data: sitesData } = await qSites;
      if (!sitesData || sitesData.length === 0) return { custoOrcado: 0, valorProduzido: 0 };

      const siteIds = siteId ? [siteId] : sitesData.map(s => s.id);

      const { data: escopoItens } = await supabase
        .from("escopo_itens")
        .select("quantidade, custo_unitario, valor_unitario, item_lpu_id")
        .in("site_id", siteIds);

      if (!escopoItens || escopoItens.length === 0) return { custoOrcado: 0, valorProduzido: 0 };

      let custoOrcado = 0;
      let valorProduzido = 0;
      for (const item of escopoItens) {
        custoOrcado += Number(item.custo_unitario || 0) * Number(item.quantidade || 0);
        valorProduzido += Number(item.valor_unitario || 0) * Number(item.quantidade || 0);
      }
      return { custoOrcado, valorProduzido };
    },
    enabled: !!projetoId
  });

  const custoOrcado = escopoData.custoOrcado;
  const valorProduzido = escopoData.valorProduzido;

  // 2. Custos Pagos (ERP)
  const { data: custosErp = [], isLoading: loadCustos } = useQuery({
    queryKey: ["custos_erp", projetoId, siteId, startDate],
    queryFn: async () => {
      let q = (supabase as any).from("custo_real_erp").select("*");
      if (projetoId) q = q.eq("projeto_id", projetoId);
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

  // 3. Produzido Físico
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
        materiais: 0,
        total_produzido: (prods.data || []).reduce((acc, curr) => acc + Number(curr.valor_total || 0), 0)
      };
    },
    enabled: !!projetoId && !!siteId
  });

  const updateCategoria = useMutation({
    mutationFn: async ({ erpId, newCategoria }: { erpId: string, newCategoria: string }) => {
      const { error } = await (supabase as any).from("custo_real_erp")
         .update({ categoria_interna: newCategoria })
         .eq("erp_id", erpId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custos_erp"] });
      toast.success("Categoria atualizada.");
    }
  });

  // Sincronizar com API real do Conta Azul
  const syncErp = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-contaazul", {
        body: {
          action: "sync_contaazul",
          empresa_id: empresaId,
          start_date: startDate,
          end_date: endDate,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["custos_erp"] });
      toast.success(data?.message || "ERP Sincronizado!");
    },
    onError: (e: any) => toast.error("Falha ao sincronizar ERP: " + e.message),
  });

  return { 
    custoOrcado, loadOrc,
    custosErp, loadCustos, updateCategoria, 
    syncErpMock: syncErp,
    syncErp,
    fisico, loadFisico
  };
}
