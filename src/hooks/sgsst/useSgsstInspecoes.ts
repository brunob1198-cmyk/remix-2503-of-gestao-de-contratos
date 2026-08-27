import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getDefaultInspecaoItems, type TipoInspecao } from "@/utils/sgsstInspecaoDefaults";

export { getDefaultInspecaoItems };
export type { TipoInspecao };

export type StatusInspecao = "PLANEJADA" | "EM_EXECUCAO" | "CONCLUIDA" | "CANCELADA";
export type RespostaItem = "CONFORME" | "NAO_CONFORME" | "NAO_APLICAVEL" | "PENDENTE";
export type CriticidadeNC = "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
export type StatusNC = "ABERTA" | "EM_TRATAMENTO" | "CONCLUIDA" | "CANCELADA";

export interface SgsstInspecao {
  id: string;
  empresa_id: string;
  projeto_id: string;
  site_id?: string | null;
  area_id?: string | null;
  pgr_id?: string | null;
  apr_id?: string | null;
  pt_id?: string | null;
  codigo?: string | null;
  titulo: string;
  tipo: TipoInspecao;
  responsavel_id?: string | null;
  data_planejada: string;
  data_execucao?: string | null;
  status: StatusInspecao;
  observacoes?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
  // Joined Data
  projeto?: { id: string; codigo: string; nome: string } | null;
  site?: { id: string; codigo: string; nome: string } | null;
  area?: { id: string; nome: string } | null;
  pgr?: { id: string; titulo: string } | null;
  apr?: { id: string; titulo: string } | null;
  pt?: { id: string; titulo: string } | null;
  responsavel?: { id: string; nome: string | null } | null;
}

export type SgsstInspecaoInput = Omit<
  SgsstInspecao,
  "id" | "empresa_id" | "created_at" | "updated_at" | "projeto" | "site" | "area" | "pgr" | "apr" | "pt" | "responsavel"
>;

export interface SgsstInspecaoItem {
  id: string;
  empresa_id: string;
  inspecao_id: string;
  ordem: number;
  descricao: string;
  categoria?: string | null;
  obrigatorio: boolean;
  resposta: RespostaItem;
  observacao?: string | null;
  created_at?: string;
}

export interface SgsstInspecaoNaoConformidade {
  id: string;
  empresa_id: string;
  inspecao_id: string;
  item_id?: string | null;
  risco_catalogo_id?: string | null;
  descricao: string;
  evidencia?: string | null;
  criticidade: CriticidadeNC;
  responsavel_id?: string | null;
  prazo?: string | null;
  status: StatusNC;
  observacao?: string | null;
  created_at?: string;
  updated_at?: string;
  responsavel?: { id: string; nome: string | null } | null;
  risco_catalogo?: { id: string; nome: string; categoria: string } | null;
}

export interface SgsstInspecaoHistorico {
  id: string;
  empresa_id: string;
  inspecao_id: string;
  usuario_id?: string | null;
  status_anterior?: string | null;
  novo_status: string;
  observacao?: string | null;
  created_at: string;
  usuario?: { id: string; nome: string | null } | null;
}

export function useSgsstInspecoesDetail(inspecaoId?: string) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  return useQuery({
    queryKey: ["sgsst_inspecoes", "detail", inspecaoId],
    enabled: !!empresaId && !!inspecaoId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_inspecoes" as any)
        .select(`
          *,
          projeto:projetos(id, codigo, nome),
          site:sites(id, codigo, nome),
          area:areas(id, nome),
          pgr:sgsst_pgr(id, titulo),
          apr:sgsst_apr(id, titulo),
          pt:sgsst_pt(id, titulo),
          responsavel:profiles!sgsst_inspecoes_responsavel_id_fkey(id, nome)
        `)
        .eq("id", inspecaoId)
        .single() as any);
      if (error) throw error;
      return data as SgsstInspecao;
    },
  });
}

export function useSgsstInspecoes(params?: { page?: number; pageSize?: number; search?: string; status?: string }) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;
  const page = params?.page ?? 0;
  const pageSize = params?.pageSize ?? 25;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["sgsst_inspecoes", empresaId, page, pageSize, params?.search, params?.status],
    enabled: !!empresaId,
    queryFn: async () => {
      let query = supabase
        .from("sgsst_inspecoes" as any)
        .select(`
          *,
          projeto:projetos(id, codigo, nome),
          site:sites(id, codigo, nome),
          area:areas(id, nome),
          pgr:sgsst_pgr(id, titulo),
          apr:sgsst_apr(id, titulo),
          pt:sgsst_pt(id, titulo),
          responsavel:profiles!sgsst_inspecoes_responsavel_id_fkey(id, nome)
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
      return { rows: (data as SgsstInspecao[]) || [], total: count ?? 0 };
    },
  });

  const createInspecao = useMutation({
    mutationFn: async (input: SgsstInspecaoInput) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data: createdInsp, error } = await (supabase
        .from("sgsst_inspecoes" as any)
        .insert({
          ...input,
          empresa_id: empresaId,
          created_by: profile?.id,
          updated_by: profile?.id,
        })
        .select()
        .single() as any);

      if (error) throw error;

      // Inserir itens padrão de checklist conforme o Tipo de Inspeção
      const defaultItems = getDefaultInspecaoItems(input.tipo);
      if (defaultItems.length > 0) {
        await supabase.from("sgsst_inspecoes_itens" as any).insert(
          defaultItems.map((item) => ({
            empresa_id: empresaId,
            inspecao_id: createdInsp.id,
            ordem: item.ordem,
            descricao: item.descricao,
            categoria: item.categoria,
            obrigatorio: item.obrigatorio,
            resposta: "PENDENTE",
          }))
        );
      }

      // Histórico inicial
      await supabase.from("sgsst_inspecoes_historico" as any).insert({
        empresa_id: empresaId,
        inspecao_id: createdInsp.id,
        usuario_id: profile?.id,
        status_anterior: null,
        novo_status: createdInsp.status,
        observacao: "Planejamento e criação da inspeção de segurança",
      });

      return createdInsp as SgsstInspecao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_inspecoes"] });
      toast.success("Inspeção agendada/criada com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao criar inspeção: ${err.message || err}`);
    },
  });

  const updateInspecao = useMutation({
    mutationFn: async ({ id, ...input }: Partial<SgsstInspecaoInput> & { id: string }) => {
      const { data, error } = await (supabase
        .from("sgsst_inspecoes" as any)
        .update({
          ...input,
          updated_by: profile?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstInspecao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_inspecoes"] });
      toast.success("Inspeção atualizada com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar inspeção: ${err.message || err}`);
    },
  });

  const updateStatusInspecao = useMutation({
    mutationFn: async ({
      id,
      statusAnterior,
      novoStatus,
      observacao,
    }: {
      id: string;
      statusAnterior: StatusInspecao;
      novoStatus: StatusInspecao;
      observacao?: string;
    }) => {
      const updateData: any = {
        status: novoStatus,
        updated_by: profile?.id,
        updated_at: new Date().toISOString(),
      };

      if (novoStatus === "EM_EXECUCAO" || novoStatus === "CONCLUIDA") {
        updateData.data_execucao = new Date().toISOString();
      }

      const { data, error } = await (supabase
        .from("sgsst_inspecoes" as any)
        .update(updateData)
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;

      // Registrar histórico
      await supabase.from("sgsst_inspecoes_historico" as any).insert({
        empresa_id: empresaId,
        inspecao_id: id,
        usuario_id: profile?.id,
        status_anterior: statusAnterior,
        novo_status: novoStatus,
        observacao: observacao || `Transição de status de ${statusAnterior} para ${novoStatus}`,
      });

      return data as SgsstInspecao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_inspecoes"] });
      queryClient.invalidateQueries({ queryKey: ["sgsst_inspecoes_historico"] });
      toast.success("Status da inspeção alterado com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao alterar status da inspeção: ${err.message || err}`);
    },
  });

  const removeInspecao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_inspecoes" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_inspecoes"] });
      toast.success("Inspeção removida com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover inspeção: ${err.message || err}`);
    },
  });

  return {
    inspecoes: data?.rows ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    refetch,
    createInspecao,
    updateInspecao,
    updateStatusInspecao,
    removeInspecao,
  };
}

// Hook for Inspeção Itens (Checklist)
export function useSgsstInspecaoItens(inspecaoId?: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const { data: itens = [], isLoading, refetch } = useQuery({
    queryKey: ["sgsst_inspecoes_itens", inspecaoId],
    enabled: !!inspecaoId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_inspecoes_itens" as any)
        .select("*")
        .eq("inspecao_id", inspecaoId!)
        .order("ordem", { ascending: true }) as any);

      if (error) throw error;
      return (data as SgsstInspecaoItem[]) || [];
    },
  });

  const updateRespostaItem = useMutation({
    mutationFn: async ({
      id,
      resposta,
      observacao,
    }: {
      id: string;
      resposta: RespostaItem;
      observacao?: string;
    }) => {
      const { data, error } = await (supabase
        .from("sgsst_inspecoes_itens" as any)
        .update({
          resposta,
          observacao: observacao || null,
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstInspecaoItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_inspecoes_itens", inspecaoId] });
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar item do checklist: ${err.message || err}`);
    },
  });

  const addItem = useMutation({
    mutationFn: async ({
      ordem,
      descricao,
      categoria,
      obrigatorio,
    }: {
      ordem: number;
      descricao: string;
      categoria?: string;
      obrigatorio: boolean;
    }) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data, error } = await (supabase
        .from("sgsst_inspecoes_itens" as any)
        .insert({
          empresa_id: empresaId,
          inspecao_id: inspecaoId!,
          ordem,
          descricao,
          categoria: categoria || null,
          obrigatorio,
          resposta: "PENDENTE",
        })
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstInspecaoItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_inspecoes_itens", inspecaoId] });
      toast.success("Item adicionado ao checklist!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao adicionar item: ${err.message || err}`);
    },
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_inspecoes_itens" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_inspecoes_itens", inspecaoId] });
      toast.success("Item removido!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover item: ${err.message || err}`);
    },
  });

  return {
    itens,
    isLoading,
    refetch,
    updateRespostaItem,
    addItem,
    removeItem,
  };
}

// Hook for Não Conformidades da Inspeção
export function useSgsstInspecaoNaoConformidades(inspecaoId?: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const { data: naoConformidades = [], isLoading, refetch } = useQuery({
    queryKey: ["sgsst_inspecoes_nao_conformidades", inspecaoId],
    enabled: !!inspecaoId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_inspecoes_nao_conformidades" as any)
        .select(`
          *,
          responsavel:profiles!sgsst_inspecoes_nao_conformidades_responsavel_id_fkey(id, nome),
          risco_catalogo:sgsst_riscos_catalogo(id, nome, categoria)
        `)
        .eq("inspecao_id", inspecaoId!)
        .order("created_at", { ascending: false }) as any);

      if (error) throw error;
      return (data as SgsstInspecaoNaoConformidade[]) || [];
    },
  });

  const addNaoConformidade = useMutation({
    mutationFn: async (
      input: Omit<SgsstInspecaoNaoConformidade, "id" | "empresa_id" | "created_at" | "updated_at" | "responsavel" | "risco_catalogo">
    ) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data, error } = await (supabase
        .from("sgsst_inspecoes_nao_conformidades" as any)
        .insert({
          ...input,
          empresa_id: empresaId,
        })
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstInspecaoNaoConformidade;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_inspecoes_nao_conformidades", inspecaoId] });
      toast.success("Não Conformidade registrada!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao registrar não conformidade: ${err.message || err}`);
    },
  });

  const updateNaoConformidade = useMutation({
    mutationFn: async ({
      id,
      ...input
    }: Partial<Omit<SgsstInspecaoNaoConformidade, "id" | "empresa_id">> & { id: string }) => {
      const { data, error } = await (supabase
        .from("sgsst_inspecoes_nao_conformidades" as any)
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstInspecaoNaoConformidade;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_inspecoes_nao_conformidades", inspecaoId] });
      toast.success("Não conformidade atualizada!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar não conformidade: ${err.message || err}`);
    },
  });

  const removeNaoConformidade = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_inspecoes_nao_conformidades" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_inspecoes_nao_conformidades", inspecaoId] });
      toast.success("Não conformidade removida!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover não conformidade: ${err.message || err}`);
    },
  });

  return {
    naoConformidades,
    isLoading,
    refetch,
    addNaoConformidade,
    updateNaoConformidade,
    removeNaoConformidade,
  };
}

// Hook for Inspeção Historico
export function useSgsstInspecaoHistorico(inspecaoId?: string) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const { data: historico = [], isLoading } = useQuery({
    queryKey: ["sgsst_inspecoes_historico", inspecaoId],
    enabled: !!inspecaoId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_inspecoes_historico" as any)
        .select(`
          *,
          usuario:profiles!sgsst_inspecoes_historico_usuario_id_fkey(id, nome)
        `)
        .eq("inspecao_id", inspecaoId!)
        .order("created_at", { ascending: false }) as any);

      if (error) throw error;
      return (data as SgsstInspecaoHistorico[]) || [];
    },
  });

  return {
    historico,
    isLoading,
  };
}
