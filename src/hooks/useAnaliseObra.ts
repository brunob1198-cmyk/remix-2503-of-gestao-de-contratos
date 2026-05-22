import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";

export interface AnaliseFinanceira {
  receitaTotal: number;
  receitaLiquida: number;
  custoReal: number;
  custoEsperado: number;
  margem: number;
  margemPercent: number;
  mbOrcada: number;
  mbOrcadaPercent: number;
  aFaturar: number;
  custoPrevisto: number;
  lucroProjetado: number;
}

export interface AnaliseProgresso {
  percentExecutado: number;
  percentMedido: number;
  percentFaturado: number;
}

export interface AnaliseServico {
  itemId: string;
  codigo: string;
  descricao: string;
  receita: number;
  custoReal: number;
  custoEsperado: number;
  margem: number;
  margemPercent: number;
}

export interface AlertaObra {
  tipo: "critico" | "atencao" | "info";
  mensagem: string;
}

export interface CustoCategoria {
  categoria: string;
  esperado: number;
  real: number;
  desvio: number;
  desvioPercent: number;
}

export interface EvolucaoDiaria {
  data: string;
  producao: number;
  custo: number;
  margemAcumulada: number;
}

export interface ProducaoItem {
  itemLpuId: string;
  codigo: string;
  descricao: string;
  unidade: string;
  planejado: number;
  executado: number;
  saldo: number;
  mediaDiaria: number;
  mediaSemanal: number;
  mediaMensal: number;
  diasComProducao: number;
  primeiraData: string | null;
  ultimaData: string | null;
  fotos?: string[];
}

export function useAnaliseObra(projetoId?: string, filterSiteId?: string, periodoInicio?: Date, periodoFim?: Date) {
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["analise_obra", projetoId, filterSiteId, periodoInicio?.toISOString(), periodoFim?.toISOString()],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      if (!projetoId) return null;

      // Ensure we have the correct projeto_id. 
      // In some cases, projetoId might be passed as a siteId if incorrectly linked in UI,
      // but usuallyprojetoId is the actual projeto.id.
      let resolvedProjetoId = projetoId;
      
      // If we are filtering by site, and projetoId is not set or seems like a site ID, 
      // we double check it.
      if (filterSiteId && (!projetoId || projetoId === filterSiteId)) {
        const { data: siteData } = await supabase.from("sites").select("projeto_id").eq("id", filterSiteId).maybeSingle();
        if (siteData) resolvedProjetoId = siteData.projeto_id;
      }

      // Fetch all sites for this project
      const { data: projectSites } = await supabase
        .from("sites")
        .select("id")
        .eq("projeto_id", resolvedProjetoId);

      let siteIds = projectSites?.map(s => s.id) || [];
      
      // If filtering by specific site, narrow down
      if (filterSiteId && siteIds.includes(filterSiteId)) {
        siteIds = [filterSiteId];
      }

      // Fetch escopo (budget) with item_lpu for BDI
      let escopo: any[] = [];
      let medicao: any[] = [];
      let faturamento: any[] = [];
      let diarios: any[] = [];

      const { data: faturamentosData } = await supabase
        .from("faturamentos")
        .select("valor_liquido, valor_bruto")
        .eq("projeto_id", resolvedProjetoId);

      let taxRate = 0.94;
      if (faturamentosData && faturamentosData.length > 0) {
        const totalBruto = faturamentosData.reduce((a, b) => a + Number(b.valor_bruto || 0), 0);
        const totalLiquido = faturamentosData.reduce((a, b) => a + Number(b.valor_liquido || 0), 0);
        taxRate = totalBruto > 0 ? totalLiquido / totalBruto : 0.94;
      }

      if (siteIds.length > 0) {
        const startDateStr = periodoInicio ? format(startOfMonth(periodoInicio), "yyyy-MM-dd") : null;
        const endDateStr = periodoFim ? format(endOfMonth(periodoFim), "yyyy-MM-dd") : null;

        for (let i = 0; i < siteIds.length; i += 50) {
          const chunk = siteIds.slice(i, i + 50);
          
          // Fetch escopo, medicao, faturamento without date filter as they are cumulative
          const [escopoRes, medicaoRes, faturamentoRes] = await Promise.all([
            supabase.from("escopo_itens").select("*, item_lpu:itens_lpu(id, codigo, descricao, unidade, preco_unitario, bdi)").in("site_id", chunk),
            supabase.from("lancamentos_medicao").select("*, item_lpu:itens_lpu(codigo, descricao, unidade, preco_unitario)").in("site_id", chunk),
            supabase.from("lancamentos_faturamento").select("*, item_lpu:itens_lpu(codigo, descricao, unidade, preco_unitario)").in("site_id", chunk),
          ]);
          
          escopo = [...escopo, ...(escopoRes.data || [])];
          medicao = [...medicao, ...(medicaoRes.data || [])];
          faturamento = [...faturamento, ...(faturamentoRes.data || [])];

          // Fetch diarios_obra with pagination and date filter
          let hasMoreDiarios = true;
          let offsetDiarios = 0;
          while (hasMoreDiarios) {
            let q = supabase.from("diarios_obra").select("id, data").in("site_id", chunk).order("data", { ascending: true }).range(offsetDiarios, offsetDiarios + 999);
            if (startDateStr) q = q.gte("data", startDateStr);
            if (endDateStr) q = q.lte("data", endDateStr);
            
            const { data: batch } = await q;
            const rows = batch || [];
            diarios = [...diarios, ...rows];
            hasMoreDiarios = rows.length === 1000;
            offsetDiarios += 1000;
          }
        }
      }

      const diarioIds = diarios.map(d => d.id);

      let equipeData: any[] = [];
      let equipamentosData: any[] = [];
      let veiculosData: any[] = [];
      let diarioProducaoData: any[] = [];
      let fotosData: any[] = [];
      

      // Fetch disabled ERP categories
      const { data: categoriasMap } = await supabase
        .from("mapeamento_categorias_erp")
        .select("categoria_erp, ativo");
      const disabledCategorias = new Set(
        (categoriasMap || []).filter(c => !c.ativo).map(c => c.categoria_erp)
      );

      // Fetch ERP costs for the project — paginated
      const allErpData: any[] = [];
      let erpOffset = 0;
      let erpHasMore = true;
      let startDateStr: string | null = null;
      let endDateStr: string | null = null;
      if (periodoInicio) startDateStr = format(startOfMonth(periodoInicio), "yyyy-MM-dd");
      if (periodoFim) endDateStr = format(endOfMonth(periodoFim), "yyyy-MM-dd");

      while (erpHasMore) {
        let q = (supabase as any)
          .from("custo_real_erp")
          .select("valor, categoria_erp, categoria_interna, centro_custo")
          .eq("projeto_id", resolvedProjetoId)
          .range(erpOffset, erpOffset + 999);
        
        if (startDateStr) {
          q = q.gte("data_competencia", startDateStr).lte("data_competencia", endDateStr);
        }

        const { data: batch } = await q;
        const rows = batch || [];
        allErpData.push(...rows);
        erpHasMore = rows.length === 1000;
        erpOffset += 1000;
      }
      const erpData = allErpData;
      const uniqueErpCustos = (erpData || []).filter((c: any) => 
        !disabledCategorias.has(c.categoria_erp) && 
        c.centro_custo?.trim() !== "Reforma Sede Jardim América"
      );

      // Breakdown by category
      const custosErpPorCategoriaMap: Record<string, number> = {};
      uniqueErpCustos.forEach((c: any) => {
        const cat = c.categoria_interna || c.categoria_erp || "Outros";
        custosErpPorCategoriaMap[cat] = (custosErpPorCategoriaMap[cat] || 0) + Number(c.valor || 0);
      });
      const custosErpPorCategoria = Object.entries(custosErpPorCategoriaMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      if (diarioIds.length > 0) {
        for (let i = 0; i < diarioIds.length; i += 100) {
          const chunk = diarioIds.slice(i, i + 100);
          const [eq, eqp, vec, dprod, fts] = await Promise.all([
            supabase.from("diario_equipe").select("*").in("diario_id", chunk),
            supabase.from("diario_equipamentos").select("*").in("diario_id", chunk),
            supabase.from("diario_veiculos").select("*").in("diario_id", chunk),
            supabase.from("diario_producao").select("*, item_lpu:itens_lpu(id, codigo, descricao, unidade, preco_unitario, bdi)").in("diario_id", chunk),
            supabase.from("diario_fotos").select("*, diario:diarios_obra(data)").in("diario_id", chunk),
          ]);
          equipeData = [...equipeData, ...(eq.data || [])];
          equipamentosData = [...equipamentosData, ...(eqp.data || [])];
          veiculosData = [...veiculosData, ...(vec.data || [])];
          diarioProducaoData = [...diarioProducaoData, ...(dprod.data || [])];
          fotosData = [...fotosData, ...(fts.data || [])];
        }
      }

      const diarioMap = new Map(diarios?.map(d => [d.id, d.data]) || []);

      // ── Build escopo map (item_lpu_id -> escopo data) ──
      const escopoMap = new Map<string, { quantidade: number; valorUnitario: number; custoUnitario: number; codigo: string; descricao: string; unidade: string; bdi: number }>();
      escopo.forEach(e => {
        const item = e.item_lpu as any;
        const itemLpuId = e.item_lpu_id || item?.id;
        if (!itemLpuId) return;
        const existing = escopoMap.get(itemLpuId);
        if (existing) {
          existing.quantidade += Number(e.quantidade);
        } else {
          escopoMap.set(itemLpuId, {
            quantidade: Number(e.quantidade),
            valorUnitario: Number(e.valor_unitario),
            custoUnitario: Number(e.custo_unitario),
            codigo: item?.codigo || e.nome,
            descricao: item?.descricao || e.nome,
            unidade: item?.unidade || e.unidade,
            bdi: Number(item?.bdi || 1),
          });
        }
      });

      // ── RECEITA from diário production ──
      // Group diário production by item_lpu_id
      const prodByItem = new Map<string, { receita: number; quantidade: number; diasSet: Set<string>; primeiraData: string | null; ultimaData: string | null }>();
      
      diarioProducaoData.forEach(dp => {
        const itemLpuId = dp.item_lpu_id;
        const dt = diarioMap.get(dp.diario_id) || "";
        const existing = prodByItem.get(itemLpuId) || { receita: 0, quantidade: 0, diasSet: new Set<string>(), primeiraData: null, ultimaData: null };
        const qtd = Number(dp.quantidade);
        existing.receita += Number(dp.valor_total);
        existing.quantidade += qtd;
        if (dt && qtd > 0) {
          existing.diasSet.add(dt);
          if (!existing.primeiraData || dt < existing.primeiraData) existing.primeiraData = dt;
          if (!existing.ultimaData || dt > existing.ultimaData) existing.ultimaData = dt;
        }
        prodByItem.set(itemLpuId, existing);
      });

      const receitaTotal = diarioProducaoData.reduce((s: number, dp: any) => s + Number(dp.valor_total), 0);

      // ── COSTS: ERP costs take priority, fallback to diário costs ──
      const custoErpTotal = uniqueErpCustos.reduce((s, c) => s + Number(c.valor || 0), 0);
      const custoEquipe = equipeData.reduce((s, e) => s + Number(e.custo_total), 0);
      const custoEquipamentos = equipamentosData.reduce((s, e) => s + Number(e.custo_total), 0);
      const custoVeiculos = veiculosData.reduce((s, v) => s + Number(v.custo_diaria), 0);
      const custoDiario = custoEquipe + custoEquipamentos + custoVeiculos;
      // Use ERP cost if available, otherwise use diário cost
      const custoReal = custoErpTotal > 0 ? custoErpTotal : custoDiario;

      // ── EXPECTED COST based on BDI ──
      // For each item produced in diário, expected cost = receita / BDI
      // If escopo has custo_unitario, use: quantidade_produzida * custo_unitario
      let custoEsperado = 0;
      prodByItem.forEach((prod, itemLpuId) => {
        const esc = escopoMap.get(itemLpuId);
        if (esc && esc.custoUnitario > 0) {
          custoEsperado += prod.quantidade * esc.custoUnitario;
        } else {
          // Fallback: use BDI from itens_lpu
          const dpSample = diarioProducaoData.find((d: any) => d.item_lpu_id === itemLpuId);
          const bdi = Number((dpSample?.item_lpu as any)?.bdi || 1);
          custoEsperado += bdi > 0 ? prod.receita / bdi : prod.receita;
        }
      });

      const receitaLiquida = receitaTotal * taxRate;
      const margem = receitaLiquida - custoReal;
      const margemPercent = receitaLiquida > 0 ? (margem / receitaLiquida) * 100 : 0;
      
      const mbOrcada = receitaLiquida - custoEsperado;
      const mbOrcadaPercent = receitaLiquida > 0 ? (mbOrcada / receitaLiquida) * 100 : 0;

      const totalMedido = medicao.reduce((s, l) => {
        const preco = (l.item_lpu as any)?.preco_unitario || 0;
        return s + Number(l.quantidade) * Number(preco);
      }, 0);

      const totalFaturado = faturamento.reduce((s, l) => {
        return s + (Number(l.valor_faturado) || Number(l.quantidade) * Number((l.item_lpu as any)?.preco_unitario || 0));
      }, 0);

      const aFaturar = totalMedido - totalFaturado;

      // Escopo total
      const escopoTotal = escopo.reduce((s, e) => s + Number(e.quantidade) * Number(e.valor_unitario), 0);
      const escopoCustoTotal = escopo.reduce((s, e) => s + Number(e.quantidade) * Number(e.custo_unitario), 0);

      const financeiro: AnaliseFinanceira = {
        receitaTotal,
        receitaLiquida,
        custoReal,
        custoEsperado,
        margem,
        margemPercent,
        mbOrcada,
        mbOrcadaPercent,
        aFaturar,
        custoPrevisto: escopoCustoTotal,
        lucroProjetado: margem + (aFaturar > 0 ? aFaturar * taxRate : 0),
      };

      // ── PROGRESS ──
      const progresso: AnaliseProgresso = {
        percentExecutado: escopoTotal > 0 ? (receitaTotal / escopoTotal) * 100 : 0,
        percentMedido: escopoTotal > 0 ? (totalMedido / escopoTotal) * 100 : 0,
        percentFaturado: escopoTotal > 0 ? (totalFaturado / escopoTotal) * 100 : 0,
      };

      // ── SERVICE BREAKDOWN ──
      const servicos: AnaliseServico[] = [];
      prodByItem.forEach((prod, itemLpuId) => {
        const esc = escopoMap.get(itemLpuId);
        const dpSample = diarioProducaoData.find((d: any) => d.item_lpu_id === itemLpuId);
        const item = dpSample?.item_lpu as any;
        const codigo = esc?.codigo || item?.codigo || "?";
        const descricao = esc?.descricao || item?.descricao || "?";

        let custoEsp = 0;
        if (esc && esc.custoUnitario > 0) {
          custoEsp = prod.quantidade * esc.custoUnitario;
        } else {
          const bdi = Number(item?.bdi || 1);
          custoEsp = bdi > 0 ? prod.receita / bdi : prod.receita;
        }

        const receitaLiquidaItem = prod.receita * taxRate;
        // Prorate real cost by receita ratio
        const ratio = receitaTotal > 0 ? prod.receita / receitaTotal : 0;
        const custoRealItem = custoReal * ratio;

        const m = receitaLiquidaItem - custoRealItem;
        servicos.push({
          itemId: itemLpuId,
          codigo,
          descricao,
          receita: prod.receita,
          custoReal: custoRealItem,
          custoEsperado: custoEsp,
          margem: m,
          margemPercent: receitaLiquidaItem > 0 ? (m / receitaLiquidaItem) * 100 : 0,
        });
      });
      servicos.sort((a, b) => b.receita - a.receita);

      // ── ALERTS REMOVED ──
      const alertas: AlertaObra[] = [];

      // ── COST CATEGORIES (expected vs real) ──
      // Calculate expected split based on actual cost composition
      const custosCategorias: CustoCategoria[] = [
        {
          categoria: "Equipe",
          esperado: custoEsperado > 0 && custoReal > 0 ? custoEsperado * (custoEquipe / custoReal) : 0,
          real: custoEquipe,
          desvio: 0,
          desvioPercent: 0,
        },
        {
          categoria: "Equipamentos",
          esperado: custoEsperado > 0 && custoReal > 0 ? custoEsperado * (custoEquipamentos / custoReal) : 0,
          real: custoEquipamentos,
          desvio: 0,
          desvioPercent: 0,
        },
        {
          categoria: "Veículos",
          esperado: custoEsperado > 0 && custoReal > 0 ? custoEsperado * (custoVeiculos / custoReal) : 0,
          real: custoVeiculos,
          desvio: 0,
          desvioPercent: 0,
        },
      ];
      custosCategorias.forEach(c => {
        c.desvio = c.real - c.esperado;
        c.desvioPercent = c.esperado > 0 ? (c.desvio / c.esperado) * 100 : 0;
      });

      // ── DAILY EVOLUTION ──
      const evolucaoMap = new Map<string, { producao: number; custo: number }>();

      diarioProducaoData.forEach(dp => {
        const dt = diarioMap.get(dp.diario_id);
        if (!dt) return;
        const e = evolucaoMap.get(dt) || { producao: 0, custo: 0 };
        e.producao += Number(dp.valor_total);
        evolucaoMap.set(dt, e);
      });

      [...equipeData, ...equipamentosData].forEach(item => {
        const dt = diarioMap.get(item.diario_id);
        if (!dt) return;
        const e = evolucaoMap.get(dt) || { producao: 0, custo: 0 };
        e.custo += Number(item.custo_total);
        evolucaoMap.set(dt, e);
      });

      veiculosData.forEach(v => {
        const dt = diarioMap.get(v.diario_id);
        if (!dt) return;
        const e = evolucaoMap.get(dt) || { producao: 0, custo: 0 };
        e.custo += Number(v.custo_diaria);
        evolucaoMap.set(dt, e);
      });

      let margemAcum = 0;
      const evolucao: EvolucaoDiaria[] = Array.from(evolucaoMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([data, vals]) => {
          margemAcum += vals.producao - vals.custo;
          return { data, producao: vals.producao, custo: vals.custo, margemAcumulada: margemAcum };
        });

      // ── PRODUÇÃO TAB DATA ──
      // Calculate number of calendar days in the production period
      const allDates = Array.from(new Set(diarios.map(d => d.data))).sort();
      const totalDiasObra = allDates.length;

      const producaoItems: ProducaoItem[] = [];
      escopoMap.forEach((esc, itemLpuId) => {
        const prod = prodByItem.get(itemLpuId);
        const executado = prod?.quantidade || 0;
        const saldo = esc.quantidade - executado;
        const diasComProducao = prod?.diasSet.size || 0;

        // Calculate averages based on calendar span
        let mediaDiaria = 0;
        let mediaSemanal = 0;
        let mediaMensal = 0;

        if (totalDiasObra > 0) {
          mediaDiaria = executado / totalDiasObra;
          mediaSemanal = mediaDiaria * 7;
          mediaMensal = mediaDiaria * 30;
        }

        const itemFotos = fotosData
          .filter(f => f.diario_producao?.item_lpu_id === itemLpuId)
          .map(f => f.url)
          .slice(0, 5);

        producaoItems.push({
          itemLpuId,
          codigo: esc.codigo,
          descricao: esc.descricao,
          unidade: esc.unidade,
          planejado: esc.quantidade,
          executado,
          saldo,
          mediaDiaria,
          mediaSemanal,
          mediaMensal,
          diasComProducao,
          primeiraData: prod?.primeiraData || null,
          ultimaData: prod?.ultimaData || null,
          fotos: itemFotos,
        });
      });

      // Include items that are in prodByItem but NOT in escopoMap (Extra-plan production)
      prodByItem.forEach((prod, itemLpuId) => {
        if (!escopoMap.has(itemLpuId)) {
          const executado = prod.quantidade;
          const diasComProducao = prod.diasSet.size;
          
          let mediaDiaria = totalDiasObra > 0 ? executado / totalDiasObra : 0;
          
          const dpSample = diarioProducaoData.find((d: any) => d.item_lpu_id === itemLpuId);
          const item = dpSample?.item_lpu as any;

          producaoItems.push({
            itemLpuId,
            codigo: item?.codigo || "Extra",
            descricao: item?.descricao || "Item fora do escopo",
            unidade: item?.unidade || "-",
            planejado: 0,
            executado,
            saldo: -executado,
            mediaDiaria,
            mediaSemanal: mediaDiaria * 7,
            mediaMensal: mediaDiaria * 30,
            diasComProducao,
            primeiraData: prod.primeiraData,
            ultimaData: prod.ultimaData,
            fotos: fotosData
              .filter(f => f.diario_producao?.item_lpu_id === itemLpuId)
              .map(f => f.url)
              .slice(0, 5),
          });
        }
      });

      producaoItems.sort((a, b) => b.executado - a.executado);

      return {
        financeiro,
        progresso,
        servicos,
        alertas,
        custosCategorias,
        evolucao,
        producaoItems,
        custosErpPorCategoria,
      };
    },
  });

  return {
    data,
    isLoading,
    isFetching,
  };
}
