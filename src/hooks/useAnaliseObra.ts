import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AnaliseFinanceira {
  receitaTotal: number;
  custoReal: number;
  custoEsperado: number;
  margem: number;
  margemPercent: number;
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
}

export function useAnaliseObra(siteId?: string) {
  const { data, isLoading } = useQuery({
    queryKey: ["analise_obra", siteId],
    queryFn: async () => {
      if (!siteId) return null;

      // Fetch escopo (budget) with item_lpu for BDI
      const { data: escopo } = await supabase
        .from("escopo_itens")
        .select("*, item_lpu:itens_lpu(id, codigo, descricao, unidade, preco_unitario, bdi)")
        .eq("site_id", siteId);

      // Fetch measurements
      const { data: medicao } = await supabase
        .from("lancamentos_medicao")
        .select("*, item_lpu:itens_lpu(codigo, descricao, unidade, preco_unitario)")
        .eq("site_id", siteId)
        .limit(100000);

      // Fetch billing
      const { data: faturamento } = await supabase
        .from("lancamentos_faturamento")
        .select("*, item_lpu:itens_lpu(codigo, descricao, unidade, preco_unitario)")
        .eq("site_id", siteId)
        .limit(100000);

      // Fetch diários
      const { data: diarios } = await supabase
        .from("diarios_obra")
        .select("id, data")
        .eq("site_id", siteId)
        .order("data", { ascending: true });

      const diarioIds = diarios?.map(d => d.id) || [];

      let equipeData: any[] = [];
      let equipamentosData: any[] = [];
      let veiculosData: any[] = [];
      let diarioProducaoData: any[] = [];
      let fotosData: any[] = [];

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
      (escopo || []).forEach(e => {
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
        existing.receita += Number(dp.valor_total);
        existing.quantidade += Number(dp.quantidade);
        if (dt) {
          existing.diasSet.add(dt);
          if (!existing.primeiraData || dt < existing.primeiraData) existing.primeiraData = dt;
          if (!existing.ultimaData || dt > existing.ultimaData) existing.ultimaData = dt;
        }
        prodByItem.set(itemLpuId, existing);
      });

      const receitaTotal = diarioProducaoData.reduce((s: number, dp: any) => s + Number(dp.valor_total), 0);

      // ── COSTS from diário ──
      const custoEquipe = equipeData.reduce((s, e) => s + Number(e.custo_total), 0);
      const custoEquipamentos = equipamentosData.reduce((s, e) => s + Number(e.custo_total), 0);
      const custoVeiculos = veiculosData.reduce((s, v) => s + Number(v.custo_diaria), 0);
      const custoReal = custoEquipe + custoEquipamentos + custoVeiculos;

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

      const margem = receitaTotal - custoReal;
      const margemPercent = receitaTotal > 0 ? (margem / receitaTotal) * 100 : 0;

      const totalMedido = (medicao || []).reduce((s, l) => {
        const preco = (l.item_lpu as any)?.preco_unitario || 0;
        return s + Number(l.quantidade) * Number(preco);
      }, 0);

      const totalFaturado = (faturamento || []).reduce((s, l) => {
        return s + (Number(l.valor_faturado) || Number(l.quantidade) * Number((l.item_lpu as any)?.preco_unitario || 0));
      }, 0);

      const aFaturar = totalMedido - totalFaturado;

      // Escopo total
      const escopoTotal = (escopo || []).reduce((s, e) => s + Number(e.quantidade) * Number(e.valor_unitario), 0);
      const escopoCustoTotal = (escopo || []).reduce((s, e) => s + Number(e.quantidade) * Number(e.custo_unitario), 0);

      const financeiro: AnaliseFinanceira = {
        receitaTotal,
        custoReal,
        custoEsperado,
        margem,
        margemPercent,
        aFaturar,
        custoPrevisto: escopoCustoTotal,
        lucroProjetado: margem + (aFaturar > 0 ? aFaturar : 0),
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

        // Prorate real cost by receita ratio
        const ratio = receitaTotal > 0 ? prod.receita / receitaTotal : 0;
        const custoRealItem = custoReal * ratio;

        const m = prod.receita - custoRealItem;
        servicos.push({
          itemId: itemLpuId,
          codigo,
          descricao,
          receita: prod.receita,
          custoReal: custoRealItem,
          custoEsperado: custoEsp,
          margem: m,
          margemPercent: prod.receita > 0 ? (m / prod.receita) * 100 : 0,
        });
      });
      servicos.sort((a, b) => b.receita - a.receita);

      // ── ALERTS ──
      const alertas: AlertaObra[] = [];
      // Cost overrun vs expected
      if (custoEsperado > 0 && custoReal > custoEsperado * 1.05) {
        const desvio = ((custoReal - custoEsperado) / custoEsperado) * 100;
        alertas.push({ tipo: "critico", mensagem: `Custo real ${desvio.toFixed(0)}% acima do esperado para a produção apontada` });
      }
      // Low margin services
      servicos.filter(s => s.margemPercent < 10 && s.receita > 0).forEach(s => {
        alertas.push({ tipo: "critico", mensagem: `${s.descricao} com margem baixa (${s.margemPercent.toFixed(0)}%)` });
      });
      // Unmeasured production
      const naoMedido = receitaTotal - totalMedido;
      if (naoMedido > 1000) {
        alertas.push({ tipo: "atencao", mensagem: `R$ ${(naoMedido / 1000).toFixed(0)}k produzidos e não medidos` });
      }
      if (aFaturar > 1000) {
        alertas.push({ tipo: "atencao", mensagem: `R$ ${(aFaturar / 1000).toFixed(0)}k medidos e não faturados` });
      }
      // Cost saving
      if (custoEsperado > 0 && custoReal < custoEsperado * 0.95) {
        const economia = ((custoEsperado - custoReal) / custoEsperado) * 100;
        alertas.push({ tipo: "info", mensagem: `Custo real ${economia.toFixed(0)}% abaixo do esperado — boa eficiência` });
      }

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
      const allDates = Array.from(new Set(diarios?.map(d => d.data) || [])).sort();
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

        if (prod && prod.primeiraData && prod.ultimaData && diasComProducao > 0) {
          const first = new Date(prod.primeiraData + "T12:00:00");
          const last = new Date(prod.ultimaData + "T12:00:00");
          const spanDays = Math.max(1, Math.ceil((last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24)) + 1);

          mediaDiaria = executado / spanDays;
          mediaSemanal = mediaDiaria * 7;
          mediaMensal = mediaDiaria * 30;
        }

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
        });
      });

      // Also add items produced that aren't in escopo
      prodByItem.forEach((prod, itemLpuId) => {
        if (escopoMap.has(itemLpuId)) return;
        const dpSample = diarioProducaoData.find((d: any) => d.item_lpu_id === itemLpuId);
        const item = dpSample?.item_lpu as any;

        let mediaDiaria = 0;
        if (prod.primeiraData && prod.ultimaData) {
          const first = new Date(prod.primeiraData + "T12:00:00");
          const last = new Date(prod.ultimaData + "T12:00:00");
          const spanDays = Math.max(1, Math.ceil((last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24)) + 1);
          mediaDiaria = prod.quantidade / spanDays;
        }

        producaoItems.push({
          itemLpuId,
          codigo: item?.codigo || "?",
          descricao: item?.descricao || "Item sem escopo",
          unidade: item?.unidade || "UN",
          planejado: 0,
          executado: prod.quantidade,
          saldo: -prod.quantidade,
          mediaDiaria,
          mediaSemanal: mediaDiaria * 7,
          mediaMensal: mediaDiaria * 30,
          diasComProducao: prod.diasSet.size,
          primeiraData: prod.primeiraData,
          ultimaData: prod.ultimaData,
        });
      });

      producaoItems.sort((a, b) => a.codigo.localeCompare(b.codigo));

      return {
        financeiro,
        progresso,
        servicos,
        alertas: alertas.slice(0, 5),
        custosCategorias,
        evolucao,
        producaoItems,
        escopoTotal,
        custoReal,
        custoEsperado,
        custoEquipe,
        custoEquipamentos,
        custoVeiculos,
        totalMedido,
        totalFaturado,
        fotos: fotosData,
      };
    },
    enabled: !!siteId,
  });

  return { data, isLoading };
}
