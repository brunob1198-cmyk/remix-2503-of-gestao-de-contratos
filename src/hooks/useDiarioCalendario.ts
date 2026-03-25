import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DiarioCalendarioEntry } from "@/components/medicoes/DiarioCalendario";

export function useDiarioCalendario(siteId: string | undefined, dataInicio: string, dataFim: string) {
  return useQuery({
    queryKey: ["diario_calendario", siteId, dataInicio, dataFim],
    queryFn: async (): Promise<DiarioCalendarioEntry[]> => {
      if (!siteId) return [];

      const { data: diarios, error } = await supabase
        .from("diarios_obra")
        .select("id, data, clima, observacoes")
        .eq("site_id", siteId)
        .gte("data", dataInicio)
        .lte("data", dataFim)
        .order("data", { ascending: true });

      if (error) throw error;
      if (!diarios || diarios.length === 0) return [];

      const ids = diarios.map(d => d.id);

      // Fetch production counts + totals
      const { data: producoes } = await supabase
        .from("diario_producao")
        .select("diario_id, valor_total, quantidade")
        .in("diario_id", ids);

      // Fetch equipe counts
      const { data: equipe } = await supabase
        .from("diario_equipe")
        .select("diario_id")
        .in("diario_id", ids);

      const prodByDiario = new Map<string, { total: number; count: number }>();
      (producoes || []).forEach(p => {
        const existing = prodByDiario.get(p.diario_id) || { total: 0, count: 0 };
        existing.total += Number(p.valor_total);
        existing.count += 1;
        prodByDiario.set(p.diario_id, existing);
      });

      const equipeByDiario = new Map<string, number>();
      (equipe || []).forEach(e => {
        equipeByDiario.set(e.diario_id, (equipeByDiario.get(e.diario_id) || 0) + 1);
      });

      return diarios.map(d => ({
        id: d.id,
        data: d.data,
        clima: (d as any).clima || null,
        observacoes: d.observacoes,
        totalProducao: prodByDiario.get(d.id)?.total || 0,
        totalItens: prodByDiario.get(d.id)?.count || 0,
        totalEquipe: equipeByDiario.get(d.id) || 0,
      }));
    },
    enabled: !!siteId,
  });
}
