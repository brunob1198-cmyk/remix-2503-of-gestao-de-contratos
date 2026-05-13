import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { calculateCustoDiretoOrcado } from "@/lib/custoUtils";


export interface AnaliseCustosRow {
  projetoId: string;
  projetoCodigo: string;
  projetoNome: string;
  area: string;
  cliente: string;
  referencia: string;           // "Jan/2026"

  // ── RECEITA ──────────────────────────────────────
  poc: number;                  // Produção bruta (POC do período)
  impostos: {                   // detalhamento por tipo
    issqn: number;
    pis: number;
    cofins: number;
    inss: number;
    dara: number;
    icms: number;
    irpj: number;
    csll: number;
    totalPerc: number;          // soma dos percentuais
    totalReais: number;         // poc * totalPerc
  };
  producaoLiquida: number;      // poc * (1 - impostos.totalPerc)

  // ── CUSTO DIRETO (categoria_analise = 'DIRETO') ──
  moObra: number;
  materiais: number;
  transporte: number;
  equipamentos: number;
  indiretos: number;
  custoDiretoReal: number;      // soma dos três acima — SEM gerência
  custoDiretoOrcado: number;    // poc * (mkp.perc_custo_direto + mkp.perc_risco + mkp.perc_inflacao)
  deltaDireto: number;          // orcado - real (+ = favorável)
  percCustoDiretoOrcado: number;
  percCustoDiretoReal: number;

  // ── GERÊNCIA (categoria_analise = 'GERENCIA') ────
  gerenciaReal: number;         // soma dos lançamentos IA-categorizados como GERENCIA
  gerenciaOrcada: number;       // poc * mkp.perc_gerencia
  deltaGerencia: number;        // orcado - real
  percGerenciaOrcada: number;
  percGerenciaReal: number;
  pendentesCategorizacao: number; // qtd. lançamentos ainda sem categoria confirmada

  // ── CUSTO TOTAL ──────────────────────────────────
  custoTotalReal: number;       // custoDiretoReal + gerenciaReal
  custoTotalOrcado: number;     // custoDiretoOrcado + formula complexa
  resultadoTotal: number;       // custoTotalOrcado - custoTotalReal

  // ── MB ───────────────────────────────────────────
  mbOrcada: number;
  mbRealizada: number;
  percMbOrcada: number;
  percMbReal: number;
  percMbMkp: number;            // benchmark: mkp.perc_mb_esperado

  // ── FLAGS ────────────────────────────────────────
  alertaMb: boolean;            // percMbReal < percMbMkp * 0.85
  alertaGerencia: boolean;      // gerenciaReal > gerenciaOrcada * 1.15
  semMkp: boolean;              // não tem mkp_parametros cadastrado
  semImpostos: boolean;         // não tem projeto_impostos cadastrado
}

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
  categoria_analise: 'DIRETO' | 'GERENCIA';
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
    staleTime: Infinity,
    queryFn: async () => {
      let qSites = supabase.from("sites").select("id").eq("projeto_id", projetoId);
      const { data: sitesData } = await qSites;
      if (!sitesData || sitesData.length === 0) return { custoOrcado: 0, valorProduzido: 0 };

      const siteIds = siteId ? [siteId] : sitesData.map(s => s.id);

      const { data: escopoItens, error: escopoError } = await supabase
        .from("escopo_itens")
        .select(`
          quantidade, 
          custo_unitario, 
          valor_unitario, 
          item_lpu_id,
          item_lpu:itens_lpu (
            bdi
          )
        `)
        .in("site_id", siteIds);

      if (escopoError || !escopoItens || escopoItens.length === 0) return { custoOrcado: 0, valorProduzido: 0 };

      let custoOrcado = 0;
      let valorProduzido = 0;
      for (const item of escopoItens) {
        const quantidade = Number(item.quantidade || 0);
        const valorUnitario = Number(item.valor_unitario || 0);
        const bdiItem = Number((item.item_lpu as any)?.bdi || 0);
        
        // Se houver BDI no item, o custo unitário orçado é o valor unitário / BDI
        const custoUnitarioCalculado = bdiItem > 0 ? (valorUnitario / bdiItem) : Number(item.custo_unitario || 0);
        
        custoOrcado += custoUnitarioCalculado * quantidade;
        valorProduzido += valorUnitario * quantidade;
      }
      return { custoOrcado, valorProduzido };
    },
    enabled: !!projetoId
  });

  const custoOrcado = escopoData.custoOrcado;
  const valorProduzido = escopoData.valorProduzido;

  // Fetch disabled ERP categories
  const { data: categoriasDesativadas = [] } = useQuery({
    queryKey: ["categorias_erp_desativadas"],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mapeamento_categorias_erp")
        .select("categoria_erp")
        .eq("ativo", false);
      if (error) throw error;
      return (data || []).map(d => d.categoria_erp);
    },
  });

  // 2. Custos Pagos (ERP) - filtra categorias desativadas
  const { data: custosErp = [], isLoading: loadCustos } = useQuery({
    queryKey: ["custos_erp", projetoId, siteId, startDate, categoriasDesativadas],
    staleTime: Infinity,
    queryFn: async () => {
      const BATCH_SIZE = 1000;
      const allData: CustoErp[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        let q = supabase.from("custo_real_erp").select("*").range(offset, offset + BATCH_SIZE - 1);
        if (projetoId) q = q.eq("projeto_id", projetoId);
        if (siteId) q = q.eq("site_id", siteId);
        if (startDate && endDate) {
          q = q.gte("data_competencia", startDate).lte("data_competencia", endDate);
        } else if (startDate) {
          q = q.gte("data_competencia", startDate);
        }

        const { data, error } = await q;
        if (error) throw error;
        const batch = (data || []) as CustoErp[];
        allData.push(...batch);
        hasMore = batch.length === BATCH_SIZE;
        offset += BATCH_SIZE;
      }

      return allData.filter(
        item => !categoriasDesativadas.includes(item.categoria_erp) &&
                item.centro_custo?.trim() !== "Reforma Sede Jardim América"
      );
    },
    enabled: !!projetoId
  });

  // 3. Produzido Físico
  const { data: fisico = { maoDeObra: 0, materiais: 0, transporte: 0, equipamentos: 0, total_produzido: 0 }, isLoading: loadFisico } = useQuery({
    queryKey: ["fisico_apropriado", projetoId, siteId, startDate],
    staleTime: Infinity,
    queryFn: async () => {
      let qDiarios = supabase.from("diarios_obra").select("id").eq("site_id", siteId);
      if (startDate && endDate) qDiarios = qDiarios.gte("data", startDate).lte("data", endDate);
      else if (startDate) qDiarios = qDiarios.gte("data", startDate);

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
      // 1. Get current record to know original category
      const { data: current } = await supabase
        .from("custo_real_erp")
        .select("categoria_erp")
        .eq("erp_id", erpId)
        .single();

      // 2. Update record
      const { error } = await supabase.from("custo_real_erp")
         .update({ categoria_interna: newCategoria })
         .eq("erp_id", erpId);
      if (error) throw error;

      // 3. Learning Step: Upsert mapping
      if (current?.categoria_erp) {
        await supabase.from("mapeamento_categorias_erp").upsert({
          categoria_erp: current.categoria_erp,
          categoria_interna: newCategoria,
          criado_por_ia: false, // User manual adjustment
          ativo: true
        }, { onConflict: "categoria_erp" });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custos_erp"] });
      queryClient.invalidateQueries({ queryKey: ["custos_erp_multi"] });
      toast.success("Categoria atualizada e sistema atualizado para futuros registros.");
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
    custoOrcado, valorProduzido, loadOrc,
    custosErp, loadCustos, updateCategoria, 
    syncErpMock: syncErp,
    syncErp,
    fisico, loadFisico
  };
}

export function useAnaliseCustosMulti(projetoIds: string[], periodoInicio?: Date, periodoFim?: Date) {
  const queryClient = useQueryClient();

  const startDate = periodoInicio ? format(startOfMonth(periodoInicio), "yyyy-MM-dd") : null;
  const endDate = periodoFim ? format(endOfMonth(periodoFim), "yyyy-MM-dd") : null;

  // 1. Parâmetros MKP
  const { data: mkpParams = [] } = useQuery({
    queryKey: ["mkp_parametros", projetoIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("mkp_parametros")
        .select("*")
        .in("projeto_id", projetoIds);
      return data || [];
    },
    enabled: projetoIds.length > 0,
  });

  // 2. Impostos por projeto
  const { data: impostosData = [] } = useQuery({
    queryKey: ["projeto_impostos", projetoIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("projeto_impostos")
        .select("*")
        .in("projeto_id", projetoIds);
      return data || [];
    },
    enabled: projetoIds.length > 0,
  });

  const { data: categoriasMapeamento = [] } = useQuery({
    queryKey: ["mapeamento_categorias_erp_all"],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mapeamento_categorias_erp")
        .select("categoria_erp, categoria_interna, ativo");
      if (error) throw error;
      return data || [];
    },
  });

  const categoriasDesativadas = useMemo(() => 
    categoriasMapeamento.filter(c => !c.ativo).map(c => c.categoria_erp),
    [categoriasMapeamento]
  );

  const { data: custosErp = [], isLoading: loadCustos } = useQuery({
    queryKey: ["custos_erp_multi", projetoIds, startDate, endDate, categoriasDesativadas],
    staleTime: Infinity,
    queryFn: async () => {
      if (projetoIds.length === 0) return [];
      const BATCH_SIZE = 1000;
      const allData: CustoErp[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        let q = supabase.from("custo_real_erp").select("*").range(offset, offset + BATCH_SIZE - 1);
        q = q.in("projeto_id", projetoIds);
        if (startDate && endDate) {
          q = q.gte("data_competencia", startDate).lte("data_competencia", endDate);
        } else if (startDate) {
          q = q.gte("data_competencia", startDate);
        }

        const { data, error } = await q;
        if (error) throw error;
        const batch = (data || []) as CustoErp[];
        allData.push(...batch);
        hasMore = batch.length === BATCH_SIZE;
        offset += BATCH_SIZE;
      }

      return allData.filter(
        item => !categoriasDesativadas.includes(item.categoria_erp) &&
                item.centro_custo?.trim() !== "Reforma Sede Jardim América"
      );
    },
    enabled: projetoIds.length > 0
  });

  // 4. Produção (POC) por Projeto e Referência
  const { data: producaoData = [] } = useQuery({
    queryKey: ["producao_poc_multi_v14", projetoIds],
    queryFn: async () => {
      if (projetoIds.length === 0) return [];
      
      const BATCH_SIZE = 1000;
      let allData: any[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("diario_producao")
          .select(`
            valor_total,
            item_lpu_id,
            diarios_obra (
              id,
              data,
              site:sites (
                id,
                projeto_id
              )
            ),
            item_lpu:itens_lpu (
              bdi
            )
          `)
          .range(offset, offset + BATCH_SIZE - 1);

        if (error) {
          console.error("Erro ao buscar producaoData:", error);
          break;
        }
        
        allData = [...allData, ...(data || [])];
        hasMore = data?.length === BATCH_SIZE;
        offset += BATCH_SIZE;
      }

      const mapped = allData

        .map(p => {
          // A estrutura pode ser p.diarios_obra.sites.projeto_id ou p.diarios_obra.site.projeto_id
          const doObj = (p.diarios_obra as any);
          const siteData = doObj?.site || doObj?.sites;
          const projeto_id = Array.isArray(siteData) ? siteData[0]?.projeto_id : siteData?.projeto_id;
          
          return {
            projeto_id,
            valor_total: Number(p.valor_total || 0),
            data_producao: doObj?.data,
            bdi_item: Number((p.item_lpu as any)?.bdi || 0)
          };
        })
        .filter(p => p.projeto_id && projetoIds.includes(p.projeto_id));



      console.log(`[Producao] Itens filtrados: ${mapped.length}. Projetos buscados: ${projetoIds.join(',')}`);
      if (mapped.length > 0) {
        console.log(`[Producao] Exemplo de item:`, mapped[0]);
      }
      
      return mapped;



    },
    enabled: projetoIds.length > 0
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
    enabled: projetoIds.length > 0
  });

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

    (projetosData || []).forEach(projeto => {
      const projetoId = projeto.id;
      const mkp = (mkpParams || []).find(m => m.projeto_id === projetoId);
      const impostosProjeto = (impostosData || []).find(i => i.projeto_id === projetoId);
      const clienteNome = (projeto as any).clientes?.nome || (projeto as any).cliente || (projeto as any).cliente_id || 'N/A';
      const areaNome = (projeto as any).areas?.nome || (projeto as any).area_analise || (projeto as any).area_id || 'N/A';
      
      (periodMonths || []).forEach(monthStr => {
        const monthStart = startOfMonth(parseISO(monthStr));
        const monthEnd = endOfMonth(monthStart);
        const monthLabel = format(monthStart, 'MMM/yyyy', { locale: ptBR });








        // 1. Produção Bruta (POC) do mês e Custo Direto Orçado (baseado no BDI do item)
        const producaoItensMes = (producaoData || [])
          .filter(p => {
            if (p.projeto_id !== projetoId) return false;
            try {
              const dStr = p.data_producao;
              if (!dStr) return false;
              // data_producao usually comes as YYYY-MM-DD
              const d = parseISO(dStr);
              return d >= monthStart && d <= monthEnd;

            } catch (e) {
              return false;
            }
          });




        const poc = producaoItensMes.reduce((sum, p) => sum + Number(p.valor_total || 0), 0);
        
        // Novo cálculo de Custo Direto Orçado: soma de (Valor Item / BDI Item)
        const custoDiretoOrcado = calculateCustoDiretoOrcado(producaoItensMes, mkp);


        // 2. Custos do mês
        const projetoCustosMes = (custosErp || []).filter(c => {
          if (c.projeto_id !== projetoId || !c.data_competencia) return false;
          try {
            const d = parseISO(c.data_competencia);
            return d >= monthStart && d <= monthEnd;
          } catch (e) {
            return false;
          }
        });

        const custosGerencia = projetoCustosMes.filter(c => c.categoria_interna === 'Gerência');
        const custosDiretos = projetoCustosMes.filter(c => c.categoria_interna !== 'Gerência' && c.categoria_interna !== 'Financeiros');

        const gerenciaReal = custosGerencia.reduce((s, c) => s + Number(c.valor || 0), 0);
        const custoDiretoReal = custosDiretos.reduce((s, c) => s + Number(c.valor || 0), 0);

        // 3. Ignorar meses sem produção e sem custos reais
        if (poc === 0 && custoDiretoReal === 0 && gerenciaReal === 0) return;


        // Impostos
        const totalPercImpostos = impostosProjeto?.perc_total_impostos ?? 0;
        const impostosReais = poc * totalPercImpostos;
        const producaoLiquida = poc - impostosReais;
        
        const moObra = (projetoCustosMes || []).filter(c => c.categoria_analise === 'DIRETO' && c.categoria_interna === 'Mão de Obra').reduce((s, c) => s + Number(c.valor || 0), 0);
        const materiais = (projetoCustosMes || []).filter(c => c.categoria_analise === 'DIRETO' && c.categoria_interna === 'Materiais').reduce((s, c) => s + Number(c.valor || 0), 0);
        const transporte = (projetoCustosMes || []).filter(c => c.categoria_analise === 'DIRETO' && c.categoria_interna === 'Transporte').reduce((s, c) => s + Number(c.valor || 0), 0);
        const equipamentos = (projetoCustosMes || []).filter(c => c.categoria_analise === 'DIRETO' && c.categoria_interna === 'Equipamentos').reduce((s, c) => s + Number(c.valor || 0), 0);
        const indiretos = (projetoCustosMes || []).filter(c => c.categoria_analise === 'DIRETO' && c.categoria_interna === 'Indiretos').reduce((s, c) => s + Number(c.valor || 0), 0);

        const percRisco = mkp?.perc_risco ?? 0;
        const percInflacao = mkp?.perc_inflacao ?? 0;
        const percGerencia = mkp?.perc_gerencia ?? 0;
        const percTreinamento = mkp?.perc_treinamento ?? 0;
        const gerenciaOrcada = poc * percGerencia;

        const custoTotalReal = custoDiretoReal + gerenciaReal;
        
        // Coluna “Custo Orçado Total”
        // const custoTotalOrcado = custoDiretoOrcado + (custoDiretoOrcado * percRisco) + ((custoDiretoOrcado * (percRisco+percGerencia)) * percInflacao) + gerenciaOrcada + ((custoDiretoOrcado * (percRisco+percGerencia)) * perc_treinamento);
        const custoTotalOrcado = 
          custoDiretoOrcado + 
          (custoDiretoOrcado * percRisco) + 
          ((custoDiretoOrcado * (percRisco + percGerencia)) * percInflacao) + 
          gerenciaOrcada + 
          ((custoDiretoOrcado * (percRisco + percGerencia)) * percTreinamento);

        const resultadoTotal = custoTotalOrcado - custoTotalReal;

        const mbRealizada = producaoLiquida - custoTotalReal;
        const mbOrcada = producaoLiquida - custoTotalOrcado;
        
        const percMbReal = producaoLiquida > 0 ? mbRealizada / producaoLiquida : 0;
        const percMbOrcada = producaoLiquida > 0 ? mbOrcada / producaoLiquida : 0;
        const percMbMkp = mkp?.perc_mb_esperado ?? 0;

        const pendentesCategorizacao = projetoCustosMes.filter(c => !c.categoria_confirmada).length;

        rows.push({
          projetoId,
          projetoCodigo: projeto.codigo || '',
          projetoNome: projeto.nome,
          area: areaNome,
          cliente: clienteNome,
          referencia: monthLabel,
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
            totalReais: impostosReais
          },
          producaoLiquida,
          moObra,
          materiais,
          transporte,
          equipamentos,
          indiretos,
          custoDiretoReal,
          custoDiretoOrcado,
          deltaDireto: custoDiretoOrcado - custoDiretoReal,
          percCustoDiretoOrcado: mkp?.perc_custo_direto ?? 0,
          percCustoDiretoReal: poc > 0 ? custoDiretoReal / poc : 0,
          gerenciaReal,
          gerenciaOrcada,
          deltaGerencia: gerenciaOrcada - gerenciaReal,
          percGerenciaOrcada: mkp?.perc_gerencia ?? 0,
          percGerenciaReal: poc > 0 ? gerenciaReal / poc : 0,
          pendentesCategorizacao,
          custoTotalReal,
          custoTotalOrcado,
          mbOrcada,
          mbRealizada,
          percMbOrcada,
          percMbReal,
          percMbMkp,
          alertaMb: percMbReal < (percMbMkp * 0.85),
          alertaGerencia: gerenciaReal > (gerenciaOrcada * 1.15),
          semMkp: !mkp,
          semImpostos: !impostosProjeto
        });
      });
    });

    return rows;
  }, [projetosData, mkpParams, impostosData, producaoData, custosErp, startDate, endDate]);

  const updateCategoria = useMutation({
    mutationFn: async ({ erpId, newCategoria }: { erpId: string; newCategoria: string }) => {
      const { data: current } = await supabase
        .from("custo_real_erp")
        .select("categoria_erp")
        .eq("erp_id", erpId)
        .single();

      const { error } = await supabase.from("custo_real_erp")
        .update({ categoria_interna: newCategoria })
        .eq("erp_id", erpId);
      if (error) throw error;

      if (current?.categoria_erp) {
        await supabase.from("mapeamento_categorias_erp").upsert({
          categoria_erp: current.categoria_erp,
          categoria_interna: newCategoria,
          criado_por_ia: false,
          ativo: true
        }, { onConflict: "categoria_erp" });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custos_erp_multi"] });
      queryClient.invalidateQueries({ queryKey: ["custos_erp"] });
      toast.success("Categoria atualizada.");
    }
  });

  const updateBulkCategorias = useMutation({
    mutationFn: async (updates: { erp_id: string; categoria_interna: string; categoria_erp: string }[]) => {
      for (const up of updates) {
        await supabase.from("custo_real_erp")
          .update({ categoria_interna: up.categoria_interna })
          .eq("erp_id", up.erp_id);
        
        await supabase.from("mapeamento_categorias_erp").upsert({
          categoria_erp: up.categoria_erp,
          categoria_interna: up.categoria_interna,
          criado_por_ia: false,
          ativo: true
        }, { onConflict: "categoria_erp" });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custos_erp_multi"] });
      queryClient.invalidateQueries({ queryKey: ["custos_erp"] });
      toast.success("Correções em lote aplicadas com sucesso.");
    }
  });

  return { 
    analiseRows, 
    custosErp, 
    loadCustos, 
    updateCategoria, 
    updateBulkCategorias, 
    categoriasMapeamento 
  };
}


