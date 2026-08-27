import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { calcularClassificacaoRisco } from "@/utils/sgsstRiscoMatrix";

export type TipoPt =
  | "Trabalho a Quente"
  | "Trabalho em Altura"
  | "Espaço Confinado"
  | "Trabalho com Eletricidade"
  | "Escavação"
  | "Içamento"
  | "Trabalho com Produtos Químicos"
  | "Outros";

export type StatusPt =
  | "RASCUNHO"
  | "EM_ANALISE"
  | "APROVADA"
  | "EM_EXECUCAO"
  | "SUSPENSA"
  | "ENCERRADA"
  | "CANCELADA"
  | "REJEITADA";

export interface SgsstPt {
  id: string;
  empresa_id: string;
  projeto_id: string;
  site_id?: string | null;
  area_id?: string | null;
  apr_id?: string | null;
  codigo?: string | null;
  titulo: string;
  tipo: TipoPt;
  atividade: string;
  local_execucao?: string | null;
  responsavel_id?: string | null;
  data_inicio: string;
  data_fim?: string | null;
  observacoes?: string | null;
  status: StatusPt;

  // --- Pre-requisitos de entrada em espaco confinado (NR-33) ---
  ventilacao_adotada?: string | null;
  bloqueio_energias?: boolean | null;
  /** A norma exige plano de resgate ANTES da entrada, nao depois do acidente. */
  plano_resgate?: string | null;
  /**
   * Fim da validade da permissao. A PT vale para o turno autorizado; sem esse
   * limite ela ficaria valendo indefinidamente, o oposto do que ela e.
   */
  validade_fim?: string | null;

  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
  // Joined Data
  projeto?: { id: string; codigo: string; nome: string } | null;
  site?: { id: string; codigo: string; nome: string } | null;
  area?: { id: string; nome: string } | null;
  apr?: { id: string; codigo: string | null; titulo: string } | null;
  responsavel?: { id: string; nome: string | null } | null;
}

export type SgsstPtInput = Omit<
  SgsstPt,
  "id" | "empresa_id" | "created_at" | "updated_at" | "projeto" | "site" | "area" | "apr" | "responsavel"
>;

export interface SgsstPtChecklistItem {
  id: string;
  empresa_id: string;
  pt_id: string;
  item: string;
  obrigatorio: boolean;
  resposta: "Conforme" | "Não Conforme" | "Não Aplicável" | "Pendente";
  observacao?: string | null;
  created_at?: string;
}

export interface SgsstPtRisco {
  id: string;
  empresa_id: string;
  pt_id: string;
  risco_catalogo_id?: string | null;
  perigo: string;
  risco: string;
  consequencia?: string | null;
  probabilidade: number;
  severidade: number;
  nivel_risco?: number;
  classificacao?: "BAIXO" | "MODERADO" | "ALTO" | "CRÍTICO";
  created_at?: string;
}

export interface SgsstPtMedida {
  id: string;
  empresa_id: string;
  pt_risco_id: string;
  descricao: string;
  tipo: "Eliminação" | "Substituição" | "Engenharia" | "Administrativa" | "EPI";
  responsavel_id?: string | null;
  status: "pendente" | "em_andamento" | "implementado" | "cancelado";
  created_at?: string;
  responsavel?: { id: string; nome: string | null } | null;
}

export interface SgsstPtParticipante {
  id: string;
  empresa_id: string;
  pt_id: string;
  colaborador_dados_id?: string | null;
  funcao_id?: string | null;
  responsabilidade?: string | null;
  confirmacao: boolean;
  created_at?: string;
  colaborador_dados?: {
    id: string;
    matricula?: string | null;
    nome?: string | null;
    profile?: { nome: string | null } | null;
    recurso?: { nome: string } | null;
  } | null;
  funcao?: { id: string; nome: string } | null;
}

export interface SgsstPtHistorico {
  id: string;
  empresa_id: string;
  pt_id: string;
  usuario_id?: string | null;
  status_anterior?: string | null;
  novo_status: string;
  observacao?: string | null;
  created_at: string;
  usuario?: { id: string; nome: string | null } | null;
}

import type { MomentoMedicao } from "@/utils/sgsstAtmosfera";
import { getDefaultChecklistItems } from "@/utils/sgsstChecklistDefaults";
export { getDefaultChecklistItems };

export function useSgsstPtDetail(ptId?: string) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  return useQuery({
    queryKey: ["sgsst_pt", "detail", ptId],
    enabled: !!empresaId && !!ptId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_pt" as any)
        .select(`
          *,
          projeto:projetos(id, codigo, nome),
          site:sites(id, codigo, nome),
          area:areas(id, nome),
          apr:sgsst_apr(id, codigo, titulo),
          responsavel:profiles!sgsst_pt_responsavel_id_fkey(id, nome)
        `)
        .eq("id", ptId)
        .single() as any);
      if (error) throw error;
      return data as SgsstPt;
    },
  });
}

export function useSgsstPt(params?: { page?: number; pageSize?: number; search?: string; status?: string }) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;
  const page = params?.page ?? 0;
  const pageSize = params?.pageSize ?? 25;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["sgsst_pt", empresaId, page, pageSize, params?.search, params?.status],
    enabled: !!empresaId,
    queryFn: async () => {
      let query = supabase
        .from("sgsst_pt" as any)
        .select(`
          *,
          projeto:projetos(id, codigo, nome),
          site:sites(id, codigo, nome),
          area:areas(id, nome),
          apr:sgsst_apr(id, codigo, titulo),
          responsavel:profiles!sgsst_pt_responsavel_id_fkey(id, nome)
        `, { count: "exact" })
        .order("created_at", { ascending: false });

      if (params?.search) {
        query = query.ilike("titulo", `%${params.search}%`);
      }
      if (params?.status && params.status !== "todos") {
        query = query.eq("status", params.status);
      }

      query = query.range(page * pageSize, page * pageSize + pageSize - 1);

      const { data, error, count } = await (query as any);

      if (error) throw error;
      return { rows: (data as SgsstPt[]) || [], total: count ?? 0 };
    },
  });

  const createPt = useMutation({
    mutationFn: async (input: SgsstPtInput) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data: createdPt, error } = await (supabase
        .from("sgsst_pt" as any)
        .insert({
          ...input,
          empresa_id: empresaId,
          created_by: profile?.id,
          updated_by: profile?.id,
        })
        .select()
        .single() as any);

      if (error) throw error;

      // Inserir itens padrão do checklist de acordo com o Tipo de PT
      const defaultItems = getDefaultChecklistItems(input.tipo);
      if (defaultItems.length > 0) {
        await supabase.from("sgsst_pt_checklist" as any).insert(
          defaultItems.map((item) => ({
            empresa_id: empresaId,
            pt_id: createdPt.id,
            item: item.item,
            obrigatorio: item.obrigatorio,
            resposta: "Pendente",
          }))
        );
      }

      // Registrar histórico inicial
      await supabase.from("sgsst_pt_historico" as any).insert({
        empresa_id: empresaId,
        pt_id: createdPt.id,
        usuario_id: profile?.id,
        status_anterior: null,
        novo_status: createdPt.status,
        observacao: "Emissão e criação da Permissão de Trabalho (PT)",
      });

      return createdPt as SgsstPt;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pt"] });
      toast.success("Permissão de Trabalho emitida com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao emitir PT: ${err.message || err}`);
    },
  });

  const updatePt = useMutation({
    mutationFn: async ({ id, ...input }: Partial<SgsstPtInput> & { id: string }) => {
      const { data, error } = await (supabase
        .from("sgsst_pt" as any)
        .update({
          ...input,
          updated_by: profile?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstPt;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pt"] });
      toast.success("PT atualizada com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar PT: ${err.message || err}`);
    },
  });

  const updateStatusPt = useMutation({
    mutationFn: async ({
      id,
      statusAnterior,
      novoStatus,
      observacao,
    }: {
      id: string;
      statusAnterior: StatusPt;
      novoStatus: StatusPt;
      observacao?: string;
    }) => {
      const { data, error } = await (supabase
        .from("sgsst_pt" as any)
        .update({
          status: novoStatus,
          updated_by: profile?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;

      // Registrar histórico
      await supabase.from("sgsst_pt_historico" as any).insert({
        empresa_id: empresaId,
        pt_id: id,
        usuario_id: profile?.id,
        status_anterior: statusAnterior,
        novo_status: novoStatus,
        observacao: observacao || `Transição de status de ${statusAnterior} para ${novoStatus}`,
      });

      return data as SgsstPt;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pt"] });
      queryClient.invalidateQueries({ queryKey: ["sgsst_pt_historico"] });
      toast.success("Status da PT alterado com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao alterar status da PT: ${err.message || err}`);
    },
  });

  const removePt = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_pt" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pt"] });
      toast.success("PT removida com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover PT: ${err.message || err}`);
    },
  });

  return {
    pts: data?.rows ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    refetch,
    createPt,
    updatePt,
    updateStatusPt,
    removePt,
  };
}

// Hook for PT Checklist
export function useSgsstPtChecklist(ptId?: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const { data: checklist = [], isLoading, refetch } = useQuery({
    queryKey: ["sgsst_pt_checklist", ptId],
    enabled: !!ptId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_pt_checklist" as any)
        .select("*")
        .eq("pt_id", ptId!)
        .order("created_at", { ascending: true }) as any);

      if (error) throw error;
      return (data as SgsstPtChecklistItem[]) || [];
    },
  });

  const updateRespostaItem = useMutation({
    mutationFn: async ({
      id,
      resposta,
      observacao,
    }: {
      id: string;
      resposta: "Conforme" | "Não Conforme" | "Não Aplicável" | "Pendente";
      observacao?: string;
    }) => {
      const { data, error } = await (supabase
        .from("sgsst_pt_checklist" as any)
        .update({
          resposta,
          observacao: observacao || null,
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstPtChecklistItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pt_checklist", ptId] });
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar checklist: ${err.message || err}`);
    },
  });

  const addChecklistItem = useMutation({
    mutationFn: async ({ item, obrigatorio }: { item: string; obrigatorio: boolean }) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data, error } = await (supabase
        .from("sgsst_pt_checklist" as any)
        .insert({
          empresa_id: empresaId,
          pt_id: ptId!,
          item,
          obrigatorio,
          resposta: "Pendente",
        })
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstPtChecklistItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pt_checklist", ptId] });
      toast.success("Item adicionado ao checklist!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao adicionar item: ${err.message || err}`);
    },
  });

  const removeChecklistItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_pt_checklist" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pt_checklist", ptId] });
      toast.success("Item do checklist removido!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover item: ${err.message || err}`);
    },
  });

  return {
    checklist,
    isLoading,
    refetch,
    updateRespostaItem,
    addChecklistItem,
    removeChecklistItem,
  };
}

// Hook for PT Riscos & Medidas
export function useSgsstPtRiscos(ptId?: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const { data: riscos = [], isLoading, refetch } = useQuery({
    queryKey: ["sgsst_pt_riscos", ptId],
    enabled: !!ptId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_pt_riscos" as any)
        .select(`
          *,
          risco_catalogo:sgsst_riscos_catalogo(id, nome, categoria)
        `)
        .eq("pt_id", ptId!)
        .order("created_at", { ascending: true }) as any);

      if (error) throw error;
      return (data as SgsstPtRisco[]) || [];
    },
  });

  const addRisco = useMutation({
    mutationFn: async (input: Omit<SgsstPtRisco, "id" | "empresa_id" | "nivel_risco" | "classificacao" | "created_at" | "risco_catalogo">) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data, error } = await (supabase
        .from("sgsst_pt_riscos" as any)
        .insert({
          ...input,
          empresa_id: empresaId,
        })
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstPtRisco;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pt_riscos", ptId] });
      toast.success("Risco vinculado à PT!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao vincular risco: ${err.message || err}`);
    },
  });

  const removeRisco = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_pt_riscos" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pt_riscos", ptId] });
      toast.success("Risco removido da PT!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover risco: ${err.message || err}`);
    },
  });

  return {
    riscos,
    isLoading,
    refetch,
    addRisco,
    removeRisco,
  };
}

/**
 * Medidas de controle de um risco da PT.
 *
 * As invalidações abaixo são de propósito SEM escopo de risco. A folha da PT lê as
 * medidas de todos os riscos de uma vez, por `["sgsst_pt_medidas", "da_pt", ...]`,
 * e `invalidateQueries({ queryKey: ["sgsst_pt_medidas", ptRiscoId] })` não alcança
 * essa chave: são dois elementos, e o segundo nunca vale "da_pt". Escopada, a
 * invalidação deixaria a folha sair com as medidas de antes da edição.
 *
 * O custo de não escopar é refazer as medidas de outros riscos que estejam em
 * cache — e só as que estiverem ATIVAS na tela refazem na hora. Barato.
 */
// Hook for PT Medidas
export function useSgsstPtMedidas(ptRiscoId?: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const { data: medidas = [], isLoading, refetch } = useQuery({
    queryKey: ["sgsst_pt_medidas", ptRiscoId],
    enabled: !!ptRiscoId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_pt_medidas" as any)
        .select(`
          *,
          responsavel:profiles!sgsst_pt_medidas_responsavel_id_fkey(id, nome)
        `)
        .eq("pt_risco_id", ptRiscoId!)
        .order("created_at", { ascending: true }) as any);

      if (error) throw error;
      return (data as SgsstPtMedida[]) || [];
    },
  });

  const addMedida = useMutation({
    mutationFn: async (input: Omit<SgsstPtMedida, "id" | "empresa_id" | "created_at" | "responsavel">) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data, error } = await (supabase
        .from("sgsst_pt_medidas" as any)
        .insert({
          ...input,
          empresa_id: empresaId,
        })
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstPtMedida;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pt_medidas"] });
      toast.success("Medida adicionada!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao adicionar medida: ${err.message || err}`);
    },
  });

  const removeMedida = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_pt_medidas" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pt_medidas"] });
      toast.success("Medida removida!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover medida: ${err.message || err}`);
    },
  });

  return {
    medidas,
    isLoading,
    refetch,
    addMedida,
    removeMedida,
  };
}

// Hook for PT Participantes
export function useSgsstPtParticipantes(ptId?: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const { data: participantes = [], isLoading, refetch } = useQuery({
    queryKey: ["sgsst_pt_participantes", ptId],
    enabled: !!ptId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_pt_participantes" as any)
        .select(`
          *,
          colaborador_dados:sgsst_colaborador_dados(
            id,
            matricula,
            nome,
            profile:profiles(nome),
            recurso:recursos(nome)
          ),
          funcao:sgsst_funcoes(id, nome)
        `)
        .eq("pt_id", ptId!)
        .order("created_at", { ascending: true }) as any);

      if (error) throw error;
      return (data as SgsstPtParticipante[]) || [];
    },
  });

  const addParticipante = useMutation({
    mutationFn: async ({
      colaborador_dados_id,
      funcao_id,
      responsabilidade,
    }: {
      colaborador_dados_id: string;
      funcao_id?: string | null;
      responsabilidade?: string;
    }) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data, error } = await (supabase
        .from("sgsst_pt_participantes" as any)
        .insert({
          empresa_id: empresaId,
          pt_id: ptId!,
          colaborador_dados_id,
          funcao_id: funcao_id || null,
          responsabilidade: responsabilidade || "Executante",
          confirmacao: true,
        })
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstPtParticipante;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pt_participantes", ptId] });
      toast.success("Trabalhador vinculado à PT!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao vincular trabalhador: ${err.message || err}`);
    },
  });

  const removeParticipante = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_pt_participantes" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_pt_participantes", ptId] });
      toast.success("Trabalhador desvinculado!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao desvincular trabalhador: ${err.message || err}`);
    },
  });

  return {
    participantes,
    isLoading,
    refetch,
    addParticipante,
    removeParticipante,
  };
}

// Hook for PT Historico
export function useSgsstPtHistorico(ptId?: string) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const { data: historico = [], isLoading } = useQuery({
    queryKey: ["sgsst_pt_historico", ptId],
    enabled: !!ptId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_pt_historico" as any)
        .select(`
          *,
          usuario:profiles!sgsst_pt_historico_usuario_id_fkey(id, nome)
        `)
        .eq("pt_id", ptId!)
        .order("created_at", { ascending: false }) as any);

      if (error) throw error;
      return (data as SgsstPtHistorico[]) || [];
    },
  });

  return {
    historico,
    isLoading,
  };
}

/**
 * Papeis que a NR-33 nomeia para trabalho em espaco confinado.
 *
 * Nao virou CHECK no banco de proposito: ha PTs cadastradas com texto livre, e
 * um CHECK retroativo obrigaria a reescrever dado do usuario. Aqui eles viram
 * opcao na tela, e a exigencia de Vigia e validada na aplicacao — onde da para
 * explicar o motivo em vez de so recusar.
 */
export const PAPEIS_ESPACO_CONFINADO = [
  "Trabalhador Autorizado",
  "Vigia",
  "Supervisor de Entrada",
] as const;

export const PAPEIS_PT_GERAIS = [
  "Executante",
  "Responsável",
  "Supervisor",
  "Observador",
] as const;

export interface SgsstPtMedicaoAtmosfera {
  id: string;
  empresa_id: string;
  pt_id: string;
  medido_em: string;
  momento: MomentoMedicao;
  oxigenio_percentual?: number | null;
  causa_variacao_conhecida: boolean;
  inflamaveis_percentual_lie?: number | null;
  contaminante_nome?: string | null;
  contaminante_valor?: number | null;
  contaminante_unidade?: string | null;
  contaminante_limite?: number | null;
  equipamento?: string | null;
  numero_serie?: string | null;
  calibracao_validade?: string | null;
  medido_por_id?: string | null;
  medido_por_nome?: string | null;
  observacoes?: string | null;
  created_at?: string;
  medido_por?: { id: string; nome: string | null } | null;
}

export type SgsstPtMedicaoAtmosferaInput = Omit<
  SgsstPtMedicaoAtmosfera,
  "id" | "empresa_id" | "created_at" | "medido_por"
>;

/**
 * Medicoes atmosfericas da PT — condicao de entrada em espaco confinado.
 *
 * A PT podia ser aprovada e executada sem ninguem ter medido oxigenio,
 * inflamaveis ou contaminantes. Isto nao e lacuna de cadastro: e o item que a
 * NR-33 coloca antes da entrada.
 */
export function useSgsstPtAtmosfera(ptId?: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["sgsst_pt_medicoes_atmosfera", ptId],
    enabled: !!ptId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_pt_medicoes_atmosfera" as never)
        .select("*, medido_por:profiles!sgsst_pt_medicoes_atmosfera_medido_por_id_fkey(id, nome)")
        .eq("pt_id", ptId as string)
        .order("medido_em", { ascending: false }) as never as Promise<{
        data: SgsstPtMedicaoAtmosfera[] | null;
        error: { message?: string } | null;
      }>);

      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ["sgsst_pt_medicoes_atmosfera", ptId] });
  };

  const criarMedicao = useMutation({
    mutationFn: async (input: SgsstPtMedicaoAtmosferaInput) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");
      if (!ptId) throw new Error("Permissão de trabalho não selecionada.");

      const { error } = await (supabase.from("sgsst_pt_medicoes_atmosfera" as never).insert({
        ...input,
        pt_id: ptId,
        empresa_id: empresaId,
        medido_por_id: input.medido_por_id ?? profile?.id ?? null,
        created_by: profile?.id,
      } as never) as never as Promise<{ error: { message?: string } | null }>);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidar();
      toast.success("Medição atmosférica registrada.");
    },
    onError: (err: unknown) => {
      const detalhe = err instanceof Error ? err.message : String(err);
      toast.error(`Erro ao registrar a medição: ${detalhe}`);
    },
  });

  const removerMedicao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_pt_medicoes_atmosfera" as never)
        .delete()
        .eq("id", id) as never as Promise<{ error: { message?: string } | null }>);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidar();
      toast.success("Medição removida.");
    },
    onError: (err: unknown) => {
      const detalhe = err instanceof Error ? err.message : String(err);
      toast.error(`Erro ao remover a medição: ${detalhe}`);
    },
  });

  return {
    medicoes: data ?? [],
    isLoading,
    error,
    refetch,
    criarMedicao,
    removerMedicao,
  };
}
