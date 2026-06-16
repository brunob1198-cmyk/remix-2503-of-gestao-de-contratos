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
        .select(`
          id, codigo, descricao, unidade, preco_unitario, bdi, categoria, projeto_id, created_at, updated_at, 
          projeto:projetos(id, codigo, nome),
          item_lpu_bdi_mensal(id, mes_referencia, bdi)
        `)
        .order("codigo");
      
      if (projetoId) {
        query = query.eq("projeto_id", projetoId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown) as ItemLpu[];
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
    mutationFn: async ({ itens, mes_referencia }: { 
      itens: { codigo: string; descricao: string; unidade?: string; preco_unitario?: number; bdi?: number; categoria?: string; projeto_id?: string }[];
      mes_referencia?: string;
    }) => {
      // 1. Inserir (ou atualizar se houver conflito, caso configurado no DB) os itens na LPU
      // Nota: Como não temos certeza da unique key, usamos upsert tentando codigo,projeto_id ou insert fallback.
      // 1. Separar itens em novos (insert) e existentes (update)
      // Agrupar por projeto_id para buscar
      const projetoIds = [...new Set(itens.map(i => i.projeto_id))];
      
      const { data: existingItems } = await supabase
        .from("itens_lpu")
        .select("id, codigo, projeto_id")
        .in("projeto_id", projetoIds);
        
      const existingMap = new Map();
      (existingItems || []).forEach(item => {
        existingMap.set(`${item.codigo}-${item.projeto_id}`, item.id);
      });

      const toInsert: any[] = [];
      const toUpdate: any[] = [];

      itens.forEach(item => {
        const existingId = existingMap.get(`${item.codigo}-${item.projeto_id}`);
        if (existingId) {
          toUpdate.push({ ...item, id: existingId });
        } else {
          toInsert.push(item);
        }
      });

      let finalData: any[] = [];

      if (toInsert.length > 0) {
        const { data: inserted, error: insertError } = await supabase
          .from("itens_lpu")
          .insert(toInsert)
          .select();
        if (insertError) throw insertError;
        if (inserted) finalData = [...finalData, ...inserted];
      }

      if (toUpdate.length > 0) {
        const { data: updated, error: updateError } = await supabase
          .from("itens_lpu")
          .upsert(toUpdate, { onConflict: "id" })
          .select();
        if (updateError) throw updateError;
        if (updated) finalData = [...finalData, ...updated];
      }

      // 2. Se houver mês de vigência, gravar na tabela item_lpu_bdi_mensal
      if (mes_referencia && finalData.length > 0) {
        const bdiMensalData = finalData.map(item => ({
          item_lpu_id: item.id,
          mes_referencia,
          bdi: item.bdi || 1
        }));
        
        const { error: bdiError } = await (supabase as any)
          .from("item_lpu_bdi_mensal")
          .upsert(bdiMensalData, { onConflict: "item_lpu_id,mes_referencia" });
          
        if (bdiError) {
          console.error("Erro ao inserir BDI mensal", bdiError);
        }
      }

      return finalData;
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
      // Remover propriedades que não pertencem à tabela itens_lpu
      const { projeto, created_at, updated_at, ...cleanItem } = item as any;
      
      const { data, error } = await supabase
        .from("itens_lpu")
        .update(cleanItem)
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
