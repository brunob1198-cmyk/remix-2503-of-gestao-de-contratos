import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type OrigemNC = "INSPECAO" | "INCIDENTE" | "PGR" | "APR" | "PT" | "MANUAL";
export type CriticidadeNC = "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
export type StatusNC =
  | "ABERTA"
  | "EM_ANALISE"
  | "PLANO_ACAO"
  | "EM_TRATAMENTO"
  | "AGUARDANDO_VERIFICACAO"
  | "CONCLUIDA"
  | "CANCELADA";

export type ResultadoVerificacao = "ACEITA" | "REJEITADA";
export type TipoAcaoNC = "CORRETIVA" | "PREVENTIVA" | "CONTENCAO" | "MELHORIA";
export type PrioridadeAcaoNC = "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
export type StatusAcaoNC = "ABERTA" | "EM_ANDAMENTO" | "CONCLUIDA" | "CANCELADA";

export interface SgsstNaoConformidade {
  id: string;
  empresa_id: string;
  projeto_id: string;
  site_id?: string | null;
  area_id?: string | null;
  codigo?: string | null;
  titulo: string;
  descricao: string;
  origem_tipo: OrigemNC;
  origem_id?: string | null;
  responsavel_id?: string | null;
  data_identificacao: string;
  criticidade: CriticidadeNC;
  prazo?: string | null;
  status: StatusNC;
  causa?: string | null;
  observacoes?: string | null;
  verificador_id?: string | null;
  data_verificacao?: string | null;
  resultado_verificacao?: ResultadoVerificacao | null;
  observacao_verificacao?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
  // Joined Data
  projeto?: { id: string; codigo: string; nome: string } | null;
  site?: { id: string; codigo: string; nome: string } | null;
  area?: { id: string; nome: string } | null;
  responsavel?: { id: string; nome: string | null } | null;
  verificador?: { id: string; nome: string | null } | null;
}

export type SgsstNaoConformidadeInput = Omit<
  SgsstNaoConformidade,
  "id" | "empresa_id" | "created_at" | "updated_at" | "projeto" | "site" | "area" | "responsavel" | "verificador"
>;

export interface SgsstNaoConformidadeAcao {
  id: string;
  empresa_id: string;
  nao_conformidade_id: string;
  descricao: string;
  tipo: TipoAcaoNC;
  responsavel_id?: string | null;
  prazo?: string | null;
  prioridade: PrioridadeAcaoNC;
  status: StatusAcaoNC;
  data_conclusao?: string | null;
  evidencia?: string | null;
  observacao?: string | null;
  created_at?: string;
  updated_at?: string;
  responsavel?: { id: string; nome: string | null } | null;
}

export interface SgsstNaoConformidadeHistorico {
  id: string;
  empresa_id: string;
  nao_conformidade_id: string;
  usuario_id?: string | null;
  status_anterior?: string | null;
  novo_status: string;
  observacao?: string | null;
  created_at: string;
  usuario?: { id: string; nome: string | null } | null;
}

export function useSgsstNaoConformidades() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const { data: naoConformidades = [], isLoading, error, refetch } = useQuery({
    queryKey: ["sgsst_nao_conformidades", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_nao_conformidades" as any)
        .select(`
          *,
          projeto:projetos(id, codigo, nome),
          site:sites(id, codigo, nome),
          area:areas(id, nome),
          responsavel:profiles!sgsst_nao_conformidades_responsavel_id_fkey(id, nome),
          verificador:profiles!sgsst_nao_conformidades_verificador_id_fkey(id, nome)
        `)
        .order("created_at", { ascending: false }) as any);

      if (error) throw error;
      return (data as SgsstNaoConformidade[]) || [];
    },
  });

  const createNaoConformidade = useMutation({
    mutationFn: async (input: SgsstNaoConformidadeInput) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data: createdNc, error } = await (supabase
        .from("sgsst_nao_conformidades" as any)
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
      await supabase.from("sgsst_nao_conformidades_historico" as any).insert({
        empresa_id: empresaId,
        nao_conformidade_id: createdNc.id,
        usuario_id: profile?.id,
        status_anterior: null,
        novo_status: createdNc.status,
        observacao: `Abertura da Não Conformidade [Origem: ${createdNc.origem_tipo}]`,
      });

      return createdNc as SgsstNaoConformidade;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_nao_conformidades"] });
      toast.success("Não Conformidade criada com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao criar Não Conformidade: ${err.message || err}`);
    },
  });

  const updateNaoConformidade = useMutation({
    mutationFn: async ({ id, ...input }: Partial<SgsstNaoConformidadeInput> & { id: string }) => {
      const { data, error } = await (supabase
        .from("sgsst_nao_conformidades" as any)
        .update({
          ...input,
          updated_by: profile?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstNaoConformidade;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_nao_conformidades"] });
      toast.success("Não Conformidade atualizada com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar Não Conformidade: ${err.message || err}`);
    },
  });

  const updateStatusNaoConformidade = useMutation({
    mutationFn: async ({
      id,
      statusAnterior,
      novoStatus,
      observacao,
    }: {
      id: string;
      statusAnterior: StatusNC;
      novoStatus: StatusNC;
      observacao?: string;
    }) => {
      const { data, error } = await (supabase
        .from("sgsst_nao_conformidades" as any)
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
      await supabase.from("sgsst_nao_conformidades_historico" as any).insert({
        empresa_id: empresaId,
        nao_conformidade_id: id,
        usuario_id: profile?.id,
        status_anterior: statusAnterior,
        novo_status: novoStatus,
        observacao: observacao || `Transição de status de ${statusAnterior} para ${novoStatus}`,
      });

      return data as SgsstNaoConformidade;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_nao_conformidades"] });
      queryClient.invalidateQueries({ queryKey: ["sgsst_nao_conformidades_historico"] });
      toast.success("Status da Não Conformidade alterado!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao alterar status: ${err.message || err}`);
    },
  });

  const verificarNaoConformidade = useMutation({
    mutationFn: async ({
      id,
      resultado,
      observacao,
    }: {
      id: string;
      resultado: ResultadoVerificacao;
      observacao?: string;
    }) => {
      const novoStatus: StatusNC = resultado === "ACEITA" ? "CONCLUIDA" : "EM_TRATAMENTO";

      const { data, error } = await (supabase
        .from("sgsst_nao_conformidades" as any)
        .update({
          verificador_id: profile?.id,
          data_verificacao: new Date().toISOString().split("T")[0],
          resultado_verificacao: resultado,
          observacao_verificacao: observacao || null,
          status: novoStatus,
          updated_by: profile?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;

      // Log no histórico
      await supabase.from("sgsst_nao_conformidades_historico" as any).insert({
        empresa_id: empresaId,
        nao_conformidade_id: id,
        usuario_id: profile?.id,
        status_anterior: "AGUARDANDO_VERIFICACAO",
        novo_status: novoStatus,
        observacao: `Verificação efetuada com resultado: ${resultado}. ${observacao || ""}`,
      });

      return data as SgsstNaoConformidade;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_nao_conformidades"] });
      queryClient.invalidateQueries({ queryKey: ["sgsst_nao_conformidades_historico"] });
      if (vars.resultado === "ACEITA") {
        toast.success("Não Conformidade verificada e CONCLUÍDA com sucesso!");
      } else {
        toast.warning("Verificação REJEITADA! A Não Conformidade retornou para EM TRATAMENTO.");
      }
    },
    onError: (err: any) => {
      toast.error(`Erro ao realizar verificação: ${err.message || err}`);
    },
  });

  const removeNaoConformidade = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_nao_conformidades" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_nao_conformidades"] });
      toast.success("Não Conformidade removida com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover Não Conformidade: ${err.message || err}`);
    },
  });

  return {
    naoConformidades,
    isLoading,
    error,
    refetch,
    createNaoConformidade,
    updateNaoConformidade,
    updateStatusNaoConformidade,
    verificarNaoConformidade,
    removeNaoConformidade,
  };
}

// Hook for Ações da Não Conformidade
export function useSgsstNaoConformidadeAcoes(ncId?: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const { data: acoes = [], isLoading, refetch } = useQuery({
    queryKey: ["sgsst_nao_conformidades_acoes", ncId],
    enabled: !!ncId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_nao_conformidades_acoes" as any)
        .select(`
          *,
          responsavel:profiles!sgsst_nao_conformidades_acoes_responsavel_id_fkey(id, nome)
        `)
        .eq("nao_conformidade_id", ncId!)
        .order("created_at", { ascending: true }) as any);

      if (error) throw error;
      return (data as SgsstNaoConformidadeAcao[]) || [];
    },
  });

  const addAcao = useMutation({
    mutationFn: async (
      input: Omit<SgsstNaoConformidadeAcao, "id" | "empresa_id" | "created_at" | "updated_at" | "responsavel">
    ) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data, error } = await (supabase
        .from("sgsst_nao_conformidades_acoes" as any)
        .insert({
          ...input,
          empresa_id: empresaId,
          nao_conformidade_id: ncId!,
        })
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstNaoConformidadeAcao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_nao_conformidades_acoes", ncId] });
      toast.success("Ação registrada com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao registrar ação: ${err.message || err}`);
    },
  });

  const updateAcao = useMutation({
    mutationFn: async ({
      id,
      ...input
    }: Partial<Omit<SgsstNaoConformidadeAcao, "id" | "empresa_id">> & { id: string }) => {
      const updateData: any = {
        ...input,
        updated_at: new Date().toISOString(),
      };

      if (input.status === "CONCLUIDA" && !input.data_conclusao) {
        updateData.data_conclusao = new Date().toISOString().split("T")[0];
      }

      const { data, error } = await (supabase
        .from("sgsst_nao_conformidades_acoes" as any)
        .update(updateData)
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstNaoConformidadeAcao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_nao_conformidades_acoes", ncId] });
      toast.success("Ação atualizada!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar ação: ${err.message || err}`);
    },
  });

  const removeAcao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_nao_conformidades_acoes" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_nao_conformidades_acoes", ncId] });
      toast.success("Ação removida!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover ação: ${err.message || err}`);
    },
  });

  return {
    acoes,
    isLoading,
    refetch,
    addAcao,
    updateAcao,
    removeAcao,
  };
}

// Hook for Histórico
export function useSgsstNaoConformidadeHistorico(ncId?: string) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const { data: historico = [], isLoading } = useQuery({
    queryKey: ["sgsst_nao_conformidades_historico", ncId],
    enabled: !!ncId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_nao_conformidades_historico" as any)
        .select(`
          *,
          usuario:profiles!sgsst_nao_conformidades_historico_usuario_id_fkey(id, nome)
        `)
        .eq("nao_conformidade_id", ncId!)
        .order("created_at", { ascending: false }) as any);

      if (error) throw error;
      return (data as SgsstNaoConformidadeHistorico[]) || [];
    },
  });

  return {
    historico,
    isLoading,
  };
}
