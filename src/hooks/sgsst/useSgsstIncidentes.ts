import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type TipoIncidente =
  | "Incidente"
  | "Acidente"
  | "Quase Acidente"
  | "Acidente com Afastamento"
  | "Acidente sem Afastamento"
  | "Ocorrência Ambiental"
  | "Outros";

export type GravidadeIncidente = "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";

export type StatusIncidente =
  | "REGISTRADO"
  | "EM_INVESTIGACAO"
  | "PLANO_ACAO"
  | "EM_TRATAMENTO"
  | "ENCERRADO"
  | "CANCELADO";

export type TipoEnvolvimento = "Vítima" | "Testemunha" | "Envolvido" | "Comunicante" | "Responsável";
export type TipoAcao = "Corretiva" | "Preventiva" | "Contenção" | "Melhoria";
export type PrioridadeAcao = "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
export type StatusAcao = "ABERTA" | "EM_ANDAMENTO" | "CONCLUIDA" | "CANCELADA";

export interface SgsstIncidente {
  id: string;
  empresa_id: string;
  projeto_id: string;
  site_id?: string | null;
  area_id?: string | null;
  pgr_id?: string | null;
  apr_id?: string | null;
  pt_id?: string | null;
  inspecao_id?: string | null;
  codigo?: string | null;
  tipo: TipoIncidente;
  titulo: string;
  descricao: string;
  local_ocorrencia?: string | null;
  data_ocorrencia: string;
  hora_ocorrencia?: string | null;
  responsavel_registro_id?: string | null;
  gravidade: GravidadeIncidente;
  status: StatusIncidente;

  // --- Base das taxas de frequencia e gravidade (NBR 14280) ---
  /** Dias de afastamento perdidos. Numerador da taxa de gravidade. */
  dias_perdidos?: number | null;
  /**
   * Dias DEBITADOS pela NBR 14280 para perda permanente (obito, invalidez,
   * perda de membro). Somam aos perdidos: sem eles, um obito pesaria menos que
   * um afastamento de 30 dias.
   */
  dias_debitados?: number | null;
  data_afastamento?: string | null;
  data_retorno?: string | null;
  /** CAT emitida. Acidente com afastamento sem CAT e irregularidade legal. */
  cat_emitida?: boolean | null;

  observacoes?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
  // Joined Data
  projeto?: { id: string; codigo: string; nome: string } | null;
  site?: { id: string; codigo: string; nome: string } | null;
  area?: { id: string; nome: string } | null;
  responsavel_registro?: { id: string; nome: string | null } | null;
  pgr?: { id: string; titulo: string } | null;
  apr?: { id: string; titulo: string } | null;
  pt?: { id: string; titulo: string } | null;
  inspecao?: { id: string; titulo: string } | null;
}

export type SgsstIncidenteInput = Omit<
  SgsstIncidente,
  "id" | "empresa_id" | "created_at" | "updated_at" | "projeto" | "site" | "area" | "responsavel_registro" | "pgr" | "apr" | "pt" | "inspecao"
>;

export interface SgsstIncidenteEnvolvido {
  id: string;
  empresa_id: string;
  incidente_id: string;
  colaborador_dados_id?: string | null;
  funcao_id?: string | null;
  tipo_envolvimento: TipoEnvolvimento;
  descricao?: string | null;
  observacoes?: string | null;
  created_at?: string;
  colaborador_dados?: {
    id: string;
    matricula?: string | null;
    nome?: string | null;
    profile?: { nome: string | null } | null;
    recurso?: { nome: string } | null;
  } | null;
  funcao?: { id: string; nome: string } | null;
}

export interface SgsstIncidenteInvestigacao {
  id: string;
  empresa_id: string;
  incidente_id: string;
  descricao_investigacao: string;
  fatos_observados?: string | null;
  causas_imediatas?: string | null;
  causas_basicas?: string | null;
  causas_raiz?: string | null;
  fatores_contribuintes?: string | null;
  conclusao?: string | null;
  responsavel_id?: string | null;
  data_investigacao?: string | null;
  risco_catalogo_id?: string | null;
  created_at?: string;
  updated_at?: string;
  responsavel?: { id: string; nome: string | null } | null;
  risco_catalogo?: { id: string; nome: string; categoria: string } | null;
}

export interface SgsstIncidenteAcao {
  id: string;
  empresa_id: string;
  incidente_id: string;
  descricao: string;
  tipo: TipoAcao;
  responsavel_id?: string | null;
  prazo?: string | null;
  prioridade: PrioridadeAcao;
  status: StatusAcao;
  data_conclusao?: string | null;
  observacao?: string | null;
  created_at?: string;
  updated_at?: string;
  responsavel?: { id: string; nome: string | null } | null;
}

export interface SgsstIncidenteHistorico {
  id: string;
  empresa_id: string;
  incidente_id: string;
  usuario_id?: string | null;
  status_anterior?: string | null;
  novo_status: string;
  observacao?: string | null;
  created_at: string;
  usuario?: { id: string; nome: string | null } | null;
}

export function useSgsstIncidentesDetail(incidenteId?: string) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  return useQuery({
    queryKey: ["sgsst_incidentes", "detail", incidenteId],
    enabled: !!empresaId && !!incidenteId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_incidentes" as any)
        .select(`
          *,
          projeto:projetos(id, codigo, nome),
          site:sites(id, codigo, nome),
          area:areas(id, nome),
          responsavel_registro:profiles!sgsst_incidentes_responsavel_registro_id_fkey(id, nome),
          pgr:sgsst_pgr(id, titulo),
          apr:sgsst_apr(id, titulo),
          pt:sgsst_pt(id, titulo),
          inspecao:sgsst_inspecoes(id, titulo)
        `)
        .eq("id", incidenteId)
        .single() as any);
      if (error) throw error;
      return data as SgsstIncidente;
    },
  });
}

export function useSgsstIncidentes(params?: { page?: number; pageSize?: number; search?: string; status?: string; tipo?: string }) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;
  const page = params?.page ?? 0;
  const pageSize = params?.pageSize ?? 25;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["sgsst_incidentes", empresaId, page, pageSize, params?.search, params?.status, params?.tipo],
    enabled: !!empresaId,
    queryFn: async () => {
      let query = supabase
        .from("sgsst_incidentes" as any)
        .select(`
          *,
          projeto:projetos(id, codigo, nome),
          site:sites(id, codigo, nome),
          area:areas(id, nome),
          responsavel_registro:profiles!sgsst_incidentes_responsavel_registro_id_fkey(id, nome),
          pgr:sgsst_pgr(id, titulo),
          apr:sgsst_apr(id, titulo),
          pt:sgsst_pt(id, titulo),
          inspecao:sgsst_inspecoes(id, titulo)
        `, { count: "exact" })
        .order("created_at", { ascending: false });

      if (params?.search) {
        query = query.ilike("titulo", `%${params.search}%`);
      }
      if (params?.status && params.status !== "todos") {
        query = query.eq("status", params.status);
      }
      if (params?.tipo && params.tipo !== "todos") {
        query = query.eq("tipo", params.tipo);
      }

      query = query.range(page * pageSize, page * pageSize + pageSize - 1);

      const { data, error, count } = await (query as any);

      if (error) throw error;
      return { rows: (data as SgsstIncidente[]) || [], total: count ?? 0 };
    },
  });

  const createIncidente = useMutation({
    mutationFn: async (input: SgsstIncidenteInput) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data: createdInc, error } = await (supabase
        .from("sgsst_incidentes" as any)
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
      await supabase.from("sgsst_incidentes_historico" as any).insert({
        empresa_id: empresaId,
        incidente_id: createdInc.id,
        usuario_id: profile?.id,
        status_anterior: null,
        novo_status: createdInc.status,
        observacao: "Registro inicial do incidente/acidente de segurança",
      });

      return createdInc as SgsstIncidente;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_incidentes"] });
      toast.success("Incidente registrado com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao registrar incidente: ${err.message || err}`);
    },
  });

  const updateIncidente = useMutation({
    mutationFn: async ({ id, ...input }: Partial<SgsstIncidenteInput> & { id: string }) => {
      const { data, error } = await (supabase
        .from("sgsst_incidentes" as any)
        .update({
          ...input,
          updated_by: profile?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstIncidente;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_incidentes"] });
      toast.success("Incidente atualizado com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar incidente: ${err.message || err}`);
    },
  });

  const updateStatusIncidente = useMutation({
    mutationFn: async ({
      id,
      statusAnterior,
      novoStatus,
      observacao,
    }: {
      id: string;
      statusAnterior: StatusIncidente;
      novoStatus: StatusIncidente;
      observacao?: string;
    }) => {
      const { data, error } = await (supabase
        .from("sgsst_incidentes" as any)
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
      await supabase.from("sgsst_incidentes_historico" as any).insert({
        empresa_id: empresaId,
        incidente_id: id,
        usuario_id: profile?.id,
        status_anterior: statusAnterior,
        novo_status: novoStatus,
        observacao: observacao || `Transição de status de ${statusAnterior} para ${novoStatus}`,
      });

      return data as SgsstIncidente;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_incidentes"] });
      queryClient.invalidateQueries({ queryKey: ["sgsst_incidentes_historico"] });
      toast.success("Status do incidente alterado!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao alterar status: ${err.message || err}`);
    },
  });

  const removeIncidente = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_incidentes" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_incidentes"] });
      toast.success("Incidente removido com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover incidente: ${err.message || err}`);
    },
  });

  return {
    incidentes: data?.rows ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    refetch,
    createIncidente,
    updateIncidente,
    updateStatusIncidente,
    removeIncidente,
  };
}

// Hook for Envolvidos
export function useSgsstIncidenteEnvolvidos(incidenteId?: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const { data: envolvidos = [], isLoading, refetch } = useQuery({
    queryKey: ["sgsst_incidentes_envolvidos", incidenteId],
    enabled: !!incidenteId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_incidentes_envolvidos" as any)
        .select(`
          *,
          colaborador_dados:sgsst_colaborador_dados(
            id,
            matricula,
            nome,
            profile:profiles(nome),
            recurso:recursos(nome)
          ),
          funcao:sgsst_funcoes(id, nome)
        `)
        .eq("incidente_id", incidenteId!)
        .order("created_at", { ascending: true }) as any);

      if (error) throw error;
      return (data as SgsstIncidenteEnvolvido[]) || [];
    },
  });

  const addEnvolvido = useMutation({
    mutationFn: async (input: {
      colaborador_dados_id: string;
      funcao_id?: string | null;
      tipo_envolvimento: TipoEnvolvimento;
      descricao?: string;
      observacoes?: string;
    }) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data, error } = await (supabase
        .from("sgsst_incidentes_envolvidos" as any)
        .insert({
          ...input,
          empresa_id: empresaId,
          incidente_id: incidenteId!,
        })
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstIncidenteEnvolvido;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_incidentes_envolvidos", incidenteId] });
      toast.success("Pessoa/Envolvido registrado no incidente!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao vincular envolvido: ${err.message || err}`);
    },
  });

  const removeEnvolvido = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_incidentes_envolvidos" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_incidentes_envolvidos", incidenteId] });
      toast.success("Envolvido removido!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover envolvido: ${err.message || err}`);
    },
  });

  return {
    envolvidos,
    isLoading,
    refetch,
    addEnvolvido,
    removeEnvolvido,
  };
}

// Hook for Investigação
export function useSgsstIncidenteInvestigacao(incidenteId?: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const { data: investigacao = null, isLoading, refetch } = useQuery({
    queryKey: ["sgsst_incidentes_investigacao", incidenteId],
    enabled: !!incidenteId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_incidentes_investigacao" as any)
        .select(`
          *,
          responsavel:profiles!sgsst_incidentes_investigacao_responsavel_id_fkey(id, nome),
          risco_catalogo:sgsst_riscos_catalogo(id, nome, categoria)
        `)
        .eq("incidente_id", incidenteId!)
        .maybeSingle() as any);

      if (error) throw error;
      return (data as SgsstIncidenteInvestigacao) || null;
    },
  });

  const saveInvestigacao = useMutation({
    mutationFn: async (
      input: Omit<SgsstIncidenteInvestigacao, "id" | "empresa_id" | "created_at" | "updated_at" | "responsavel" | "risco_catalogo">
    ) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      if (investigacao?.id) {
        const { data, error } = await (supabase
          .from("sgsst_incidentes_investigacao" as any)
          .update({
            ...input,
            updated_at: new Date().toISOString(),
          })
          .eq("id", investigacao.id)
          .select()
          .single() as any);

        if (error) throw error;
        return data as SgsstIncidenteInvestigacao;
      } else {
        const { data, error } = await (supabase
          .from("sgsst_incidentes_investigacao" as any)
          .insert({
            ...input,
            empresa_id: empresaId,
            incidente_id: incidenteId!,
          })
          .select()
          .single() as any);

        if (error) throw error;
        return data as SgsstIncidenteInvestigacao;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_incidentes_investigacao", incidenteId] });
      toast.success("Investigação do incidente salva!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao salvar investigação: ${err.message || err}`);
    },
  });

  return {
    investigacao,
    isLoading,
    refetch,
    saveInvestigacao,
  };
}

// Hook for Ações Corretivas e Preventivas
export function useSgsstIncidenteAcoes(incidenteId?: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const { data: acoes = [], isLoading, refetch } = useQuery({
    queryKey: ["sgsst_incidentes_acoes", incidenteId],
    enabled: !!incidenteId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_incidentes_acoes" as any)
        .select(`
          *,
          responsavel:profiles!sgsst_incidentes_acoes_responsavel_id_fkey(id, nome)
        `)
        .eq("incidente_id", incidenteId!)
        .order("created_at", { ascending: true }) as any);

      if (error) throw error;
      return (data as SgsstIncidenteAcao[]) || [];
    },
  });

  const addAcao = useMutation({
    mutationFn: async (
      input: Omit<SgsstIncidenteAcao, "id" | "empresa_id" | "created_at" | "updated_at" | "responsavel">
    ) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data, error } = await (supabase
        .from("sgsst_incidentes_acoes" as any)
        .insert({
          ...input,
          empresa_id: empresaId,
          incidente_id: incidenteId!,
        })
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstIncidenteAcao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_incidentes_acoes", incidenteId] });
      toast.success("Plano de Ação registrado!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao registrar ação: ${err.message || err}`);
    },
  });

  const updateAcao = useMutation({
    mutationFn: async ({
      id,
      ...input
    }: Partial<Omit<SgsstIncidenteAcao, "id" | "empresa_id">> & { id: string }) => {
      const updateData: any = {
        ...input,
        updated_at: new Date().toISOString(),
      };

      if (input.status === "CONCLUIDA" && !input.data_conclusao) {
        updateData.data_conclusao = new Date().toISOString().split("T")[0];
      }

      const { data, error } = await (supabase
        .from("sgsst_incidentes_acoes" as any)
        .update(updateData)
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstIncidenteAcao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_incidentes_acoes", incidenteId] });
      toast.success("Ação atualizada!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar ação: ${err.message || err}`);
    },
  });

  const removeAcao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_incidentes_acoes" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_incidentes_acoes", incidenteId] });
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
export function useSgsstIncidenteHistorico(incidenteId?: string) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const { data: historico = [], isLoading } = useQuery({
    queryKey: ["sgsst_incidentes_historico", incidenteId],
    enabled: !!incidenteId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_incidentes_historico" as any)
        .select(`
          *,
          usuario:profiles!sgsst_incidentes_historico_usuario_id_fkey(id, nome)
        `)
        .eq("incidente_id", incidenteId!)
        .order("created_at", { ascending: false }) as any);

      if (error) throw error;
      return (data as SgsstIncidenteHistorico[]) || [];
    },
  });

  return {
    historico,
    isLoading,
  };
}
