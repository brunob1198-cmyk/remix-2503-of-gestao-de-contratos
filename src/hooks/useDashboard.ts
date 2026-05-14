import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ResumoItem, ResumoProjeto } from "@/types/medicoes";
import { useAuth } from "@/contexts/AuthContext";

export function useDashboard(projetoId?: string, siteIds?: string[]) {
  const { empresaId } = useAuth();

  const { data: producaoAgregada } = useQuery({
    queryKey: ["sum_producao_por_item", projetoId, empresaId],
    queryFn: async () => {
      let p_projeto_ids: string[] = [];
      
      if (projetoId) {
        p_projeto_ids = [projetoId];
      } else if (empresaId) {
        const { data: projetosEmpresa } = await supabase
          .from("projetos")
          .select("id")
          .eq("empresa_id", empresaId);
        p_projeto_ids = projetosEmpresa?.map(p => p.id) || [];
      }

      if (p_projeto_ids.length === 0) return [];

      const { data, error } = await supabase
        .rpc("sum_producao_por_item", {
          p_projeto_ids
        });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!(projetoId || empresaId),
    staleTime: 10 * 60 * 1000,
  });

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ["dashboard_agregado", projetoId, siteIds, empresaId],
    queryFn: async () => {
      // 1. Get projects info
      let projQuery = supabase.from("projetos").select("id, codigo, nome");
      if (projetoId) projQuery = projQuery.eq("id", projetoId);
      else if (empresaId) projQuery = projQuery.eq("empresa_id", empresaId);
      
      const { data: projetos } = await projQuery;
      if (!projetos) return { resumoProjetos: [], resumoItens: [], totais: null };

      // 2. Get data from optimized view
      let viewQuery = supabase.from("vw_resumo_financeiro_site_item").select("*");
      if (projetoId) {
        viewQuery = viewQuery.eq("projeto_id", projetoId);
      } else if (empresaId) {
        const pIds = projetos.map(p => p.id);
        viewQuery = viewQuery.in("projeto_id", pIds);
      }
      
      if (siteIds && siteIds.length > 0) {
        viewQuery = viewQuery.in("site_id", siteIds);
      }

      const { data: viewData, error: viewError } = await viewQuery;
      if (viewError) throw viewError;

      // 3. Process data for projects summary
      const projetoResumoMap = new Map<string, ResumoProjeto>();
      projetos.forEach(p => {
        projetoResumoMap.set(p.id, {
          projeto_id: p.id,
          codigo: p.codigo,
          nome: p.nome,
          total_produzido: 0,
          total_medido: 0,
          total_faturado: 0,
          total_a_medir: 0,
          total_a_faturar: 0,
        });
      });

      const itemsResumo: ResumoItem[] = [];
      const siteIdsInvolved = Array.from(new Set(viewData?.map(v => v.site_id) || []));
      
      // Get sites info for items list
      const { data: sitesInfo } = await supabase
        .from("sites")
        .select("id, codigo, nome, projeto_id")
        .in("id", siteIdsInvolved);
      const siteMap = new Map(sitesInfo?.map(s => [s.id, s]) || []);

      viewData?.forEach(v => {
        const rp = projetoResumoMap.get(v.projeto_id);
        if (rp) {
          rp.total_produzido += Number(v.valor_produzido);
          rp.total_medido += Number(v.valor_medido);
          rp.total_faturado += Number(v.valor_faturado);
        }

        const site = siteMap.get(v.site_id);
        const projeto = projetos.find(p => p.id === v.projeto_id);

        itemsResumo.push({
          item_lpu_id: v.item_lpu_id,
          codigo: v.item_codigo,
          descricao: v.item_descricao,
          unidade: v.item_unidade,
          preco_unitario: Number(v.item_preco_unitario),
          site_codigo: site?.codigo || "",
          site_nome: site?.nome || "",
          projeto_codigo: projeto?.codigo || "",
          projeto_nome: projeto?.nome || "",
          qtd_produzida: Number(v.qtd_produzida),
          qtd_medida: Number(v.qtd_medida),
          qtd_faturada: Number(v.qtd_faturada),
          qtd_a_medir: Number(v.qtd_produzida) - Number(v.qtd_medida),
          qtd_a_faturar: Number(v.qtd_medida) - Number(v.qtd_faturada),
          valor_produzido: Number(v.valor_produzido),
          valor_medido: Number(v.valor_medido),
          valor_faturado: Number(v.valor_faturado),
        });
      });

      const resumoProjetosList = Array.from(projetoResumoMap.values()).map(rp => ({
        ...rp,
        total_a_medir: rp.total_produzido - rp.total_medido,
        total_a_faturar: rp.total_medido - rp.total_faturado,
      })).filter(p => p.total_produzido > 0 || p.total_medido > 0 || p.total_faturado > 0);

      const totais = {
        totalProduzido: resumoProjetosList.reduce((sum, p) => sum + p.total_produzido, 0),
        totalMedido: resumoProjetosList.reduce((sum, p) => sum + p.total_medido, 0),
        totalFaturado: resumoProjetosList.reduce((sum, p) => sum + p.total_faturado, 0),
        totalAMedir: resumoProjetosList.reduce((sum, p) => sum + p.total_a_medir, 0),
        totalAFaturar: resumoProjetosList.reduce((sum, p) => sum + p.total_a_faturar, 0),
      };

      return { resumoProjetos: resumoProjetosList, resumoItens: itemsResumo, totais };
    },
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  return {
    resumoProjetos: dashboardData?.resumoProjetos || [],
    resumoItens: dashboardData?.resumoItens || [],
    totais: dashboardData?.totais || { totalProduzido: 0, totalMedido: 0, totalFaturado: 0, totalAMedir: 0, totalAFaturar: 0 },
    isLoading,
  };
}
}
