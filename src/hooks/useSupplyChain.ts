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

// ─── Fornecedores ───
export function useFornecedores() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: fornecedores = [], isLoading } = useQuery({
    queryKey: ["fornecedores"],
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

  return { fornecedores, isLoading, create, update, remove };
}

// ─── SC Itens ───
export function useScItens() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["sc_itens"],
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
      delete req.itens;
      
      const count = await supabase
        .from("requisicoes_compra")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId);
      const numero = `RC-${String((count.count || 0) + 1).padStart(4, "0")}`;

      const { data, error } = await supabase
        .from("requisicoes_compra")
        .insert({ ...req, empresa_id: empresaId, solicitante_id: user!.id, numero })
        .select()
        .single();
      if (error) throw error;

      if (itens.length > 0) {
        const { error: itemErr } = await supabase
          .from("requisicao_itens")
          .insert(itens.map((i: any) => ({ ...i, requisicao_id: data.id })));
        if (itemErr) throw itemErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requisicoes_compra"] });
      toast({ title: "Requisição criada!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("requisicoes_compra").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requisicoes_compra"] });
      toast({ title: "Status atualizado!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

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

  return { requisicoes, isLoading, create, updateStatus, remove };
}

// ─── Cotações ───
export function useCotacoes(requisicaoId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: cotacoes = [], isLoading } = useQuery({
    queryKey: ["cotacoes", requisicaoId],
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
  const { toast } = useToast();

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["pedidos_compra"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos_compra")
        .select("*, fornecedor:fornecedores(razao_social), itens:pedido_itens(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

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
      toast({ title: "Pedido de compra criado!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("pedidos_compra").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos_compra"] });
      toast({ title: "Status atualizado!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pedidos_compra").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos_compra"] });
      toast({ title: "Pedido excluído!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return { pedidos, isLoading, create, updateStatus, remove };
}
