import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ItemLpu } from "@/types/medicoes";
import { useToast } from "@/hooks/use-toast";

export function useItensLpu(projetoId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: itensLpu = [], isLoading } = useQuery({
    queryKey: ["itens_lpu", projetoId],
    staleTime: 1000 * 60 * 30, // 30 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
    queryFn: async () => {
      let query = supabase
        .from("itens_lpu")
        .select("*, projeto:projetos(*)")
        .order("codigo");
      
      if (projetoId) {
        query = query.eq("projeto_id", projetoId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as ItemLpu[];
    },
  });

  const createItemLpu = useMutation({
    mutationFn: async (item: { codigo: string; descricao: string; unidade?: string; preco_unitario?: number; bdi?: number; categoria?: string; projeto_id?: string }) => {
      const { data, error } = await supabase
        .from("itens_lpu")
        .insert([item])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["itens_lpu"] });
      toast({ title: "Item LPU criado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar item LPU", description: error.message, variant: "destructive" });
    },
  });

  const importItensLpu = useMutation({
    mutationFn: async (itens: { codigo: string; descricao: string; unidade?: string; preco_unitario?: number; bdi?: number; categoria?: string; projeto_id?: string }[]) => {
      const { data, error } = await supabase
        .from("itens_lpu")
        .insert(itens)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["itens_lpu"] });
      toast({ title: `${data?.length || 0} itens importados com sucesso!` });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao importar itens LPU", description: error.message, variant: "destructive" });
    },
  });

  const updateItemLpu = useMutation({
    mutationFn: async ({ id, ...item }: Partial<ItemLpu> & { id: string }) => {
      const { data, error } = await supabase
        .from("itens_lpu")
        .update(item)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["itens_lpu"] });
      toast({ title: "Item LPU atualizado!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar item LPU", description: error.message, variant: "destructive" });
    },
  });

  const deleteItemLpu = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("itens_lpu").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["itens_lpu"] });
      toast({ title: "Item LPU excluído!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir item LPU", description: error.message, variant: "destructive" });
    },
  });

  return {
    itensLpu,
    isLoading,
    createItemLpu,
    importItensLpu,
    updateItemLpu,
    deleteItemLpu,
  };
}
