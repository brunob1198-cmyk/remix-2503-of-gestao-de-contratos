import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type StatusPgr = "RASCUNHO" | "ATIVO" | "EM_REVISAO" | "ENCERRADO";

export interface SgsstPgr {
  id: string;
  empresa_id: string;
  projeto_id: string;
  site_id?: string | null;
  codigo?: string | null;
  titulo: string;
  objetivo?: string | null;
  responsavel_id?: string | null;
  data_inicio: string;
  data_revisao?: string | null;
  status: StatusPgr;
  observacoes?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
  // Joined Data
  projeto?: { id: string; codigo: string; nome: string } | null;
  site?: { id: string; codigo: string; nome: string } | null;
  responsavel?: { id: string; nome: string | null } | null;
}

export type SgsstPgrInput = Omit<SgsstPgr, "id" | "empresa_id" | "created_at" | "updated_at" | "projeto" | "site" | "responsavel">;

export interface SgsstPgrInventario {
  id: string;
  empresa_id: string;
  pgr_id: string;
  risco_catalogo_id?: string | null;
  area_id?: string | null;
  atividade: string;
  perigo: string;
  fonte_geradora?: string | null;
  consequencia?: string | null;
  trabalhadores_expostos: number;
  probabilidade: number;
  severidade: number;
  nivel_risco?: number;
  classificacao?: "BAIXO" | "MODERADO" | "ALTO" | "CRÍTICO";
  medidas_existentes?: string | null;
  medidas_necessarias?: string | null;
  responsavel_id?: string | null;
  prazo?: string | null;
  status: "pendente" | "em_andamento" | "concluido" | "cancelado";
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
  // Joined Data
  risco_catalogo?: { id: string; nome: string; categoria: string; agente?: string | null } | null;
  area?: { id: string; nome: string } | null;
  responsavel?: { id: string; nome: string | null } | null;
}

export type SgsstPgrInventarioInput = Omit<
  SgsstPgrInventario,
  "id" | "empresa_id" | "nivel_risco" | "classificacao" | "created_at" | "updated_at" | "risco_catalogo" | "area" | "responsavel"
>;

export interface SgsstPgrMedidaControle {
  id: string;
  empresa_id: string;
  inventario_id: string;
  descricao: string;
  tipo: "Eliminação" | "Substituição" | "Engenharia" | "Administrativa" | "EPI";
  responsavel_id?: string | null;
  prazo?: string | null;
  status: "pendente" | "em_andamento" | "implementado" | "cancelado";
  data_implementacao?: string | null;
  observacao?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
  // Joined Data
  responsavel?: { id: string; nome: string | null } | null;
}

export type SgsstPgrMedidaControleInput = Omit<
  SgsstPgrMedidaControle,
  "id" | "empresa_id" | "created_at" | "updated_at" | "responsavel"
>;

import { calcularClassificacaoRisco } from "@/utils/sgsstRiscoMatrix";
export { calcularClassificacaoRisco };

export function useSgsstPgrDetail(pgrId?: string) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  return useQuery({
    queryKey: ["sgsst_pgr_detail", pgrId],
    enabled: !!empresaId && !!pgrId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_pgr" as any)
        .select(`
          *,
          projeto:projetos(id, codigo, nome),
          site:sites(id, codigo, nome),
          responsavel:profiles!sgsst_pgr_responsavel_id_fkey(id, nome)
        `)
        .eq("id", pgrId)
        .single() as any);
      if (error) throw error;
      return data as SgsstPgr;
    },
  });
}

export function useSgsstPgr(params?: { page?: number; pageSize?: number; search?: string; status?: string }) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;
  const page = params?.page ?? 0;
  const pageSize = params?.pageSize ?? 25;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["sgsst_pgr", empresaId, page, pageSize, params?.search, params?.status],
    enabled: !!empresaId,
    queryFn: async () => {
      let query = supabase
        .from("sgsst_pgr" as any)
        .select(`
          *,
          projeto:projetos(id, codigo, nome),
          site:sites(id, codigo, nome),
          responsavel:profiles!sgsst_pgr_responsavel_id_fkey(id, nome)
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
      return { rows: (data as SgsstPgr[]) || [], total: count ?? 0 };
    },
  });

  const createPgr = useMutation({
    mutationFn: async (input: SgsstPgrInput) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data, error } = await (supabase
        .from("sgsst_pgr" as any)
        .insert({
          ...input,
          empresa_id: empresaId,
          created_by: profile?.id,
          updated_by: profile?.id,
        })
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstPgr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pgr"] });
      toast.success("PGR criado com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao criar PGR: ${err.message || err}`);
    },
  });

  const updatePgr = useMutation({
    mutationFn: async ({ id, ...input }: Partial<SgsstPgrInput> & { id: string }) => {
      const { data, error } = await (supabase
        .from("sgsst_pgr" as any)
        .update({
          ...input,
          updated_by: profile?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstPgr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pgr"] });
      toast.success("PGR atualizado com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar PGR: ${err.message || err}`);
    },
  });

  const updateStatusPgr = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusPgr }) => {
      const { data, error } = await (supabase
        .from("sgsst_pgr" as any)
        .update({
          status,
          updated_by: profile?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstPgr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pgr"] });
      toast.success("Status do PGR alterado com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao alterar status: ${err.message || err}`);
    },
  });

  const removePgr = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_pgr" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pgr"] });
      toast.success("PGR removido com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover PGR: ${err.message || err}`);
    },
  });

  return {
    pgrs: data?.rows ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    refetch,
    createPgr,
    updatePgr,
    updateStatusPgr,
    removePgr,
  };
}

// Hook for Inventário de Riscos
export function useSgsstPgrInventario(pgrId?: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const { data: inventario = [], isLoading, refetch } = useQuery({
    queryKey: ["sgsst_pgr_inventario", pgrId],
    enabled: !!pgrId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_pgr_inventario" as any)
        .select(`
          *,
          risco_catalogo:sgsst_riscos_catalogo(id, nome, categoria, agente),
          area:areas(id, nome),
          responsavel:profiles!sgsst_pgr_inventario_responsavel_id_fkey(id, nome)
        `)
        .eq("pgr_id", pgrId!)
        .order("created_at", { ascending: false }) as any);

      if (error) throw error;
      return (data as SgsstPgrInventario[]) || [];
    },
  });

  const createInventarioItem = useMutation({
    mutationFn: async (input: SgsstPgrInventarioInput) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data, error } = await (supabase
        .from("sgsst_pgr_inventario" as any)
        .insert({
          ...input,
          empresa_id: empresaId,
          created_by: profile?.id,
          updated_by: profile?.id,
        })
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstPgrInventario;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pgr_inventario", pgrId] });
      toast.success("Risco incluído no inventário!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao adicionar risco ao inventário: ${err.message || err}`);
    },
  });

  const updateInventarioItem = useMutation({
    mutationFn: async ({ id, ...input }: Partial<SgsstPgrInventarioInput> & { id: string }) => {
      const { data, error } = await (supabase
        .from("sgsst_pgr_inventario" as any)
        .update({
          ...input,
          updated_by: profile?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstPgrInventario;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pgr_inventario", pgrId] });
      toast.success("Item do inventário atualizado!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar inventário: ${err.message || err}`);
    },
  });

  const removeInventarioItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_pgr_inventario" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pgr_inventario", pgrId] });
      toast.success("Item removido do inventário!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover item do inventário: ${err.message || err}`);
    },
  });

  return {
    inventario,
    isLoading,
    refetch,
    createInventarioItem,
    updateInventarioItem,
    removeInventarioItem,
  };
}

// Hook for Medidas de Controle
export function useSgsstPgrMedidasControle(inventarioId?: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const { data: medidas = [], isLoading, refetch } = useQuery({
    queryKey: ["sgsst_pgr_medidas_controle", inventarioId],
    enabled: !!inventarioId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_pgr_medidas_controle" as any)
        .select(`
          *,
          responsavel:profiles!sgsst_pgr_medidas_controle_responsavel_id_fkey(id, nome)
        `)
        .eq("inventario_id", inventarioId!)
        .order("created_at", { ascending: false }) as any);

      if (error) throw error;
      return (data as SgsstPgrMedidaControle[]) || [];
    },
  });

  const createMedida = useMutation({
    mutationFn: async (input: SgsstPgrMedidaControleInput) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data, error } = await (supabase
        .from("sgsst_pgr_medidas_controle" as any)
        .insert({
          ...input,
          empresa_id: empresaId,
          created_by: profile?.id,
          updated_by: profile?.id,
        })
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstPgrMedidaControle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pgr_medidas_controle", inventarioId] });
      toast.success("Medida de controle cadastrada!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao cadastrar medida: ${err.message || err}`);
    },
  });

  const updateMedida = useMutation({
    mutationFn: async ({ id, ...input }: Partial<SgsstPgrMedidaControleInput> & { id: string }) => {
      const { data, error } = await (supabase
        .from("sgsst_pgr_medidas_controle" as any)
        .update({
          ...input,
          updated_by: profile?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstPgrMedidaControle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pgr_medidas_controle", inventarioId] });
      toast.success("Medida de controle atualizada!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar medida: ${err.message || err}`);
    },
  });

  const removeMedida = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_pgr_medidas_controle" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pgr_medidas_controle", inventarioId] });
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
