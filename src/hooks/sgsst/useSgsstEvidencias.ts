import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { OrigemFoto } from "@/utils/fotoGeolocalizada";

/**
 * Evidência fotográfica do SGSST.
 *
 * Nenhuma tela do módulo tinha anexo de foto: inspeções, incidentes, não
 * conformidades, PT, APR e EPI registravam desvio em TEXTO. O campo `evidencia` da
 * não conformidade de inspeção é literalmente uma coluna `text` — dava para
 * escrever "foto 03" e a foto 03 não existir em lugar nenhum.
 *
 * Uma tabela para as doze entidades, porque a forma é idêntica em todas. O custo
 * está declarado na migration: sem chave estrangeira, com a integridade feita por
 * trigger.
 */

/** As entidades que aceitam foto. Espelha o CHECK da tabela. */
export type EntidadeEvidencia =
  | "INSPECAO"
  | "INSPECAO_NC"
  | "NAO_CONFORMIDADE"
  | "NC_ACAO"
  | "INCIDENTE"
  | "PT"
  | "PT_MEDICAO"
  | "APR"
  | "APR_ETAPA"
  | "EPI_ENTREGA"
  | "EPI_DEVOLUCAO"
  | "EPI_MANUTENCAO";

/** Como cada entidade se chama na tela, para mensagens e para o documento. */
export const ENTIDADE_EVIDENCIA_LABEL: Record<EntidadeEvidencia, string> = {
  INSPECAO: "Inspeção",
  INSPECAO_NC: "Não conformidade da inspeção",
  NAO_CONFORMIDADE: "Não conformidade",
  NC_ACAO: "Ação do plano",
  INCIDENTE: "Incidente",
  PT: "Permissão de trabalho",
  PT_MEDICAO: "Medição atmosférica",
  APR: "Análise preliminar de riscos",
  APR_ETAPA: "Etapa da APR",
  EPI_ENTREGA: "Entrega de EPI",
  EPI_DEVOLUCAO: "Devolução de EPI",
  EPI_MANUTENCAO: "Higienização ou manutenção de EPI",
};

export interface SgsstEvidencia {
  id: string;
  empresa_id: string;
  entidade: EntidadeEvidencia;
  entidade_id: string;
  r2_key: string;
  r2_url: string;
  nome_arquivo?: string | null;
  tipo_mime?: string | null;
  tamanho?: number | null
  descricao?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  precisao_metros?: number | null;
  capturada_em?: string | null;
  origem_captura?: OrigemFoto | null;
  motivo_sem_geo?: string | null;
  created_by?: string | null;
  created_at?: string;
  // Joined
  autor?: { id: string; nome: string | null } | null;
}

export interface SgsstEvidenciaInput {
  entidade: EntidadeEvidencia;
  entidade_id: string;
  r2_key: string;
  r2_url: string;
  nome_arquivo?: string | null;
  tipo_mime?: string | null;
  tamanho?: number | null;
  descricao?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  precisao_metros?: number | null;
  capturada_em?: string | null;
  origem_captura?: OrigemFoto | null;
  motivo_sem_geo?: string | null;
}

/** Teto por registro. Um desvio rende algumas fotos, não centenas. */
export const EVIDENCIAS_LIMITE = 100;

export function useSgsstEvidencias(
  entidade: EntidadeEvidencia,
  entidadeId?: string,
  options?: { enabled?: boolean }
) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const habilitado = !!entidadeId && !!empresaId && options?.enabled !== false;
  const chave = ["sgsst_evidencias", entidade, entidadeId ?? null];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: chave,
    enabled: habilitado,
    queryFn: async (): Promise<SgsstEvidencia[]> => {
      const { data, error } = await (supabase
        .from("sgsst_evidencias" as never)
        .select(
          "*, autor:profiles!sgsst_evidencias_created_by_fkey(id, nome)"
        )
        .eq("entidade", entidade)
        .eq("entidade_id", entidadeId as string)
        // Mais antiga primeiro: a sequência de fotos conta a história do desvio.
        .order("created_at", { ascending: true })
        .limit(EVIDENCIAS_LIMITE) as never as Promise<{
        data: SgsstEvidencia[] | null;
        error: { message?: string } | null;
      }>);

      if (error) throw error;
      return data ?? [];
    },
  });

  const adicionar = useMutation({
    mutationFn: async (input: SgsstEvidenciaInput) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const payload = {
        ...input,
        empresa_id: empresaId,
        created_by: profile?.id,
        // A coluna é excludente com a coordenada no banco: o motivo só vai quando
        // de fato não houve ponto.
        motivo_sem_geo: input.latitude ? null : input.motivo_sem_geo ?? null,
      } as never;

      const { data, error } = await (supabase
        .from("sgsst_evidencias" as never)
        .insert(payload)
        .select()
        .single() as never as Promise<{
        data: SgsstEvidencia | null;
        error: { message?: string } | null;
      }>);

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chave });
    },
    onError: (err: { message?: string }) => {
      toast.error(`Erro ao anexar a foto: ${err.message || err}`);
    },
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_evidencias" as never)
        .delete()
        .eq("id", id) as never as Promise<{ error: { message?: string } | null }>);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chave });
      toast.success("Evidência removida.");
    },
    onError: (err: { message?: string }) => {
      toast.error(`Erro ao remover: ${err.message || err}`);
    },
  });

  const atualizarDescricao = useMutation({
    mutationFn: async (params: { id: string; descricao: string }) => {
      const { error } = await (supabase
        .from("sgsst_evidencias" as never)
        .update({ descricao: params.descricao.trim() || null } as never)
        .eq("id", params.id) as never as Promise<{
        error: { message?: string } | null;
      }>);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chave });
    },
    onError: (err: { message?: string }) => {
      toast.error(`Erro ao salvar a legenda: ${err.message || err}`);
    },
  });

  return {
    evidencias: data ?? [],
    isLoading,
    error,
    refetch,
    adicionar,
    remover,
    atualizarDescricao,
    truncado: (data ?? []).length >= EVIDENCIAS_LIMITE,
  };
}
