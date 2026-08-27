import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  consolidarIndicadores,
  consolidarInspecoes,
  consolidarPlanoAcao,
  type IncidenteIndicador,
  type ItemInspecaoIndicador,
  type MedidaIndicador,
  type ResumoIndicadores,
  type ResumoInspecoes,
  type ResumoPlanoAcao,
} from "@/utils/sgsstIndicadores";

/**
 * Indicadores de SST do período.
 *
 * O cruzamento é no cliente, sobre listas do período recortado, porque cada
 * indicador precisa das linhas e não só de uma contagem — "acidente com
 * afastamento" depende do tipo E dos dias perdidos, o que uma contagem no
 * servidor não resolve sem duplicar a regra em SQL.
 */

interface ErroConsulta {
  message?: string;
  code?: string;
}

/** Teto de segurança por consulta. */
export const INDICADORES_LIMITE_LINHAS = 5000;

export type OrigemHht = "MANUAL" | "DIARIO_OBRA" | "FOLHA";

export const ORIGEM_HHT_LABEL: Record<OrigemHht, string> = {
  MANUAL: "Informado manualmente",
  DIARIO_OBRA: "Somado do diário de obra",
  FOLHA: "Do departamento pessoal",
};

export interface SgsstHht {
  id: string;
  empresa_id: string;
  projeto_id?: string | null;
  ano: number;
  mes: number;
  horas: number;
  origem: OrigemHht;
  media_trabalhadores?: number | null;
  observacao?: string | null;
  created_at?: string;
  projeto?: { id: string; nome: string; codigo?: string | null } | null;
}

export type SgsstHhtInput = Omit<
  SgsstHht,
  "id" | "empresa_id" | "created_at" | "projeto"
>;

export interface PeriodoIndicadores {
  /** Data inicial, ISO YYYY-MM-DD. */
  de: string;
  /** Data final, ISO YYYY-MM-DD. */
  ate: string;
  /** Nulo = todas as obras (indicador consolidado). */
  projetoId?: string | null;
}

/** Primeiro e último dia do mês, no calendário local. */
export function limitesDoMes(ano: number, mes: number): { de: string; ate: string } {
  const dois = (n: number) => String(n).padStart(2, "0");
  // Dia 0 do mês seguinte é o último dia deste mês, sem tabela de dias por mês
  // e já tratando ano bissexto.
  const ultimoDia = new Date(ano, mes, 0).getDate();
  return { de: `${ano}-${dois(mes)}-01`, ate: `${ano}-${dois(mes)}-${dois(ultimoDia)}` };
}

/**
 * HHT cadastrado, por mês.
 *
 * Sem HHT as taxas da NBR 14280 não existem. É melhor a tela mostrar "—" e
 * explicar do que exibir um número calculado sobre denominador inventado.
 */
export function useSgsstHht(params?: { ano?: number }) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["sgsst_hht", empresaId, params?.ano ?? "todos"],
    enabled: !!empresaId,
    queryFn: async () => {
      let query = supabase
        .from("sgsst_hht" as never)
        .select("*, projeto:projetos(id, nome, codigo)")
        .order("ano", { ascending: false })
        .order("mes", { ascending: false })
        .limit(INDICADORES_LIMITE_LINHAS);

      if (params?.ano) {
        query = (query as unknown as { eq: (c: string, v: number) => typeof query }).eq(
          "ano",
          params.ano
        );
      }

      const { data, error } = await (query as never as Promise<{
        data: SgsstHht[] | null;
        error: ErroConsulta | null;
      }>);

      if (error) throw error;
      return data ?? [];
    },
  });

  const salvarHht = useMutation({
    mutationFn: async (input: SgsstHhtInput & { id?: string }) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { id, ...campos } = input;

      if (id) {
        const { error } = await (supabase
          .from("sgsst_hht" as never)
          .update({ ...campos, updated_at: new Date().toISOString() } as never)
          .eq("id", id) as never as Promise<{ error: ErroConsulta | null }>);
        if (error) throw error;
        return;
      }

      const { error } = await (supabase.from("sgsst_hht" as never).insert({
        ...campos,
        empresa_id: empresaId,
        created_by: profile?.id,
      } as never) as never as Promise<{ error: ErroConsulta | null }>);

      if (error) {
        // 23505 = índice único do período. Mensagem específica porque "violação
        // de constraint" não diz ao usuário o que fazer.
        if (error.code === "23505") {
          throw new Error(
            "Já existe HHT lançado para esta obra neste mês. Edite o registro existente."
          );
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_hht"] });
      queryClient.invalidateQueries({ queryKey: ["sgsst_indicadores"] });
      toast.success("HHT registrado.");
    },
    onError: (err: unknown) => {
      const detalhe = err instanceof Error ? err.message : String(err);
      toast.error(`Erro ao salvar o HHT: ${detalhe}`);
    },
  });

  const removerHht = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_hht" as never)
        .delete()
        .eq("id", id) as never as Promise<{ error: ErroConsulta | null }>);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_hht"] });
      queryClient.invalidateQueries({ queryKey: ["sgsst_indicadores"] });
      toast.success("HHT removido.");
    },
    onError: (err: unknown) => {
      const detalhe = err instanceof Error ? err.message : String(err);
      toast.error(`Erro ao remover o HHT: ${detalhe}`);
    },
  });

  return { registros: data ?? [], isLoading, error, refetch, salvarHht, removerHht };
}

interface LinhaHoraDiario {
  horas: number | null;
  diario?: { data: string; site?: { projeto_id: string } | null } | null;
}

/**
 * Horas somadas do diário de obra no período — sugestão de HHT.
 *
 * O app já registra horas por pessoa e por dia em `diario_equipe`. Aproveitar
 * isso poupa digitação, MAS o número que vale é o informado: quem fecha o
 * indicador mensal tira o HHT da folha, e o diário pode estar incompleto.
 *
 * Diário incompleto subestima o HHT e portanto INFLA as taxas, porque o HHT é
 * divisor. É o viés seguro para indicador de segurança — erra para pior.
 *
 * A chave é sub-chave de `diario_equipe`, e não de `sgsst_hht`, porque a base tem
 * de seguir o DADO e não a tela: o número sai de `diario_equipe`, e são as mutations
 * do diário que o mudam. Sob `sgsst_hht`, lançar horas no diário não invalidaria
 * nada, e registrar um HHT invalidaria à toa.
 */
export function useSgsstHhtSugerido(periodo: PeriodoIndicadores | null) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const { data, isLoading, error } = useQuery({
    queryKey: ["diario_equipe", "hht_sugerido", empresaId, periodo?.de, periodo?.ate, periodo?.projetoId],
    enabled: !!empresaId && !!periodo,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("diario_equipe")
        .select("horas, diario:diarios_obra!inner(data, site:sites!inner(projeto_id))")
        .gte("diario.data", periodo!.de)
        .lte("diario.data", periodo!.ate)
        .limit(INDICADORES_LIMITE_LINHAS) as never as Promise<{
        data: LinhaHoraDiario[] | null;
        error: ErroConsulta | null;
      }>);

      if (error) throw error;

      const linhas = (data ?? []).filter((l) =>
        periodo!.projetoId ? l.diario?.site?.projeto_id === periodo!.projetoId : true
      );

      return {
        horas: linhas.reduce((s, l) => s + (l.horas ?? 0), 0),
        lancamentos: linhas.length,
        truncado: (data ?? []).length >= INDICADORES_LIMITE_LINHAS,
      };
    },
  });

  return {
    horas: data?.horas ?? 0,
    lancamentos: data?.lancamentos ?? 0,
    truncado: data?.truncado ?? false,
    isLoading,
    error,
  };
}

export interface IndicadoresConsolidados {
  seguranca: ResumoIndicadores;
  inspecoes: ResumoInspecoes;
  planoAcao: ResumoPlanoAcao;
  /** Quais consultas falharam, para a tela mostrar "—" em vez de zero. */
  indisponiveis: string[];
  truncado: boolean;
}

async function buscar<T>(
  tabela: string,
  select: string,
  aplicar?: (q: unknown) => unknown
): Promise<{ dados: T[]; falhou: boolean }> {
  const base = supabase.from(tabela as never).select(select).limit(INDICADORES_LIMITE_LINHAS);
  const query = aplicar ? aplicar(base) : base;

  const { data, error } = await (query as never as Promise<{
    data: T[] | null;
    error: ErroConsulta | null;
  }>);

  // Falha de uma consulta não zera as outras: cada indicador é independente, e
  // zero significaria "não houve", não "não deu para contar".
  if (error) return { dados: [], falhou: true };
  return { dados: data ?? [], falhou: false };
}

export function useSgsstIndicadores(periodo: PeriodoIndicadores) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      "sgsst_indicadores",
      empresaId,
      periodo.de,
      periodo.ate,
      periodo.projetoId ?? "todas",
    ],
    enabled: !!empresaId,
    staleTime: 1000 * 60,
    queryFn: async (): Promise<IndicadoresConsolidados> => {
      const filtroProjeto = (q: unknown) =>
        periodo.projetoId
          ? (q as { eq: (c: string, v: string) => unknown }).eq("projeto_id", periodo.projetoId)
          : q;

      const [incidentes, hhtRegistros, itensInspecao, medidas] = await Promise.all([
        buscar<IncidenteIndicador>(
          "sgsst_incidentes",
          "tipo, data_ocorrencia, dias_perdidos, dias_debitados, cat_emitida, projeto_id",
          (q) =>
            filtroProjeto(
              (q as { gte: (c: string, v: string) => { lte: (c: string, v: string) => unknown } })
                .gte("data_ocorrencia", periodo.de)
                .lte("data_ocorrencia", periodo.ate)
            )
        ),
        buscar<{ horas: number; origem: OrigemHht; projeto_id: string | null; ano: number; mes: number }>(
          "sgsst_hht",
          "horas, origem, projeto_id, ano, mes"
        ),
        // Ancora em `data_planejada` e nao em `data_execucao`: a segunda e
        // anulavel, e o PostgREST nao tem coalesce em filtro. O recorte por
        // status CONCLUIDA garante que so entra inspecao que de fato aconteceu.
        buscar<ItemInspecaoIndicador>(
          "sgsst_inspecoes_itens",
          "resposta, inspecao:sgsst_inspecoes!inner(data_planejada, status, projeto_id)",
          (q) =>
            (
              q as {
                gte: (c: string, v: string) => {
                  lte: (c: string, v: string) => { eq: (c: string, v: string) => unknown };
                };
              }
            )
              .gte("inspecao.data_planejada", periodo.de)
              .lte("inspecao.data_planejada", periodo.ate)
              .eq("inspecao.status", "CONCLUIDA")
        ),
        buscar<MedidaIndicador>(
          "sgsst_pgr_medidas_controle",
          "status, prazo, data_implementacao, resultado_verificacao"
        ),
      ]);

      const indisponiveis: string[] = [];
      if (incidentes.falhou) indisponiveis.push("Incidentes");
      if (hhtRegistros.falhou) indisponiveis.push("HHT");
      if (itensInspecao.falhou) indisponiveis.push("Inspeções");
      if (medidas.falhou) indisponiveis.push("Plano de ação");

      // Soma o HHT dos meses dentro do período. O consolidado (projeto nulo) só
      // entra quando não há recorte por obra — somar os dois contaria em dobro.
      const anoMesNoPeriodo = (ano: number, mes: number) => {
        const primeiro = `${ano}-${String(mes).padStart(2, "0")}-01`;
        return primeiro >= periodo.de.slice(0, 7) + "-01" && primeiro <= periodo.ate;
      };

      const hhtDoPeriodo = hhtRegistros.dados.filter((h) => {
        if (!anoMesNoPeriodo(h.ano, h.mes)) return false;
        return periodo.projetoId ? h.projeto_id === periodo.projetoId : h.projeto_id === null;
      });

      const hht = hhtDoPeriodo.reduce((s, h) => s + Number(h.horas ?? 0), 0);

      // Origem única quando todos os meses vêm da mesma fonte; "mista" quando não.
      const origens = [...new Set(hhtDoPeriodo.map((h) => h.origem))];
      const origemHht =
        origens.length === 0 ? null : origens.length === 1 ? origens[0] : "MISTA";

      return {
        seguranca: consolidarIndicadores({
          incidentes: incidentes.dados,
          hht: hht > 0 ? hht : null,
          origemHht,
        }),
        inspecoes: consolidarInspecoes(itensInspecao.dados),
        planoAcao: consolidarPlanoAcao(medidas.dados, new Date()),
        indisponiveis,
        truncado: [incidentes, itensInspecao, medidas].some(
          (r) => r.dados.length >= INDICADORES_LIMITE_LINHAS
        ),
      };
    },
  });

  return { indicadores: data ?? null, isLoading, error, refetch };
}
