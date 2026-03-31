import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Projeto } from "@/types/medicoes";
import { useToast } from "@/hooks/use-toast";

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

export function useProjetos() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: projetos = [], isLoading } = useQuery({
    queryKey: ["projetos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select("*, clienteObj:clientes(*), contratoObj:contratos(*)")
        .order("codigo");
      if (error) throw error;
      return data as unknown as Projeto[];
    },
  });

  const createProjeto = useMutation({
    mutationFn: async (projeto: { codigo: string; nome: string; descricao?: string; coordenador?: string; cliente?: string; cliente_id?: string; contrato_id?: string; valor_total?: number; status?: string }) => {
      const empresaId = await getEmpresaId();
      const { error } = await supabase
        .from("projetos")
        .insert([{ ...projeto, empresa_id: empresaId }]);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projetos"] });
      toast({ title: "Projeto criado com sucesso!" });
    },
    onError: (error: Error) => {
      console.error("Erro ao criar projeto:", error);
      toast({ title: "Erro ao criar projeto", description: error.message, variant: "destructive" });
    },
  });

  const updateProjeto = useMutation({
    mutationFn: async ({ id, ...projeto }: Partial<Projeto> & { id: string }) => {
      const { data, error } = await supabase
        .from("projetos")
        .update(projeto)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projetos"] });
      toast({ title: "Projeto atualizado!" });
    },
    onError: (error: Error) => {
      console.error("Erro ao atualizar projeto:", error);
      toast({ title: "Erro ao atualizar projeto", description: error.message, variant: "destructive" });
    },
  });

  const deleteProjeto = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projetos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projetos"] });
      toast({ title: "Projeto excluído!" });
    },
    onError: (error: Error) => {
      console.error("Erro ao excluir projeto:", error);
      toast({ title: "Erro ao excluir projeto", description: error.message, variant: "destructive" });
    },
  });

  return {
    projetos,
    isLoading,
    createProjeto,
    updateProjeto,
    deleteProjeto,
  };
}
