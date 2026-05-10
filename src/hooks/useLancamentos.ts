import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LancamentoProducao, LancamentoMedicao, LancamentoFaturamento } from "@/types/medicoes";
import { useToast } from "@/hooks/use-toast";

export function useLancamentosProducao(siteId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: lancamentos = [], isLoading } = useQuery({
    queryKey: ["lancamentos_producao", siteId],
    queryFn: async () => {
      let allData: LancamentoProducao[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from("lancamentos_producao")
          .select("*, site:sites(*, projeto:projetos(*)), item_lpu:itens_lpu(id, codigo, descricao, unidade, preco_unitario)")
          .order("id")
          .range(from, from + 1000 - 1);
        
        if (siteId) {
          query = query.eq("site_id", siteId);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allData = [...allData, ...(data as LancamentoProducao[])];
          if (data.length < 1000) {
            hasMore = false;
          } else {
            from += 1000;
          }
        }
      }
      return allData;
    },
  });

  const createLancamento = useMutation({
    mutationFn: async (lancamento: { site_id: string; item_lpu_id: string; data_producao: string; quantidade: number; empresa_executora?: string; uf?: string; municipio?: string; observacao?: string }) => {
      const { data, error } = await supabase
        .from("lancamentos_producao")
        .insert([lancamento])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lancamentos_producao"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({ title: "Produção lançada com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao lançar produção", description: error.message, variant: "destructive" });
    },
  });

  const bulkCreateLancamento = useMutation({
    mutationFn: async (lancamentos: { site_id: string; item_lpu_id: string; data_producao: string; quantidade: number; empresa_executora?: string; uf?: string; municipio?: string; observacao?: string }[]) => {
      const { data, error } = await supabase
        .from("lancamentos_producao")
        .insert(lancamentos)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["lancamentos_producao"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({ title: `${data.length} produções importadas com sucesso!` });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao importar produções", description: error.message, variant: "destructive" });
    },
  });

  const deleteLancamento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lancamentos_producao").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lancamentos_producao"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({ title: "Lançamento excluído!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir lançamento", description: error.message, variant: "destructive" });
    },
  });

  const bulkDeleteLancamento = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("lancamentos_producao").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["lancamentos_producao"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({ title: `${ids.length} lançamentos excluídos!` });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir lançamentos", description: error.message, variant: "destructive" });
    },
  });

  return { lancamentos, isLoading, createLancamento, bulkCreateLancamento, deleteLancamento, bulkDeleteLancamento };
}

export function useLancamentosMedicao(siteId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: lancamentos = [], isLoading, refetch } = useQuery({
    queryKey: ["lancamentos_medicao", siteId],
    queryFn: async () => {
      let allData: LancamentoMedicao[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from("lancamentos_medicao")
          .select("*, site:sites(*, projeto:projetos(*)), item_lpu:itens_lpu(id, codigo, descricao, unidade, preco_unitario)")
          .order("id")
          .range(from, from + 1000 - 1);
        
        if (siteId) {
          query = query.eq("site_id", siteId);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allData = [...allData, ...(data as LancamentoMedicao[])];
          if (data.length < 1000) {
            hasMore = false;
          } else {
            from += 1000;
          }
        }
      }
      return allData;
    },
  });

  const createLancamento = useMutation({
    mutationFn: async (lancamento: { site_id?: string; item_lpu_id: string; data_medicao: string; quantidade: number; numero_medicao?: string; status?: string; observacao?: string }) => {
      const { data, error } = await supabase
        .from("lancamentos_medicao")
        .insert([lancamento])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lancamentos_medicao"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({ title: "Medição lançada com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao lançar medição", description: error.message, variant: "destructive" });
    },
  });

  const bulkCreateLancamento = useMutation({
    mutationFn: async (lancamentos: { site_id?: string; item_lpu_id: string; data_medicao: string; quantidade: number; numero_medicao?: string; status?: string; observacao?: string; capa_url?: string | null }[]) => {
      const { data, error } = await supabase
        .from("lancamentos_medicao")
        .insert(lancamentos)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["lancamentos_medicao"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({ title: `${data.length} medições importadas com sucesso!` });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao importar medições", description: error.message, variant: "destructive" });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await supabase
        .from("lancamentos_medicao")
        .update({ status })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lancamentos_medicao"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({ title: "Status atualizado!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" });
    },
  });

  const updateMedicaoFields = useMutation({
    mutationFn: async ({ id, ...fields }: { id: string; status?: string; numero_po?: string; observacao_acompanhamento?: string }) => {
      const { data, error } = await supabase
        .from("lancamentos_medicao")
        .update(fields)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lancamentos_medicao"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({ title: "Medição atualizada!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar medição", description: error.message, variant: "destructive" });
    },
  });

  const bulkUpdateMedicaoFields = useMutation({
    mutationFn: async (updates: { ids: string[]; status?: string; numero_po?: string; observacao_acompanhamento?: string; data_resposta?: string; quantidade_aprovada?: number; quantidade_rejeitada?: number; quantidade_pendente?: number }) => {
      const { ids, ...fields } = updates;
      const { error } = await supabase
        .from("lancamentos_medicao")
        .update(fields)
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lancamentos_medicao"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({ title: "Medições atualizadas!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar medições", description: error.message, variant: "destructive" });
    },
  });

  const bulkDeleteMedicao = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("lancamentos_medicao").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["lancamentos_medicao"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({ title: `${ids.length} lançamentos de medição excluídos!` });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir medições", description: error.message, variant: "destructive" });
    },
  });

  const deleteLancamento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lancamentos_medicao").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lancamentos_medicao"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({ title: "Lançamento excluído!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir lançamento", description: error.message, variant: "destructive" });
    },
  });

  return { lancamentos, isLoading, refetch, createLancamento, bulkCreateLancamento, updateStatus, updateMedicaoFields, bulkUpdateMedicaoFields, bulkDeleteMedicao, deleteLancamento };
}

export function useLancamentosFaturamento(siteId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: lancamentos = [], isLoading } = useQuery({
    queryKey: ["lancamentos_faturamento", siteId],
    queryFn: async () => {
      let allData: LancamentoFaturamento[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from("lancamentos_faturamento")
          .select("*, site:sites(*, projeto:projetos(*)), item_lpu:itens_lpu(id, codigo, descricao, unidade, preco_unitario)")
          .order("id")
          .range(from, from + 1000 - 1);
        
        if (siteId) {
          query = query.eq("site_id", siteId);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allData = [...allData, ...(data as LancamentoFaturamento[])];
          if (data.length < 1000) {
            hasMore = false;
          } else {
            from += 1000;
          }
        }
      }
      return allData;
    },
  });

  const createLancamento = useMutation({
    mutationFn: async (lancamento: { site_id: string; item_lpu_id: string; data_faturamento: string; quantidade: number; numero_nf?: string; numero_po?: string; valor_faturado?: number; observacao?: string }) => {
      const { data, error } = await supabase
        .from("lancamentos_faturamento")
        .insert([lancamento])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lancamentos_faturamento"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({ title: "Faturamento lançado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao lançar faturamento", description: error.message, variant: "destructive" });
    },
  });

  const bulkCreateLancamento = useMutation({
    mutationFn: async (lancamentos: { site_id: string; item_lpu_id: string; data_faturamento: string; quantidade: number; numero_nf?: string; numero_po?: string; valor_faturado?: number; observacao?: string }[]) => {
      const { data, error } = await supabase
        .from("lancamentos_faturamento")
        .insert(lancamentos)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["lancamentos_faturamento"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({ title: `${data.length} faturamentos importados com sucesso!` });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao importar faturamentos", description: error.message, variant: "destructive" });
    },
  });

  const deleteLancamento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lancamentos_faturamento").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lancamentos_faturamento"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({ title: "Lançamento excluído!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir lançamento", description: error.message, variant: "destructive" });
    },
  });

  return { lancamentos, isLoading, createLancamento, bulkCreateLancamento, deleteLancamento };
}
