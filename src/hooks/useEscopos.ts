import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EscopoItem } from "@/types/medicoes";
import { useToast } from "@/hooks/use-toast";
import type { Json } from "@/integrations/supabase/types";

export function useEscopos(siteId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["escopo_itens", siteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("escopo_itens")
        .select("*")
        .eq("site_id", siteId)
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      return data as EscopoItem[];
    },
    enabled: !!siteId,
  });

  const saveEscopo = useMutation({
    mutationFn: async (novosItens: EscopoItem[]) => {
      // 1. Delete existing items
      const { error: deleteError } = await supabase
        .from("escopo_itens")
        .delete()
        .eq("site_id", siteId);
      if (deleteError) throw deleteError;

      // 2. Insert new items
      if (novosItens.length > 0) {
        const itemsToInsert = novosItens.map(item => {
          const { id, created_at, updated_at, ...rest } = item;
          return rest;
        });

        const { error: insertError } = await supabase
          .from("escopo_itens")
          .insert(itemsToInsert);
        if (insertError) throw insertError;
      }

      // 3. Save History
      const { error: historyError } = await supabase
        .from("escopos_historico")
        .insert([{ site_id: siteId, snapshot: novosItens as unknown as Json }]);
      if (historyError) throw historyError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["escopo_itens", siteId] });
      toast({ title: "Escopo salvo", description: "O escopo da obra foi atualizado com sucesso." });
    },
    onError: (error: Error) => {
      console.error(error);
      toast({ title: "Erro ao salvar escopo", description: error.message, variant: "destructive" });
    },
  });

  return {
    itens,
    isLoading,
    saveEscopo,
  };
}
