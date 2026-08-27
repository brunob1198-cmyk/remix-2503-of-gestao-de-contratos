import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { SgsstAprEtapa, SgsstAprRisco, SgsstAprMedida } from "@/hooks/sgsst/useSgsstApr";
import type { SgsstPtMedida } from "@/hooks/sgsst/useSgsstPt";

/**
 * Árvore completa de riscos e medidas — para a emissão dos documentos.
 *
 * As telas de APR e PT carregam riscos e medidas **por pai selecionado**: os
 * riscos da etapa que o usuário abriu, as medidas do risco que ele clicou. Isso
 * é correto para navegar, e inútil para imprimir: o documento precisa da árvore
 * inteira de uma vez.
 *
 * A alternativa seria emitir com o que estivesse na tela — e sairia uma APR com
 * os riscos de uma única etapa, silenciosamente. Documento que omite parte do
 * levantamento é pior que documento nenhum: ele afirma completude que não tem.
 *
 * As consultas são em cadeia (etapas → riscos das etapas → medidas dos riscos)
 * porque cada nível precisa dos ids do anterior. Três idas ao banco, uma vez, no
 * momento da emissão.
 */

/** Teto por nível. Uma APR real não chega perto disso; o limite é anti-runaway. */
export const ARVORE_LIMITE_LINHAS = 2000;

interface ErroConsulta {
  message?: string;
  code?: string;
}

async function buscarPor<T>(
  tabela: string,
  select: string,
  coluna: string,
  valores: readonly string[],
  ordem: string
): Promise<T[]> {
  // Sem pais não há filhos — e `in` com lista vazia é consulta desperdiçada.
  if (valores.length === 0) return [];

  const { data, error } = await (supabase
    .from(tabela as never)
    .select(select)
    .in(coluna, valores as string[])
    .order(ordem, { ascending: true })
    .limit(ARVORE_LIMITE_LINHAS) as never as Promise<{
    data: T[] | null;
    error: ErroConsulta | null;
  }>);

  if (error) throw error;
  return data ?? [];
}

export interface ArvoreApr {
  etapas: SgsstAprEtapa[];
  /** Riscos de todas as etapas, achatados. Cada um traz `etapa_id`. */
  riscos: SgsstAprRisco[];
  /** Medidas de todos os riscos, achatadas. Cada uma traz `apr_risco_id`. */
  medidas: SgsstAprMedida[];
  truncado: boolean;
}

/**
 * Árvore inteira da APR: etapas, riscos de cada etapa, medidas de cada risco.
 *
 * `enabled: false` mantém a consulta fora do ar até a emissão ser pedida — a tela
 * já tem os dados de que precisa para navegar, e carregar a árvore toda a cada
 * abertura seria custo sem uso.
 */
export function useSgsstAprArvore(aprId?: string, options?: { enabled?: boolean }) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["sgsst_apr", "arvore", aprId],
    enabled: !!aprId && !!empresaId && options?.enabled !== false,
    queryFn: async (): Promise<ArvoreApr> => {
      const etapas = await buscarPor<SgsstAprEtapa>(
        "sgsst_apr_etapas",
        "*, responsavel:profiles!sgsst_apr_etapas_responsavel_id_fkey(id, nome)",
        "apr_id",
        [aprId as string],
        "ordem"
      );

      const riscos = await buscarPor<SgsstAprRisco>(
        "sgsst_apr_riscos",
        "*, risco_catalogo:sgsst_riscos_catalogo(id, nome, categoria)",
        "etapa_id",
        etapas.map((e) => e.id),
        "created_at"
      );

      const medidas = await buscarPor<SgsstAprMedida>(
        "sgsst_apr_medidas",
        "*, responsavel:profiles!sgsst_apr_medidas_responsavel_id_fkey(id, nome)",
        "apr_risco_id",
        riscos.map((r) => r.id),
        "created_at"
      );

      return {
        etapas,
        riscos,
        medidas,
        truncado: [etapas, riscos, medidas].some(
          (lista) => lista.length >= ARVORE_LIMITE_LINHAS
        ),
      };
    },
  });

  return {
    etapas: data?.etapas ?? [],
    riscos: data?.riscos ?? [],
    medidas: data?.medidas ?? [],
    truncado: data?.truncado ?? false,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Medidas de controle de todos os riscos de uma PT.
 *
 * A PT não tem etapas — os riscos pendem direto dela —, então basta um nível. Mas
 * as medidas continuam presas a cada risco, e são elas que o executante precisa
 * ler na folha: risco sem a medida ao lado informa o perigo e não diz o que fazer
 * a respeito.
 */
export function useSgsstPtMedidasDaPt(
  riscoIds: readonly string[],
  options?: { enabled?: boolean }
) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  // Ordenado para a chave do cache não mudar só porque a lista chegou em outra
  // ordem — senão a consulta refaz sem necessidade.
  const chave = [...riscoIds].sort().join(",");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["sgsst_pt_medidas", "da_pt", chave],
    enabled: !!empresaId && riscoIds.length > 0 && options?.enabled !== false,
    queryFn: async (): Promise<SgsstPtMedida[]> =>
      buscarPor<SgsstPtMedida>(
        "sgsst_pt_medidas",
        "*, responsavel:profiles!sgsst_pt_medidas_responsavel_id_fkey(id, nome)",
        "pt_risco_id",
        riscoIds,
        "created_at"
      ),
  });

  return {
    medidas: data ?? [],
    isLoading,
    error,
    refetch,
  };
}
