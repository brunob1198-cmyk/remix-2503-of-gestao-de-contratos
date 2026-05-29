import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

async function getEmpresaIdFresh(): Promise<string> {
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

export interface ErpConfig {
  id: string;
  empresa_id: string;
  nome: string;
  webhook_url: string;
  auth_token: string | null;
  auth_type: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ErpLog {
  id: string;
  config_id: string;
  empresa_id: string;
  evento: string;
  payload: Record<string, unknown>;
  status: string;
  resposta: Record<string, unknown> | null;
  tentativas: number;
  erro: string | null;
  created_at: string;
  updated_at: string;
}

export function useErpConfig() {
  const { empresaId } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const configQuery = useQuery({
    queryKey: ["erp_config", empresaId],
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integracoes_erp_config")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return data as ErpConfig[];
    },
    enabled: !!empresaId,
  });

  const createConfig = useMutation({
    mutationFn: async (input: { nome: string; webhook_url: string; auth_token?: string; auth_type?: string }) => {
      const freshEmpresaId = await getEmpresaIdFresh();
      const { data, error } = await supabase
        .from("integracoes_erp_config")
        .insert({
          empresa_id: freshEmpresaId,
          nome: input.nome,
          webhook_url: input.webhook_url,
          auth_token: input.auth_token || null,
          auth_type: input.auth_type || "bearer",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["erp_config"] });
      toast({ title: "Integração ERP configurada!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateConfig = useMutation({
    mutationFn: async (input: { id: string; webhook_url?: string; auth_token?: string; auth_type?: string; ativo?: boolean; nome?: string }) => {
      const { id, ...rest } = input;
      const { error } = await supabase
        .from("integracoes_erp_config")
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["erp_config"] });
      toast({ title: "Configuração atualizada!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteConfig = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("integracoes_erp_config").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["erp_config"] });
      toast({ title: "Integração removida!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return { configs: configQuery.data || [], isLoading: configQuery.isLoading, createConfig, updateConfig, deleteConfig };
}

export function useErpLogs() {
  const { empresaId } = useAuth();

  return useQuery({
    queryKey: ["erp_logs", empresaId],
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integracoes_erp_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as ErpLog[];
    },
    enabled: !!empresaId,
  });
}

export function useErpSend() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const sendMutation = useMutation({
    mutationFn: async (params: { config_id: string; empresa_id: string; evento: string; payload: Record<string, unknown> }) => {
      const { data, error } = await supabase.functions.invoke("send-erp-webhook", {
        body: { action: "send", ...params },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["erp_logs"] });
      if (data?.success) {
        toast({ title: "Enviado ao ERP com sucesso!" });
      } else {
        toast({ title: "Erro ao enviar ao ERP", description: "Verifique os logs de integração.", variant: "destructive" });
      }
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const retryMutation = useMutation({
    mutationFn: async (log_id: string) => {
      const { data, error } = await supabase.functions.invoke("send-erp-webhook", {
        body: { action: "retry", log_id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["erp_logs"] });
      if (data?.success) {
        toast({ title: "Reenvio bem-sucedido!" });
      } else {
        toast({ title: "Reenvio falhou", variant: "destructive" });
      }
    },
    onError: (e: Error) => toast({ title: "Erro no reenvio", description: e.message, variant: "destructive" }),
  });

  return { send: sendMutation, retry: retryMutation };
}
