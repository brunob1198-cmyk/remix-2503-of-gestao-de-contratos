import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface SgsstAlertaItem {
  id: string;
  modulo: "PGR" | "APR" | "PT" | "INSPECAO" | "INCIDENTE" | "NC" | "PCMSO" | "ASO" | "TREINAMENTO" | "EPI";
  titulo: string;
  subtitulo: string;
  urgencia: "CRITICA" | "ALTA" | "MEDIA";
  dataRef?: string | null;
  linkUrl: string;
}

export interface SgsstDashboardMetrics {
  // Segurança
  pgrAtivos: number;
  aprEmAndamento: number;
  ptEmExecucao: number;
  inspecoesPendentes: number;
  inspecoesConcluidas: number;
  incidentesAbertos: number;
  incidentesEmInvestigacao: number;
  naoConformidadesAbertas: number;
  naoConformidadesVencidas: number;
  naoConformidadesCriticas: number;

  // Saúde Ocupacional
  asosValidos: number;
  asosProximosVencimento: number;
  asosVencidos: number;
  examesPendentes: number;

  // Treinamentos
  treinamentosValidos: number;
  treinamentosProximosVencimento: number;
  treinamentosVencidos: number;
  participantesPendentes: number;

  // EPI
  episAtivos: number;
  entregasRecentes: number;
  estoqueAbaixoMinimo: number;
  casProximosVencimento: number;
  casVencidos: number;

  // Alertas Prioritários
  alertasRequerAtenção: SgsstAlertaItem[];
}

export function useSgsstDashboard(projetoId?: string, dataInicial?: string, dataFinal?: string) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const { data: metrics, isLoading, refetch } = useQuery({
    queryKey: ["sgsst_dashboard_metrics", empresaId, projetoId, dataInicial, dataFinal],
    enabled: !!empresaId,
    queryFn: async (): Promise<SgsstDashboardMetrics> => {
      const [metricsRes, alertasRes] = await Promise.all([
        supabase.rpc("sgsst_dashboard_metrics" as any, {
          p_empresa_id: empresaId!,
          p_projeto_id: projetoId || null,
          p_data_inicial: dataInicial || null,
          p_data_final: dataFinal || null,
        }),
        supabase.rpc("sgsst_dashboard_alertas" as any, {
          p_empresa_id: empresaId!,
          p_projeto_id: projetoId || null,
          p_data_inicial: dataInicial || null,
          p_data_final: dataFinal || null,
        }),
      ]);

      if (metricsRes.error) throw metricsRes.error;
      if (alertasRes.error) throw alertasRes.error;

      const rawMetrics = (metricsRes.data || {}) as Record<string, number>;
      const alertas = (alertasRes.data || []) as SgsstAlertaItem[];

      return {
        pgrAtivos: Number(rawMetrics.pgrAtivos || 0),
        aprEmAndamento: Number(rawMetrics.aprEmAndamento || 0),
        ptEmExecucao: Number(rawMetrics.ptEmExecucao || 0),
        inspecoesPendentes: Number(rawMetrics.inspecoesPendentes || 0),
        inspecoesConcluidas: Number(rawMetrics.inspecoesConcluidas || 0),
        incidentesAbertos: Number(rawMetrics.incidentesAbertos || 0),
        incidentesEmInvestigacao: Number(rawMetrics.incidentesEmInvestigacao || 0),
        naoConformidadesAbertas: Number(rawMetrics.naoConformidadesAbertas || 0),
        naoConformidadesVencidas: Number(rawMetrics.naoConformidadesVencidas || 0),
        naoConformidadesCriticas: Number(rawMetrics.naoConformidadesCriticas || 0),

        asosValidos: Number(rawMetrics.asosValidos || 0),
        asosProximosVencimento: Number(rawMetrics.asosProximosVencimento || 0),
        asosVencidos: Number(rawMetrics.asosVencidos || 0),
        examesPendentes: Number(rawMetrics.examesPendentes || 0),

        treinamentosValidos: Number(rawMetrics.treinamentosValidos || 0),
        treinamentosProximosVencimento: Number(rawMetrics.treinamentosProximosVencimento || 0),
        treinamentosVencidos: Number(rawMetrics.treinamentosVencidos || 0),
        participantesPendentes: Number(rawMetrics.participantesPendentes || 0),

        episAtivos: Number(rawMetrics.episAtivos || 0),
        entregasRecentes: Number(rawMetrics.entregasRecentes || 0),
        estoqueAbaixoMinimo: Number(rawMetrics.estoqueAbaixoMinimo || 0),
        casProximosVencimento: Number(rawMetrics.casProximosVencimento || 0),
        casVencidos: Number(rawMetrics.casVencidos || 0),

        alertasRequerAtenção: alertas,
      };
    },
  });

  return {
    metrics,
    isLoading,
    refetch,
  };
}
