import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface SgsstFuncao {
  id: string;
  empresa_id: string;
  nome: string;
  cbo?: string | null;
  descricao?: string | null;
  requisitos_minimos?: string | null;
  status: "ativo" | "inativo";
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type SgsstFuncaoInput = Omit<SgsstFuncao, "id" | "empresa_id" | "created_at" | "updated_at">;

export function useSgsstFuncoes() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const { data: funcoes = [], isLoading, error, refetch } = useQuery({
    queryKey: ["sgsst_funcoes", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_funcoes" as any)
        .select("*")
        .order("nome", { ascending: true }) as any);

      if (error) throw error;
      return (data as SgsstFuncao[]) || [];
    },
  });

  const createFuncao = useMutation({
    mutationFn: async (input: SgsstFuncaoInput) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data, error } = await (supabase
        .from("sgsst_funcoes" as any)
        .insert({
          ...input,
          empresa_id: empresaId,
          created_by: profile?.id,
        })
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstFuncao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_funcoes"] });
      toast.success("Função cadastrada com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao cadastrar função: ${err.message || err}`);
    },
  });

  const updateFuncao = useMutation({
    mutationFn: async ({ id, ...input }: Partial<SgsstFuncaoInput> & { id: string }) => {
      const { data, error } = await (supabase
        .from("sgsst_funcoes" as any)
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstFuncao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_funcoes"] });
      toast.success("Função atualizada com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar função: ${err.message || err}`);
    },
  });

  const removeFuncao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_funcoes" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_funcoes"] });
      toast.success("Função removida com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover função: ${err.message || err}`);
    },
  });

  return {
    funcoes,
    isLoading,
    error,
    refetch,
    createFuncao,
    updateFuncao,
    removeFuncao,
  };
}
