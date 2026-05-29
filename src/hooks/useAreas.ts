import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Area } from "@/types/medicoes";

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

export function useAreas() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: areas = [], isLoading } = useQuery({
    queryKey: ["areas"],
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,

    queryFn: async () => {
      const { data, error } = await supabase
        .from("areas")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data as Area[];
    },
  });

  const createArea = useMutation({
    mutationFn: async (area: { nome: string; descricao?: string }) => {
      const empresaId = await getEmpresaId();
      const { error } = await supabase
        .from("areas")
        .insert([{ ...area, empresa_id: empresaId }]);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["areas"] });
      toast({ title: "Área criada com sucesso!" });
    },
    onError: (error: any) => {
      console.error("Erro ao criar área:", error);
      toast({ 
        title: "Erro ao criar", 
        description: error?.code === "23505" ? "Já existe uma área com esse nome" : error.message, 
        variant: "destructive" 
      });
    },
  });

  const updateArea = useMutation({
    mutationFn: async ({ id, ...area }: Partial<Area> & { id: string }) => {
      const { data, error } = await supabase
        .from("areas")
        .update(area)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["areas"] });
      toast({ title: "Área atualizada!" });
    },
    onError: (error: Error) => {
      console.error("Erro ao atualizar área:", error);
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });

  const deleteArea = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("areas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["areas"] });
      toast({ title: "Área excluída!" });
    },
    onError: (error: any) => {
      console.error("Erro ao excluir área:", error);
      // Pega erro de Foreign Key Violation (Postgres 23503) "update or delete on table violates foreign key constraint"
      if (error?.code === "23503" || error?.message?.includes("violates foreign key constraint")) {
        toast({ 
          title: "Não é possível excluir", 
          description: "Esta área não pode ser deletada pois existem projetos já vinculados a ela.", 
          variant: "destructive" 
        });
      } else {
        toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      }
    },
  });

  return {
    areas,
    isLoading,
    createArea,
    updateArea,
    deleteArea,
  };
}
