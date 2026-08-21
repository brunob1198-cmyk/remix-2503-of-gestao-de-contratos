import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSgsstFuncaoMatriz } from "@/hooks/sgsst/useSgsstFuncaoMatriz";
import type { PendenciaDossie } from "@/lib/dossieDocumento";
import type { SgsstAso } from "@/hooks/sgsst/useSgsstAsosAndExames";
import type { SgsstEpiEntrega } from "@/hooks/sgsst/useSgsstEpis";
import type { SgsstTreinamentoParticipante } from "@/hooks/sgsst/useSgsstTreinamentos";

/**
 * Reúne o que o sistema sabe sobre um trabalhador, para a emissão do dossiê.
 *
 * São quatro fontes em módulos diferentes — ASO, turmas de treinamento, entregas
 * de EPI e o cruzamento com as exigências da função. É exatamente por estarem
 * separadas que montar a pasta à mão exigia abrir cinco telas.
 *
 * As consultas correm em paralelo e cada uma devolve o erro dela: se as entregas
 * de EPI falharem, o dossiê sai com ASO e treinamentos, dizendo o que faltou. Uma
 * emissão que aborta inteira por causa de uma consulta entrega menos que uma
 * emissão parcial declarada.
 */

/** Teto por lista. Um trabalhador real não chega perto; é anti-runaway. */
export const DOSSIE_LIMITE_LINHAS = 500;

interface ErroConsulta {
  message?: string;
  code?: string;
}

async function buscarDoColaborador<T>(
  tabela: string,
  select: string,
  colaboradorId: string,
  ordem: string
): Promise<T[]> {
  const { data, error } = await (supabase
    .from(tabela as never)
    .select(select)
    .eq("colaborador_id", colaboradorId)
    .order(ordem, { ascending: false })
    .limit(DOSSIE_LIMITE_LINHAS) as never as Promise<{
    data: T[] | null;
    error: ErroConsulta | null;
  }>);

  if (error) throw error;
  return data ?? [];
}

export interface DossieDoColaborador {
  asos: SgsstAso[];
  matriculas: SgsstTreinamentoParticipante[];
  entregasEpi: SgsstEpiEntrega[];
  pendencias: PendenciaDossie[];
  /** Erros por fonte: o dossiê sai declarando o que não pôde ser lido. */
  erros: { fonte: string; erro: unknown }[];
  isLoading: boolean;
  refetch: () => void;
}

/**
 * `enabled: false` mantém tudo fora do ar até a emissão ser pedida. A tela de
 * colaboradores lista dezenas de linhas; carregar quatro consultas por linha
 * seria custo sem uso.
 */
export function useSgsstColaboradorDossie(
  colaboradorId?: string,
  options?: { enabled?: boolean }
): DossieDoColaborador {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const habilitado = !!colaboradorId && !!empresaId && options?.enabled !== false;

  const asos = useQuery({
    queryKey: ["sgsst_dossie_asos", colaboradorId],
    enabled: habilitado,
    queryFn: () =>
      buscarDoColaborador<SgsstAso>(
        "sgsst_asos",
        "*",
        colaboradorId as string,
        "data_emissao"
      ),
  });

  const matriculas = useQuery({
    queryKey: ["sgsst_dossie_matriculas", colaboradorId],
    enabled: habilitado,
    queryFn: () =>
      buscarDoColaborador<SgsstTreinamentoParticipante>(
        "sgsst_treinamentos_participantes",
        `*, turma:sgsst_treinamentos_turmas(
           codigo_turma, treinamento:sgsst_treinamentos(nome, carga_horaria)
         )`,
        colaboradorId as string,
        "data_conclusao"
      ),
  });

  const entregas = useQuery({
    queryKey: ["sgsst_dossie_epis", colaboradorId],
    enabled: habilitado,
    queryFn: () =>
      buscarDoColaborador<SgsstEpiEntrega>(
        "sgsst_epi_entregas",
        "*, epi:sgsst_epis(nome, ca, unidade_medida)",
        colaboradorId as string,
        "data_entrega"
      ),
  });

  // A matriz é da empresa inteira e já fica em cache com staleTime; aqui só se
  // recorta a parte deste trabalhador.
  const matriz = useSgsstFuncaoMatriz({ enabled: habilitado });

  const pendencias: PendenciaDossie[] = matriz.pendencias
    .filter(
      (p) =>
        p.colaboradorId === colaboradorId &&
        (p.situacao === "NUNCA_FEITO" || p.situacao === "VENCIDO")
    )
    .map((p) => ({
      tipo: p.tipo,
      itemNome: p.itemNome,
      situacao: p.situacao as "NUNCA_FEITO" | "VENCIDO",
      vencimento: p.vencimento ?? null,
    }));

  const erros = [
    { fonte: "Exames ocupacionais", erro: asos.error },
    { fonte: "Matrículas em turmas", erro: matriculas.error },
    { fonte: "Entregas de EPI", erro: entregas.error },
    { fonte: "Exigências da função", erro: matriz.error },
  ].filter((e) => !!e.erro);

  return {
    asos: asos.data ?? [],
    matriculas: matriculas.data ?? [],
    entregasEpi: entregas.data ?? [],
    pendencias,
    erros,
    isLoading:
      asos.isLoading || matriculas.isLoading || entregas.isLoading || matriz.isLoading,
    refetch: () => {
      void asos.refetch();
      void matriculas.refetch();
      void entregas.refetch();
      matriz.refetch();
    },
  };
}
