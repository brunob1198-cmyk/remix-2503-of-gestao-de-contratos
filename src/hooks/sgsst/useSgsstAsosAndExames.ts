import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
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
export function useSgsstExames() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const { data: exames = [], isLoading, error, refetch } = useQuery({
    queryKey: ["sgsst_exames", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_exames" as any)
        .select(`
          *,
          colaborador:sgsst_colaborador_dados(
            id, cpf,
            profile:profiles(id, nome),
            recurso:recursos(id, nome),
            funcao:sgsst_funcoes(id, nome)
          ),
          pcmso:sgsst_pcmso(id, codigo, titulo)
        `)
        .order("created_at", { ascending: false }) as any);

      if (error) throw error;
      return (data as SgsstExame[]) || [];
    },
  });

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
    isLoading,
    error,
    refetch,
    createExame,
    updateExame,
    removeExame,
  };
}

// Hook for ASOs
export function useSgsstAsos() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const { data: asos = [], isLoading, error, refetch } = useQuery({
    queryKey: ["sgsst_asos", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sgsst_asos" as any)
        .select(`
          *,
          colaborador:sgsst_colaborador_dados(
            id, cpf,
            profile:profiles(id, nome),
            recurso:recursos(id, nome),
            funcao:sgsst_funcoes(id, nome)
          ),
          pcmso:sgsst_pcmso(id, codigo, titulo),
          exame:sgsst_exames(id, nome_exame, data_realizacao)
        `)
        .order("data_emissao", { ascending: false }) as any);

      if (error) throw error;

      return ((data || []) as SgsstAso[]).map((aso) => ({
        ...aso,
        statusVencimento: calculateVencimentoAso(aso.validade),
      }));
    },
  });

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
