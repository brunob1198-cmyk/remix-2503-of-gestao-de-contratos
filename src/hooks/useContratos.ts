import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Contrato } from "@/types/medicoes";
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

export function useContratos() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: contratos = [], isLoading } = useQuery({
    queryKey: ["contratos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      
      // Here we parse and structure the hierarchical relationship of additives
      const items = data as unknown as Contrato[];
      const parents = items.filter(c => !c.contrato_pai_id);
      
      return parents.map(parent => ({
        ...parent,
        aditivos: items.filter(c => c.contrato_pai_id === parent.id).sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      }));
    },
  });

  const createContrato = useMutation({
    mutationFn: async (contrato: Partial<Contrato>) => {
      const empresaId = await getEmpresaId();
      const { data, error } = await supabase
        .from("contratos")
        .insert([{ ...contrato, empresa_id: empresaId }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contratos"] });
      toast({ title: "Contrato salvo com sucesso!" });
    },
    onError: (error: Error) => {
      console.error("Erro ao salvar contrato:", error);
      toast({ title: "Erro ao salvar contrato", description: error.message, variant: "destructive" });
    },
  });

  const updateContrato = useMutation({
    mutationFn: async ({ id, ...contrato }: Partial<Contrato> & { id: string }) => {
      // Remove populated fields before sending to supabase
      const { aditivos, ...payload } = contrato;
      const { data, error } = await supabase
        .from("contratos")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contratos"] });
      toast({ title: "Contrato atualizado!" });
    },
    onError: (error: Error) => {
      console.error("Erro ao atualizar contrato:", error);
      toast({ title: "Erro ao atualizar contrato", description: error.message, variant: "destructive" });
    },
  });

  const deleteContrato = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contratos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contratos"] });
      toast({ title: "Contrato excluído!" });
    },
    onError: (error: Error) => {
      console.error("Erro ao excluir contrato:", error);
      toast({ title: "Erro ao excluir contrato", description: error.message, variant: "destructive" });
    },
  });

  return {
    contratos,
    isLoading,
    createContrato,
    updateContrato,
    deleteContrato,
  };
}
