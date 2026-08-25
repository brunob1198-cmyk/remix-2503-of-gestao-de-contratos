import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Alcada, TipoCompra } from "@/lib/alcadaCompras";

/**
 * As alçadas de aprovação de compra.
 *
 * A regra de quem pode aprovar quanto vive em duas tabelas — a faixa e os
 * aprovadores dela — e é sempre lida junto: alçada sem a lista de aprovadores não
 * responde a pergunta que se faz dela.
 */

export interface AlcadaInput {
  nome: string;
  valor_minimo: number;
  valor_maximo: number | null;
  tipo_compra: TipoCompra | null;
  observacoes?: string | null;
  ativo?: boolean;
  /** Ids dos usuários aprovadores. Substituem por completo os atuais. */
  aprovadores: string[];
}

export function useAlcadasCompra() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const { data: alcadas = [], isLoading, error } = useQuery({
    queryKey: ["sc_alcadas", empresaId],
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Alcada[]> => {
      const { data, error } = await (supabase
        .from("sc_alcadas" as never)
        .select("*, aprovadores:sc_alcada_aprovadores(user_id, profile:profiles(id, nome))")
        .eq("empresa_id", empresaId as string)
        .order("valor_minimo", { ascending: true }) as never as Promise<{
        data:
          | (Omit<Alcada, "aprovadores"> & {
              aprovadores: { user_id: string; profile?: { id: string; nome: string | null } | null }[];
            })[]
          | null;
        error: { message?: string } | null;
      }>);

      if (error) throw error;

      return (data ?? []).map((a) => ({
        ...a,
        valor_minimo: Number(a.valor_minimo ?? 0),
        valor_maximo: a.valor_maximo === null ? null : Number(a.valor_maximo),
        aprovadores: a.aprovadores.map((x) => x.user_id),
        // Guarda os nomes ao lado, para a tela poder dizer A QUEM encaminhar sem
        // uma segunda consulta.
        nomesDosAprovadores: a.aprovadores
          .map((x) => x.profile?.nome)
          .filter((n): n is string => !!n),
      })) as Alcada[];
    },
  });

  /** Grava a alçada e a lista de aprovadores dela, nesta ordem. */
  const salvarAprovadores = async (alcadaId: string, aprovadores: string[]) => {
    // Apaga e regrava: a lista é pequena e a alternativa (calcular o delta) erra
    // silenciosamente quando alguém é removido e re-adicionado na mesma edição.
    const { error: delErr } = await (supabase
      .from("sc_alcada_aprovadores" as never)
      .delete()
      .eq("alcada_id", alcadaId) as never as Promise<{ error: { message?: string } | null }>);
    if (delErr) throw delErr;

    if (aprovadores.length === 0) return;

    const { error: insErr } = await (supabase
      .from("sc_alcada_aprovadores" as never)
      .insert(aprovadores.map((user_id) => ({ alcada_id: alcadaId, user_id })) as never) as never as Promise<{
      error: { message?: string } | null;
    }>);
    if (insErr) throw insErr;
  };

  const criar = useMutation({
    mutationFn: async (entrada: AlcadaInput) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");
      const { aprovadores, ...alcada } = entrada;

      const { data, error } = await (supabase
        .from("sc_alcadas" as never)
        .insert({ ...alcada, empresa_id: empresaId } as never)
        .select()
        .single() as never as Promise<{
        data: { id: string } | null;
        error: { message?: string } | null;
      }>);

      if (error) throw error;
      if (data?.id) await salvarAprovadores(data.id, aprovadores);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sc_alcadas"] });
      toast.success("Alçada cadastrada.");
    },
    onError: (e: { message?: string }) => toast.error(`Erro ao cadastrar: ${e.message || e}`),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, ...entrada }: AlcadaInput & { id: string }) => {
      const { aprovadores, ...alcada } = entrada;

      const { error } = await (supabase
        .from("sc_alcadas" as never)
        .update(alcada as never)
        .eq("id", id) as never as Promise<{ error: { message?: string } | null }>);
      if (error) throw error;

      await salvarAprovadores(id, aprovadores);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sc_alcadas"] });
      toast.success("Alçada atualizada.");
    },
    onError: (e: { message?: string }) => toast.error(`Erro ao atualizar: ${e.message || e}`),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sc_alcadas" as never)
        .delete()
        .eq("id", id) as never as Promise<{ error: { message?: string } | null }>);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sc_alcadas"] });
      toast.success("Alçada removida.");
    },
    onError: (e: { message?: string }) => toast.error(`Erro ao remover: ${e.message || e}`),
  });

  return { alcadas, isLoading, error, criar, atualizar, remover };
}

/**
 * Usuários que podem ser aprovadores.
 *
 * Só quem tem `pode_aprovar_compra` no perfil aparece: colocar numa alçada alguém
 * sem essa permissão criaria uma alçada que não autoriza nada, e o motivo ficaria
 * escondido.
 */
export function useCandidatosAAprovador() {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  return useQuery({
    queryKey: ["candidatos_aprovador", empresaId],
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, pode_aprovar_compra")
        .eq("empresa_id", empresaId as string)
        .eq("pode_aprovar_compra", true)
        .order("nome");

      if (error) throw error;
      return data ?? [];
    },
  });
}
