import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

export function useBdiConfig() {
  return useQuery({
    queryKey: ["projetos-bdi-config"],
    staleTime: 60_000,
    queryFn: async () => {
      const empresaId = await getEmpresaId();
      const { data, error } = await supabase
        .from("projetos")
        .select("id, codigo, nome, bdi_variavel, bdi_padrao")
        .eq("empresa_id", empresaId)
        .order("codigo");
      if (error) throw error;
      return data;
    },
  });
}

export function useBdiMensal(projetoId: string | null) {
  return useQuery({
    queryKey: ["bdi-mensal", projetoId],
    staleTime: 60_000,
    enabled: !!projetoId,
    queryFn: async () => {
      if (!projetoId) return [];
      const { data, error } = await supabase
        .from("projeto_bdi_mensal")
        .select("id, projeto_id, competencia, bdi, observacao, created_at")
        .eq("projeto_id", projetoId)
        .order("competencia", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useToggleBdiVariavel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, bdi_variavel, bdi_padrao }: { id: string; bdi_variavel: boolean; bdi_padrao?: number | null }) => {
      const updates: any = { bdi_variavel };
      if (bdi_padrao !== undefined) updates.bdi_padrao = bdi_padrao;
      
      const { error } = await supabase.from("projetos").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projetos-bdi-config"] });
      toast({ title: "Configuração de BDI atualizada!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
}

export function useAddBdiMensal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ projetoId, mesCompetencia, bdi, observacao }: { projetoId: string; mesCompetencia: string; bdi: number; observacao?: string }) => {
      // Normalizar para dia 1 do mês: "YYYY-MM" -> "YYYY-MM-01"
      const d = new Date(mesCompetencia + "-02"); // dia 2 para evitar fuso horário
      const competencia = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];

      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from("projeto_bdi_mensal").insert({
        projeto_id: projetoId,
        competencia,
        bdi,
        observacao,
        criado_por: user?.id,
      });
      if (error) {
        if (error.code === "23505") { // UNIQUE constraint violation
          throw new Error("Já existe BDI cadastrado para este mês. Use a opção de editar.");
        }
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["bdi-mensal", variables.projetoId] });
      toast({ title: "BDI mensal cadastrado com sucesso!" });
    },
    onError: (e: Error) => toast({ title: "Erro ao adicionar BDI", description: e.message, variant: "destructive" }),
  });
}

export function useUpdateBdiMensal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, bdi, observacao }: { id: string; bdi: number; observacao?: string }) => {
      const { error } = await supabase.from("projeto_bdi_mensal").update({ bdi, observacao }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      // Invalida para todos os projetos, pois não passamos o projetoId aqui. Ou invalidamos genérico.
      queryClient.invalidateQueries({ queryKey: ["bdi-mensal"] });
      toast({ title: "BDI mensal atualizado!" });
    },
    onError: (e: Error) => toast({ title: "Erro ao atualizar BDI", description: e.message, variant: "destructive" }),
  });
}

export function useDeleteBdiMensal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projeto_bdi_mensal").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bdi-mensal"] });
      toast({ title: "BDI mensal removido!" });
    },
    onError: (e: Error) => toast({ title: "Erro ao remover BDI", description: e.message, variant: "destructive" }),
  });
}
