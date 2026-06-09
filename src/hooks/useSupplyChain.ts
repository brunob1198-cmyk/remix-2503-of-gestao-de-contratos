import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toast } from "sonner";

// Friendly labels used in realtime notifications
const PEDIDO_STATUS_LABELS: Record<string, string> = {
  emitido: "Emitido",
  confirmado: "Confirmado pelo fornecedor",
  em_transito: "Em trânsito",
  saiu_para_entrega: "Saiu para entrega",
  entregue_parcial: "Entregue parcialmente",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

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

// ─── Fornecedores ───
export function useFornecedores() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: fornecedores = [], isLoading } = useQuery({
    queryKey: ["fornecedores"],
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fornecedores")
        .select("*")
        .order("razao_social");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (f: any) => {
      const empresaId = await getEmpresaId();
      const { error } = await supabase.from("fornecedores").insert({ ...f, empresa_id: empresaId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      toast({ title: "Fornecedor cadastrado!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...f }: any) => {
      const { error } = await supabase.from("fornecedores").update(f).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      toast({ title: "Fornecedor atualizado!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fornecedores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      toast({ title: "Fornecedor excluído!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const bulkCreate = useMutation({
    mutationFn: async (items: { razao_social: string; cnpj?: string; contato_nome?: string; contato_email?: string; contato_telefone?: string; endereco?: string; categoria?: string; observacoes?: string }[]) => {
      const empresaId = await getEmpresaId();
      const BATCH_SIZE = 500;
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE).map(item => ({ ...item, empresa_id: empresaId }));
        const { error } = await supabase.from("fornecedores").insert(batch);
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      toast({ title: `${vars.length} fornecedores importados com sucesso!` });
    },
    onError: (e: Error) => toast({ title: "Erro na importação", description: e.message, variant: "destructive" }),
  });

  return { fornecedores, isLoading, create, update, remove, bulkCreate };
}

// ─── SC Itens ───
export function useScItens() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["sc_itens"],
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.from("sc_itens").select("*").order("codigo");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (item: any) => {
      const empresaId = await getEmpresaId();
      const { error } = await supabase.from("sc_itens").insert({ ...item, empresa_id: empresaId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sc_itens"] });
      toast({ title: "Item cadastrado!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...item }: any) => {
      const { error } = await supabase.from("sc_itens").update(item).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sc_itens"] });
      toast({ title: "Item atualizado!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sc_itens").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sc_itens"] });
      toast({ title: "Item excluído!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const bulkCreate = useMutation({
    mutationFn: async (items: { codigo: string; descricao: string; unidade: string; categoria?: string; especificacao?: string }[]) => {
      const empresaId = await getEmpresaId();
      const BATCH_SIZE = 500;
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE).map(item => ({ ...item, empresa_id: empresaId }));
        const { error } = await supabase.from("sc_itens").upsert(batch, { onConflict: "empresa_id,codigo", ignoreDuplicates: false });
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["sc_itens"] });
      toast({ title: `${vars.length} itens importados com sucesso!` });
    },
    onError: (e: Error) => toast({ title: "Erro na importação", description: e.message, variant: "destructive" }),
  });

  return { itens, isLoading, create, update, remove, bulkCreate };
}

// ─── Requisições de Compra ───
export function useRequisicoes() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: requisicoes = [], isLoading } = useQuery({
    queryKey: ["requisicoes_compra"],
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requisicoes_compra")
        .select("*, projeto:projetos(nome, codigo), local_entrega:sc_locais(nome), itens:requisicao_itens(*, sc_item:sc_itens(codigo, descricao))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (req: any) => {
      const empresaId = await getEmpresaId();
      const { data: { user } } = await supabase.auth.getUser();
      const itens = req.itens || [];
      const reqData = { ...req };
      delete reqData.itens;
      
      // Get the next RC number atomically using a function or a more reliable method
      // For now, let's at least wrap it better. 
      // Ideally, this should be a DB trigger or a function to avoid collisions
      const { data: countData, error: countErr } = await supabase
        .from("requisicoes_compra")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId);
      
      if (countErr) throw countErr;
      const numero = `RC-${String((countData || 0) + 1).padStart(4, "0")}`;

      const { data, error } = await supabase
        .from("requisicoes_compra")
        .insert({ ...reqData, empresa_id: empresaId, solicitante_id: user!.id, numero, workflow_status: 'DRAFT' })
        .select()
        .single();
      if (error) throw error;

      if (itens.length > 0) {
        const { error: itemErr } = await supabase
          .from("requisicao_itens")
          .insert(itens.map((i: any) => ({ ...i, requisicao_id: data.id })));
        if (itemErr) throw itemErr;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requisicoes_compra"] });
      toast({ title: "Requisição criada!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, workflow_status }: { id: string; status?: string; workflow_status?: string }) => {
      const updates: any = {};
      if (status) updates.status = status;
      if (workflow_status) updates.workflow_status = workflow_status;
      
      const { error } = await supabase.from("requisicoes_compra").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requisicoes_compra"] });
      toast({ title: "Status atualizado!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const getHistorico = (requisicaoId: string) => {
    return useQuery({
      queryKey: ["requisicao_historico", requisicaoId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("requisicao_historico")
          .select("*, profiles(nome)")
          .eq("requisicao_id", requisicaoId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return data;
      },
      enabled: !!requisicaoId,
    });
  };

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("requisicoes_compra").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requisicoes_compra"] });
      toast({ title: "Requisição excluída!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return { requisicoes, isLoading, create, updateStatus, remove, getHistorico };
}

// ─── Cotações ───
export function useCotacoes(requisicaoId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: cotacoes = [], isLoading } = useQuery({
    queryKey: ["cotacoes", requisicaoId],
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      let q = supabase
        .from("cotacoes")
        .select("*, fornecedor:fornecedores(razao_social), itens:cotacao_itens(*, req_item:requisicao_itens(descricao_livre, sc_item:sc_itens(codigo, descricao)))")
        .order("created_at", { ascending: false });
      if (requisicaoId) q = q.eq("requisicao_id", requisicaoId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: requisicaoId !== undefined ? !!requisicaoId : true,
  });

  const create = useMutation({
    mutationFn: async (cot: any) => {
      const empresaId = await getEmpresaId();
      const itens = cot.itens || [];
      delete cot.itens;

      const count = await supabase
        .from("cotacoes")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId);
      const numero = `COT-${String((count.count || 0) + 1).padStart(4, "0")}`;

      const { data, error } = await supabase
        .from("cotacoes")
        .insert({ ...cot, empresa_id: empresaId, numero })
        .select()
        .single();
      if (error) throw error;

      if (itens.length > 0) {
        const { error: itemErr } = await supabase
          .from("cotacao_itens")
          .insert(itens.map((i: any) => ({ ...i, cotacao_id: data.id })));
        if (itemErr) throw itemErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cotacoes"] });
      toast({ title: "Cotação registrada!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("cotacoes").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cotacoes"] });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return { cotacoes, isLoading, create, updateStatus };
}

// ─── Pedidos de Compra ───
export function usePedidosCompra() {
  const queryClient = useQueryClient();
  const queryClientRef = useRef(queryClient);

  useEffect(() => {
    queryClientRef.current = queryClient;
  }, [queryClient]);

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["pedidos_compra"],
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos_compra")
        .select("*, fornecedor:fornecedores(razao_social), itens:pedido_itens(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // ─── Realtime: refresh list and notify on key status transitions ───
  useEffect(() => {
    let channel: any;

    const setupRealtime = async () => {
      try {
        const empresaId = await getEmpresaId();
        
        // Uso de canal específico por empresa para isolamento via RLS em realtime.messages
        channel = supabase
          .channel(`pedidos_compra:${empresaId}`)
          .on(
            "postgres_changes",
            { 
              event: "*", 
              schema: "public", 
              table: "pedidos_compra",
              filter: `empresa_id=eq.${empresaId}` 
            },
            (payload) => {
              queryClientRef.current.invalidateQueries({ queryKey: ["pedidos_compra"] });

              if (payload.eventType === "UPDATE") {
                const oldStatus = (payload.old as any)?.status;
                const newStatus = (payload.new as any)?.status;
                const numero = (payload.new as any)?.numero || "";

                if (oldStatus !== newStatus) {
                  if (newStatus === "saiu_para_entrega") {
                    toast.success(`🚚 Pedido ${numero} saiu para entrega`, {
                      description: `O pedido está a caminho do destino.`,
                    });
                  } else if (newStatus === "entregue") {
                    toast.success(`✅ Pedido ${numero} entregue`, {
                      description: `O pedido foi entregue com sucesso.`,
                    });
                  } else {
                    const label = PEDIDO_STATUS_LABELS[newStatus] || newStatus;
                    toast(`Pedido atualizado`, {
                      description: `Pedido ${numero} → ${label}`,
                    });
                  }
                }
              } else if (payload.eventType === "INSERT") {
                const numero = (payload.new as any)?.numero || "";
                toast(`Novo pedido`, {
                  description: `Pedido ${numero} criado.`,
                });
              }
            }
          )
          .subscribe();
      } catch (error) {
        console.error("Erro ao configurar realtime para pedidos:", error);
      }
    };

    setupRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []); // dependências vazias — usa refs para valores estáveis

  const create = useMutation({
    mutationFn: async (ped: any) => {
      const empresaId = await getEmpresaId();
      const itens = ped.itens || [];
      delete ped.itens;

      const count = await supabase
        .from("pedidos_compra")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId);
      const numero = `PC-${String((count.count || 0) + 1).padStart(4, "0")}`;

      const { data, error } = await supabase
        .from("pedidos_compra")
        .insert({ ...ped, empresa_id: empresaId, numero })
        .select()
        .single();
      if (error) throw error;

      if (itens.length > 0) {
        const { error: itemErr } = await supabase
          .from("pedido_itens")
          .insert(itens.map((i: any) => ({ ...i, pedido_id: data.id })));
        if (itemErr) throw itemErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos_compra"] });
      toast.success("Pedido de compra criado!");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, workflow_status }: { id: string; status?: string; workflow_status?: string }) => {
      const updates: any = {};
      if (status) updates.status = status;
      if (workflow_status) updates.workflow_status = workflow_status;
      const { error } = await supabase.from("pedidos_compra").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos_compra"] });
      toast.success("Status atualizado!");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pedidos_compra").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos_compra"] });
      toast.success("Pedido excluído!");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  return { pedidos, isLoading, create, updateStatus, remove };
}
