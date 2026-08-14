import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { calcularClassificacaoRisco } from "@/utils/sgsstRiscoMatrix";

export type StatusApr = "RASCUNHO" | "EM_ANALISE" | "APROVADA" | "REJEITADA" | "CANCELADA" | "ENCERRADA";

export interface SgsstApr {
  id: string;
  empresa_id: string;
  projeto_id: string;
  site_id?: string | null;
  area_id?: string | null;
  codigo?: string | null;
  titulo: string;
  atividade: string;
  descricao?: string | null;
  responsavel_id?: string | null;
  data: string;
  validade?: string | null;
  status: StatusApr;
  observacoes?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
  // Joined Data
  projeto?: { id: string; codigo: string; nome: string } | null;
  site?: { id: string; codigo: string; nome: string } | null;
  area?: { id: string; nome: string } | null;
  responsavel?: { id: string; nome: string | null } | null;
}

export type SgsstAprInput = Omit<SgsstApr, "id" | "empresa_id" | "created_at" | "updated_at" | "projeto" | "site" | "area" | "responsavel">;

export interface SgsstAprEtapa {
  id: string;
  empresa_id: string;
  apr_id: string;
  ordem: number;
  descricao: string;
  responsavel_id?: string | null;
  observacoes?: string | null;
  created_at?: string;
  updated_at?: string;
  responsavel?: { id: string; nome: string | null } | null;
}

export type SgsstAprEtapaInput = Omit<SgsstAprEtapa, "id" | "empresa_id" | "created_at" | "updated_at" | "responsavel">;

export interface SgsstAprRisco {
  id: string;
  empresa_id: string;
  etapa_id: string;
  risco_catalogo_id?: string | null;
  perigo: string;
  risco: string;
  consequencia?: string | null;
  probabilidade: number;
  severidade: number;
  nivel_risco?: number;
  classificacao?: "BAIXO" | "MODERADO" | "ALTO" | "CRÍTICO";
  created_at?: string;
  updated_at?: string;
  risco_catalogo?: { id: string; nome: string; categoria: string } | null;
}

export type SgsstAprRiscoInput = Omit<SgsstAprRisco, "id" | "empresa_id" | "nivel_risco" | "classificacao" | "created_at" | "updated_at" | "risco_catalogo">;

export interface SgsstAprMedida {
  id: string;
  empresa_id: string;
  apr_risco_id: string;
  descricao: string;
  tipo: "Eliminação" | "Substituição" | "Engenharia" | "Administrativa" | "EPI";
  responsavel_id?: string | null;
  prazo?: string | null;
  status: "pendente" | "em_andamento" | "implementado" | "cancelado";
  created_at?: string;
  updated_at?: string;
  responsavel?: { id: string; nome: string | null } | null;
}

export type SgsstAprMedidaInput = Omit<SgsstAprMedida, "id" | "empresa_id" | "created_at" | "updated_at" | "responsavel">;

export interface SgsstAprParticipante {
  id: string;
  empresa_id: string;
  apr_id: string;
  colaborador_dados_id?: string | null;
  funcao_id?: string | null;
  participacao?: string | null;
  confirmacao: boolean;
  created_at?: string;
  colaborador_dados?: {
    id: string;
    matricula?: string | null;
    profile?: { nome: string | null } | null;
    recurso?: { nome: string } | null;
  } | null;
  funcao?: { id: string; nome: string } | null;
}

export interface SgsstAprHistorico {
  id: string;
  empresa_id: string;
  apr_id: string;
  usuario_id?: string | null;
  status_anterior?: string | null;
  novo_status: string;
  observacao?: string | null;
  created_at: string;
  usuario?: { id: string; nome: string | null } | null;
}

export function useSgsstAprDetail(aprId?: string) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  return useQuery({
    queryKey: ["sgsst_apr_detail", aprId],
    enabled: !!empresaId && !!aprId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_apr" as any)
        .select(`
          *,
          projeto:projetos(id, codigo, nome),
          site:sites(id, codigo, nome),
          area:areas(id, nome),
          responsavel:profiles!sgsst_apr_responsavel_id_fkey(id, nome)
        `)
        .eq("id", aprId)
        .single() as any);
      if (error) throw error;
      return data as SgsstApr;
    },
  });
}

export function useSgsstApr(params?: { page?: number; pageSize?: number; search?: string; status?: string }) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;
  const page = params?.page ?? 0;
  const pageSize = params?.pageSize ?? 25;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["sgsst_apr", empresaId, page, pageSize, params?.search, params?.status],
    enabled: !!empresaId,
    queryFn: async () => {
      let query = supabase
        .from("sgsst_apr" as any)
        .select(`
          *,
          projeto:projetos(id, codigo, nome),
          site:sites(id, codigo, nome),
          area:areas(id, nome),
          responsavel:profiles!sgsst_apr_responsavel_id_fkey(id, nome)
        `, { count: "exact" })
        .order("created_at", { ascending: false });

      if (params?.search) {
        query = query.ilike("titulo", `%${params.search}%`);
      }
      if (params?.status && params.status !== "todos") {
        query = query.eq("status", params.status);
      }

      query = query.range(page * pageSize, page * pageSize + pageSize - 1);

      const { data, error, count } = await (query as any);

      if (error) throw error;
      return { rows: (data as SgsstApr[]) || [], total: count ?? 0 };
    },
  });

  const createApr = useMutation({
    mutationFn: async (input: SgsstAprInput) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data, error } = await (supabase
        .from("sgsst_apr" as any)
        .insert({
          ...input,
          empresa_id: empresaId,
          created_by: profile?.id,
          updated_by: profile?.id,
        })
        .select()
        .single() as any);

      if (error) throw error;

      // Gravar histórico inicial
      await supabase.from("sgsst_apr_historico" as any).insert({
        empresa_id: empresaId,
        apr_id: data.id,
        usuario_id: profile?.id,
        status_anterior: null,
        novo_status: data.status,
        observacao: "Criação do documento APR",
      });

      return data as SgsstApr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_apr"] });
      toast.success("APR criada com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao criar APR: ${err.message || err}`);
    },
  });

  const updateApr = useMutation({
    mutationFn: async ({ id, ...input }: Partial<SgsstAprInput> & { id: string }) => {
      const { data, error } = await (supabase
        .from("sgsst_apr" as any)
        .update({
          ...input,
          updated_by: profile?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstApr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_apr"] });
      toast.success("APR atualizada com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar APR: ${err.message || err}`);
    },
  });

  const updateStatusApr = useMutation({
    mutationFn: async ({
      id,
      statusAnterior,
      novoStatus,
      observacao,
    }: {
      id: string;
      statusAnterior: StatusApr;
      novoStatus: StatusApr;
      observacao?: string;
    }) => {
      const { data, error } = await (supabase
        .from("sgsst_apr" as any)
        .update({
          status: novoStatus,
          updated_by: profile?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;

      // Registrar no histórico de transições
      await supabase.from("sgsst_apr_historico" as any).insert({
        empresa_id: empresaId,
        apr_id: id,
        usuario_id: profile?.id,
        status_anterior: statusAnterior,
        novo_status: novoStatus,
        observacao: observacao || `Alteração de status para ${novoStatus}`,
      });

      return data as SgsstApr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_apr"] });
      queryClient.invalidateQueries({ queryKey: ["sgsst_apr_historico"] });
      toast.success("Status da APR atualizado com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao alterar status da APR: ${err.message || err}`);
    },
  });

  const removeApr = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_apr" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_apr"] });
      toast.success("APR removida com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover APR: ${err.message || err}`);
    },
  });

  return {
    aprs: data?.rows ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    refetch,
    createApr,
    updateApr,
    updateStatusApr,
    removeApr,
  };
}

// Hook for APR Etapas
export function useSgsstAprEtapas(aprId?: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const { data: etapas = [], isLoading, refetch } = useQuery({
    queryKey: ["sgsst_apr_etapas", aprId],
    enabled: !!aprId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_apr_etapas" as any)
        .select(`
          *,
          responsavel:profiles!sgsst_apr_etapas_responsavel_id_fkey(id, nome)
        `)
        .eq("apr_id", aprId!)
        .order("ordem", { ascending: true }) as any);

      if (error) throw error;
      return (data as SgsstAprEtapa[]) || [];
    },
  });

  const createEtapa = useMutation({
    mutationFn: async (input: SgsstAprEtapaInput) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data, error } = await (supabase
        .from("sgsst_apr_etapas" as any)
        .insert({
          ...input,
          empresa_id: empresaId,
        })
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstAprEtapa;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_apr_etapas", aprId] });
      toast.success("Etapa adicionada à APR!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao adicionar etapa: ${err.message || err}`);
    },
  });

  const updateEtapa = useMutation({
    mutationFn: async ({ id, ...input }: Partial<SgsstAprEtapaInput> & { id: string }) => {
      const { data, error } = await (supabase
        .from("sgsst_apr_etapas" as any)
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstAprEtapa;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_apr_etapas", aprId] });
      toast.success("Etapa atualizada!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar etapa: ${err.message || err}`);
    },
  });

  const removeEtapa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_apr_etapas" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_apr_etapas", aprId] });
      toast.success("Etapa removida!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover etapa: ${err.message || err}`);
    },
  });

  return {
    etapas,
    isLoading,
    refetch,
    createEtapa,
    updateEtapa,
    removeEtapa,
  };
}

// Hook for APR Riscos
export function useSgsstAprRiscos(etapaId?: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const { data: riscos = [], isLoading, refetch } = useQuery({
    queryKey: ["sgsst_apr_riscos", etapaId],
    enabled: !!etapaId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_apr_riscos" as any)
        .select(`
          *,
          risco_catalogo:sgsst_riscos_catalogo(id, nome, categoria)
        `)
        .eq("etapa_id", etapaId!)
        .order("created_at", { ascending: true }) as any);

      if (error) throw error;
      return (data as SgsstAprRisco[]) || [];
    },
  });

  const createRisco = useMutation({
    mutationFn: async (input: SgsstAprRiscoInput) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data, error } = await (supabase
        .from("sgsst_apr_riscos" as any)
        .insert({
          ...input,
          empresa_id: empresaId,
        })
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstAprRisco;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_apr_riscos", etapaId] });
      toast.success("Risco incluído na etapa!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao incluir risco: ${err.message || err}`);
    },
  });

  const updateRisco = useMutation({
    mutationFn: async ({ id, ...input }: Partial<SgsstAprRiscoInput> & { id: string }) => {
      const { data, error } = await (supabase
        .from("sgsst_apr_riscos" as any)
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstAprRisco;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_apr_riscos", etapaId] });
      toast.success("Risco atualizado!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar risco: ${err.message || err}`);
    },
  });

  const removeRisco = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_apr_riscos" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_apr_riscos", etapaId] });
      toast.success("Risco removido!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover risco: ${err.message || err}`);
    },
  });

  return {
    riscos,
    isLoading,
    refetch,
    createRisco,
    updateRisco,
    removeRisco,
  };
}

// Hook for APR Medidas
export function useSgsstAprMedidas(aprRiscoId?: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const { data: medidas = [], isLoading, refetch } = useQuery({
    queryKey: ["sgsst_apr_medidas", aprRiscoId],
    enabled: !!aprRiscoId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_apr_medidas" as any)
        .select(`
          *,
          responsavel:profiles!sgsst_apr_medidas_responsavel_id_fkey(id, nome)
        `)
        .eq("apr_risco_id", aprRiscoId!)
        .order("created_at", { ascending: true }) as any);

      if (error) throw error;
      return (data as SgsstAprMedida[]) || [];
    },
  });

  const createMedida = useMutation({
    mutationFn: async (input: SgsstAprMedidaInput) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data, error } = await (supabase
        .from("sgsst_apr_medidas" as any)
        .insert({
          ...input,
          empresa_id: empresaId,
        })
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstAprMedida;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_apr_medidas", aprRiscoId] });
      toast.success("Medida de controle adicionada!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao adicionar medida: ${err.message || err}`);
    },
  });

  const updateMedida = useMutation({
    mutationFn: async ({ id, ...input }: Partial<SgsstAprMedidaInput> & { id: string }) => {
      const { data, error } = await (supabase
        .from("sgsst_apr_medidas" as any)
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstAprMedida;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_apr_medidas", aprRiscoId] });
      toast.success("Medida de controle atualizada!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar medida: ${err.message || err}`);
    },
  });

  const removeMedida = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_apr_medidas" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_apr_medidas", aprRiscoId] });
      toast.success("Medida de controle removida!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover medida: ${err.message || err}`);
    },
  });

  return {
    medidas,
    isLoading,
    refetch,
    createMedida,
    updateMedida,
    removeMedida,
  };
}

// Hook for APR Participantes
export function useSgsstAprParticipantes(aprId?: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const { data: participantes = [], isLoading, refetch } = useQuery({
    queryKey: ["sgsst_apr_participantes", aprId],
    enabled: !!aprId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_apr_participantes" as any)
        .select(`
          *,
          colaborador_dados:sgsst_colaborador_dados(
            id,
            matricula,
            profile:profiles(nome),
            recurso:recursos(nome)
          ),
          funcao:sgsst_funcoes(id, nome)
        `)
        .eq("apr_id", aprId!)
        .order("created_at", { ascending: true }) as any);

      if (error) throw error;
      return (data as SgsstAprParticipante[]) || [];
    },
  });

  const addParticipante = useMutation({
    mutationFn: async ({
      colaborador_dados_id,
      funcao_id,
      participacao,
    }: {
      colaborador_dados_id: string;
      funcao_id?: string | null;
      participacao?: string;
    }) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data, error } = await (supabase
        .from("sgsst_apr_participantes" as any)
        .insert({
          empresa_id: empresaId,
          apr_id: aprId!,
          colaborador_dados_id,
          funcao_id: funcao_id || null,
          participacao: participacao || "Executante",
          confirmacao: true,
        })
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstAprParticipante;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_apr_participantes", aprId] });
      toast.success("Participante adicionado à APR!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao adicionar participante: ${err.message || err}`);
    },
  });

  const removeParticipante = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_apr_participantes" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_apr_participantes", aprId] });
      toast.success("Participante removido!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover participante: ${err.message || err}`);
    },
  });

  return {
    participantes,
    isLoading,
    refetch,
    addParticipante,
    removeParticipante,
  };
}

// Hook for APR Historico (Aprovações / Mudanças de Status)
export function useSgsstAprHistorico(aprId?: string) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const { data: historico = [], isLoading } = useQuery({
    queryKey: ["sgsst_apr_historico", aprId],
    enabled: !!aprId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_apr_historico" as any)
        .select(`
          *,
          usuario:profiles!sgsst_apr_historico_usuario_id_fkey(id, nome)
        `)
        .eq("apr_id", aprId!)
        .order("created_at", { ascending: false }) as any);

      if (error) throw error;
      return (data as SgsstAprHistorico[]) || [];
    },
  });

  return {
    historico,
    isLoading,
  };
}
