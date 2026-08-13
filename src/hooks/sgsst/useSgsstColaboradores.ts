import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface SgsstColaboradorDados {
  id: string;
  empresa_id: string;
  profile_id?: string | null;
  recurso_id?: string | null;
  funcao_id?: string | null;
  area_id?: string | null;
  matricula?: string | null;
  data_admissao?: string | null;
  data_demissao?: string | null;
  tipo_vinculo: "CLT" | "PJ" | "Terceirizado" | "Estagiario" | "Outro";
  status: "ativo" | "afastado" | "desligado";
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  // Joined Data
  profile?: { id: string; nome: string | null; avatar_url: string | null; cpf: string | null; cargo: string | null } | null;
  recurso?: { id: string; nome: string; cargo: string | null; tipo: string } | null;
  funcao?: { id: string; nome: string; cbo: string | null } | null;
  area?: { id: string; nome: string } | null;
}

export type SgsstColaboradorInput = Omit<
  SgsstColaboradorDados,
  "id" | "empresa_id" | "created_at" | "updated_at" | "profile" | "recurso" | "funcao" | "area"
>;

export function useSgsstColaboradores() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const { data: colaboradores = [], isLoading, error, refetch } = useQuery({
    queryKey: ["sgsst_colaboradores", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_colaborador_dados" as any)
        .select(`
          *,
          profile:profiles(id, nome, avatar_url, cpf, cargo),
          recurso:recursos(id, nome, cargo, tipo),
          funcao:sgsst_funcoes(id, nome, cbo),
          area:areas(id, nome)
        `)
        .order("created_at", { ascending: false }) as any);

      if (error) throw error;
      return (data as SgsstColaboradorDados[]) || [];
    },
  });

  const createColaborador = useMutation({
    mutationFn: async (input: SgsstColaboradorInput) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data, error } = await (supabase
        .from("sgsst_colaborador_dados" as any)
        .insert({
          ...input,
          empresa_id: empresaId,
          created_by: profile?.id,
        })
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstColaboradorDados;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_colaboradores"] });
      toast.success("Dados do colaborador cadastrados com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao cadastrar colaborador: ${err.message || err}`);
    },
  });

  const updateColaborador = useMutation({
    mutationFn: async ({ id, ...input }: Partial<SgsstColaboradorInput> & { id: string }) => {
      const { data, error } = await (supabase
        .from("sgsst_colaborador_dados" as any)
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstColaboradorDados;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_colaboradores"] });
      toast.success("Dados do colaborador atualizados com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar colaborador: ${err.message || err}`);
    },
  });

  const removeColaborador = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_colaborador_dados" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_colaboradores"] });
      toast.success("Registro de colaborador removido com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover colaborador: ${err.message || err}`);
    },
  });

  return {
    colaboradores,
    isLoading,
    error,
    refetch,
    createColaborador,
    updateColaborador,
    removeColaborador,
  };
}
