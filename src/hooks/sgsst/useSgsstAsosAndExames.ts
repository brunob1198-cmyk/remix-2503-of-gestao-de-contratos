import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { escapeSearchTerm } from "@/utils/sgsstSearch";
import { parseISO, isBefore, isAfter, addDays, startOfDay } from "date-fns";

export type TipoExameOcupacional =
  | "Admissional"
  | "Periódico"
  | "Retorno ao Trabalho"
  | "Mudança de Risco/Função"
  | "Demissional"
  | "Complementar"
  | "Outros";

export type StatusExameOcupacional = "PENDENTE" | "AGENDADO" | "REALIZADO" | "CANCELADO";

export type AptidaoAso = "APTO" | "APTO_COM_RESTRICAO" | "INAPTO";

export type StatusAso = "ATIVO" | "SUBSTITUIDO" | "CANCELADO";

export type StatusVencimentoAso = "VALIDO" | "PROXIMO_VENCIMENTO" | "VENCIDO";

export interface SgsstExame {
  id: string;
  empresa_id: string;
  colaborador_id: string;
  pcmso_id?: string | null;
  pcmso_exame_id?: string | null;
  nome_exame: string;
  tipo: TipoExameOcupacional;
  data_solicitacao: string;
  data_realizacao?: string | null;
  resultado?: string | null;
  medico_responsavel?: string | null;
  observacoes?: string | null;
  status: StatusExameOcupacional;
  created_at?: string;
  updated_at?: string;
  // Joined Data
  colaborador?: {
    id: string;
    cpf: string;
    profile?: { id: string; nome: string } | null;
    recurso?: { id: string; nome: string } | null;
    funcao?: { id: string; nome: string } | null;
  } | null;
  pcmso?: { id: string; codigo: string; titulo: string } | null;
}

export type SgsstExameInput = Omit<
  SgsstExame,
  "id" | "empresa_id" | "created_at" | "updated_at" | "colaborador" | "pcmso"
>;

export interface SgsstAso {
  id: string;
  empresa_id: string;
  colaborador_id: string;
  exame_id?: string | null;
  pcmso_id?: string | null;
  numero_documento?: string | null;
  data_emissao: string;
  tipo: TipoExameOcupacional;
  aptidao: AptidaoAso;
  validade: string;
  medico_responsavel?: string | null;
  crm_medico?: string | null;
  descricao_restricao?: string | null;
  data_inicio_restricao?: string | null;
  data_termino_restricao?: string | null;
  observacoes?: string | null;
  status: StatusAso;
  created_at?: string;
  updated_at?: string;
  // Joined Data
  colaborador?: {
    id: string;
    cpf: string;
    profile?: { id: string; nome: string } | null;
    recurso?: { id: string; nome: string } | null;
    funcao?: { id: string; nome: string } | null;
  } | null;
  pcmso?: { id: string; codigo: string; titulo: string } | null;
  exame?: { id: string; nome_exame: string; data_realizacao: string } | null;
  // Calculated dynamically
  statusVencimento?: StatusVencimentoAso;
}

export type SgsstAsoInput = Omit<
  SgsstAso,
  "id" | "empresa_id" | "created_at" | "updated_at" | "colaborador" | "pcmso" | "exame" | "statusVencimento"
>;

export interface SgsstAsoHistorico {
  id: string;
  empresa_id: string;
  aso_id: string;
  usuario_id?: string | null;
  operacao: string;
  status_anterior?: string | null;
  novo_status: string;
  observacao?: string | null;
  created_at: string;
  usuario?: { id: string; nome: string | null } | null;
}

import { calculateVencimentoAso } from "@/utils/sgsstAsoUtils";

export { calculateVencimentoAso };

// Hook for Exames Ocupacionais
export interface SgsstExamesParams {
  page?: number;
  pageSize?: number;
  /** Busca no nome do exame e no medico responsavel. */
  search?: string;
  status?: string;
}

/** Teto para o uso como lista de apoio (select do dialogo de ASO). */
export const EXAMES_LISTA_LIMITE = 1000;

/**
 * Sem `params`, devolve a lista inteira (uso como lista de apoio).
 * Com `params`, pagina e filtra no servidor (uso na aba de Exames).
 */
export function useSgsstExames(params?: SgsstExamesParams) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const paginado = !!params;
  const page = params?.page ?? 0;
  const pageSize = params?.pageSize ?? 25;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      "sgsst_exames",
      empresaId,
      paginado ? page : "all",
      paginado ? pageSize : "all",
      params?.search ?? "",
      params?.status ?? "",
    ],
    enabled: !!empresaId,
    queryFn: async () => {
      let query = supabase
        .from("sgsst_exames" as any)
        .select(
          `
          *,
          colaborador:sgsst_colaborador_dados(
            id, cpf,
            profile:profiles(id, nome),
            recurso:recursos(id, nome),
            funcao:sgsst_funcoes(id, nome)
          ),
          pcmso:sgsst_pcmso(id, codigo, titulo)
        `,
          { count: "exact" }
        )
        .order("created_at", { ascending: false });

      if (params?.search) {
        const term = escapeSearchTerm(params.search);
        if (term) {
          query = query.or(
            `nome_exame.ilike.%${term}%,medico_responsavel.ilike.%${term}%`
          );
        }
      }

      if (params?.status && params.status !== "todos") {
        query = query.eq("status", params.status);
      }

      query = paginado
        ? query.range(page * pageSize, page * pageSize + pageSize - 1)
        : query.limit(EXAMES_LISTA_LIMITE);

      const { data, error, count } = await (query as any);
      if (error) throw error;

      const rows = (data as SgsstExame[]) || [];
      return { rows, total: count ?? rows.length };
    },
  });

  const exames = data?.rows ?? [];

  const createExame = useMutation({
    mutationFn: async (input: SgsstExameInput) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data, error } = await (supabase
        .from("sgsst_exames" as any)
        .insert({
          ...input,
          empresa_id: empresaId,
        })
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstExame;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_exames"] });
      toast.success("Exame Ocupacional solicitado com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao solicitar exame: ${err.message || err}`);
    },
  });

  const updateExame = useMutation({
    mutationFn: async ({ id, ...input }: Partial<SgsstExameInput> & { id: string }) => {
      const { data, error } = await (supabase
        .from("sgsst_exames" as any)
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstExame;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_exames"] });
      toast.success("Exame Ocupacional atualizado com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar exame: ${err.message || err}`);
    },
  });

  const removeExame = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_exames" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_exames"] });
      toast.success("Exame Ocupacional removido!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover exame: ${err.message || err}`);
    },
  });

  return {
    exames,
    total: data?.total ?? 0,
    isLoading,
    error,
    refetch,
    createExame,
    updateExame,
    removeExame,
  };
}

// Hook for ASOs
export interface SgsstAsosParams {
  page?: number;
  pageSize?: number;
  /** Busca no numero do documento do ASO. */
  search?: string;
  tipo?: string;
  aptidao?: string;
  colaboradorId?: string;
  pcmsoId?: string;
  /** "VALIDO" | "PROXIMO_VENCIMENTO" | "VENCIDO" */
  vencimento?: string;
}

/** Mesma janela de 30 dias usada por calculateVencimentoAso. */
const DIAS_AVISO_VENCIMENTO = 30;

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * ASOs crescem por colaborador e por ano — e a consulta nao tinha limite algum,
 * entao a partir de ~1000 registros o PostgREST passava a cortar em silencio.
 * Agora pagina no servidor, com todos os filtros aplicados antes do corte.
 */
export function useSgsstAsos(params?: SgsstAsosParams) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const paginado = !!params;
  const page = params?.page ?? 0;
  const pageSize = params?.pageSize ?? 25;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      "sgsst_asos",
      empresaId,
      paginado ? page : "all",
      paginado ? pageSize : "all",
      params?.search ?? "",
      params?.tipo ?? "",
      params?.aptidao ?? "",
      params?.colaboradorId ?? "",
      params?.pcmsoId ?? "",
      params?.vencimento ?? "",
    ],
    enabled: !!empresaId,
    queryFn: async () => {
      let query = supabase
        .from("sgsst_asos" as any)
        .select(
          `
          *,
          colaborador:sgsst_colaborador_dados(
            id, cpf,
            profile:profiles(id, nome),
            recurso:recursos(id, nome),
            funcao:sgsst_funcoes(id, nome)
          ),
          pcmso:sgsst_pcmso(id, codigo, titulo),
          exame:sgsst_exames(id, nome_exame, data_realizacao)
        `,
          { count: "exact" }
        )
        .order("data_emissao", { ascending: false });

      if (params?.search) {
        const term = escapeSearchTerm(params.search);
        if (term) query = query.ilike("numero_documento", `%${term}%`);
      }

      if (params?.tipo && params.tipo !== "todos") query = query.eq("tipo", params.tipo);
      if (params?.aptidao && params.aptidao !== "todos")
        query = query.eq("aptidao", params.aptidao);
      if (params?.colaboradorId && params.colaboradorId !== "todos")
        query = query.eq("colaborador_id", params.colaboradorId);
      if (params?.pcmsoId && params.pcmsoId !== "todos")
        query = query.eq("pcmso_id", params.pcmsoId);

      // O status de vencimento e derivado de `validade`, entao filtra por faixa
      // de data em vez de depender do calculo feito no cliente — assim o filtro
      // vale para a base inteira e nao so para a pagina carregada.
      if (params?.vencimento && params.vencimento !== "todos") {
        const hoje = new Date();
        const limite = new Date(hoje);
        limite.setDate(limite.getDate() + DIAS_AVISO_VENCIMENTO);

        if (params.vencimento === "VENCIDO") {
          query = query.lt("validade", isoDate(hoje));
        } else if (params.vencimento === "PROXIMO_VENCIMENTO") {
          query = query.gte("validade", isoDate(hoje)).lte("validade", isoDate(limite));
        } else if (params.vencimento === "VALIDO") {
          query = query.gt("validade", isoDate(limite));
        }
      }

      query = paginado
        ? query.range(page * pageSize, page * pageSize + pageSize - 1)
        : query.limit(1000);

      const { data, error, count } = await (query as any);
      if (error) throw error;

      const rows = ((data || []) as SgsstAso[]).map((aso) => ({
        ...aso,
        statusVencimento: calculateVencimentoAso(aso.validade),
      }));

      return { rows, total: count ?? rows.length };
    },
  });

  const asos = data?.rows ?? [];

  const createAso = useMutation({
    mutationFn: async (input: SgsstAsoInput) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      // Regra de Integridade e Substituição: se existir ASO ATIVO para o mesmo colaborador, substitui
      const { data: activeAsos } = await (supabase
        .from("sgsst_asos" as any)
        .select("id")
        .eq("empresa_id", empresaId)
        .eq("colaborador_id", input.colaborador_id)
        .eq("status", "ATIVO") as any);

      if (activeAsos && activeAsos.length > 0) {
        for (const oldAso of activeAsos) {
          await supabase
            .from("sgsst_asos" as any)
            .update({ status: "SUBSTITUIDO", updated_at: new Date().toISOString() })
            .eq("id", oldAso.id);

          await supabase.from("sgsst_asos_historico" as any).insert({
            empresa_id: empresaId,
            aso_id: oldAso.id,
            usuario_id: profile?.id,
            operacao: "SUBSTITUICAO",
            status_anterior: "ATIVO",
            novo_status: "SUBSTITUIDO",
            observacao: "Substituído por novo ASO emitido.",
          });
        }
      }

      const { data: createdAso, error } = await (supabase
        .from("sgsst_asos" as any)
        .insert({
          ...input,
          empresa_id: empresaId,
        })
        .select()
        .single() as any);

      if (error) throw error;

      // Log inicial no histórico
      await supabase.from("sgsst_asos_historico" as any).insert({
        empresa_id: empresaId,
        aso_id: createdAso.id,
        usuario_id: profile?.id,
        operacao: "EMISSAO",
        status_anterior: null,
        novo_status: createdAso.status,
        observacao: `Emissão do ASO [Aptidão: ${createdAso.aptidao}]`,
      });

      // Se o ASO veio de um exame, atualiza o status do exame para REALIZADO
      if (input.exame_id) {
        await supabase
          .from("sgsst_exames" as any)
          .update({ status: "REALIZADO", data_realizacao: input.data_emissao })
          .eq("id", input.exame_id);
      }

      return createdAso as SgsstAso;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_asos"] });
      queryClient.invalidateQueries({ queryKey: ["sgsst_exames"] });
      toast.success("ASO emitido com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao emitir ASO: ${err.message || err}`);
    },
  });

  const updateAso = useMutation({
    mutationFn: async ({ id, ...input }: Partial<SgsstAsoInput> & { id: string }) => {
      const { data, error } = await (supabase
        .from("sgsst_asos" as any)
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstAso;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_asos"] });
      toast.success("ASO atualizado!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar ASO: ${err.message || err}`);
    },
  });

  const cancelAso = useMutation({
    mutationFn: async ({ id, observacao }: { id: string; observacao?: string }) => {
      const { data, error } = await (supabase
        .from("sgsst_asos" as any)
        .update({
          status: "CANCELADO",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;

      // Log no histórico
      await supabase.from("sgsst_asos_historico" as any).insert({
        empresa_id: empresaId,
        aso_id: id,
        usuario_id: profile?.id,
        operacao: "CANCELAMENTO",
        status_anterior: "ATIVO",
        novo_status: "CANCELADO",
        observacao: observacao || "ASO cancelado formalmente.",
      });

      return data as SgsstAso;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_asos"] });
      queryClient.invalidateQueries({ queryKey: ["sgsst_asos_historico"] });
      toast.success("ASO cancelado!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao cancelar ASO: ${err.message || err}`);
    },
  });

  const removeAso = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_asos" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_asos"] });
      toast.success("ASO removido!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover ASO: ${err.message || err}`);
    },
  });

  return {
    asos,
    total: data?.total ?? 0,
    isLoading,
    error,
    refetch,
    createAso,
    updateAso,
    cancelAso,
    removeAso,
  };
}

// Hook for Histórico ASO
export function useSgsstAsoHistorico(asoId?: string) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const { data: historico = [], isLoading } = useQuery({
    queryKey: ["sgsst_asos_historico", asoId],
    enabled: !!asoId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_asos_historico" as any)
        .select(`
          *,
          usuario:profiles!sgsst_asos_historico_usuario_id_fkey(id, nome)
        `)
        .eq("aso_id", asoId!)
        .order("created_at", { ascending: false }) as any);

      if (error) throw error;
      return (data as SgsstAsoHistorico[]) || [];
    },
  });

  return {
    historico,
    isLoading,
  };
}
