import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_DEFAULTS } from "@/lib/queryClient";
import { supabase } from "@/integrations/supabase/client";
import { Site } from "@/types/medicoes";
import { useToast } from "@/hooks/use-toast";

export function useSites(projetoId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: sites = [], isLoading } = useQuery({
    queryKey: ["sites", projetoId],
    ...QUERY_DEFAULTS,
    staleTime: 1000 * 60 * 30, // Mantendo 30 min por ser um cadastro lento
    gcTime: 1000 * 60 * 60, // 1 hora
    queryFn: async () => {
      let query = supabase
        .from("sites")
        .select("*, projeto:projetos(*, clienteObj:clientes(*))")
        .order("codigo");
      
      if (projetoId) {
        query = query.eq("projeto_id", projetoId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Site[];
    },
  });

  const createSite = useMutation({
    mutationFn: async ({ cliente_id, ...site }: { projeto_id: string; codigo: string; nome: string; municipio?: string; uf?: string; cliente_id?: string }) => {
      const { error } = await supabase
        .from("sites")
        .insert([site]);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      toast({ title: "Site criado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar site", description: error.message, variant: "destructive" });
    },
  });

  const updateSite = useMutation({
    mutationFn: async ({ id, ...site }: Partial<Site> & { id: string }) => {
      const { data, error } = await supabase
        .from("sites")
        .update(site)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      toast({ title: "Site atualizado!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar site", description: error.message, variant: "destructive" });
    },
  });

  const deleteSite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sites").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      toast({ title: "Site excluído!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir site", description: error.message, variant: "destructive" });
    },
  });

  return {
    sites,
    isLoading,
    createSite,
    updateSite,
    deleteSite,
  };
}
