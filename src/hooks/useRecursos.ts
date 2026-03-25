import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type TipoRecurso = "pessoa" | "equipamento" | "veiculo";
export type UnidadeRecurso = "hora" | "dia";
export type StatusRecursoPessoa = "alocado" | "livre" | "folga" | "ferias";
export type StatusRecursoEquip = "alocado" | "livre" | "manutencao";

export interface Recurso {
  id: string;
  nome: string;
  tipo: TipoRecurso;
  unidade: UnidadeRecurso;
  ativo: boolean;
  cargo: string | null;
  placa: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface RecursoCusto {
  id: string;
  recurso_id: string;
  custo_unitario: number;
  data_inicio: string;
  data_fim: string | null;
  motivo: string | null;
  created_at: string;
}

export interface RecursoAlocacao {
  id: string;
  recurso_id: string;
  site_id: string;
  projeto_id: string;
  data_inicio: string;
  data_fim: string | null;
  created_at: string;
  updated_at: string;
}

async function getEmpresaId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");
  const { data, error } = await supabase
    .from("profiles")
    .select("empresa_id")
    .eq("id", user.id)
    .single();
  if (error) throw error;
  if (!data?.empresa_id) throw new Error("Usuário não vinculado a uma empresa");
  return data.empresa_id;
}

export function useRecursos() {
  const queryClient = useQueryClient();

  const recursosQuery = useQuery({
    queryKey: ["recursos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recursos")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data as Recurso[];
    },
  });

  const custosQuery = useQuery({
    queryKey: ["recurso_custos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurso_custos")
        .select("*")
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return data as RecursoCusto[];
    },
  });

  const alocacoesQuery = useQuery({
    queryKey: ["recurso_alocacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurso_alocacoes")
        .select("*")
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return data as RecursoAlocacao[];
    },
  });

  const createRecurso = useMutation({
    mutationFn: async (input: {
      nome: string;
      tipo: TipoRecurso;
      unidade: UnidadeRecurso;
      custo_unitario: number;
      data_inicio: string;
      cargo?: string;
      placa?: string;
    }) => {
      const empresaId = await getEmpresaId();
      const insertData: any = { nome: input.nome, tipo: input.tipo, unidade: input.unidade, empresa_id: empresaId, status: "livre" };
      if (input.cargo) insertData.cargo = input.cargo;
      if (input.placa) insertData.placa = input.placa;
      const { data: recurso, error: rErr } = await supabase
        .from("recursos")
        .insert(insertData)
        .select()
        .single();
      if (rErr) throw rErr;

      const { error: cErr } = await supabase.from("recurso_custos").insert({
        recurso_id: recurso.id,
        custo_unitario: input.custo_unitario,
        data_inicio: input.data_inicio,
      });
      if (cErr) throw cErr;
      return recurso;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recursos"] });
      queryClient.invalidateQueries({ queryKey: ["recurso_custos"] });
      toast.success("Recurso criado com sucesso!");
    },
    onError: (e: Error) => toast.error("Erro ao criar recurso: " + e.message),
  });

  const updateCusto = useMutation({
    mutationFn: async (input: {
      recurso_id: string;
      custo_unitario: number;
      data_inicio: string;
      motivo?: string;
    }) => {
      const prevDay = new Date(input.data_inicio);
      prevDay.setDate(prevDay.getDate() - 1);
      const data_fim = prevDay.toISOString().split("T")[0];

      await supabase
        .from("recurso_custos")
        .update({ data_fim })
        .eq("recurso_id", input.recurso_id)
        .is("data_fim", null);

      const { error } = await supabase.from("recurso_custos").insert({
        recurso_id: input.recurso_id,
        custo_unitario: input.custo_unitario,
        data_inicio: input.data_inicio,
        motivo: input.motivo || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurso_custos"] });
      toast.success("Custo atualizado com sucesso!");
    },
    onError: (e: Error) => toast.error("Erro ao atualizar custo: " + e.message),
  });

  const updateRecurso = useMutation({
    mutationFn: async (input: { id: string; nome: string; ativo: boolean; cargo?: string | null; placa?: string | null }) => {
      const updateData: any = { nome: input.nome, ativo: input.ativo };
      if (input.cargo !== undefined) updateData.cargo = input.cargo;
      if (input.placa !== undefined) updateData.placa = input.placa;
      const { error } = await supabase
        .from("recursos")
        .update(updateData)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recursos"] });
      toast.success("Recurso atualizado!");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const deleteRecurso = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recursos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recursos"] });
      queryClient.invalidateQueries({ queryKey: ["recurso_custos"] });
      queryClient.invalidateQueries({ queryKey: ["recurso_alocacoes"] });
      toast.success("Recurso excluído!");
    },
    onError: (e: Error) => toast.error("Erro ao excluir: " + e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async (input: { id: string; status: string }) => {
      const { error } = await supabase
        .from("recursos")
        .update({ status: input.status } as any)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recursos"] });
      toast.success("Status atualizado!");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const alocarRecurso = useMutation({
    mutationFn: async (input: { recurso_id: string; site_id: string; projeto_id: string; data_inicio: string }) => {
      // Set status to alocado
      await supabase
        .from("recursos")
        .update({ status: "alocado" } as any)
        .eq("id", input.recurso_id);

      const { error } = await supabase.from("recurso_alocacoes").insert({
        recurso_id: input.recurso_id,
        site_id: input.site_id,
        projeto_id: input.projeto_id,
        data_inicio: input.data_inicio,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recursos"] });
      queryClient.invalidateQueries({ queryKey: ["recurso_alocacoes"] });
      toast.success("Recurso alocado com sucesso!");
    },
    onError: (e: Error) => toast.error("Erro ao alocar: " + e.message),
  });

  const liberarRecurso = useMutation({
    mutationFn: async (input: { alocacao_id: string; recurso_id: string }) => {
      const today = new Date().toISOString().split("T")[0];
      await supabase
        .from("recurso_alocacoes")
        .update({ data_fim: today } as any)
        .eq("id", input.alocacao_id);

      await supabase
        .from("recursos")
        .update({ status: "livre" } as any)
        .eq("id", input.recurso_id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recursos"] });
      queryClient.invalidateQueries({ queryKey: ["recurso_alocacoes"] });
      toast.success("Recurso liberado!");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  function getCustoAtual(recursoId: string): RecursoCusto | undefined {
    return custosQuery.data?.find(
      (c) => c.recurso_id === recursoId && c.data_fim === null
    );
  }

  function getHistorico(recursoId: string): RecursoCusto[] {
    return (custosQuery.data || []).filter((c) => c.recurso_id === recursoId);
  }

  function getAlocacaoAtiva(recursoId: string): RecursoAlocacao | undefined {
    return alocacoesQuery.data?.find(
      (a) => a.recurso_id === recursoId && a.data_fim === null
    );
  }

  function getAlocacoesBySite(siteId: string): RecursoAlocacao[] {
    return (alocacoesQuery.data || []).filter(
      (a) => a.site_id === siteId && a.data_fim === null
    );
  }

  return {
    recursos: recursosQuery.data || [],
    custos: custosQuery.data || [],
    alocacoes: alocacoesQuery.data || [],
    isLoading: recursosQuery.isLoading || custosQuery.isLoading || alocacoesQuery.isLoading,
    createRecurso,
    updateCusto,
    updateRecurso,
    deleteRecurso,
    updateStatus,
    alocarRecurso,
    liberarRecurso,
    getCustoAtual,
    getHistorico,
    getAlocacaoAtiva,
    getAlocacoesBySite,
  };
}
