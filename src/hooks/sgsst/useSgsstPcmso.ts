import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type StatusPcmso = "RASCUNHO" | "ATIVO" | "EM_REVISAO" | "ENCERRADO" | "CANCELADO";

export type TipoExamePcmso =
  | "Admissional"
  | "Periódico"
  | "Retorno ao Trabalho"
  | "Mudança de Risco/Função"
  | "Demissional"
  | "Outros";

export interface SgsstPcmso {
  id: string;
  empresa_id: string;
  projeto_id?: string | null;
  codigo?: string | null;
  titulo: string;
  responsavel?: string | null;
  medico_responsavel?: string | null;
  crm_medico?: string | null;
  data_inicio: string;
  data_revisao?: string | null;
  status: StatusPcmso;
  objetivo?: string | null;
  observacoes?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
  // Joined Data
  projeto?: { id: string; codigo: string; nome: string } | null;
}

export type SgsstPcmsoInput = Omit<
  SgsstPcmso,
  "id" | "empresa_id" | "created_at" | "updated_at" | "projeto"
>;

export interface SgsstPcmsoExame {
  id: string;
  empresa_id: string;
  pcmso_id: string;
  nome_exame: string;
  tipo_exame: TipoExamePcmso;
  periodicidade_meses: number;
  funcao_id?: string | null;
  grupo_risco?: string | null;
  observacoes?: string | null;
  created_at?: string;
  funcao?: { id: string; nome: string } | null;
}

export interface SgsstPcmsoHistorico {
  id: string;
  empresa_id: string;
  pcmso_id: string;
  usuario_id?: string | null;
  status_anterior?: string | null;
  novo_status: string;
  observacao?: string | null;
  created_at: string;
  usuario?: { id: string; nome: string | null } | null;
}

export function useSgsstPcmsoDetail(pcmsoId?: string) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  return useQuery({
    queryKey: ["sgsst_pcmso_detail", pcmsoId],
    enabled: !!empresaId && !!pcmsoId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_pcmso" as any)
        .select(`
          *,
          projeto:projetos(id, codigo, nome)
        `)
        .eq("id", pcmsoId)
        .single() as any);
      if (error) throw error;
      return data as SgsstPcmso;
    },
  });
}

export function useSgsstPcmso() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const { data: pcmsoList = [], isLoading, error, refetch } = useQuery({
    queryKey: ["sgsst_pcmso", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_pcmso" as any)
        .select(`
          *,
          projeto:projetos(id, codigo, nome)
        `)
        .order("created_at", { ascending: false }) as any);

      if (error) throw error;
      return (data as SgsstPcmso[]) || [];
    },
  });

  const createPcmso = useMutation({
    mutationFn: async (input: SgsstPcmsoInput) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data: createdPcmso, error } = await (supabase
        .from("sgsst_pcmso" as any)
        .insert({
          ...input,
          empresa_id: empresaId,
          created_by: profile?.id,
          updated_by: profile?.id,
        })
        .select()
        .single() as any);

      if (error) throw error;

      // Log inicial no histórico
      await supabase.from("sgsst_pcmso_historico" as any).insert({
        empresa_id: empresaId,
        pcmso_id: createdPcmso.id,
        usuario_id: profile?.id,
        status_anterior: null,
        novo_status: createdPcmso.status,
        observacao: "Elaboração e criação do programa PCMSO",
      });

      return createdPcmso as SgsstPcmso;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pcmso"] });
      toast.success("PCMSO criado com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao criar PCMSO: ${err.message || err}`);
    },
  });

  const updatePcmso = useMutation({
    mutationFn: async ({ id, ...input }: Partial<SgsstPcmsoInput> & { id: string }) => {
      const { data, error } = await (supabase
        .from("sgsst_pcmso" as any)
        .update({
          ...input,
          updated_by: profile?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstPcmso;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pcmso"] });
      toast.success("PCMSO atualizado com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar PCMSO: ${err.message || err}`);
    },
  });

  const updateStatusPcmso = useMutation({
    mutationFn: async ({
      id,
      statusAnterior,
      novoStatus,
      observacao,
    }: {
      id: string;
      statusAnterior: StatusPcmso;
      novoStatus: StatusPcmso;
      observacao?: string;
    }) => {
      const { data, error } = await (supabase
        .from("sgsst_pcmso" as any)
        .update({
          status: novoStatus,
          updated_by: profile?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;

      // Log no histórico
      await supabase.from("sgsst_pcmso_historico" as any).insert({
        empresa_id: empresaId,
        pcmso_id: id,
        usuario_id: profile?.id,
        status_anterior: statusAnterior,
        novo_status: novoStatus,
        observacao: observacao || `Transição de status de ${statusAnterior} para ${novoStatus}`,
      });

      return data as SgsstPcmso;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pcmso"] });
      queryClient.invalidateQueries({ queryKey: ["sgsst_pcmso_historico"] });
      toast.success("Status do PCMSO alterado!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao alterar status: ${err.message || err}`);
    },
  });

  const removePcmso = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_pcmso" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pcmso"] });
      toast.success("PCMSO removido com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover PCMSO: ${err.message || err}`);
    },
  });

  return {
    pcmsoList,
    isLoading,
    error,
    refetch,
    createPcmso,
    updatePcmso,
    updateStatusPcmso,
    removePcmso,
  };
}

// Hook for Exames Previstos
export function useSgsstPcmsoExames(pcmsoId?: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const { data: exames = [], isLoading, refetch } = useQuery({
    queryKey: ["sgsst_pcmso_exames", pcmsoId],
    enabled: !!pcmsoId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_pcmso_exames" as any)
        .select(`
          *,
          funcao:sgsst_funcoes(id, nome)
        `)
        .eq("pcmso_id", pcmsoId!)
        .order("created_at", { ascending: true }) as any);

      if (error) throw error;
      return (data as SgsstPcmsoExame[]) || [];
    },
  });

  const addExame = useMutation({
    mutationFn: async (
      input: Omit<SgsstPcmsoExame, "id" | "empresa_id" | "created_at" | "funcao">
    ) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data, error } = await (supabase
        .from("sgsst_pcmso_exames" as any)
        .insert({
          ...input,
          empresa_id: empresaId,
          pcmso_id: pcmsoId!,
        })
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstPcmsoExame;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pcmso_exames", pcmsoId] });
      toast.success("Exame previsto adicionado ao PCMSO!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao adicionar exame: ${err.message || err}`);
    },
  });

  const removeExame = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_pcmso_exames" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pcmso_exames", pcmsoId] });
      toast.success("Exame removido do PCMSO!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover exame: ${err.message || err}`);
    },
  });

  return {
    exames,
    isLoading,
    refetch,
    addExame,
    removeExame,
  };
}

// Hook for Histórico
export function useSgsstPcmsoHistorico(pcmsoId?: string) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const { data: historico = [], isLoading } = useQuery({
    queryKey: ["sgsst_pcmso_historico", pcmsoId],
    enabled: !!pcmsoId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_pcmso_historico" as any)
        .select(`
          *,
          usuario:profiles!sgsst_pcmso_historico_usuario_id_fkey(id, nome)
        `)
        .eq("pcmso_id", pcmsoId!)
        .order("created_at", { ascending: false }) as any);

      if (error) throw error;
      return (data as SgsstPcmsoHistorico[]) || [];
    },
  });

  return {
    historico,
    isLoading,
  };
}
