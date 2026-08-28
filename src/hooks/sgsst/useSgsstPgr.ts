import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { escapeSearchTerm } from "@/utils/sgsstSearch";
import { useSgsstCounts } from "./useSgsstCounts";
import { useEmpresaAtual } from "@/hooks/useEmpresaAtual";
import type {
  ResultadoAvaliacao,
  TecnicaAvaliacao,
  TipoExposicao,
} from "@/utils/sgsstPgrInventario";

// Reexportados porque nascem junto das funcoes de conformidade do inventario,
// mas quem consome o PGR importa tudo pelo hook.
export type { ResultadoAvaliacao, TecnicaAvaliacao, TipoExposicao };

export type StatusPgr = "RASCUNHO" | "ATIVO" | "EM_REVISAO" | "ENCERRADO";

export interface SgsstPgr {
  id: string;
  empresa_id: string;
  projeto_id: string;
  site_id?: string | null;
  codigo?: string | null;
  titulo: string;
  objetivo?: string | null;
  responsavel_id?: string | null;
  data_inicio: string;
  /** Data da ULTIMA revisao realizada, nao a proxima. Ver sgsstPgrRevisao. */
  data_revisao?: string | null;
  /**
   * NR-01 1.5.4.4.5: 2 anos na regra geral, 3 anos com sistema de gestao de SST
   * certificado. E dado, e nao constante no codigo, por causa desse segundo caso.
   */
  periodicidade_revisao_meses?: number | null;
  versao?: number | null;
  /**
   * Identificacao da organizacao congelada na emissao. Ler de `empresas` ao
   * imprimir faria PGRs antigos passarem a mostrar o nome novo da empresa.
   */
  empresa_nome?: string | null;
  empresa_cnpj?: string | null;
  responsavel_tecnico?: string | null;
  registro_responsavel?: string | null;
  metodologia?: string | null;
  status: StatusPgr;
  observacoes?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
  // Joined Data
  projeto?: { id: string; codigo: string; nome: string } | null;
  site?: { id: string; codigo: string; nome: string } | null;
  responsavel?: { id: string; nome: string | null } | null;
}

export type SgsstPgrInput = Omit<SgsstPgr, "id" | "empresa_id" | "created_at" | "updated_at" | "projeto" | "site" | "responsavel">;

export interface SgsstPgrInventario {
  id: string;
  empresa_id: string;
  pgr_id: string;
  risco_catalogo_id?: string | null;
  area_id?: string | null;
  atividade: string;
  perigo: string;
  fonte_geradora?: string | null;
  consequencia?: string | null;
  /**
   * QUANTIDADE de expostos. A NR-01 1.5.7.3.2 pede tambem QUAIS grupos — isso
   * esta em `grupos_expostos` (texto livre) e na tabela de ligacao com funcoes.
   */
  trabalhadores_expostos: number;
  probabilidade: number;
  severidade: number;
  nivel_risco?: number;
  classificacao?: "BAIXO" | "MODERADO" | "ALTO" | "CRÍTICO";
  medidas_existentes?: string | null;
  medidas_necessarias?: string | null;

  // --- Alineas que faltavam ao inventario (NR-01 1.5.7.3.2) ---
  /** Caracterizacao da exposicao. Herdavel de sgsst_funcao_riscos. */
  tipo_exposicao?: TipoExposicao | null;
  tempo_exposicao?: string | null;
  /** Como e o ambiente. `area_id` diz onde no cadastro; isto diz o que importa. */
  descricao_local?: string | null;
  /** Grupos que nao correspondem a funcao cadastrada (terceiros, visitantes). */
  grupos_expostos?: string | null;
  // Dados de monitoramento.
  intensidade_medida?: number | null;
  unidade_medida?: string | null;
  /**
   * Limite usado NESTA avaliacao, copiado do catalogo no lancamento. Nao e lido
   * por join de proposito: se o catalogo mudar, o inventario ja emitido nao pode
   * mudar retroativamente.
   */
  limite_tolerancia_aplicado?: number | null;
  tecnica_avaliacao?: TecnicaAvaliacao | null;
  data_medicao?: string | null;
  /** Declarado, nao calculado: ha agente cujo limite e piso e nao teto (NR-33). */
  resultado_avaliacao?: ResultadoAvaliacao | null;
  metodologia_medicao?: string | null;

  responsavel_id?: string | null;
  prazo?: string | null;
  status: "pendente" | "em_andamento" | "concluido" | "cancelado";
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
  // Joined Data
  risco_catalogo?: {
    id: string;
    nome: string;
    categoria: string;
    agente?: string | null;
    limite_tolerancia?: number | null;
    unidade_medida?: string | null;
    tecnica_avaliacao?: string | null;
    base_legal?: string | null;
  } | null;
  area?: { id: string; nome: string } | null;
  responsavel?: { id: string; nome: string | null } | null;
  /** Funcoes expostas, quando carregadas junto. */
  funcoes?: { id: string; funcao_id: string; funcao?: { id: string; nome: string } | null }[];
}

export type SgsstPgrInventarioInput = Omit<
  SgsstPgrInventario,
  | "id"
  | "empresa_id"
  | "nivel_risco"
  | "classificacao"
  | "created_at"
  | "updated_at"
  | "risco_catalogo"
  | "area"
  | "responsavel"
  | "funcoes"
>;

export interface SgsstPgrMedidaControle {
  id: string;
  empresa_id: string;
  inventario_id: string;
  descricao: string;
  tipo: "Eliminação" | "Substituição" | "Engenharia" | "Administrativa" | "EPI";
  responsavel_id?: string | null;
  prazo?: string | null;
  status: "pendente" | "em_andamento" | "implementado" | "cancelado";
  data_implementacao?: string | null;
  observacao?: string | null;

  // --- NR-01 1.5.5.2: o plano de acao pede as duas coisas junto ---
  /** Como o cumprimento da medida sera acompanhado. */
  forma_acompanhamento?: string | null;
  /**
   * Afericao dos resultados: a medida implantada de fato reduziu o risco?
   * PARCIALMENTE_EFICAZ existe porque medida de controle costuma funcionar em
   * parte, e forcar binario esconderia justamente o caso que precisa de reforco.
   */
  verificador_id?: string | null;
  data_verificacao?: string | null;
  resultado_verificacao?: ResultadoVerificacao | null;
  observacao_verificacao?: string | null;

  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
  // Joined Data
  responsavel?: { id: string; nome: string | null } | null;
  verificador?: { id: string; nome: string | null } | null;
}

export type ResultadoVerificacao = "EFICAZ" | "PARCIALMENTE_EFICAZ" | "INEFICAZ";

export const RESULTADO_VERIFICACAO_LABEL: Record<ResultadoVerificacao, string> = {
  EFICAZ: "Eficaz",
  PARCIALMENTE_EFICAZ: "Parcialmente eficaz",
  INEFICAZ: "Ineficaz",
};

export type SgsstPgrMedidaControleInput = Omit<
  SgsstPgrMedidaControle,
  "id" | "empresa_id" | "created_at" | "updated_at" | "responsavel" | "verificador"
>;

import { calcularClassificacaoRisco } from "@/utils/sgsstRiscoMatrix";
export { calcularClassificacaoRisco };

export function useSgsstPgrDetail(pgrId?: string) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  return useQuery({
    queryKey: ["sgsst_pgr", "detail", pgrId],
    enabled: !!empresaId && !!pgrId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_pgr" as any)
        .select(`
          *,
          projeto:projetos(id, codigo, nome),
          site:sites(id, codigo, nome),
          responsavel:profiles!sgsst_pgr_responsavel_id_fkey(id, nome)
        `)
        .eq("id", pgrId)
        .single() as any);
      if (error) throw error;
      return data as SgsstPgr;
    },
  });
}

export function useSgsstPgr(params?: { page?: number; pageSize?: number; search?: string; status?: string }) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { empresa } = useEmpresaAtual();
  const empresaId = profile?.empresa_id;
  const page = params?.page ?? 0;
  const pageSize = params?.pageSize ?? 25;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["sgsst_pgr", empresaId, page, pageSize, params?.search, params?.status],
    enabled: !!empresaId,
    queryFn: async () => {
      let query = supabase
        .from("sgsst_pgr" as any)
        .select(`
          *,
          projeto:projetos(id, codigo, nome),
          site:sites(id, codigo, nome),
          responsavel:profiles!sgsst_pgr_responsavel_id_fkey(id, nome)
        `, { count: "exact" })
        .order("created_at", { ascending: false });

      if (params?.search) {
        // A tela oferece busca por codigo e titulo; antes o filtro cobria so o
        // titulo, entao procurar pelo codigo do PGR nunca retornava nada.
        const term = escapeSearchTerm(params.search);
        if (term) {
          query = query.or(`codigo.ilike.%${term}%,titulo.ilike.%${term}%`);
        }
      }
      if (params?.status && params.status !== "todos") {
        query = query.eq("status", params.status);
      }

      query = query.range(page * pageSize, page * pageSize + pageSize - 1);

      const { data, error, count } = await (query as any);

      if (error) throw error;
      return { rows: (data as SgsstPgr[]) || [], total: count ?? 0 };
    },
  });

  const createPgr = useMutation({
    mutationFn: async (input: SgsstPgrInput) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data, error } = await (supabase
        .from("sgsst_pgr" as any)
        .insert({
          ...input,
          empresa_id: empresaId,
          // Congela a identificacao da organizacao na criacao. Ler de `empresas`
          // ao imprimir faria PGRs antigos passarem a mostrar o nome novo se a
          // empresa fosse renomeada, o que falseia o documento.
          empresa_nome: input.empresa_nome ?? empresa?.nome ?? null,
          empresa_cnpj: input.empresa_cnpj ?? empresa?.cnpj ?? null,
          created_by: profile?.id,
          updated_by: profile?.id,
        })
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstPgr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pgr"] });
      toast.success("PGR criado com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao criar PGR: ${err.message || err}`);
    },
  });

  const updatePgr = useMutation({
    mutationFn: async ({ id, ...input }: Partial<SgsstPgrInput> & { id: string }) => {
      const { data, error } = await (supabase
        .from("sgsst_pgr" as any)
        .update({
          ...input,
          updated_by: profile?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstPgr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pgr"] });
      toast.success("PGR atualizado com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar PGR: ${err.message || err}`);
    },
  });

  const updateStatusPgr = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusPgr }) => {
      const { data, error } = await (supabase
        .from("sgsst_pgr" as any)
        .update({
          status,
          updated_by: profile?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstPgr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pgr"] });
      toast.success("Status do PGR alterado com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao alterar status: ${err.message || err}`);
    },
  });

  const removePgr = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_pgr" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pgr"] });
      toast.success("PGR removido com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover PGR: ${err.message || err}`);
    },
  });

  return {
    pgrs: data?.rows ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    refetch,
    createPgr,
    updatePgr,
    updateStatusPgr,
    removePgr,
  };
}

// Hook for Inventário de Riscos
/**
 * Contadores da tela de PGR sobre a base inteira.
 * Os cartoes calculavam `pgrs.filter(...).length`, o que media apenas a pagina
 * corrente: com 300 PGRs, "Total de PGRs" exibia 25.
 */
export function useSgsstPgrResumo() {
  const { count, isLoading, error, refetch } = useSgsstCounts("sgsst_pgr", [
    { key: "total" },
    { key: "ativos", build: (q) => q.eq("status", "ATIVO") },
    { key: "emRevisao", build: (q) => q.in("status", ["EM_REVISAO", "RASCUNHO"]) },
    { key: "encerrados", build: (q) => q.eq("status", "ENCERRADO") },
  ]);

  return {
    resumo: {
      total: count("total"),
      ativos: count("ativos"),
      emRevisao: count("emRevisao"),
      encerrados: count("encerrados"),
    },
    isLoading,
    error,
    refetch,
  };
}

export function useSgsstPgrInventario(pgrId?: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const { data: inventario = [], isLoading, refetch } = useQuery({
    queryKey: ["sgsst_pgr_inventario", pgrId],
    enabled: !!pgrId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_pgr_inventario" as any)
        .select(`
          *,
          risco_catalogo:sgsst_riscos_catalogo(id, nome, categoria, agente, limite_tolerancia, unidade_medida, tecnica_avaliacao, base_legal),
          area:areas(id, nome),
          responsavel:profiles!sgsst_pgr_inventario_responsavel_id_fkey(id, nome)
        `)
        .eq("pgr_id", pgrId!)
        .order("created_at", { ascending: false }) as any);

      if (error) throw error;
      return (data as SgsstPgrInventario[]) || [];
    },
  });

  /**
   * Reconcilia os grupos expostos (funcoes) de um item do inventario.
   *
   * `undefined` significa "nao mexer"; um array vazio significa "remover todos".
   * Sao coisas diferentes: salvar o item sem tocar nos grupos nao pode apagar os
   * grupos que ja estavam la.
   */
  const sincronizarFuncoes = async (inventarioId: string, funcaoIds?: string[]) => {
    if (funcaoIds === undefined) return;
    if (!empresaId) throw new Error("Empresa não selecionada.");

    const { data: atuais, error: erroLeitura } = await (supabase
      .from("sgsst_pgr_inventario_funcoes" as never)
      .select("id, funcao_id")
      .eq("inventario_id", inventarioId) as never as Promise<{
      data: { id: string; funcao_id: string }[] | null;
      error: { message?: string } | null;
    }>);

    if (erroLeitura) throw erroLeitura;

    const existentes = new Map((atuais ?? []).map((l) => [l.funcao_id, l.id]));
    const desejados = new Set(funcaoIds);

    const paraRemover = [...existentes.entries()]
      .filter(([funcaoId]) => !desejados.has(funcaoId))
      .map(([, id]) => id);

    const paraInserir = funcaoIds.filter((funcaoId) => !existentes.has(funcaoId));

    if (paraRemover.length > 0) {
      const { error } = await (supabase
        .from("sgsst_pgr_inventario_funcoes" as never)
        .delete()
        .in("id", paraRemover) as never as Promise<{ error: { message?: string } | null }>);
      if (error) throw error;
    }

    if (paraInserir.length > 0) {
      const { error } = await (supabase.from("sgsst_pgr_inventario_funcoes" as never).insert(
        paraInserir.map((funcaoId) => ({
          empresa_id: empresaId,
          inventario_id: inventarioId,
          funcao_id: funcaoId,
        })) as never
      ) as never as Promise<{ error: { message?: string } | null }>);
      if (error) throw error;
    }
  };

  const createInventarioItem = useMutation({
    mutationFn: async (
      input: SgsstPgrInventarioInput & { funcaoIds?: string[] }
    ) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { funcaoIds, ...campos } = input;

      const { data, error } = await (supabase
        .from("sgsst_pgr_inventario" as any)
        .insert({
          ...campos,
          empresa_id: empresaId,
          created_by: profile?.id,
          updated_by: profile?.id,
        })
        .select()
        .single() as any);

      if (error) throw error;

      const criado = data as SgsstPgrInventario;
      await sincronizarFuncoes(criado.id, funcaoIds);
      return criado;
    },
    onSuccess: () => {
      // Base inteira e nao ["sgsst_pgr_inventario", pgrId]: a consulta do inventario
      // por empresa (secao de GHE do PCMSO) tem sufixo proprio na chave, e o
      // casamento do TanStack e elemento a elemento — a chave com pgrId nao a
      // alcanca, e ela ficaria mostrando risco que acabou de mudar.
      queryClient.invalidateQueries({ queryKey: ["sgsst_pgr_inventario"] });
      queryClient.invalidateQueries({ queryKey: ["sgsst_pgr_inventario_funcoes", pgrId] });
      toast.success("Risco incluído no inventário!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao adicionar risco ao inventário: ${err.message || err}`);
    },
  });

  const updateInventarioItem = useMutation({
    mutationFn: async ({
      id,
      funcaoIds,
      ...input
    }: Partial<SgsstPgrInventarioInput> & { id: string; funcaoIds?: string[] }) => {
      const { data, error } = await (supabase
        .from("sgsst_pgr_inventario" as any)
        .update({
          ...input,
          updated_by: profile?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;

      await sincronizarFuncoes(id, funcaoIds);
      return data as SgsstPgrInventario;
    },
    onSuccess: () => {
      // Base inteira e nao ["sgsst_pgr_inventario", pgrId]: a consulta do inventario
      // por empresa (secao de GHE do PCMSO) tem sufixo proprio na chave, e o
      // casamento do TanStack e elemento a elemento — a chave com pgrId nao a
      // alcanca, e ela ficaria mostrando risco que acabou de mudar.
      queryClient.invalidateQueries({ queryKey: ["sgsst_pgr_inventario"] });
      queryClient.invalidateQueries({ queryKey: ["sgsst_pgr_inventario_funcoes", pgrId] });
      toast.success("Item do inventário atualizado!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar inventário: ${err.message || err}`);
    },
  });

  const removeInventarioItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_pgr_inventario" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      // Base inteira e nao ["sgsst_pgr_inventario", pgrId]: a consulta do inventario
      // por empresa (secao de GHE do PCMSO) tem sufixo proprio na chave, e o
      // casamento do TanStack e elemento a elemento — a chave com pgrId nao a
      // alcanca, e ela ficaria mostrando risco que acabou de mudar.
      queryClient.invalidateQueries({ queryKey: ["sgsst_pgr_inventario"] });
      toast.success("Item removido do inventário!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover item do inventário: ${err.message || err}`);
    },
  });

  return {
    inventario,
    isLoading,
    refetch,
    createInventarioItem,
    updateInventarioItem,
    removeInventarioItem,
  };
}

// Hook for Medidas de Controle
export function useSgsstPgrMedidasControle(inventarioId?: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const { data: medidas = [], isLoading, refetch } = useQuery({
    queryKey: ["sgsst_pgr_medidas_controle", inventarioId],
    enabled: !!inventarioId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_pgr_medidas_controle" as any)
        .select(`
          *,
          responsavel:profiles!sgsst_pgr_medidas_controle_responsavel_id_fkey(id, nome),
          verificador:profiles!sgsst_pgr_medidas_controle_verificador_id_fkey(id, nome)
        `)
        .eq("inventario_id", inventarioId!)
        .order("created_at", { ascending: false }) as any);

      if (error) throw error;
      return (data as SgsstPgrMedidaControle[]) || [];
    },
  });

  const createMedida = useMutation({
    mutationFn: async (input: SgsstPgrMedidaControleInput) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data, error } = await (supabase
        .from("sgsst_pgr_medidas_controle" as any)
        .insert({
          ...input,
          empresa_id: empresaId,
          created_by: profile?.id,
          updated_by: profile?.id,
        })
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstPgrMedidaControle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pgr_medidas_controle"] });
      toast.success("Medida de controle cadastrada!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao cadastrar medida: ${err.message || err}`);
    },
  });

  const updateMedida = useMutation({
    mutationFn: async ({ id, ...input }: Partial<SgsstPgrMedidaControleInput> & { id: string }) => {
      const { data, error } = await (supabase
        .from("sgsst_pgr_medidas_controle" as any)
        .update({
          ...input,
          updated_by: profile?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstPgrMedidaControle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pgr_medidas_controle"] });
      toast.success("Medida de controle atualizada!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar medida: ${err.message || err}`);
    },
  });

  const removeMedida = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_pgr_medidas_controle" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pgr_medidas_controle"] });
      toast.success("Medida de controle removida!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover medida: ${err.message || err}`);
    },
  });

  return {
    medidas,
    isLoading,
    refetch,
    createMedida,
    updateMedida,
    removeMedida,
  };
}

/**
 * Historico de alteracoes do PGR.
 *
 * O PGR era o unico dos dez modulos SGSST sem historico — justamente o documento
 * que a NR-01 1.5.7.3.3 manda manter por 20 anos COM historico das atualizacoes.
 *
 * O registro e feito por trigger no banco, nao aqui: alteracao vinda de script,
 * do painel do Supabase ou de outra tela tambem precisa aparecer. Este hook so
 * le.
 */
export function useSgsstPgrHistorico(pgrId?: string) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["sgsst_pgr", "historico", pgrId],
    enabled: !!pgrId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_pgr_historico" as never)
        .select("*, usuario:profiles!sgsst_pgr_historico_usuario_id_fkey(id, nome)")
        .eq("pgr_id", pgrId as string)
        .order("created_at", { ascending: false })
        .limit(200) as never as Promise<{
        data: SgsstPgrHistorico[] | null;
        error: { message?: string } | null;
      }>);

      if (error) throw error;
      return data ?? [];
    },
  });

  return { historico: data ?? [], isLoading, error, refetch };
}

export interface SgsstPgrHistorico {
  id: string;
  empresa_id: string;
  pgr_id: string;
  usuario_id?: string | null;
  operacao: string;
  versao?: number | null;
  status_anterior?: string | null;
  status_novo?: string | null;
  observacao?: string | null;
  created_at: string;
  usuario?: { id: string; nome: string | null } | null;
}

export const OPERACAO_HISTORICO_LABEL: Record<string, string> = {
  CRIACAO: "Criação",
  MUDANCA_STATUS: "Mudança de status",
  NOVA_VERSAO: "Nova versão",
  REVISAO: "Revisão registrada",
};

export interface InventarioFuncao {
  id: string;
  inventario_id: string;
  funcao_id: string;
  funcao?: { id: string; nome: string; cbo?: string | null } | null;
}

/**
 * Grupos de trabalhadores expostos, por item de inventario.
 *
 * A NR-01 1.5.7.3.2 pede QUAIS grupos estao expostos; o campo antigo guardava
 * so uma quantidade, e numero nao identifica ninguem.
 *
 * Consulta separada da do inventario de proposito: um embed derrubaria a lista
 * inteira enquanto a migration desta fase nao estivesse aplicada.
 */
export function useSgsstPgrInventarioFuncoes(pgrId?: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["sgsst_pgr_inventario_funcoes", pgrId],
    enabled: !!pgrId && !!empresaId,
    queryFn: async () => {
      // Filtra pelos itens do PGR via a FK do inventario, para nao trazer as
      // ligacoes de outros programas da mesma empresa.
      const { data, error } = await (supabase
        .from("sgsst_pgr_inventario_funcoes" as never)
        .select("id, inventario_id, funcao_id, funcao:sgsst_funcoes(id, nome, cbo), inventario:sgsst_pgr_inventario!inner(pgr_id)")
        .eq("inventario.pgr_id", pgrId as string)
        .limit(2000) as never as Promise<{
        data: InventarioFuncao[] | null;
        error: { message?: string } | null;
      }>);

      if (error) throw error;
      return data ?? [];
    },
  });

  const porItem = new Map<string, InventarioFuncao[]>();
  for (const linha of data ?? []) {
    const atual = porItem.get(linha.inventario_id);
    if (atual) atual.push(linha);
    else porItem.set(linha.inventario_id, [linha]);
  }

  const vinculo = useMutation({
    mutationFn: async (params:
      | { acao: "adicionar"; inventarioId: string; funcaoId: string }
      | { acao: "remover"; id: string }
    ) => {
      if (params.acao === "remover") {
        const { error } = await (supabase
          .from("sgsst_pgr_inventario_funcoes" as never)
          .delete()
          .eq("id", params.id) as never as Promise<{ error: { message?: string } | null }>);
        if (error) throw error;
        return;
      }

      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { error } = await (supabase.from("sgsst_pgr_inventario_funcoes" as never).insert({
        empresa_id: empresaId,
        inventario_id: params.inventarioId,
        funcao_id: params.funcaoId,
      } as never) as never as Promise<{ error: { message?: string; code?: string } | null }>);

      if (error) {
        if (error.code === "23505") {
          throw new Error("Esta função já está vinculada a este item do inventário.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pgr_inventario_funcoes", pgrId] });
    },
    onError: (err: unknown) => {
      const detalhe = err instanceof Error ? err.message : String(err);
      toast.error(`Erro ao alterar grupos expostos: ${detalhe}`);
    },
  });

  return {
    /** Ligacoes do item informado. */
    funcoesDoItem: (inventarioId: string) => porItem.get(inventarioId) ?? [],
    total: data?.length ?? 0,
    isLoading,
    error,
    refetch,
    vinculo,
  };
}

/**
 * Funcoes que a fase 2 diz estarem expostas a um risco do catalogo.
 *
 * E o que faz o inventario deixar de pedir redigitacao: escolhido o risco, o
 * sistema ja sabe quais funcoes se expoem a ele e sugere, junto com a
 * caracterizacao da exposicao que a funcao declarou.
 */
export function useSgsstFuncoesDoRisco(riscoCatalogoId?: string | null) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const { data, isLoading, error } = useQuery({
    queryKey: ["sgsst_funcao_riscos", "por_risco", riscoCatalogoId, empresaId],
    enabled: !!empresaId && !!riscoCatalogoId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_funcao_riscos" as never)
        .select("funcao_id, tipo_exposicao, tempo_exposicao, funcao:sgsst_funcoes(id, nome, cbo)")
        .eq("risco_catalogo_id", riscoCatalogoId as string) as never as Promise<{
        data: SugestaoFuncaoExposta[] | null;
        error: { message?: string } | null;
      }>);

      if (error) throw error;
      return data ?? [];
    },
  });

  return { sugestoes: data ?? [], isLoading, error };
}

export interface SugestaoFuncaoExposta {
  funcao_id: string;
  tipo_exposicao?: TipoExposicao | null;
  tempo_exposicao?: string | null;
  funcao?: { id: string; nome: string; cbo?: string | null } | null;
}

/**
 * Todas as medidas de um PGR, agrupadas por item de inventário.
 *
 * O hook por item (`useSgsstPgrMedidasControle`) serve à tela, que mostra um
 * risco por vez. Este serve a quem precisa do quadro inteiro: o documento, e a
 * checagem de completude da NR-01, que precisa saber se cada item já tem alguma
 * medida IMPLANTADA para responder pela alínea "h".
 */
export function useSgsstPgrMedidasDoPgr(
  inventarioIds: readonly string[],
  options?: { enabled?: boolean }
) {
  // Ordenado para a chave de cache não mudar só porque a ordem da lista mudou.
  const chaveIds = [...inventarioIds].sort().join(",");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["sgsst_pgr_medidas_controle", "do_pgr", chaveIds],
    enabled: (options?.enabled ?? true) && inventarioIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_pgr_medidas_controle" as never)
        .select(
          "*, responsavel:profiles!sgsst_pgr_medidas_controle_responsavel_id_fkey(id, nome), verificador:profiles!sgsst_pgr_medidas_controle_verificador_id_fkey(id, nome)"
        )
        .in("inventario_id", inventarioIds as string[]) as never as Promise<{
        data: SgsstPgrMedidaControle[] | null;
        error: { message?: string } | null;
      }>);

      if (error) throw error;
      return data ?? [];
    },
  });

  const medidas = data ?? [];

  const medidasPorItem: Record<string, SgsstPgrMedidaControle[]> = {};
  for (const m of medidas) {
    (medidasPorItem[m.inventario_id] ??= []).push(m);
  }

  return {
    medidas,
    medidasPorItem,
    /**
     * Quantas medidas do item já estão implantadas. É o que a alínea "h" pede:
     * medida pendente é promessa e responde pelo plano de ação, não pelo
     * controle existente.
     */
    implantadasDoItem: (inventarioId: string): number =>
      (medidasPorItem[inventarioId] ?? []).filter((m) => m.status === "implementado").length,
    isLoading,
    error,
    refetch,
  };
}
