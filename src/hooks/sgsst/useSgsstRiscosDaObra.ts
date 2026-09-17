import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  sugestaoDeRiscosDoAso,
  type ItemInventariadoParaSugestao,
  type SugestaoDeRiscos,
} from "@/utils/sugestaoDeRiscosDoAso";

/**
 * Os riscos que o PGR de uma obra já inventariou.
 *
 * Existe para o ASO: ao escolher o trabalhador, a grade de perigos passa a
 * mostrar o que o programa daquela obra identificou — para LER, não para marcar.
 * O porquê de não marcar está em `sugestaoDeRiscosDoAso.ts`.
 *
 * DUAS CONSULTAS, E NÃO UM JOIN
 *
 * O inventário pende do PGR, não da obra. Primeiro achamos os PGRs ativos do
 * projeto, depois os itens deles. Um join aninhado por `pgr.projeto_id` faria o
 * PostgREST filtrar DEPOIS de trazer, e o teto de linhas cortaria em silêncio.
 *
 * MAIS DE UM PGR POR OBRA É NORMAL
 *
 * Programa revisado gera versão nova, e obra grande pode ter um por frente. A
 * sugestão junta todos os ATIVOS e remove repetição — quem preenche quer saber
 * quais riscos existem ali, não de qual documento cada um veio.
 */

/** Teto de itens lidos. Sugestão é lista de leitura, não relatório. */
const LIMITE_DE_ITENS = 300;

export interface RiscosDaObra {
  sugestao: SugestaoDeRiscos;
  isLoading: boolean;
  /** Verdadeiro quando há obra e o PGR dela não tem nada inventariado. */
  semInventario: boolean;
}

export function useSgsstRiscosDaObra(projetoId?: string | null): RiscosDaObra {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const habilitado = !!projetoId && !!empresaId;

  const { data, isLoading } = useQuery({
    /*
      SUB-CHAVE DE `sgsst_pgr_inventario`, e nao uma chave propria.

      Esta consulta LE o inventario. As mutacoes do inventario ja invalidam a
      base inteira; pendurada nela, a sugestao se atualiza sozinha quando alguem
      acrescenta um risco ao PGR. Com chave propria ela ficaria parada pelos dez
      minutos de `staleTime` -- e o teste chavesDeCache.test.ts pegou isso.
    */
    queryKey: ["sgsst_pgr_inventario", "sugestao-da-obra", empresaId, projetoId],
    enabled: habilitado,
    // O inventário muda pouco e esta é uma consulta de apoio: revalidar a cada
    // abertura do formulário só gastaria rede.
    staleTime: 1000 * 60 * 10,
    queryFn: async (): Promise<ItemInventariadoParaSugestao[]> => {
      const { data: pgrs, error: erroPgr } = await (supabase
        .from("sgsst_pgr" as never)
        .select("id")
        .eq("empresa_id", empresaId!)
        .eq("projeto_id", projetoId!)
        .eq("status", "ATIVO") as never as Promise<{
        data: { id: string }[] | null;
        error: { message?: string } | null;
      }>);

      if (erroPgr) throw erroPgr;

      const ids = (pgrs ?? []).map((p) => p.id);
      if (ids.length === 0) return [];

      const { data: itens, error: erroItens } = await (supabase
        .from("sgsst_pgr_inventario" as never)
        .select("perigo, risco_catalogo:sgsst_riscos_catalogo(nome, categoria)")
        .in("pgr_id", ids)
        .limit(LIMITE_DE_ITENS) as never as Promise<{
        data: ItemInventariadoParaSugestao[] | null;
        error: { message?: string } | null;
      }>);

      if (erroItens) throw erroItens;
      return itens ?? [];
    },
  });

  const sugestao = sugestaoDeRiscosDoAso(data);

  return {
    sugestao,
    isLoading: habilitado && isLoading,
    // Só afirma "sem inventário" depois de ter carregado: durante a consulta a
    // lista vazia é ausência de resposta, não ausência de risco.
    semInventario: habilitado && !isLoading && sugestao.total === 0,
  };
}
