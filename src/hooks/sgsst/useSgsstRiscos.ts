import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type CategoriaRisco = "Físico" | "Químico" | "Biológico" | "Ergonômico" | "Acidente" | "Outros";

export interface SgsstRisco {
  id: string;
  empresa_id: string;
  codigo?: string | null;
  nome: string;
  categoria: CategoriaRisco;
  descricao?: string | null;
  agente?: string | null;
  fonte_geradora?: string | null;
  consequencia?: string | null;
  status: "ativo" | "inativo";
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type SgsstRiscoInput = Omit<SgsstRisco, "id" | "empresa_id" | "created_at" | "updated_at">;

export function useSgsstRiscos() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const { data: riscos = [], isLoading, error, refetch } = useQuery({
    queryKey: ["sgsst_riscos", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_riscos_catalogo" as any)
        .select("*")
        .order("categoria", { ascending: true })
        .order("nome", { ascending: true }) as any);

      if (error) throw error;
      return (data as SgsstRisco[]) || [];
    },
  });

  const createRisco = useMutation({
    mutationFn: async (input: SgsstRiscoInput) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data, error } = await (supabase
        .from("sgsst_riscos_catalogo" as any)
        .insert({
          ...input,
          empresa_id: empresaId,
          created_by: profile?.id,
          updated_by: profile?.id,
        })
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstRisco;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_riscos"] });
      toast.success("Risco cadastrado com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao cadastrar risco: ${err.message || err}`);
    },
  });

  const updateRisco = useMutation({
    mutationFn: async ({ id, ...input }: Partial<SgsstRiscoInput> & { id: string }) => {
      const { data, error } = await (supabase
        .from("sgsst_riscos_catalogo" as any)
        .update({
          ...input,
          updated_by: profile?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstRisco;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_riscos"] });
      toast.success("Risco atualizado com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar risco: ${err.message || err}`);
    },
  });

  const removeRisco = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_riscos_catalogo" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_riscos"] });
      toast.success("Risco removido com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover risco: ${err.message || err}`);
    },
  });

  return {
    riscos,
    isLoading,
    error,
    refetch,
    createRisco,
    updateRisco,
    removeRisco,
  };
}
