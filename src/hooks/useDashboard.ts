import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ResumoItem, ResumoProjeto } from "@/types/medicoes";

export function useDashboard(projetoId?: string, siteIds?: string[]) {
  const { data: resumoProjetos = [], isLoading: isLoadingProjetos } = useQuery({
    queryKey: ["dashboard", "projetos", projetoId, siteIds],
    queryFn: async () => {
      // Get all projects with their sites
      const { data: projetos, error: projError } = await supabase
        .from("projetos")
        .select("id, codigo, nome");
      if (projError) throw projError;

      // Get all production data from diário de obra
      const { data: producao, error: prodError } = await supabase
        .from("diario_producao")
        .select("quantidade, valor_total, item_lpu:itens_lpu(preco_unitario), diario:diarios_obra(site_id)");
      if (prodError) throw prodError;

      // Get all measurement data
      const { data: medicao, error: medError } = await supabase
        .from("lancamentos_medicao")
        .select("site_id, quantidade, item_lpu:itens_lpu(preco_unitario)");
      if (medError) throw medError;

      // Get all billing data
      const { data: faturamento, error: fatError } = await supabase
        .from("lancamentos_faturamento")
        .select("site_id, quantidade, valor_faturado, item_lpu:itens_lpu(preco_unitario)");
      if (fatError) throw fatError;

      // Get sites with project mapping
      const { data: sites, error: siteError } = await supabase
        .from("sites")
        .select("id, projeto_id");
      if (siteError) throw siteError;

      const siteProjetoMap = new Map(sites?.map(s => [s.id, s.projeto_id]) || []);

      // Determine which sites to include based on filters
      let filteredSiteIdSet: Set<string> | null = null;
      if (siteIds && siteIds.length > 0) {
        filteredSiteIdSet = new Set(siteIds);
      } else if (projetoId) {
        filteredSiteIdSet = new Set(sites?.filter(s => s.projeto_id === projetoId).map(s => s.id) || []);
      }

      // Calculate totals per project (respecting site filter)
      const resumo: ResumoProjeto[] = projetos?.map(p => {
        let projetoSites = sites?.filter(s => s.projeto_id === p.id).map(s => s.id) || [];
        
        // If site filter is active, intersect with project sites
        if (filteredSiteIdSet) {
          projetoSites = projetoSites.filter(sId => filteredSiteIdSet!.has(sId));
        }
        
        const totalProduzido = producao
          ?.filter(l => {
            const siteId = (l.diario as any)?.site_id;
            return siteId && projetoSites.includes(siteId);
          })
          .reduce((sum, l) => sum + (Number(l.valor_total) || 0), 0) || 0;

        const totalMedido = medicao
          ?.filter(l => projetoSites.includes(l.site_id))
          .reduce((sum, l) => {
            const preco = (l.item_lpu as any)?.preco_unitario || 0;
            return sum + (Number(l.quantidade) * Number(preco));
          }, 0) || 0;

        const totalFaturado = faturamento
          ?.filter(l => projetoSites.includes(l.site_id))
          .reduce((sum, l) => {
            return sum + (Number(l.valor_faturado) || (Number(l.quantidade) * Number((l.item_lpu as any)?.preco_unitario || 0)));
          }, 0) || 0;

        return {
          projeto_id: p.id,
          codigo: p.codigo,
          nome: p.nome,
          total_produzido: totalProduzido,
          total_medido: totalMedido,
          total_faturado: totalFaturado,
          total_a_medir: totalProduzido - totalMedido,
          total_a_faturar: totalMedido - totalFaturado,
        };
      }) || [];

      // Filter out projects with no data when site filter is active
      if (filteredSiteIdSet) {
        return resumo.filter(p => p.total_produzido !== 0 || p.total_medido !== 0 || p.total_faturado !== 0);
      }

      return resumo.filter(p => p.total_produzido !== 0 || p.total_medido !== 0 || p.total_faturado !== 0);

      return resumo;
    },
  });

  const { data: resumoItens = [], isLoading: isLoadingItens } = useQuery({
    queryKey: ["dashboard", "itens", projetoId, siteIds],
    queryFn: async () => {
      // Get all LPU items
      const { data: itens, error: itemError } = await supabase
        .from("itens_lpu")
        .select("*");
      if (itemError) throw itemError;

      // Get all sites with project info
      const { data: allSites, error: allSitesError } = await supabase
        .from("sites")
        .select("*, projeto:projetos(*)");
      if (allSitesError) throw allSitesError;

      // Filter sites by project or site IDs
      let filteredSiteIds: string[] = [];
      if (siteIds && siteIds.length > 0) {
        filteredSiteIds = siteIds;
      } else if (projetoId) {
        filteredSiteIds = allSites?.filter(s => s.projeto_id === projetoId).map(s => s.id) || [];
      }

      // Get all production data from diário de obra
      let prodQuery = supabase.from("diario_producao")
        .select("item_lpu_id, quantidade, valor_total, diario:diarios_obra(site_id)");
      const { data: producaoRaw } = await prodQuery;
      // Map to include site_id at top level for easier processing
      const producao = (producaoRaw || []).map(p => ({
        site_id: (p.diario as any)?.site_id as string,
        item_lpu_id: p.item_lpu_id,
        quantidade: p.quantidade,
        valor_total: p.valor_total,
      })).filter(p => p.site_id && (!filteredSiteIds.length || filteredSiteIds.includes(p.site_id)));

      // Get all measurement data
      let medQuery = supabase.from("lancamentos_medicao").select("site_id, item_lpu_id, quantidade");
      if (filteredSiteIds.length > 0) {
        medQuery = medQuery.in("site_id", filteredSiteIds);
      }
      const { data: medicao } = await medQuery;

      // Get all billing data
      let fatQuery = supabase.from("lancamentos_faturamento").select("site_id, item_lpu_id, quantidade, valor_faturado").limit(100000);
      if (filteredSiteIds.length > 0) {
        fatQuery = fatQuery.in("site_id", filteredSiteIds);
      }
      const { data: faturamento } = await fatQuery;

      // Create site map for quick lookup
      const siteMap = new Map(allSites?.map(s => [s.id, s]) || []);

      // Group by site + item CODE for detailed view (one line per site/item code combination)
      // This ensures items with the same code but different IDs (project-specific vs general) are merged
      const resumoMap = new Map<string, ResumoItem>();

      // Process production data
      producao?.forEach(l => {
        const item = itens?.find(i => i.id === l.item_lpu_id);
        const site = siteMap.get(l.site_id);
        if (!item || !site) return;

        const key = `${l.site_id}_${item.codigo}`; // Group by site + item CODE (not ID)
        if (!resumoMap.has(key)) {
          resumoMap.set(key, {
            item_lpu_id: item.id,
            codigo: item.codigo,
            descricao: item.descricao,
            unidade: item.unidade,
            preco_unitario: Number(item.preco_unitario),
            site_codigo: site.codigo,
            site_nome: site.nome,
            projeto_codigo: (site.projeto as any)?.codigo || "",
            projeto_nome: (site.projeto as any)?.nome || "",
            qtd_produzida: 0,
            qtd_medida: 0,
            qtd_faturada: 0,
            qtd_a_medir: 0,
            qtd_a_faturar: 0,
            valor_produzido: 0,
            valor_medido: 0,
            valor_faturado: 0,
          });
        }
        const resumo = resumoMap.get(key)!;
        resumo.qtd_produzida += Number(l.quantidade);
      });

      // Process measurement data
      medicao?.forEach(l => {
        const item = itens?.find(i => i.id === l.item_lpu_id);
        const site = siteMap.get(l.site_id);
        if (!item || !site) return;

        const key = `${l.site_id}_${item.codigo}`; // Group by site + item CODE (not ID)
        if (!resumoMap.has(key)) {
          resumoMap.set(key, {
            item_lpu_id: item.id,
            codigo: item.codigo,
            descricao: item.descricao,
            unidade: item.unidade,
            preco_unitario: Number(item.preco_unitario),
            site_codigo: site.codigo,
            site_nome: site.nome,
            projeto_codigo: (site.projeto as any)?.codigo || "",
            projeto_nome: (site.projeto as any)?.nome || "",
            qtd_produzida: 0,
            qtd_medida: 0,
            qtd_faturada: 0,
            qtd_a_medir: 0,
            qtd_a_faturar: 0,
            valor_produzido: 0,
            valor_medido: 0,
            valor_faturado: 0,
          });
        }
        const resumo = resumoMap.get(key)!;
        resumo.qtd_medida += Number(l.quantidade);
      });

      // Process billing data
      faturamento?.forEach(l => {
        const item = itens?.find(i => i.id === l.item_lpu_id);
        const site = siteMap.get(l.site_id);
        if (!item || !site) return;

        const key = `${l.site_id}_${item.codigo}`; // Group by site + item CODE (not ID)
        if (!resumoMap.has(key)) {
          resumoMap.set(key, {
            item_lpu_id: item.id,
            codigo: item.codigo,
            descricao: item.descricao,
            unidade: item.unidade,
            preco_unitario: Number(item.preco_unitario),
            site_codigo: site.codigo,
            site_nome: site.nome,
            projeto_codigo: (site.projeto as any)?.codigo || "",
            projeto_nome: (site.projeto as any)?.nome || "",
            qtd_produzida: 0,
            qtd_medida: 0,
            qtd_faturada: 0,
            qtd_a_medir: 0,
            qtd_a_faturar: 0,
            valor_produzido: 0,
            valor_medido: 0,
            valor_faturado: 0,
          });
        }
        const resumo = resumoMap.get(key)!;
        resumo.qtd_faturada += Number(l.quantidade);
      });

      // Calculate derived values
      const resumo = Array.from(resumoMap.values()).map(item => ({
        ...item,
        qtd_a_medir: item.qtd_produzida - item.qtd_medida,
        qtd_a_faturar: item.qtd_medida - item.qtd_faturada,
        valor_produzido: item.qtd_produzida * item.preco_unitario,
        valor_medido: item.qtd_medida * item.preco_unitario,
        valor_faturado: item.qtd_faturada * item.preco_unitario,
      })).filter(item => item.qtd_produzida !== 0 || item.qtd_medida !== 0 || item.qtd_faturada !== 0);

      return resumo;
    },
  });

  // Calculate totals from resumoProjetos (which respects filters)
  const totais = {
    totalProduzido: resumoProjetos.reduce((sum, p) => sum + p.total_produzido, 0),
    totalMedido: resumoProjetos.reduce((sum, p) => sum + p.total_medido, 0),
    totalFaturado: resumoProjetos.reduce((sum, p) => sum + p.total_faturado, 0),
    totalAMedir: resumoProjetos.reduce((sum, p) => sum + p.total_a_medir, 0),
    totalAFaturar: resumoProjetos.reduce((sum, p) => sum + p.total_a_faturar, 0),
  };

  return {
    resumoProjetos,
    resumoItens,
    totais,
    isLoading: isLoadingProjetos || isLoadingItens,
  };
}
