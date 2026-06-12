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
    mutationFn: async (items: { 
      razao_social: string; 
      cnpj?: string; 
      contato_nome?: string; 
      contato_email?: string; 
      contato_telefone?: string; 
      endereco?: string; 
      cep?: string;
      complemento?: string;
      categoria?: string; 
      observacoes?: string;
      municipio?: string;
      uf?: string;
      score?: number;
    }[]) => {
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
      if (!user) throw new Error("Usuário não autenticado");

      const itens = req.itens || [];
      const reqData = { ...req };
      delete reqData.itens;
      
      const { count, error: countErr } = await supabase
        .from("requisicoes_compra")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId);
      
      if (countErr) throw countErr;
      const numero = `RC-${String((count || 0) + 1).padStart(4, "0")}`;

      const { data, error } = await supabase
        .from("requisicoes_compra")
        .insert({ ...reqData, empresa_id: empresaId, solicitante_id: user.id, numero, workflow_status: 'DRAFT' })
        .select()
        .single();
      if (error) throw error;

      // Log initial history
      await supabase.from("requisicao_historico").insert({
        requisicao_id: data.id,
        status_anterior: null,
        status_novo: 'DRAFT',
        usuario_id: user.id,
        observacoes: "Requisição criada no sistema"
      });

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
      queryClient.invalidateQueries({ queryKey: ["sc_counts"] });
      queryClient.invalidateQueries({ queryKey: ["minha_fila"] });
      toast({ title: "Requisição criada!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, workflow_status, observacoes }: { id: string; status?: string; workflow_status?: string; observacoes?: string }) => {
      // Get current status for history
      const { data: current, error: fetchErr } = await supabase
        .from("requisicoes_compra")
        .select("workflow_status")
        .eq("id", id)
        .single();
      
      if (fetchErr) throw fetchErr;

      const updates: any = {};
      if (status) updates.status = status;
      if (workflow_status) updates.workflow_status = workflow_status;
      
      const { error } = await supabase.from("requisicoes_compra").update(updates).eq("id", id);
      if (error) throw error;

      // Log to history
      const { data: { user } } = await supabase.auth.getUser();
      if (user && (workflow_status || status)) {
        await supabase.from("requisicao_historico").insert({
          requisicao_id: id,
          status_anterior: current.workflow_status,
          status_novo: workflow_status || current.workflow_status,
          usuario_id: user.id,
          observacoes: observacoes || `Status atualizado para ${workflow_status || status}`
        });
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["requisicoes_compra"] });
      queryClient.invalidateQueries({ queryKey: ["sc_counts"] });
      queryClient.invalidateQueries({ queryKey: ["minha_fila"] });
      queryClient.invalidateQueries({ queryKey: ["requisicao_historico", variables.id] });
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
      queryClient.invalidateQueries({ queryKey: ["sc_counts"] });
      queryClient.invalidateQueries({ queryKey: ["minha_fila"] });
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
        .select("*, fornecedor:fornecedores(razao_social), requisicao:requisicoes_compra(numero, projeto:projetos(codigo, nome)), itens:cotacao_itens(*, req_item:requisicao_itens(descricao_livre, quantidade, unidade, sc_item:sc_itens(codigo, descricao)))")
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
    queryKey: ["pedidos"],
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos")
        .select("*, fornecedor:fornecedores(id, razao_social), projeto:projetos(codigo, nome), requisicao:requisicoes_compra(numero), itens:pedido_itens(*, sc_item:sc_itens(codigo, descricao)), recebimentos:pedido_recebimentos(*, itens:pedido_recebimento_itens(*))")
        .order("data_prevista_entrega", { ascending: true, nullsFirst: false });
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
        
        channel = supabase
          .channel(`pedidos:${empresaId}`)
          .on(
            "postgres_changes",
            { 
              event: "*", 
              schema: "public", 
              table: "pedidos",
              filter: `empresa_id=eq.${empresaId}` 
            },
            (payload) => {
              queryClientRef.current.invalidateQueries({ queryKey: ["pedidos"] });
              queryClientRef.current.invalidateQueries({ queryKey: ["sc_counts"] });
              queryClientRef.current.invalidateQueries({ queryKey: ["minha_fila"] });

              if (payload.eventType === "UPDATE") {
                const oldStatus = (payload.old as any)?.status;
                const newStatus = (payload.new as any)?.status;
                const numero = (payload.new as any)?.numero || "";

                if (oldStatus !== newStatus) {
                  if (newStatus === "em_transito" || newStatus === "saiu_para_entrega") {
                    toast.success(`🚚 Pedido ${numero} a caminho`, {
                      description: `O pedido está em trânsito.`,
                    });
                  } else if (newStatus === "entregue") {
                    toast.success(`✅ Pedido ${numero} entregue`, {
                      description: `O pedido foi recebido integralmente.`,
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
  }, []);

  const create = useMutation({
    mutationFn: async (ped: any) => {
      const empresaId = await getEmpresaId();
      const itens = ped.itens || [];
      delete ped.itens;

      const count = await supabase
        .from("pedidos")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId);
      const numero = `PED-${String((count.count || 0) + 1).padStart(4, "0")}`;

      const { data, error } = await supabase
        .from("pedidos")
        .insert({ ...ped, empresa_id: empresaId, numero, status: 'rascunho' })
        .select()
        .single();
      if (error) throw error;

      if (itens.length > 0) {
        const { error: itemErr } = await supabase
          .from("pedido_itens")
          .insert(itens.map((i: any) => ({ ...i, pedido_id: data.id })));
        if (itemErr) throw itemErr;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["sc_counts"] });
      queryClient.invalidateQueries({ queryKey: ["minha_fila"] });
      toast.success("Pedido de compra criado!");
    },
    onError: (e: Error) => toast.error("Erro ao criar pedido: " + e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, observacoes, motivo_cancelamento, nf_numero, nf_arquivo_url, data_emissao, requisicao_id, requisicao_status_after }: { id: string; status?: string; observacoes?: string; motivo_cancelamento?: string; nf_numero?: string; nf_arquivo_url?: string; data_emissao?: string; requisicao_id?: string; requisicao_status_after?: string }) => {
      const updates: any = {};
      if (status) updates.status = status;
      if (observacoes !== undefined) updates.observacoes = observacoes;
      if (motivo_cancelamento !== undefined) updates.motivo_cancelamento = motivo_cancelamento;
      if (nf_numero !== undefined) updates.nf_numero = nf_numero;
      if (nf_arquivo_url !== undefined) updates.nf_arquivo_url = nf_arquivo_url;
      if (data_emissao !== undefined) updates.data_emissao = data_emissao;
      if (status === 'entregue' && !updates.data_entrega_real) updates.data_entrega_real = new Date().toISOString().split('T')[0];

      const { error } = await supabase.from("pedidos").update(updates).eq("id", id);
      if (error) throw error;

      if (requisicao_id && requisicao_status_after) {
        await supabase.from("requisicoes_compra").update({ workflow_status: requisicao_status_after }).eq("id", requisicao_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["sc_counts"] });
      queryClient.invalidateQueries({ queryKey: ["minha_fila"] });
      queryClient.invalidateQueries({ queryKey: ["requisicoes_compra"] });
      queryClient.invalidateQueries({ queryKey: ["sc_counts"] });
      queryClient.invalidateQueries({ queryKey: ["minha_fila"] });
      toast.success("Pedido atualizado!");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pedidos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["sc_counts"] });
      queryClient.invalidateQueries({ queryKey: ["minha_fila"] });
      toast.success("Pedido excluído!");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  return { pedidos, isLoading, create, updateStatus, remove };
}

// ─── Recebimentos de Pedido ───
export function usePedidoRecebimentos() {
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: async (recebimento: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const itens = recebimento.itens || [];
      const nfNumero = recebimento.nf_numero;
      const nfArquivoUrl = recebimento.nf_arquivo_url;
      const pedidoId = recebimento.pedido_id;
      const dataRecebimento = recebimento.data_recebimento;
      delete recebimento.itens;
      delete recebimento.nf_numero;
      delete recebimento.nf_arquivo_url;

      const { data, error } = await supabase
        .from("pedido_recebimentos")
        .insert({ ...recebimento, recebido_por: user.id })
        .select()
        .single();

      if (error) throw error;

      if (itens.length > 0) {
        const { error: itemErr } = await supabase
          .from("pedido_recebimento_itens")
          .insert(itens.map((i: any) => ({ ...i, recebimento_id: data.id })));
        if (itemErr) throw itemErr;
      }

      // Recalcular status do pedido com base nos totais
      const { data: pedItens } = await supabase
        .from("pedido_itens")
        .select("quantidade_pedida, quantidade_recebida")
        .eq("pedido_id", pedidoId);

      const tudoRecebido = (pedItens || []).every((it: any) => Number(it.quantidade_recebida || 0) >= Number(it.quantidade_pedida || 0));

      const pedUpdates: any = {};
      if (tudoRecebido) {
        pedUpdates.status = "entregue";
        pedUpdates.data_entrega_real = dataRecebimento || new Date().toISOString().split("T")[0];
      } else {
        pedUpdates.status = "entrega_parcial";
      }
      if (nfNumero) pedUpdates.nf_numero = nfNumero;
      if (nfArquivoUrl) pedUpdates.nf_arquivo_url = nfArquivoUrl;

      await supabase.from("pedidos").update(pedUpdates).eq("id", pedidoId);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["sc_counts"] });
      queryClient.invalidateQueries({ queryKey: ["minha_fila"] });
      toast.success("Recebimento registrado com sucesso!");
    },
    onError: (e: Error) => toast.error("Erro ao registrar recebimento: " + e.message),
  });

  return { create };
}

// ─── Avaliações de Fornecedor ───
export function useAvaliacoesFornecedor() {
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: async (avaliacao: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { error } = await supabase
        .from("avaliacoes_fornecedor")
        .insert({ ...avaliacao, avaliado_por: user.id });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["sc_counts"] });
      queryClient.invalidateQueries({ queryKey: ["minha_fila"] });
      toast.success("Avaliação registrada com sucesso!");
    },
    onError: (e: Error) => toast.error("Erro ao registrar avaliação: " + e.message),
  });

  return { create };
}

// ─── Dashboard counts ───
export function useSupplyChainCounts() {
  return useQuery({
    queryKey: ["sc_counts"],
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const empresaId = await getEmpresaId();

      const baseReq = () =>
        supabase.from("requisicoes_compra").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId);
      const basePed = () =>
        supabase.from("pedidos").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId);

      const [pendentesRes, emCotacaoRes, pedidosAbertosRes, paraReceberRes, cotacoesAbertasRes] = await Promise.all([
        baseReq().in("status", ["rascunho", "pendente_aprovacao"]),
        baseReq().eq("status", "em_cotacao"),
        basePed().in("status", ["rascunho", "emitido", "confirmado", "entrega_parcial"]),
        basePed().in("status", ["emitido", "confirmado", "entrega_parcial"]),
        supabase.from("cotacoes").select("requisicao_id").eq("empresa_id", empresaId).eq("status", "aberta"),
      ]);

      const reqIdsComCotacao = new Set(
        (cotacoesAbertasRes.data || []).map((c: any) => c.requisicao_id).filter(Boolean)
      );

      let paraAprovar = 0;
      if (reqIdsComCotacao.size > 0) {
        const { count } = await supabase
          .from("requisicoes_compra")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", empresaId)
          .eq("status", "em_cotacao")
          .in("id", Array.from(reqIdsComCotacao));
        paraAprovar = count || 0;
      }

      return {
        requisicoesPendentes: pendentesRes.count || 0,
        emCotacao: emCotacaoRes.count || 0,
        paraAprovar,
        pedidosEmAberto: pedidosAbertosRes.count || 0,
        recebimentosPendentes: paraReceberRes.count || 0,
      };
    },
  });
}

// ─── Minha Fila ───
export function useMinhaFila() {
  return useQuery({
    queryKey: ["minha_fila"],
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const empresaId = await getEmpresaId();
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      const selectReq = "id, numero, status, prioridade, data_necessidade, created_at, projeto:projetos(codigo, nome)";
      const selectPed = "id, numero, status, data_prevista_entrega, valor_total, created_at, fornecedor:fornecedores(razao_social), projeto:projetos(codigo, nome)";

      const [minhas, paraCotar, pedidosRascunho, aprovacoes, recebimentos] = await Promise.all([
        userId
          ? supabase.from("requisicoes_compra").select(selectReq).eq("empresa_id", empresaId).eq("solicitante_id", userId).order("created_at", { ascending: false }).limit(10)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from("requisicoes_compra").select(selectReq).eq("empresa_id", empresaId).eq("status", "em_cotacao").order("prioridade", { ascending: false }).order("data_necessidade", { ascending: true }).limit(10),
        supabase.from("pedidos").select(selectPed).eq("empresa_id", empresaId).eq("status", "rascunho").order("created_at", { ascending: true }).limit(10),
        supabase.from("requisicoes_compra").select(selectReq).eq("empresa_id", empresaId).eq("status", "pendente_aprovacao").order("prioridade", { ascending: false }).limit(10),
        supabase.from("pedidos").select(selectPed).eq("empresa_id", empresaId).in("status", ["emitido", "confirmado", "entrega_parcial"]).order("data_prevista_entrega", { ascending: true, nullsFirst: false }).limit(10),
      ]);

      return {
        minhasRequisicoes: minhas.data || [],
        requisicoesParaCotar: paraCotar.data || [],
        pedidosParaEmitir: pedidosRascunho.data || [],
        aprovacoesPendentes: aprovacoes.data || [],
        recebimentosPendentes: recebimentos.data || [],
      };
    },
  });
}
