import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { QUERY_DEFAULTS } from "@/lib/queryClient";
import {
  ChecklistQRCode,
  ChecklistAgendamento,
  ChecklistAgendamentoExecucao,
  ChecklistNotificacao,
  QRVinculadoTipo,
  PeriodicidadeAgendamento,
  StatusAgendamento,
} from "@/types/checklistsEvolution";
import { toast } from "sonner";

export function useChecklistQRCodes(modeloId?: string) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const queryClient = useQueryClient();

  const { data: qrcodes = [], isLoading } = useQuery({
    queryKey: ["checklist_qrcodes", empresaId, modeloId],
    enabled: !!empresaId,
    ...QUERY_DEFAULTS,
    queryFn: async () => {
      let query = supabase
        .from("checklist_qrcodes" as any)
        .select("*, modelo:checklist_modelos(nome, categoria, codigo)")
        .eq("empresa_id", empresaId!)
        .order("created_at", { ascending: false });

      if (modeloId) {
        query = query.eq("checklist_modelo_id", modeloId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as ChecklistQRCode[]) || [];
    },
  });

  const createQRCode = useMutation({
    mutationFn: async (input: {
      checklist_modelo_id: string;
      vinculado_tipo: QRVinculadoTipo;
      vinculado_id?: string;
      vinculado_nome?: string;
    }) => {
      const token = `qr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const { data, error } = await supabase
        .from("checklist_qrcodes" as any)
        .insert({
          empresa_id: empresaId!,
          token,
          checklist_modelo_id: input.checklist_modelo_id,
          vinculado_tipo: input.vinculado_tipo,
          vinculado_id: input.vinculado_id || null,
          vinculado_nome: input.vinculado_nome || null,
          ativo: true,
        })
        .select("*")
        .single();

      if (error) throw error;
      return data as unknown as ChecklistQRCode;
    },
    onSuccess: () => {
      toast.success("QR Code gerado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["checklist_qrcodes"] });
    },
    onError: (err: any) => {
      toast.error(`Erro ao gerar QR Code: ${err.message || err}`);
    },
  });

  const toggleQRCodeAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("checklist_qrcodes" as any)
        .update({ ativo, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success(variables.ativo ? "QR Code ativado." : "QR Code desativado com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["checklist_qrcodes"] });
    },
  });

  return { qrcodes, isLoading, createQRCode, toggleQRCodeAtivo };
}

export function useChecklistAgendamentos() {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const queryClient = useQueryClient();

  const { data: agendamentos = [], isLoading: loadingAgendamentos } = useQuery({
    queryKey: ["checklist_agendamentos", empresaId],
    enabled: !!empresaId,
    ...QUERY_DEFAULTS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_agendamentos" as any)
        .select(`
          *,
          modelo:checklist_modelos(nome, categoria),
          responsavel:profiles(nome, email),
          projeto:projetos(nome, codigo)
        `)
        .eq("empresa_id", empresaId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as unknown as ChecklistAgendamento[]) || [];
    },
  });

  const { data: execucoes = [], isLoading: loadingExecucoes } = useQuery({
    queryKey: ["checklist_agendamento_execucoes", empresaId],
    enabled: !!empresaId,
    ...QUERY_DEFAULTS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_agendamento_execucoes" as any)
        .select(`
          *,
          agendamento:checklist_agendamentos(checklist_modelo_id, periodicidade),
          responsavel:profiles(nome)
        `)
        .eq("empresa_id", empresaId!)
        .order("data_prevista", { ascending: true });

      if (error) throw error;
      return (data as unknown as ChecklistAgendamentoExecucao[]) || [];
    },
  });

  const createAgendamento = useMutation({
    mutationFn: async (input: {
      checklist_modelo_id: string;
      responsavel_id?: string;
      projeto_id?: string;
      area_id?: string;
      data_inicial: string;
      data_final?: string;
      horario?: string;
      periodicidade: PeriodicidadeAgendamento;
      prazo_dias?: number;
      exigir_geolocalizacao?: boolean;
      observacoes?: string;
    }) => {
      const { data: agendamento, error } = await supabase
        .from("checklist_agendamentos" as any)
        .insert({
          empresa_id: empresaId!,
          checklist_modelo_id: input.checklist_modelo_id,
          responsavel_id: input.responsavel_id || null,
          projeto_id: input.projeto_id || null,
          area_id: input.area_id || null,
          data_inicial: input.data_inicial,
          data_final: input.data_final || null,
          horario: input.horario || "08:00",
          periodicidade: input.periodicidade,
          prazo_dias: input.prazo_dias || 1,
          status: "ATIVO" as StatusAgendamento,
          exigir_geolocalizacao: !!input.exigir_geolocalizacao,
          observacoes: input.observacoes || null,
        })
        .select("*")
        .single();

      if (error) throw error;

      // Gerar primeira execução inicial da agenda
      const dataPrevista = input.data_inicial;
      const prazoDate = new Date(dataPrevista);
      prazoDate.setDate(prazoDate.getDate() + (input.prazo_dias || 1));

      await supabase.from("checklist_agendamento_execucoes" as any).insert({
        empresa_id: empresaId!,
        (agendamento as any).id: agendamento.id,
        competencia: dataPrevista.substring(0, 7),
        data_prevista: dataPrevista,
        prazo: prazoDate.toISOString().split("T")[0],
        responsavel_id: input.responsavel_id || null,
        status: "PENDENTE",
      });

      return agendamento as unknown as ChecklistAgendamento;
    },
    onSuccess: () => {
      toast.success("Agendamento criado e primeira execução gerada!");
      queryClient.invalidateQueries({ queryKey: ["checklist_agendamentos"] });
      queryClient.invalidateQueries({ queryKey: ["checklist_agendamento_execucoes"] });
    },
    onError: (err: any) => {
      toast.error(`Erro ao criar agendamento: ${err.message || err}`);
    },
  });

  const updateAgendamentoStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusAgendamento }) => {
      const { error } = await supabase
        .from("checklist_agendamentos" as any)
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success(`Status do agendamento alterado para ${variables.status}`);
      queryClient.invalidateQueries({ queryKey: ["checklist_agendamentos"] });
    },
  });

  return {
    agendamentos,
    execucoes,
    loadingAgendamentos,
    loadingExecucoes,
    createAgendamento,
    updateAgendamentoStatus,
  };
}

export function useChecklistNotificacoes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notificacoes = [], isLoading } = useQuery({
    queryKey: ["checklist_notificacoes", user?.id],
    enabled: !!user,
    ...QUERY_DEFAULTS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_notificacoes" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as unknown as ChecklistNotificacao[]) || [];
    },
  });

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("checklist_notificacoes" as any)
        .update({ lida: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist_notificacoes"] });
    },
  });

  return { notificacoes, isLoading, markAsRead };
}
