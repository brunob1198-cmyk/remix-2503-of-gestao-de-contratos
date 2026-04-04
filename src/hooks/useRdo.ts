import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RdoFoto {
  id: string;
  url: string;
  classificacao: string;
  legenda: string | null;
  diario_producao_id: string | null;
  item_evidencia?: { codigo: string; descricao: string } | null;
}

export interface RdoDiarioResumo {
  id: string;
  data: string;
  observacoes: string | null;
  site_id: string;
  site_codigo?: string;
  site_nome?: string;
  municipio: string | null;
  uf: string | null;
  totalProducao: number;
  totalItens: number;
  totalFotos: number;
  producoes: Array<{
    id: string;
    quantidade: number;
    preco_unitario_congelado: number;
    valor_total: number;
    item_lpu_id: string;
    item_lpu: { codigo: string; descricao: string; unidade: string } | null;
  }>;
  equipe: Array<{ id: string; nome: string; funcao: string | null; horas: number; custo_hora: number; custo_total: number }>;
  equipamentos: Array<{ id: string; descricao: string; horas: number; custo_hora: number; custo_total: number }>;
  veiculos: Array<{ id: string; descricao: string; placa: string | null; km_inicial: number; km_final: number; km_rodados: number; custo_diaria: number }>;
  fotos: RdoFoto[];
  custoTotal: number;
}

export function useRdo(siteIds?: string[], dataInicio?: string, dataFim?: string, itemLpuId?: string, busca?: string, sitesMap?: Map<string, { codigo: string; nome: string }>) {
  return useQuery({
    queryKey: ["rdo", siteIds, dataInicio, dataFim, itemLpuId, busca],
    queryFn: async (): Promise<RdoDiarioResumo[]> => {
      if (!siteIds || siteIds.length === 0) return [];

      let q = supabase
        .from("diarios_obra")
        .select("*")
        .in("site_id", siteIds)
        .order("data", { ascending: false });

      if (dataInicio) q = q.gte("data", dataInicio);
      if (dataFim) q = q.lte("data", dataFim);

      const { data: diarios, error } = await q;
      if (error) throw error;
      if (!diarios || diarios.length === 0) return [];

      const diarioIds = diarios.map(d => d.id);

      const [prodRes, equipeRes, equipRes, veicRes, fotosRes] = await Promise.all([
        supabase.from("diario_producao").select("*, item_lpu:itens_lpu(codigo, descricao, unidade)").in("diario_id", diarioIds),
        supabase.from("diario_equipe").select("*").in("diario_id", diarioIds),
        supabase.from("diario_equipamentos").select("*").in("diario_id", diarioIds),
        supabase.from("diario_veiculos").select("*").in("diario_id", diarioIds),
        supabase.from("diario_fotos").select("*").in("diario_id", diarioIds),
      ]);

      const allProd = prodRes.data || [];
      const allEquipe = equipeRes.data || [];
      const allEquip = equipRes.data || [];
      const allVeic = veicRes.data || [];
      const allFotos = fotosRes.data || [];

      const producaoItemMap = new Map<string, { codigo: string; descricao: string }>();
      allProd.forEach((p: any) => {
        if (p.item_lpu) {
          producaoItemMap.set(p.id, { codigo: p.item_lpu.codigo, descricao: p.item_lpu.descricao });
        }
      });

      let result: RdoDiarioResumo[] = diarios.map(d => {
        const prods = allProd.filter((p: any) => p.diario_id === d.id);
        const eqs = allEquipe.filter((e: any) => e.diario_id === d.id);
        const equips = allEquip.filter((e: any) => e.diario_id === d.id);
        const veics = allVeic.filter((v: any) => v.diario_id === d.id);
        const fotos = allFotos.filter((f: any) => f.diario_id === d.id).map((f: any) => ({
          ...f,
          item_evidencia: f.diario_producao_id ? producaoItemMap.get(f.diario_producao_id) || null : null,
        }));

        const totalProducao = prods.reduce((s: number, p: any) => s + Number(p.valor_total), 0);
        const custoEquipe = eqs.reduce((s: number, e: any) => s + Number(e.custo_total), 0);
        const custoEquipamentos = equips.reduce((s: number, e: any) => s + Number(e.custo_total), 0);
        const custoVeiculos = veics.reduce((s: number, v: any) => s + Number(v.custo_diaria), 0);

        const siteInfo = sitesMap?.get(d.site_id);

        return {
          id: d.id,
          data: d.data,
          observacoes: d.observacoes,
          site_id: d.site_id,
          site_codigo: siteInfo?.codigo || "",
          site_nome: siteInfo?.nome || "",
          municipio: d.municipio || null,
          uf: d.uf || null,
          totalProducao,
          totalItens: prods.length,
          totalFotos: fotos.length,
          producoes: prods as any,
          equipe: eqs as any,
          equipamentos: equips as any,
          veiculos: veics as any,
          fotos,
          custoTotal: custoEquipe + custoEquipamentos + custoVeiculos,
        };
      }).filter(d =>
        d.totalItens > 0 || d.totalFotos > 0 || d.equipe.length > 0 ||
        d.equipamentos.length > 0 || d.veiculos.length > 0 ||
        (d.observacoes && d.observacoes.trim().length > 0)
      );

      if (itemLpuId) {
        result = result.filter(d => d.producoes.some(p => p.item_lpu?.codigo === itemLpuId || (p as any).item_lpu_id === itemLpuId));
      }

      if (busca && busca.trim()) {
        const term = busca.toLowerCase();
        result = result.filter(d =>
          d.observacoes?.toLowerCase().includes(term) ||
          d.producoes.some(p => p.item_lpu?.descricao?.toLowerCase().includes(term) || p.item_lpu?.codigo?.toLowerCase().includes(term)) ||
          d.equipe.some(e => e.nome.toLowerCase().includes(term)) ||
          d.fotos.some(f => f.legenda?.toLowerCase().includes(term))
        );
      }

      return result;
    },
    enabled: !!siteIds && siteIds.length > 0,
  });
}
