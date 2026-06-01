import { useMemo } from "react";
import { useProjetos } from "@/hooks/useProjetos";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useForecast() {
  const { projetos, isLoading: loadingProjetos, updateProjeto } = useProjetos();

  const { data: producaoTotal = {}, isLoading: loadingProducao } = useQuery({
    queryKey: ["producao_total_projetos"],
    queryFn: async () => {
      // Usar a view de produção para pegar o total produzido por projeto
      let allData: any[] = [];
      let hasMore = true;
      let offset = 0;
      const limit = 1000;

      while (hasMore) {
        const { data, error } = await supabase
          .from("view_bi_producao")
          .select("projeto_id, valor_total")
          .range(offset, offset + limit - 1);
        
        if (error) throw error;
        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allData = [...allData, ...data];
          offset += limit;
          if (data.length < limit) hasMore = false;
        }
      }

      const map: Record<string, number> = {};
      allData.forEach((row: any) => {
        map[row.projeto_id] = (map[row.projeto_id] || 0) + (Number(row.valor_total) || 0);
      });
      return map;
    },
    staleTime: 1000 * 60 * 10, // 10 min
    gcTime: 1000 * 60 * 20, // 20 min
  });

  const { data: producaoMensal = {}, isLoading: loadingMensal } = useQuery({
    queryKey: ["producao_mensal_projetos"],
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
        } else {
          allData = [...allData, ...data];
          offset += limit;
          if (data.length < limit) hasMore = false;
        }
      }

      const map: Record<string, Record<string, number>> = {};
      allData.forEach((row: any) => {
        const month = row.data_producao.substring(0, 7); // YYYY-MM
        const projId = row.projeto_id;
        
        if (!map[projId]) map[projId] = {};
        map[projId][month] = (map[projId][month] || 0) + (Number(row.valor_total) || 0);
      });
      return map;
    },
    staleTime: 1000 * 60 * 10, // 10 min
    gcTime: 1000 * 60 * 20, // 20 min
  });

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

    await updateProjeto.mutateAsync({
      id: projetoId,
      forecast_data: newForecast,
    } as any);
  };

  return {
    data: forecastData,
    isLoading: loadingProjetos || loadingProducao || loadingMensal,
    updateForecast,
  };
}
