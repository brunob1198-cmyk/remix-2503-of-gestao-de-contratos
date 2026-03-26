import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TimelineEvento {
  id: string;
  projeto_id: string;
  data: string;
  tipo: string;
  item: string | null;
  quantidade: number;
  equipe_id: string | null;
  latitude: number | null;
  longitude: number | null;
  imagem_url: string | null;
  status: string;
  observacao: string | null;
  created_at: string;
  updated_at: string;
  // joined
  equipe_nome?: string;
}

export function useTimelineEventos(projetoId?: string, filters?: {
  dateStart?: string;
  dateEnd?: string;
  tipo?: string;
  item?: string;
}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["timeline_eventos", projetoId, filters],
    queryFn: async () => {
      if (!projetoId) return [];
      let q = supabase
        .from("timeline_eventos")
        .select("*, equipe:recursos(nome)")
        .eq("projeto_id", projetoId)
        .order("data", { ascending: true })
        .order("created_at", { ascending: true });

      if (filters?.dateStart) q = q.gte("data", filters.dateStart);
      if (filters?.dateEnd) q = q.lte("data", filters.dateEnd);
      if (filters?.tipo && filters.tipo !== "all") q = q.eq("tipo", filters.tipo);
      if (filters?.item) q = q.ilike("item", `%${filters.item}%`);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((e: any) => ({
        ...e,
        quantidade: Number(e.quantidade),
        latitude: e.latitude ? Number(e.latitude) : null,
        longitude: e.longitude ? Number(e.longitude) : null,
        equipe_nome: e.equipe?.nome || null,
      })) as TimelineEvento[];
    },
    enabled: !!projetoId,
  });

  const create = useMutation({
    mutationFn: async (evento: Partial<TimelineEvento> & { projeto_id: string; data: string }) => {
      const { equipe_nome, ...rest } = evento as any;
      const { data, error } = await supabase.from("timeline_eventos").insert(rest).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeline_eventos", projetoId] });
      toast.success("Evento criado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("timeline_eventos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeline_eventos", projetoId] });
      toast.success("Evento removido");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return { ...query, create, remove };
}
