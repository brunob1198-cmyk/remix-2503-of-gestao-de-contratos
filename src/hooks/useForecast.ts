import { useMemo } from "react";
import { useProjetos } from "@/hooks/useProjetos";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useForecast() {
  const { projetos, isLoading: loadingProjetos, updateProjeto } = useProjetos();

  const { data: producaoData = [], isLoading: loadingProducao } = useQuery({
    queryKey: ["producao_forecast_unificada"],
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    queryFn: async () => {
      let allData: any[] = [];
      let hasMore = true;
      let offset = 0;
      const limit = 1000;

      while (hasMore) {
        const { data, error } = await supabase
          .from("view_bi_producao")
          .select("projeto_id, projeto_codigo, data_producao, valor_total")
          .range(offset, offset + limit - 1);

        if (error) throw error;
        if (!data || data.length === 0) {
          hasMore = false;
          break;
        }
        allData = [...allData, ...data];
        offset += limit;
        if (data.length < limit) hasMore = false;
      }
      return allData;
    },
  });

  const producaoTotal = useMemo(() => {
    const map: Record<string, number> = {};
    producaoData.forEach(row => {
      map[row.projeto_id] = (map[row.projeto_id] || 0) + Number(row.valor_total || 0);
    });
    return map;
  }, [producaoData]);

  const producaoMensal = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    producaoData.forEach(row => {
      const month = row.data_producao?.substring(0, 7);
      if (!month) return;
      if (!map[row.projeto_id]) map[row.projeto_id] = {};
      map[row.projeto_id][month] = (map[row.projeto_id][month] || 0) + Number(row.valor_total || 0);
    });
    return map;
  }, [producaoData]);

  const forecastData = useMemo(() => {
    return projetos.map((p) => {
      const totalProduzido = producaoTotal[p.id] || 0;
      const valorContrato = Number(p.valor_total) || 0;
      const saldo = Math.max(0, valorContrato - totalProduzido);

      return {
        ...p,
        totalProduzido,
        saldo,
        mensal: producaoMensal[p.id] || {},
        forecast: (p as any).forecast_data || {},
      };
    });
  }, [projetos, producaoTotal, producaoMensal]);

  const updateForecast = async (projetoId: string, month: string, value: number) => {
    const projeto = projetos.find(p => p.id === projetoId);
    if (!projeto) return;

    const currentForecast = (projeto as any).forecast_data || {};
    const newForecast = { ...currentForecast };
    
    if (value === 0) {
      delete newForecast[month];
    } else {
      newForecast[month] = value;
    }

    try {
      await updateProjeto.mutateAsync({
        id: projetoId,
        forecast_data: newForecast,
      } as any);
      return true;
    } catch (error) {
      console.error("Error updating forecast:", error);
      throw error;
    }
  };

  return {
    data: forecastData,
    isLoading: loadingProjetos || loadingProducao,
    updateForecast,
  };
}
