import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSgsstFuncaoMatriz } from "@/hooks/sgsst/useSgsstFuncaoMatriz";
import {
  montarPanorama,
  agruparPorTreinamento,
  JANELA_PANORAMA_DIAS,
  type MatriculaPanorama,
  type PendenciaDaFuncao,
  type ResultadoPanorama,
  type GrupoPorTreinamento,
} from "@/utils/sgsstTreinamentoPanorama";

/**
 * Panorama de treinamentos — as duas metades juntas.
 *
 * Uma metade vem da matriz de função (quem nunca fez o que a função exige); a
 * outra vem das matrículas com validade próxima. Nenhuma das duas, sozinha,
 * responde "que turma abrir e para quem".
 *
 * As duas consultas são independentes de propósito: se a matriz falhar, a lista
 * de vencimentos ainda aparece, e vice-versa. Uma tela que fica vazia inteira
 * por causa de uma consulta esconde o que a outra sabia.
 */

/** Teto de linhas na consulta de matrículas. */
export const PANORAMA_LIMITE_LINHAS = 2000;

interface LinhaMatricula {
  colaborador_id: string;
  resultado: string;
  validade?: string | null;
  colaborador?: {
    nome?: string | null;
    profile?: { nome: string } | null;
    recurso?: { nome: string } | null;
    funcao?: { nome: string } | null;
    projeto?: { nome: string } | null;
  } | null;
  turma?: {
    treinamento_id?: string | null;
    treinamento?: { nome: string } | null;
  } | null;
}

/** Data local em "YYYY-MM-DD" — `toISOString()` desloca o fuso e erra o dia. */
function comoIso(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${data.getFullYear()}-${mes}-${dia}`;
}

export interface PanoramaTreinamentos extends ResultadoPanorama {
  grupos: GrupoPorTreinamento[];
  isLoading: boolean;
  /** Erro da matriz de função — a metade do "nunca fez". */
  erroPendencias: unknown;
  /** Erro da consulta de matrículas — a metade do "está vencendo". */
  erroVencimentos: unknown;
  /** Verdadeiro quando alguma das listas bateu o teto. */
  truncado: boolean;
  refetch: () => void;
}

export function useSgsstTreinamentoPanorama(options?: {
  enabled?: boolean;
  janelaDias?: number;
}): PanoramaTreinamentos {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const habilitado = !!empresaId && options?.enabled !== false;
  const janela = options?.janelaDias ?? JANELA_PANORAMA_DIAS;

  const matriz = useSgsstFuncaoMatriz({ enabled: habilitado });

  const {
    data: matriculas,
    isLoading: carregandoMatriculas,
    error: erroVencimentos,
    refetch: refetchMatriculas,
  } = useQuery({
    queryKey: ["sgsst_panorama_matriculas", empresaId, janela],
    enabled: habilitado,
    staleTime: 1000 * 60,
    queryFn: async (): Promise<{ linhas: MatriculaPanorama[]; truncado: boolean }> => {
      const limite = new Date();
      limite.setDate(limite.getDate() + janela);

      const { data, error } = await (supabase
        .from("sgsst_treinamentos_participantes" as never)
        .select(
          `colaborador_id, resultado, validade,
           colaborador:sgsst_colaborador_dados(
             nome, profile:profiles(nome), recurso:recursos(nome),
             funcao:sgsst_funcoes(nome), projeto:projetos(nome)
           ),
           turma:sgsst_treinamentos_turmas(
             treinamento_id, treinamento:sgsst_treinamentos(nome)
           )`
        )
        // Recorta no servidor: sem validade, ou com validade distante, não há o
        // que programar. O filtro também descarta as linhas de validade nula.
        .lte("validade", comoIso(limite))
        .order("validade", { ascending: true })
        .limit(PANORAMA_LIMITE_LINHAS) as never as Promise<{
        data: LinhaMatricula[] | null;
        error: unknown;
      }>);

      if (error) throw error;

      const brutas = data ?? [];

      return {
        linhas: brutas.map((m) => ({
          colaboradorId: m.colaborador_id,
          colaborador:
            m.colaborador?.profile?.nome ||
            m.colaborador?.recurso?.nome ||
            m.colaborador?.nome ||
            "(sem nome)",
          funcaoNome: m.colaborador?.funcao?.nome ?? null,
          obra: m.colaborador?.projeto?.nome ?? null,
          treinamentoId: m.turma?.treinamento_id ?? null,
          treinamentoNome: m.turma?.treinamento?.nome ?? "(treinamento removido)",
          resultado: m.resultado,
          validade: m.validade ?? null,
        })),
        truncado: brutas.length >= PANORAMA_LIMITE_LINHAS,
      };
    },
  });

  // Só a metade de treinamento da matriz: EPI tem tela própria e entraria aqui
  // como ruído para quem está montando cronograma de capacitação.
  const pendencias: PendenciaDaFuncao[] = matriz.pendencias
    .filter(
      (p) =>
        p.tipo === "TREINAMENTO" &&
        (p.situacao === "NUNCA_FEITO" || p.situacao === "VENCIDO")
    )
    .map((p) => ({
      colaboradorId: p.colaboradorId,
      colaborador: p.colaborador,
      funcaoNome: p.funcaoNome ?? null,
      obra: p.obra ?? null,
      treinamentoId: p.itemId,
      treinamentoNome: p.itemNome,
      situacao: p.situacao as "NUNCA_FEITO" | "VENCIDO",
      vencimento: p.vencimento ?? null,
    }));

  const resultado = montarPanorama({
    pendencias,
    matriculas: matriculas?.linhas ?? [],
    hoje: new Date(),
    janelaDias: janela,
  });

  return {
    ...resultado,
    grupos: agruparPorTreinamento(resultado.linhas),
    isLoading: matriz.isLoading || carregandoMatriculas,
    erroPendencias: matriz.error,
    erroVencimentos,
    truncado: matriz.truncado || (matriculas?.truncado ?? false),
    refetch: () => {
      matriz.refetch();
      void refetchMatriculas();
    },
  };
}
