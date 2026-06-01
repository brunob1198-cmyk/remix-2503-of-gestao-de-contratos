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
      const { data, error } = await supabase
        .from("view_bi_producao")
        .select("projeto_id, valor_total");
      
      if (error) throw error;

      const map: Record<string, number> = {};
      data?.forEach((row: any) => {
        map[row.projeto_id] = (map[row.projeto_id] || 0) + (Number(row.valor_total) || 0);
      });
      return map;
    },
    staleTime: 1000 * 60 * 5, // 5 min
  });

  const { data: producaoMensal = {}, isLoading: loadingMensal } = useQuery({
    queryKey: ["producao_mensal_projetos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("view_bi_producao")
        .select("projeto_id, projeto_codigo, data_producao, valor_total");
      
      if (error) throw error;

      const map: Record<string, Record<string, number>> = {};
      data?.forEach((row: any) => {
        const month = row.data_producao.substring(0, 7); // YYYY-MM
        const projId = row.projeto_id;
        
        if (!map[projId]) map[projId] = {};
        map[projId][month] = (map[projId][month] || 0) + (Number(row.valor_total) || 0);
      });
      return map;
    },
    staleTime: 1000 * 60 * 5,
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
