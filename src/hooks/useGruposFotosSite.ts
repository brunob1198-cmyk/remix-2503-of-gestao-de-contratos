import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Grupos de fotos (classificacao) já utilizados por QUALQUER usuário
 * nos diários de um site. Garante que grupos criados por outras pessoas
 * fiquem visíveis para todos.
 */
export function useGruposFotosSite(siteId?: string) {
  const { data = [] } = useQuery({
    queryKey: ["diario_foto_grupos", siteId],
    enabled: !!siteId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diario_fotos")
        .select("classificacao, diarios_obra!inner(site_id)")
        .eq("diarios_obra.site_id", siteId!)
        .is("diario_producao_id", null);

      if (error) throw error;

      const grupos = new Set<string>();
      (data ?? []).forEach((row: { classificacao: string | null }) => {
        const nome = (row.classificacao ?? "").trim();
        if (nome) grupos.add(nome);
      });
      return Array.from(grupos);
    },
  });

  return data as string[];
}
