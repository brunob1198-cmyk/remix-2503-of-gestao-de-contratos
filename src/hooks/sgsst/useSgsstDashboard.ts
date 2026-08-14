import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { calculateVencimentoAso } from "@/utils/sgsstAsoUtils";
import { calculateVencimentoTreinamento } from "@/utils/sgsstTreinamentosUtils";
import { calculateValidadeCa } from "@/utils/sgsstEpiUtils";

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
      // Execute parallel calls to gather aggregated counters
      const [
        pgrRes,
        aprRes,
        ptRes,
        inspRes,
        incRes,
        ncRes,
        examesRes,
        asosRes,
        trPartRes,
        episRes,
        epiEntregasRes,
      ] = await Promise.all([
        // 1. PGRs
        supabase.from("sgsst_pgr" as any).select("id, status, titulo, projeto_id").eq("empresa_id", empresaId!),
        // 2. APRs
        supabase.from("sgsst_apr" as any).select("id, status, codigo, titulo").eq("empresa_id", empresaId!),
        // 3. PTs
        supabase.from("sgsst_pt" as any).select("id, status, codigo, atividade").eq("empresa_id", empresaId!),
        // 4. Inspeções
        supabase.from("sgsst_inspecoes" as any).select("id, status, codigo, titulo").eq("empresa_id", empresaId!),
        // 5. Incidentes
        supabase.from("sgsst_incidentes" as any).select("id, status, codigo, titulo, tipo").eq("empresa_id", empresaId!),
        // 6. Não Conformidades
        supabase.from("sgsst_nao_conformidades" as any).select("id, status, gravidade, data_limite, codigo, titulo").eq("empresa_id", empresaId!),
        // 7. Exames
        supabase.from("sgsst_exames" as any).select("id, status, tipo").eq("empresa_id", empresaId!),
        // 8. ASOs
        supabase.from("sgsst_asos" as any).select("id, validade, status, colaborador:sgsst_colaborador_dados(cpf, profile:profiles(nome), recurso:recursos(nome))").eq("empresa_id", empresaId!),
        // 9. Treinamentos Participantes
        supabase.from("sgsst_treinamentos_participantes" as any).select("id, validade, resultado, colaborador:sgsst_colaborador_dados(cpf, profile:profiles(nome), recurso:recursos(nome)), turma:sgsst_treinamentos_turmas(treinamento:sgsst_treinamentos(nome))").eq("empresa_id", empresaId!),
        // 10. EPIs
        supabase.from("sgsst_epis" as any).select("id, nome, ca, validade_ca, estoque_atual, estoque_minimo, status").eq("empresa_id", empresaId!),
        // 11. Entregas EPI
        supabase.from("sgsst_epi_entregas" as any).select("id, data_entrega").eq("empresa_id", empresaId!),
      ]);

      const pgrs = (pgrRes.data || []) as any[];
      const aprs = (aprRes.data || []) as any[];
      const pts = (ptRes.data || []) as any[];
      const inspecoes = (inspRes.data || []) as any[];
      const incidentes = (incRes.data || []) as any[];
      const ncs = (ncRes.data || []) as any[];
      const exames = (examesRes.data || []) as any[];
      const asos = (asosRes.data || []) as any[];
      const trParts = (trPartRes.data || []) as any[];
      const epis = (episRes.data || []) as any[];
      const entregasEpi = (epiEntregasRes.data || []) as any[];

      // Calculate Metrics
      const pgrAtivos = pgrs.filter((p) => p.status === "ATIVO").length;
      const aprEmAndamento = aprs.filter((a) => a.status === "EM_ANDAMENTO" || a.status === "EM_ANALISE").length;
      const ptEmExecucao = pts.filter((p) => p.status === "EM_EXECUCAO").length;
      const inspecoesPendentes = inspecoes.filter((i) => i.status === "PLANEJADA" || i.status === "EM_ANDAMENTO").length;
      const inspecoesConcluidas = inspecoes.filter((i) => i.status === "CONCLUIDA").length;
      const incidentesAbertos = incidentes.filter((i) => i.status === "REGISTRADO" || i.status === "EM_INVESTIGACAO").length;
      const incidentesEmInvestigacao = incidentes.filter((i) => i.status === "EM_INVESTIGACAO").length;

      const today = new Date().toISOString().split("T")[0];
      const naoConformidadesAbertas = ncs.filter((n) => n.status !== "CONCLUIDA" && n.status !== "CANCELADA").length;
      const naoConformidadesVencidas = ncs.filter((n) => n.status !== "CONCLUIDA" && n.status !== "CANCELADA" && n.data_limite && n.data_limite < today).length;
      const naoConformidadesCriticas = ncs.filter((n) => (n.status !== "CONCLUIDA" && n.status !== "CANCELADA") && (n.gravidade === "ALTA" || n.gravidade === "GRAVE" || n.gravidade === "CRITICA")).length;

      // ASO Metrics
      let asosValidos = 0;
      let asosProximosVencimento = 0;
      let asosVencidos = 0;

      asos.forEach((a) => {
        if (a.status === "ATIVO") {
          const st = calculateVencimentoAso(a.validade);
          if (st === "VALIDO") asosValidos++;
          else if (st === "PROXIMO_VENCIMENTO") asosProximosVencimento++;
          else if (st === "VENCIDO") asosVencidos++;
        }
      });

      const examesPendentes = exames.filter((e) => e.status === "PENDENTE" || e.status === "SOLICITADO").length;

      // Treinamento Metrics
      let treinamentosValidos = 0;
      let treinamentosProximosVencimento = 0;
      let treinamentosVencidos = 0;
      let participantesPendentes = 0;

      trParts.forEach((tp) => {
        if (tp.resultado === "PENDENTE") {
          participantesPendentes++;
        } else if (tp.resultado === "APROVADO") {
          const st = calculateVencimentoTreinamento(tp.validade);
          if (st === "VALIDO") treinamentosValidos++;
          else if (st === "PROXIMO_VENCIMENTO") treinamentosProximosVencimento++;
          else if (st === "VENCIDO") treinamentosVencidos++;
        }
      });

      // EPI Metrics
      const episAtivos = epis.filter((e) => e.status === "ATIVO").length;
      const estoqueAbaixoMinimo = epis.filter((e) => e.status === "ATIVO" && e.estoque_atual <= e.estoque_minimo).length;

      let casProximosVencimento = 0;
      let casVencidos = 0;

      epis.forEach((e) => {
        if (e.status === "ATIVO") {
          const st = calculateValidadeCa(e.validade_ca);
          if (st === "PROXIMO_VENCIMENTO") casProximosVencimento++;
          else if (st === "VENCIDO") casVencidos++;
        }
      });

      // Entregas recentes nos últimos 30 dias
      const date30dAgo = new Date();
      date30dAgo.setDate(date30dAgo.getDate() - 30);
      const str30d = date30dAgo.toISOString().split("T")[0];
      const entregasRecentes = entregasEpi.filter((e) => e.data_entrega >= str30d).length;

      // Generate "Requer Atenção" Critical Alerts Array
      const alertas: SgsstAlertaItem[] = [];

      // 1. ASOs Vencidos
      asos.forEach((a) => {
        if (a.status === "ATIVO" && calculateVencimentoAso(a.validade) === "VENCIDO") {
          const nome = a.colaborador?.profile?.nome || a.colaborador?.recurso?.nome || "Trabalhador";
          alertas.push({
            id: `aso-venc-${a.id}`,
            modulo: "ASO",
            titulo: `ASO Vencido: ${nome}`,
            subtitulo: `Validade expirada em ${a.validade || "data n/i"}`,
            urgencia: "CRITICA",
            dataRef: a.validade,
            linkUrl: "/medicoes/sgsst/pcmso",
          });
        }
      });

      // 2. EPIs com CA Vencido
      epis.forEach((e) => {
        if (e.status === "ATIVO" && calculateValidadeCa(e.validade_ca) === "VENCIDO") {
          alertas.push({
            id: `epi-ca-venc-${e.id}`,
            modulo: "EPI",
            titulo: `CA Vencido: ${e.nome}`,
            subtitulo: `Certificado CA ${e.ca} vencido em ${e.validade_ca}`,
            urgencia: "CRITICA",
            dataRef: e.validade_ca,
            linkUrl: "/medicoes/sgsst/epis",
          });
        }
      });

      // 3. Não Conformidades Vencidas / Críticas
      ncs.forEach((n) => {
        if (n.status !== "CONCLUIDA" && n.status !== "CANCELADA") {
          if (n.data_limite && n.data_limite < today) {
            alertas.push({
              id: `nc-venc-${n.id}`,
              modulo: "NC",
              titulo: `Não Conformidade Atrasada [${n.codigo || "NC"}]`,
              subtitulo: `${n.titulo} — Prazo excedido em ${n.data_limite}`,
              urgencia: "CRITICA",
              dataRef: n.data_limite,
              linkUrl: `/medicoes/sgsst/nao-conformidades/${n.id}`,
            });
          }
        }
      });

      // 4. PTs em Execução Ativa
      pts.forEach((p) => {
        if (p.status === "EM_EXECUCAO") {
          alertas.push({
            id: `pt-exec-${p.id}`,
            modulo: "PT",
            titulo: `Permissão de Trabalho em Execução [${p.codigo || "PT"}]`,
            subtitulo: `${p.atividade}`,
            urgencia: "ALTA",
            linkUrl: `/medicoes/sgsst/pt/${p.id}`,
          });
        }
      });

      // 5. Incidentes em Investigação
      incidentes.forEach((inc) => {
        if (inc.status === "EM_INVESTIGACAO" || inc.status === "REGISTRADO") {
          alertas.push({
            id: `inc-inv-${inc.id}`,
            modulo: "INCIDENTE",
            titulo: `Ocorrência em Investigação [${inc.codigo || "INC"}]`,
            subtitulo: `${inc.titulo} (${inc.tipo})`,
            urgencia: "ALTA",
            linkUrl: `/medicoes/sgsst/incidentes/${inc.id}`,
          });
        }
      });

      // 6. Treinamentos Vencidos
      trParts.forEach((tp) => {
        if (tp.resultado === "APROVADO" && calculateVencimentoTreinamento(tp.validade) === "VENCIDO") {
          const nome = tp.colaborador?.profile?.nome || tp.colaborador?.recurso?.nome || "Trabalhador";
          const trNome = tp.turma?.treinamento?.nome || "Treinamento";
          alertas.push({
            id: `tr-venc-${tp.id}`,
            modulo: "TREINAMENTO",
            titulo: `Reciclagem Vencida: ${trNome}`,
            subtitulo: `Colaborador: ${nome} | Expired: ${tp.validade}`,
            urgencia: "MEDIA",
            dataRef: tp.validade,
            linkUrl: "/medicoes/sgsst/treinamentos",
          });
        }
      });

      // 7. Estoque EPI Abaixo do Mínimo
      epis.forEach((e) => {
        if (e.status === "ATIVO" && e.estoque_atual <= e.estoque_minimo) {
          alertas.push({
            id: `epi-est-${e.id}`,
            modulo: "EPI",
            titulo: `Estoque Crítico de EPI: ${e.nome}`,
            subtitulo: `Saldo: ${e.estoque_atual} ${e.unidade_medida} (Mín: ${e.estoque_minimo})`,
            urgencia: "MEDIA",
            linkUrl: "/medicoes/sgsst/epis",
          });
        }
      });

      return {
        pgrAtivos,
        aprEmAndamento,
        ptEmExecucao,
        inspecoesPendentes,
        inspecoesConcluidas,
        incidentesAbertos,
        incidentesEmInvestigacao,
        naoConformidadesAbertas,
        naoConformidadesVencidas,
        naoConformidadesCriticas,

        asosValidos,
        asosProximosVencimento,
        asosVencidos,
        examesPendentes,

        treinamentosValidos,
        treinamentosProximosVencimento,
        treinamentosVencidos,
        participantesPendentes,

        episAtivos,
        entregasRecentes,
        estoqueAbaixoMinimo,
        casProximosVencimento,
        casVencidos,

        alertasRequerAtenção: alertas.slice(0, 15), // Top 15 critical alerts
      };
    },
  });

  return {
    metrics,
    isLoading,
    refetch,
  };
}
