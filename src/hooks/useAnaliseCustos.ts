import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { calculateCustoDiretoOrcado } from "@/lib/custoUtils";
import { AnaliseCustosRow } from "@/types/analise";

export type { AnaliseCustosRow };


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
  categoria_analise: "DIRETO" | "GERENCIA";
  categoria_sugerida_ia: string | null;
  categoria_confirmada: boolean;
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
    direto: number;
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
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24,
    queryFn: async () => {
      let qSites = supabase.from("sites").select("id").eq("projeto_id", projetoId);
      const { data: sitesData } = await qSites;
      if (!sitesData || sitesData.length === 0) return { custoOrcado: 0, valorProduzido: 0 };

      const siteIds = siteId ? [siteId] : sitesData.map((s) => s.id);

      const { data: escopoItens, error: escopoError } = await supabase
        .from("escopo_itens")
        .select(
          `
          quantidade, 
          custo_unitario, 
          valor_unitario, 
          item_lpu_id,
          item_lpu:itens_lpu (
            bdi
          )
        `,
        )
        .in("site_id", siteIds);

      if (escopoError || !escopoItens || escopoItens.length === 0) return { custoOrcado: 0, valorProduzido: 0 };

      let custoOrcado = 0;
      let valorProduzido = 0;
      for (const item of escopoItens) {
        const quantidade = Number(item.quantidade || 0);
        const valorUnitario = Number(item.valor_unitario || 0);
        const bdiItem = Number((item.item_lpu as any)?.bdi || 0);

        // Se houver BDI no item, o custo unitário orçado é o valor unitário / BDI
        const custoUnitarioCalculado = bdiItem > 0 ? valorUnitario / bdiItem : Number(item.custo_unitario || 0);

        custoOrcado += custoUnitarioCalculado * quantidade;
        valorProduzido += valorUnitario * quantidade;
      }
      return { custoOrcado, valorProduzido };
    },
    enabled: !!projetoId,
  });

  const custoOrcado = escopoData.custoOrcado;
  const valorProduzido = escopoData.valorProduzido;

  // Fetch all mappings to identify disabled ones
  const { data: categoriasMapeamento = [] } = useQuery({
    queryKey: ["mapeamento_categorias_erp_all"],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mapeamento_categorias_erp")
        .select("categoria_erp, categoria_interna, ativo");
      if (error) throw error;
      return data || [];
    },
  });

  const categoriasDesativadas = useMemo(
    () => categoriasMapeamento.filter((c) => !c.ativo).map((c) => c.categoria_erp),
    [categoriasMapeamento],
  );

  // 2. Custos Pagos (ERP) - filtra categorias desativadas
  const { data: custosErp = [], isLoading: loadCustos } = useQuery({
    queryKey: ["custos_erp", projetoId, siteId, startDate, categoriasDesativadas],
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    queryFn: async () => {
      const BATCH_SIZE = 1000;
      
      let countQuery = supabase
        .from("custo_real_erp")
        .select("*", { count: "exact", head: true });
      
      if (projetoId) countQuery = countQuery.eq("projeto_id", projetoId);
      if (siteId) countQuery = countQuery.eq("site_id", siteId);
      if (startDate && endDate) {
        countQuery = countQuery.gte("data_competencia", startDate).lte("data_competencia", endDate);
      } else if (startDate) {
        countQuery = countQuery.gte("data_competencia", startDate);
      }

      const { count, error: countError } = await countQuery;
      if (countError) throw countError;

      const totalPages = Math.ceil((count || 0) / BATCH_SIZE);
      const pagePromises = Array.from({ length: totalPages }, (_, i) => {
        let q = supabase
          .from("custo_real_erp")
          .select(
            "id, erp_id, descricao, valor, data_competencia, data_pagamento, status_erp, categoria_erp, categoria_interna, categoria_analise, categoria_sugerida_ia, categoria_confirmada, centro_custo, projeto_id, site_id",
          )
          .range(i * BATCH_SIZE, (i + 1) * BATCH_SIZE - 1);
        
        if (projetoId) q = q.eq("projeto_id", projetoId);
        if (siteId) q = q.eq("site_id", siteId);
        if (startDate && endDate) {
          q = q.gte("data_competencia", startDate).lte("data_competencia", endDate);
        } else if (startDate) {
          q = q.gte("data_competencia", startDate);
        }
        return q;
      });

      const results = await Promise.all(pagePromises);
      const allData = results.flatMap((r) => (r.data || []) as CustoErp[]);

      return allData.filter(
        (item) =>
          !categoriasDesativadas.includes(item.categoria_erp) &&
          item.centro_custo?.trim() !== "Reforma Sede Jardim América",
      );
    },
    enabled: !!projetoId,
  });

  // 3. Produzido Físico
  const {
    data: fisico = { maoDeObra: 0, materiais: 0, transporte: 0, equipamentos: 0, total_produzido: 0 },
    isLoading: loadFisico,
  } = useQuery({
    queryKey: ["fisico_apropriado", projetoId, siteId, startDate],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24,
    queryFn: async () => {
      let allDiarios: any[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        let qDiarios = supabase
          .from("diarios_obra")
          .select("id")
          .eq("site_id", siteId)
          .range(offset, offset + 999);

        if (startDate && endDate) qDiarios = qDiarios.gte("data", startDate).lte("data", endDate);
        else if (startDate) qDiarios = qDiarios.gte("data", startDate);

        const { data: batch } = await qDiarios;
        const rows = batch || [];
        allDiarios = [...allDiarios, ...rows];
        hasMore = rows.length === 1000;
        offset += 1000;
      }

      if (allDiarios.length === 0) {
        return { maoDeObra: 0, materiais: 0, transporte: 0, equipamentos: 0, total_produzido: 0 };
      }

      const dids = allDiarios.map((d) => d.id);
      const BATCH = 200;
      let eqData: any[] = [];
      let equipData: any[] = [];
      let veicData: any[] = [];
      let prodsData: any[] = [];

      for (let i = 0; i < dids.length; i += BATCH) {
        const chunk = dids.slice(i, i + BATCH);
        
        const fetchAll = async (table: string, select: string, column: string = "diario_id") => {
          let all: any[] = [];
          let offset = 0;
          let hasMore = true;
          while (hasMore) {
            const { data } = await (supabase.from(table as any) as any).select(select).in(column, chunk).range(offset, offset + 999);
            const rows = data || [];
            all = [...all, ...rows];
            hasMore = rows.length === 1000;
            offset += 1000;
          }
          return all;
        };

        const [eq, equip, veic, prods] = await Promise.all([
          fetchAll("diario_equipe", "custo_total"),
          fetchAll("diario_equipamentos", "custo_total"),
          fetchAll("diario_veiculos", "custo_diaria"),
          fetchAll("diario_producao", "valor_total"),
        ]);

        eqData = [...eqData, ...eq];
        equipData = [...equipData, ...equip];
        veicData = [...veicData, ...veic];
        prodsData = [...prodsData, ...prods];
      }

      return {
        maoDeObra: eqData.reduce((acc, curr) => acc + Number(curr.custo_total || 0), 0),
        equipamentos: equipData.reduce((acc, curr) => acc + Number(curr.custo_total || 0), 0),
        transporte: veicData.reduce((acc, curr) => acc + Number(curr.custo_diaria || 0), 0),
        materiais: 0,
        total_produzido: prodsData.reduce((acc, curr) => acc + Number(curr.valor_total || 0), 0),
      };
    },
    enabled: !!projetoId && !!siteId,
  });

  const updateCategoria = useMutation({
    mutationFn: async ({ erpId, newCategoria }: { erpId: string; newCategoria: string }) => {
      // 1. Get current record to know original category
      const { data: current } = await supabase
        .from("custo_real_erp")
        .select("categoria_erp")
        .eq("erp_id", erpId)
        .single();

      // 2. Update record
      const { error } = await supabase
        .from("custo_real_erp")
        .update({ categoria_interna: newCategoria, categoria_confirmada: true })
        .eq("erp_id", erpId);
      if (error) throw error;

      // 3. Learning Step: Upsert mapping
      if (current?.categoria_erp) {
        await supabase.from("mapeamento_categorias_erp").upsert(
          {
            categoria_erp: current.categoria_erp,
            categoria_interna: newCategoria,
            criado_por_ia: false, // User manual adjustment
            ativo: true,
          },
          { onConflict: "categoria_erp" },
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custos_erp"] });
      queryClient.invalidateQueries({ queryKey: ["custos_erp_multi"] });
      toast.success("Categoria atualizada e sistema atualizado para futuros registros.");
    },
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
    custoOrcado,
    valorProduzido,
    loadOrc,
    custosErp,
    loadCustos,
    updateCategoria,
    syncErpMock: syncErp,
    syncErp,
    fisico,
    loadFisico,
  };
}

/**
 * Hook leve que expõe apenas a mutation de sincronização do ERP (Conta Azul),
 * sem instanciar as queries pesadas de useAnaliseCustos.
 */
export function useSyncErp(empresaId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      start_date: string | null;
      end_date: string | null;
    }) => {
      const { data, error } = await supabase.functions.invoke("sync-contaazul", {
        body: {
          action: "sync_contaazul",
          empresa_id: empresaId,
          start_date: params.start_date,
          end_date: params.end_date,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["custos_erp"] });
      queryClient.invalidateQueries({ queryKey: ["custos_erp_multi"] });
      toast.success(data?.message || "ERP Sincronizado!");
    },
    onError: (e: any) => toast.error("Falha ao sincronizar ERP: " + e.message),
  });
}

export function useAnaliseCustosMulti(projetoIds: string[], periodoInicio?: Date, periodoFim?: Date) {
  const queryClient = useQueryClient();

  const startDate = periodoInicio ? format(startOfMonth(periodoInicio), "yyyy-MM-dd") : null;
  const endDate = periodoFim ? format(endOfMonth(periodoFim), "yyyy-MM-dd") : null;

  // 1. Parâmetros MKP
  const { data: mkpParams = [] } = useQuery({
    queryKey: ["mkp_parametros", projetoIds],
    queryFn: async () => {
      const { data } = await supabase.from("mkp_parametros").select("*").in("projeto_id", projetoIds);
      return data || [];
    },
    enabled: projetoIds.length > 0,
  });

  // 2. Impostos por projeto
  const { data: impostosData = [] } = useQuery({
    queryKey: ["projeto_impostos", projetoIds],
    queryFn: async () => {
      const { data } = await supabase.from("projeto_impostos").select("*").in("projeto_id", projetoIds);
      return data || [];
    },
    enabled: projetoIds.length > 0,
  });

  const { data: categoriasMapeamento = [] } = useQuery({
    queryKey: ["mapeamento_categorias_erp_all"],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mapeamento_categorias_erp")
        .select("categoria_erp, categoria_interna, ativo");
      if (error) throw error;
      return data || [];
    },
  });

  const categoriasDesativadas = useMemo(
    () => categoriasMapeamento.filter((c) => !c.ativo).map((c) => c.categoria_erp),
    [categoriasMapeamento],
  );

  const { data: custosErp = [], isLoading: loadCustos } = useQuery({
    queryKey: ["custos_erp_multi", projetoIds, startDate, endDate, categoriasDesativadas],
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    queryFn: async () => {
      if (projetoIds.length === 0) return [];
      const BATCH_SIZE = 1000;
      
      let countQuery = supabase
        .from("custo_real_erp")
        .select("*", { count: "exact", head: true })
        .in("projeto_id", projetoIds);
      
      if (startDate && endDate) {
        countQuery = countQuery.gte("data_competencia", startDate).lte("data_competencia", endDate);
      } else if (startDate) {
        countQuery = countQuery.gte("data_competencia", startDate);
      }

      const { count, error: countError } = await countQuery;
      if (countError) throw countError;

      const totalPages = Math.ceil((count || 0) / BATCH_SIZE);
      const pagePromises = Array.from({ length: totalPages }, (_, i) => {
        let q = supabase
          .from("custo_real_erp")
          .select(
            "id, erp_id, descricao, valor, data_competencia, data_pagamento, status_erp, categoria_erp, categoria_interna, categoria_analise, categoria_sugerida_ia, categoria_confirmada, centro_custo, projeto_id, site_id",
          )
          .range(i * BATCH_SIZE, (i + 1) * BATCH_SIZE - 1)
          .in("projeto_id", projetoIds);

        if (startDate && endDate) {
          q = q.gte("data_competencia", startDate).lte("data_competencia", endDate);
        } else if (startDate) {
          q = q.gte("data_competencia", startDate);
        }
        return q;
      });

      const results = await Promise.all(pagePromises);
      const allData = results.flatMap((r) => (r.data || []) as CustoErp[]);

      return allData.filter(
        (item) =>
          !categoriasDesativadas.includes(item.categoria_erp) &&
          item.centro_custo?.trim() !== "Reforma Sede Jardim América",
      );
    },
    enabled: projetoIds.length > 0,
  });

  // 4. Produção (POC) por Projeto e Referência
  const { data: producaoData = [] } = useQuery({
    queryKey: ["producao_poc_multi_v14", projetoIds, startDate, endDate],
    queryFn: async () => {
      if (projetoIds.length === 0) return [];

      const { data: sitesData } = await supabase.from("sites").select("id, projeto_id").in("projeto_id", projetoIds);

      const siteIds = (sitesData || []).map((s) => s.id);
      if (siteIds.length === 0) return [];

      let allDiarios: any[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        let diariosQuery = supabase
          .from("diarios_obra")
          .select("id, data, site_id")
          .in("site_id", siteIds)
          .range(offset, offset + 999);

        if (startDate) diariosQuery = diariosQuery.gte("data", startDate);
        if (endDate) diariosQuery = diariosQuery.lte("data", endDate);

        const { data: batch } = await diariosQuery;
        const rows = batch || [];
        allDiarios = [...allDiarios, ...rows];
        hasMore = rows.length === 1000;
        offset += 1000;
      }

      if (allDiarios.length === 0) return [];

      const diarioIds = allDiarios.map((d) => d.id);
      const diarioSiteMap = Object.fromEntries(allDiarios.map((d) => [d.id, { site_id: d.site_id, data: d.data }]));

      const BATCH = 200;
      let allProducao: any[] = [];
      for (let i = 0; i < diarioIds.length; i += BATCH) {
        const chunk = diarioIds.slice(i, i + BATCH);
        
        let hasMore = true;
        let offset = 0;
        while (hasMore) {
          const { data } = await supabase
            .from("diario_producao")
            .select("diario_id, item_lpu_id, valor_total, item_lpu:itens_lpu(bdi, item_lpu_bdi_mensal(mes_referencia, bdi))")
            .in("diario_id", chunk)
            .range(offset, offset + 999);
          
          const rows = data || [];
          allProducao = [...allProducao, ...rows];
          hasMore = rows.length === 1000;
          offset += 1000;
        }
      }

      const siteToProjetoMap = Object.fromEntries((sitesData || []).map((s) => [s.id, s.projeto_id]));

      return allProducao
        .map((p) => ({
          projeto_id: siteToProjetoMap[diarioSiteMap[p.diario_id]?.site_id],
          valor_total: Number(p.valor_total || 0),
          data_producao: diarioSiteMap[p.diario_id]?.data,
          bdi_item: Number(p.item_lpu?.bdi || 0),
          bdi_mensal: p.item_lpu?.item_lpu_bdi_mensal || [],
          site_id: diarioSiteMap[p.diario_id]?.site_id,
        }))
        .filter((p) => p.projeto_id);
    },
    enabled: projetoIds.length > 0,
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
  });

  const { data: projetosData = [] } = useQuery({
    queryKey: ["projetos_analise", projetoIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("projetos")
        .select("id, codigo, nome, area_analise, cliente, cliente_id, clientes(*), areas(*)")
        .in("id", projetoIds);
      return data || [];
    },
    enabled: projetoIds.length > 0,
  });

  const custosErpPorProjeto = useMemo(() => {
    const map = new Map<string, CustoErp[]>();
    custosErp.forEach(c => {
      if (!c.projeto_id) return;
      const key = c.projeto_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });
    return map;
  }, [custosErp]);

  const producaoPorProjeto = useMemo(() => {
    const map = new Map<string, typeof producaoData>();
    producaoData.forEach(p => {
      if (!p.projeto_id) return;
      if (!map.has(p.projeto_id)) map.set(p.projeto_id, []);
      map.get(p.projeto_id)!.push(p);
    });
    return map;
  }, [producaoData]);

  const mkpParamsPorProjeto = useMemo(() => 
    new Map(mkpParams.map(m => [m.projeto_id, m])),
  [mkpParams]);

  const impostosPorProjeto = useMemo(() =>
    new Map(impostosData.map(i => [i.projeto_id, i])),
  [impostosData]);

  const analiseRows = useMemo(() => {
    if (!startDate || !endDate || projetosData.length === 0) return [];

    const rows: AnaliseCustosRow[] = [];

    // Helper to get all months between start and end
    const getMonths = (start: string, end: string) => {
      const months = [];
      try {
        let curr = startOfMonth(parseISO(start));
        const last = startOfMonth(parseISO(end));
        // Safety break for infinite loops
        let iterations = 0;
        while (curr <= last && iterations < 120) {
          months.push(format(curr, "yyyy-MM-dd"));
          curr = startOfMonth(new Date(curr.getFullYear(), curr.getMonth() + 1, 1));
          iterations++;
        }
      } catch (e) {
        console.error("Error generating months:", e);
      }
      return months;
    };

    const periodMonths = getMonths(startDate, endDate);

    (projetosData || []).forEach((projeto) => {
      const projetoId = projeto.id;
      const mkp = mkpParamsPorProjeto.get(projetoId);
      const impostosProjeto = impostosPorProjeto.get(projetoId);
      const clienteNome =
        (projeto as any).clientes?.nome || (projeto as any).cliente || (projeto as any).cliente_id || "N/A";
      const areaNome =
        (projeto as any).areas?.nome || (projeto as any).area_analise || (projeto as any).area_id || "N/A";

      const projetoProducaoTotal = producaoPorProjeto.get(projetoId) || [];
      (periodMonths || []).forEach((monthStr) => {
        const monthStart = startOfMonth(parseISO(monthStr));
        const monthEnd = endOfMonth(monthStart);
        const monthLabel = format(monthStart, "MMM/yyyy", { locale: ptBR });
        
        // 1. Produção Bruta (POC) do mês e Custo Direto Orçado (baseado no BDI do item)
        const producaoItensMes = projetoProducaoTotal.filter((p) => {
          try {
            const dStr = p.data_producao;
            if (!dStr) return false;
            // data_producao usually comes as YYYY-MM-DD
            const d = parseISO(dStr);
            return d >= monthStart && d <= monthEnd;
          } catch (e) {
            return false;
          }
        }).map(p => {
          // BDI variavel mensal por item
          const monthKey = monthStr.slice(0, 7);
          const bdiMensalData = p.bdi_mensal?.find((b: any) => b.mes_referencia === monthKey);
          
          return {
            ...p,
            bdi_item: bdiMensalData ? Number(bdiMensalData.bdi) : p.bdi_item
          };
        });

        const poc = producaoItensMes.reduce((sum, p) => sum + Number(p.valor_total || 0), 0);

        // Custo Direto Orçado: soma de (Valor Item / BDI Item Efetivo)
        const custoDiretoOrcado = calculateCustoDiretoOrcado(producaoItensMes, mkp);

        // 2. Custos do mês
        const projetoCustosMes = projetoCustosTotal.filter((c) => {
          if (!c.data_competencia) return false;
          try {
            const d = parseISO(c.data_competencia);
            return d >= monthStart && d <= monthEnd;
          } catch (e) {
            return false;
          }
        });

        const custosGerencia = projetoCustosMes.filter((c) => c.categoria_interna === "Gerência");
        const custosDiretos = projetoCustosMes.filter(
          (c) => c.categoria_interna !== "Gerência" && c.categoria_interna !== "Financeiros",
        );

        const gerenciaReal = custosGerencia.reduce((s, c) => s + Number(c.valor || 0), 0);
        const custoDiretoReal = custosDiretos.reduce((s, c) => s + Number(c.valor || 0), 0);

        // 3. Ignorar meses sem produção e sem custos reais
        if (poc === 0 && custoDiretoReal === 0 && gerenciaReal === 0) return;

        // Impostos
        const totalPercImpostos = impostosProjeto?.perc_total_impostos ?? 0;
        const impostosReais = poc * totalPercImpostos;
        const producaoLiquida = poc - impostosReais;

        const moObra = (projetoCustosMes || [])
          .filter((c) => c.categoria_analise === "DIRETO" && c.categoria_interna === "Mão de Obra")
          .reduce((s, c) => s + Number(c.valor || 0), 0);
        const materiais = (projetoCustosMes || [])
          .filter((c) => c.categoria_analise === "DIRETO" && c.categoria_interna === "Materiais")
          .reduce((s, c) => s + Number(c.valor || 0), 0);
        const transporte = (projetoCustosMes || [])
          .filter((c) => c.categoria_analise === "DIRETO" && c.categoria_interna === "Transporte")
          .reduce((s, c) => s + Number(c.valor || 0), 0);
        const direto = (projetoCustosMes || [])
          .filter((c) => c.categoria_analise === "DIRETO" && c.categoria_interna === "Direto")
          .reduce((s, c) => s + Number(c.valor || 0), 0);

        const percRisco = mkp?.perc_risco ?? 0;
        const percInflacao = mkp?.perc_inflacao ?? 0;
        const percGerencia = mkp?.perc_gerencia ?? 0;
        const percTreinamento = mkp?.perc_treinamento ?? 0;

        // O Cálculo de gerência deve ser feito sobre o custo direto orçado e não sobre o total produzido (POC).
        const gerenciaOrcada = custoDiretoOrcado * percGerencia;

        const custoTotalReal = custoDiretoReal + gerenciaReal;

        // Coluna “Custo Orçado Total”
        const custoTotalOrcado =
          custoDiretoOrcado +
          custoDiretoOrcado * percRisco +
          (custoDiretoOrcado + custoDiretoOrcado * (percRisco + percGerencia)) * percInflacao +
          gerenciaOrcada +
          (custoDiretoOrcado + custoDiretoOrcado * (percRisco + percGerencia)) * percTreinamento;

        const resultadoTotal = custoTotalOrcado - custoTotalReal;

        const mbRealizada = producaoLiquida - custoTotalReal;
        const mbOrcada = producaoLiquida - custoTotalOrcado;

        const percMbReal = producaoLiquida > 0 ? mbRealizada / producaoLiquida : 0;
        const percMbOrcada = producaoLiquida > 0 ? mbOrcada / producaoLiquida : 0;
        const percMbMkp = mkp?.perc_mb_esperado ?? 0;

        const pendentesCategorizacao = projetoCustosMes.filter((c) => !c.categoria_confirmada).length;

        rows.push({
          projetoId,
          projetoCodigo: projeto.codigo || "",
          projetoNome: projeto.nome,
          area: areaNome,
          cliente: clienteNome,
          referencia: monthLabel,
          mesReferencia: format(monthStart, "yyyy-MM"),
          poc,
          impostos: {
            issqn: poc * (impostosProjeto?.perc_issqn ?? 0),
            pis: poc * (impostosProjeto?.perc_pis ?? 0),
            cofins: poc * (impostosProjeto?.perc_cofins ?? 0),
            inss: poc * (impostosProjeto?.perc_inss ?? 0),
            dara: poc * (impostosProjeto?.perc_dara ?? 0),
            icms: poc * (impostosProjeto?.perc_icms ?? 0),
            irpj: poc * (impostosProjeto?.perc_irpj ?? 0),
            csll: poc * (impostosProjeto?.perc_csll ?? 0),
            totalPerc: totalPercImpostos,
            totalReais: impostosReais,
          },
          producaoLiquida,
          moObra,
          materiais,
          transporte,
          // equipamentos column removed as per user request
          direto,
          custoDiretoReal,
          custoDiretoOrcado,
          deltaDireto: custoDiretoOrcado - custoDiretoReal,
          percCustoDiretoOrcado: mkp?.perc_custo_direto ?? 0,
          percCustoDiretoReal: poc > 0 ? custoDiretoReal / poc : 0,
          gerenciaReal,
          gerenciaOrcada,
          deltaGerencia: gerenciaOrcada - gerenciaReal,
          percGerenciaOrcada: custoDiretoOrcado > 0 ? gerenciaOrcada / custoDiretoOrcado : 0,
          percGerenciaReal: custoDiretoReal > 0 ? gerenciaReal / custoDiretoReal : 0,
          pendentesCategorizacao,
          custoTotalReal,
          custoTotalOrcado,
          resultadoTotal,
          mbOrcada,
          mbRealizada,
          percMbOrcada,
          percMbReal,
          percMbMkp,
          alertaMb: percMbReal < percMbMkp * 0.85,
          alertaGerencia: gerenciaReal > gerenciaOrcada * 1.15,
          semMkp: !mkp,
          semImpostos: !impostosProjeto,
        });
      });
    });

    return rows;
  }, [projetosData, mkpParamsPorProjeto, impostosPorProjeto, producaoPorProjeto, custosErpPorProjeto, startDate, endDate]);

  const updateCategoria = useMutation({
    mutationFn: async ({ erpId, newCategoria }: { erpId: string; newCategoria: string }) => {
      const { data: current } = await supabase
        .from("custo_real_erp")
        .select("categoria_erp")
        .eq("erp_id", erpId)
        .single();

      const { error } = await supabase
        .from("custo_real_erp")
        .update({ categoria_interna: newCategoria, categoria_confirmada: true })
        .eq("erp_id", erpId);
      if (error) throw error;

      if (current?.categoria_erp) {
        await supabase.from("mapeamento_categorias_erp").upsert(
          {
            categoria_erp: current.categoria_erp,
            categoria_interna: newCategoria,
            criado_por_ia: false,
            ativo: true,
          },
          { onConflict: "categoria_erp" },
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custos_erp_multi"] });
      queryClient.invalidateQueries({ queryKey: ["custos_erp"] });
      toast.success("Categoria atualizada.");
    },
  });

  const updateBulkCategorias = useMutation({
    mutationFn: async (updates: { erp_id: string; categoria_interna: string; categoria_erp: string }[]) => {
      for (const up of updates) {
        await supabase
          .from("custo_real_erp")
          .update({ categoria_interna: up.categoria_interna, categoria_confirmada: true })
          .eq("erp_id", up.erp_id);

        await supabase.from("mapeamento_categorias_erp").upsert(
          {
            categoria_erp: up.categoria_erp,
            categoria_interna: up.categoria_interna,
            criado_por_ia: false,
            ativo: true,
          },
          { onConflict: "categoria_erp" },
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custos_erp_multi"] });
      queryClient.invalidateQueries({ queryKey: ["custos_erp"] });
      toast.success("Correções em lote aplicadas com sucesso.");
    },
  });

  return {
    analiseRows,
    custosErp,
    loadCustos,
    updateCategoria,
    updateBulkCategorias,
    categoriasMapeamento,
  };
}
