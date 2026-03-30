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

      // 1. Get timeline events
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

      const { data: timelineData, error: timelineError } = await q;
      if (timelineError) throw timelineError;

      // 2. Get photos from diario_fotos (linked via diarios_obra)
      // Since they are the "official" photos, they always appear as "foto" type
      const { data: diarioData, error: diarioError } = await supabase
        .from("diario_fotos")
        .select(`
          id,
          url,
          legenda,
          classificacao,
          created_at,
          diario:diarios_obra!inner(data, projeto_id)
        `)
        .eq("diario.projeto_id", projetoId);

      if (diarioError) throw diarioError;

      // Map daily report photos to TimelineEvento format
      const diarioEvents: TimelineEvento[] = (diarioData ?? []).map((f: any) => ({
        id: f.id,
        projeto_id: f.diario.projeto_id,
        data: f.diario.data,
        tipo: "foto",
        item: f.legenda || f.classificacao || "Foto Diário",
        quantidade: 0,
        equipe_id: null,
        latitude: null, // Photos might have GPS but not easily joined here
        longitude: null,
        imagem_url: f.url,
        status: "ok",
        observacao: `Foto anexada no diário de obra em ${f.diario.data}`,
        created_at: f.created_at,
        updated_at: f.created_at,
        equipe_nome: null,
      }));

      // Merge and filter
      const allEvents = [
        ...(timelineData ?? []).map((e: any) => ({
          ...e,
          quantidade: Number(e.quantidade),
          latitude: e.latitude ? Number(e.latitude) : null,
          longitude: e.longitude ? Number(e.longitude) : null,
          equipe_nome: e.equipe?.nome || null,
        })),
        ...diarioEvents
      ];

      // Re-apply filters to diarioEvents if needed
      let filtered = allEvents;
      if (filters?.dateStart) filtered = filtered.filter(e => e.data >= filters.dateStart!);
      if (filters?.dateEnd) filtered = filtered.filter(e => e.data <= filters.dateEnd!);
      if (filters?.tipo && filters.tipo !== "all") filtered = filtered.filter(e => e.tipo === filters.tipo);
      if (filters?.item) filtered = filtered.filter(e => e.item?.toLowerCase().includes(filters.item!.toLowerCase()));

      // Sort by data and created_at
      return filtered.sort((a, b) => {
        if (a.data !== b.data) return a.data.localeCompare(b.data);
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
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
