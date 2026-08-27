import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface SgsstColaboradorTreinamento {
  id: string;
  empresa_id: string;
  colaborador_id: string;
  treinamento_id?: string | null;
  nome_treinamento: string;
  carga_horaria?: number | null;
  data_conclusao?: string | null;
  data_validade?: string | null;
  certificado_url?: string | null;
  certificado_r2_key?: string | null;
  observacoes?: string | null;
  created_at?: string;
}

export interface SgsstColaboradorDados {
  id: string;
  empresa_id: string;
  nome?: string | null;
  cpf?: string | null;
  rg?: string | null;
  data_nascimento?: string | null;
  genero?: string | null;
  telefone?: string | null;
  email?: string | null;
  foto_url?: string | null;
  foto_r2_key?: string | null;
  tamanho_calcado?: string | null;
  tamanho_camisa?: string | null;
  tamanho_calca?: string | null;
  cnh_numero?: string | null;
  cnh_categoria?: string | null;
  cnh_validade?: string | null;
  endereco?: string | null;
  /**
   * CEP mascarado (XX.XXX-XXX). Alimenta a consulta a base dos Correios que
   * preenche `endereco`.
   */
  cep?: string | null;
  /**
   * Numero, quadra, lote, apartamento. Separado de `endereco` para que uma nova
   * consulta de CEP nao apague o que o usuario digitou.
   */
  endereco_complemento?: string | null;
  centro_custo?: string | null;
  projeto_id?: string | null;
  profile_id?: string | null;
  recurso_id?: string | null;
  funcao_id?: string | null;
  area_id?: string | null;
  matricula?: string | null;
  data_admissao?: string | null;
  data_demissao?: string | null;
  tipo_vinculo: "CLT" | "PJ" | "Terceirizado" | "Estagiario" | "Outro";
  status: "ativo" | "afastado" | "desligado";
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  // Joined Data
  profile?: { id: string; nome: string | null; avatar_url: string | null; cpf: string | null; cargo: string | null } | null;
  recurso?: { id: string; nome: string; cargo: string | null; tipo: string } | null;
  funcao?: { id: string; nome: string; cbo: string | null } | null;
  area?: { id: string; nome: string } | null;
  projeto?: { id: string; nome: string; codigo: string } | null;
  treinamentos?: SgsstColaboradorTreinamento[];
}

export type SgsstColaboradorInput = Omit<
  SgsstColaboradorDados,
  "id" | "empresa_id" | "created_at" | "updated_at" | "profile" | "recurso" | "funcao" | "area" | "projeto" | "treinamentos"
>;

export function useSgsstColaboradores(params?: { page?: number; pageSize?: number; search?: string; status?: string }) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;
  const page = params?.page ?? 0;
  const pageSize = params?.pageSize ?? 25;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["sgsst_colaboradores", empresaId, page, pageSize, params?.search, params?.status],
    enabled: !!empresaId,
    queryFn: async () => {
      let query = supabase
        .from("sgsst_colaborador_dados" as any)
        .select(`
          *,
          profile:profiles(id, nome, avatar_url, cpf, cargo),
          recurso:recursos(id, nome, cargo, tipo),
          funcao:sgsst_funcoes(id, nome, cbo),
          area:areas(id, nome),
          projeto:projetos(id, nome, codigo),
          treinamentos:sgsst_colaborador_treinamentos(*)
        `, { count: "exact" })
        .order("created_at", { ascending: false });

      if (params?.search) {
        query = query.or(`nome.ilike.%${params.search}%,cpf.ilike.%${params.search}%`);
      }
      if (params?.status && params.status !== "todos") {
        query = query.eq("status", params.status);
      }

      query = query.range(page * pageSize, page * pageSize + pageSize - 1);

      const { data, error, count } = await (query as any);

      if (error) throw error;

      // Ensure name display fallback
      const formatted = (data || []).map((colab: any) => ({
        ...colab,
        displayNome: colab.nome || colab.profile?.nome || colab.recurso?.nome || "Colaborador sem nome",
      }));

      return { rows: formatted as SgsstColaboradorDados[], total: count ?? 0 };
    },
  });

  const createColaborador = useMutation({
    mutationFn: async (input: SgsstColaboradorInput) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");

      const { data, error } = await (supabase
        .from("sgsst_colaborador_dados" as any)
        .insert({
          ...input,
          empresa_id: empresaId,
          created_by: profile?.id,
        })
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstColaboradorDados;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_colaboradores"] });
      toast.success("Colaborador cadastrado com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao cadastrar colaborador: ${err.message || err}`);
    },
  });

  const updateColaborador = useMutation({
    mutationFn: async ({ id, ...input }: Partial<SgsstColaboradorDados> & { id: string }) => {
      const { data, error } = await (supabase
        .from("sgsst_colaborador_dados" as any)
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstColaboradorDados;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_colaboradores"] });
      toast.success("Cadastro do colaborador atualizado com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar colaborador: ${err.message || err}`);
    },
  });

  const removeColaborador = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_colaborador_dados" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_colaboradores"] });
      toast.success("Registro de colaborador removido!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover colaborador: ${err.message || err}`);
    },
  });

  const addTreinamento = useMutation({
    mutationFn: async (input: {
      colaborador_id: string;
      nome_treinamento: string;
      carga_horaria?: number;
      data_conclusao?: string;
      data_validade?: string;
      certificado_url?: string;
      certificado_r2_key?: string;
      observacoes?: string;
    }) => {
      if (!empresaId) throw new Error("Empresa não identificada.");

      const { data, error } = await (supabase
        .from("sgsst_colaborador_treinamentos" as any)
        .insert({
          ...input,
          empresa_id: empresaId,
        })
        .select()
        .single() as any);

      if (error) throw error;
      return data as SgsstColaboradorTreinamento;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_colaboradores"] });
      toast.success("Treinamento / Certificado adicionado!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao salvar treinamento: ${err.message || err}`);
    },
  });

  const removeTreinamento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("sgsst_colaborador_treinamentos" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sgsst_colaboradores"] });
      toast.success("Treinamento removido!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover treinamento: ${err.message || err}`);
    },
  });

  return {
    colaboradores: data?.rows ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    refetch,
    createColaborador,
    updateColaborador,
    removeColaborador,
    addTreinamento,
    removeTreinamento,
  };
}

export interface SgsstColaboradorResumoItem {
  id: string;
  nome?: string | null;
  displayNome: string;
  cpf?: string | null;
  funcao?: string | null;
  profile?: { id: string; nome: string | null } | null;
  recurso?: { id: string; nome: string } | null;
}

export function useSgsstColaboradoresResumo() {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const { data: colaboradores = [], isLoading, error, refetch } = useQuery({
    queryKey: ["sgsst_colaboradores", "resumo", empresaId],
    enabled: !!empresaId,
    staleTime: 1000 * 60 * 10,
    queryFn: async (): Promise<SgsstColaboradorResumoItem[]> => {
      const { data, error } = await supabase
        .from("sgsst_colaborador_dados" as any)
        .select("id, nome, cpf, profile:profiles(id, nome), recurso:recursos(id, nome), funcao:sgsst_funcoes(id, nome)")
        .eq("status", "ativo")
        .order("nome", { ascending: true });

      if (error) throw error;

      return (data ?? []).map((c: any) => ({
        id: c.id,
        nome: c.nome,
        displayNome: c.nome || c.profile?.nome || c.recurso?.nome || "Colaborador sem nome",
        cpf: c.cpf,
        funcao: c.funcao?.nome,
        profile: c.profile,
        recurso: c.recurso,
      }));
    },
  });

  return {
    colaboradores,
    isLoading,
    error,
    refetch,
  };
}
