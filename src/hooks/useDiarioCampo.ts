import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface DiarioCampo {
  id: string;
  site_id: string | null;
  projeto_id: string | null;
  data: string;
  descricao_servico: string | null;
  equipe_campo: string | null;
  clima: string | null;
  uf: string | null;
  municipio: string | null;
  observacoes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface DiarioCampoFoto {
  id: string;
  diario_campo_id: string;
  url: string;
  legenda: string | null;
  created_at: string | null;
}

export function useDiarioCampo(projetoId: string, siteId: string, selectedDate: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: diario, isLoading: loadingDiario } = useQuery({
    queryKey: ["diario_campo", projetoId, siteId, selectedDate],
    queryFn: async () => {
      if (!projetoId || !selectedDate) return null;
      let query = supabase
        .from("diarios_campo")
        .select("*")
        .eq("data", selectedDate);

      if (siteId) {
        query = query.eq("site_id", siteId);
      } else {
        query = query.eq("projeto_id", projetoId).is("site_id", null);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data as DiarioCampo | null;
    },
    enabled: !!projetoId && !!selectedDate,
  });

  const { data: fotos = [] } = useQuery({
    queryKey: ["diario_campo_fotos", diario?.id],
    queryFn: async () => {
      if (!diario?.id) return [];
      const { data, error } = await supabase
        .from("diario_campo_fotos")
        .select("*")
        .eq("diario_campo_id", diario.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as DiarioCampoFoto[];
    },
    enabled: !!diario?.id,
  });

  const criarDiario = useMutation({
    mutationFn: async (params: { site_id?: string; projeto_id?: string; data: string; uf?: string; municipio?: string }) => {
      const insertData: any = { data: params.data };
      if (params.site_id) insertData.site_id = params.site_id;
      if (params.projeto_id) insertData.projeto_id = params.projeto_id;
      if (params.uf) insertData.uf = params.uf;
      if (params.municipio) insertData.municipio = params.municipio;

      const { data, error } = await supabase
        .from("diarios_campo")
        .insert([insertData])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diario_campo"] });
      queryClient.invalidateQueries({ queryKey: ["diario_campo_calendario"] });
    },
  });

  const atualizarDiario = useMutation({
    mutationFn: async (params: { id: string; descricao_servico?: string; equipe_campo?: string; clima?: string; uf?: string; municipio?: string; observacoes?: string }) => {
      const { id, ...updates } = params;
      const { error } = await supabase
        .from("diarios_campo")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diario_campo"] });
      queryClient.invalidateQueries({ queryKey: ["diario_campo_calendario"] });
    },
  });

  const addFoto = useMutation({
    mutationFn: async (params: { diario_campo_id: string; url: string; legenda?: string }) => {
      const { error } = await supabase
        .from("diario_campo_fotos")
        .insert([params]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diario_campo_fotos"] });
    },
  });

  const removeFoto = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("diario_campo_fotos")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diario_campo_fotos"] });
    },
  });

  return {
    diario,
    loadingDiario,
    fotos,
    criarDiario,
    atualizarDiario,
    addFoto,
    removeFoto,
  };
}

// Calendar hook for diário de campo
export function useDiarioCampoCalendario(projetoId: string | undefined, siteId: string | undefined, dataInicio: string, dataFim: string) {
  return useQuery({
    queryKey: ["diario_campo_calendario", projetoId, siteId, dataInicio, dataFim],
    queryFn: async () => {
      if (!projetoId) return [];
      let query = supabase
        .from("diarios_campo")
        .select("id, data, clima, descricao_servico, equipe_campo")
        .gte("data", dataInicio)
        .lte("data", dataFim)
        .order("data", { ascending: true });

      if (siteId) {
        query = query.eq("site_id", siteId);
      } else {
        query = query.eq("projeto_id", projetoId);
      }

      const { data: diarios, error } = await query;
      if (error) throw error;
      if (!diarios || diarios.length === 0) return [];

      const ids = diarios.map(d => d.id);
      const { data: fotosCounts } = await supabase
        .from("diario_campo_fotos")
        .select("diario_campo_id")
        .in("diario_campo_id", ids);

      const fotosByDiario = new Map<string, number>();
      (fotosCounts || []).forEach(f => {
        fotosByDiario.set(f.diario_campo_id, (fotosByDiario.get(f.diario_campo_id) || 0) + 1);
      });

      return diarios.map(d => ({
        id: d.id,
        data: d.data,
        clima: d.clima,
        descricao: d.descricao_servico,
        equipe: d.equipe_campo,
        totalFotos: fotosByDiario.get(d.id) || 0,
        hasContent: !!(d.descricao_servico || d.equipe_campo),
      }));
    },
    enabled: !!projetoId,
  });
}
