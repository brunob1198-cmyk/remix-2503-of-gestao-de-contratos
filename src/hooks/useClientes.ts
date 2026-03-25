import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Cliente } from "@/types/medicoes";
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

export function useClientes() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("clientes" as any)
        .select("*")
        .order("razao_social") as any);
      if (error) throw error;
      return (data || []) as Cliente[];
    },
  });

  const createCliente = useMutation({
    mutationFn: async (cliente: { razao_social: string; cnpj?: string; cep?: string; endereco_completo?: string; logo_url?: string }) => {
      const empresaId = await getEmpresaId();
      const { error } = await (supabase
        .from("clientes" as any)
        .insert([{ ...cliente, empresa_id: empresaId }] as any) as any);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      toast({ title: "Cliente cadastrado com sucesso!" });
    },
    onError: (error: Error) => {
      console.error("Erro ao cadastrar cliente:", error);
      toast({ title: "Erro ao cadastrar cliente", description: error.message, variant: "destructive" });
    },
  });

  const updateCliente = useMutation({
    mutationFn: async ({ id, ...cliente }: Partial<Cliente> & { id: string }) => {
      const { data, error } = await (supabase
        .from("clientes" as any)
        .update(cliente as any)
        .eq("id", id)
        .select()
        .single() as any);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      toast({ title: "Cliente atualizado!" });
    },
    onError: (error: Error) => {
      console.error("Erro ao atualizar cliente:", error);
      toast({ title: "Erro ao atualizar cliente", description: error.message, variant: "destructive" });
    },
  });

  const deleteCliente = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("clientes" as any).delete().eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      toast({ title: "Cliente excluído!" });
    },
    onError: (error: Error) => {
      console.error("Erro ao excluir cliente:", error);
      toast({ title: "Erro ao excluir cliente", description: "Verifique se o cliente não está atrelado a um projeto ou site existente.", variant: "destructive" });
    },
  });

  return {
    clientes,
    isLoading,
    createCliente,
    updateCliente,
    deleteCliente,
  };
}
