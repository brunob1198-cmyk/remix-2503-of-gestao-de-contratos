import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { mensagemDeErroSupabase } from "@/utils/mensagemErroSupabase";
import type { GheBasico, FuncaoDoGhe, RiscoDoInventario } from "@/utils/sgsstGhe";

/**
 * GHE — Grupo Homogêneo de Exposição.
 *
 * O GHE é da EMPRESA e não de um programa: o mesmo grupo é referenciado pelo PGR
 * (onde o risco é inventariado) e pelo PCMSO (onde o exame é planejado). Por isso
 * a chave de cache é `["sgsst_ghe"]` sem escopo de documento, e as invalidações
 * usam a chave BASE — o casamento de chave do TanStack é elemento a elemento, e
 * `["sgsst_ghe_funcoes", id]` NÃO é alcançado por `["sgsst_ghe"]`.
 */

export interface SgsstGhe extends GheBasico {
  empresa_id: string;
  codigo: string;
  nome: string;
  status: "ativo" | "inativo";
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type SgsstGheInput = Omit<
  SgsstGhe,
  "id" | "empresa_id" | "created_at" | "updated_at" | "created_by"
>;

export interface SgsstGheFuncao {
  id: string;
  empresa_id: string;
  ghe_id: string;
  funcao_id: string;
  created_at?: string;
  funcao?: FuncaoDoGhe | null;
}

interface RespostaSupabase<T> {
  data: T | null;
  error: { message?: string; code?: string } | null;
}

/**
 * Riscos do inventário do PGR, para a seção de GHE do PCMSO.
 *
 * Consulta o inventário de TODOS os PGRs da empresa e não de um programa
 * específico, porque o GHE atravessa documentos: o grupo pode ter risco
 * levantado num PGR de obra e ser referenciado num PCMSO geral. Filtrar por um
 * pgrId faria a tabela de riscos do grupo aparecer vazia sem que nada estivesse
 * faltando.
 *
 * `enabled` é parâmetro porque a consulta só interessa na hora de emitir o
 * documento; carregá-la ao abrir a tela seria peso sem uso.
 */
export function useSgsstInventarioParaGhe(enabled: boolean) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  const query = useQuery({
    queryKey: ["sgsst_pgr_inventario", "para_ghe", empresaId],
    enabled: !!empresaId && enabled,
    queryFn: async () => {
      const { data, error } = (await (
        supabase
          .from("sgsst_pgr_inventario" as never)
          .select(
            "id, ghe_id, perigo, consequencia, " +
              "risco_catalogo:sgsst_riscos_catalogo(categoria, agente, consequencia), " +
              "funcoes:sgsst_pgr_inventario_funcoes(funcao_id)"
          )
          .eq("empresa_id", empresaId!) as never
      )) as RespostaSupabase<ItemInventarioBruto[]>;
      if (error) throw error;
      return (data ?? []) as ItemInventarioBruto[];
    },
  });

  /**
   * `undefined` enquanto não carregou — nunca `[]`.
   *
   * O documento usa a diferença: `undefined` imprime "inventário não consultado"
   * e `[]` imprime "nenhum risco alcança este grupo". São afirmações diferentes,
   * e só a segunda é uma conclusão.
   */
  const inventario: RiscoDoInventario[] | undefined = query.data?.map((item) => ({
    id: item.id,
    ghe_id: item.ghe_id ?? null,
    categoria: item.risco_catalogo?.categoria ?? null,
    // O perigo do item vence o agente do catálogo: é o que foi levantado em
    // campo para aquela exposição, enquanto o catálogo é o rótulo genérico.
    agente: item.perigo?.trim() || item.risco_catalogo?.agente || null,
    danos_saude: item.consequencia?.trim() || item.risco_catalogo?.consequencia || null,
    funcaoIds: (item.funcoes ?? []).map((f) => f.funcao_id),
  }));

  return { inventario, isLoading: query.isLoading, temErro: query.isError };
}

interface ItemInventarioBruto {
  id: string;
  ghe_id?: string | null;
  perigo?: string | null;
  consequencia?: string | null;
  risco_catalogo?: {
    categoria?: string | null;
    agente?: string | null;
    consequencia?: string | null;
  } | null;
  funcoes?: { funcao_id: string }[] | null;
}

export function useSgsstGhe() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = profile?.empresa_id;

  const listaQuery = useQuery({
    queryKey: ["sgsst_ghe", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = (await (
        supabase
          .from("sgsst_ghe" as never)
          .select("*")
          .eq("empresa_id", empresaId!)
          .order("codigo", { ascending: true }) as never
      )) as RespostaSupabase<SgsstGhe[]>;
      if (error) throw error;
      return (data ?? []) as SgsstGhe[];
    },
  });

  /**
   * Vínculos GHE↔função de toda a empresa, em uma consulta.
   *
   * Uma consulta por GHE geraria N requisições numa tela que lista dez grupos, e
   * o volume aqui é pequeno (dezenas de linhas por empresa). O agrupamento é
   * feito em memória.
   */
  const vinculosQuery = useQuery({
    queryKey: ["sgsst_ghe_funcoes", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = (await (
        supabase
          .from("sgsst_ghe_funcoes" as never)
          .select("*, funcao:sgsst_funcoes(id, nome, descricao, cbo)")
          .eq("empresa_id", empresaId!) as never
      )) as RespostaSupabase<SgsstGheFuncao[]>;
      if (error) throw error;
      return (data ?? []) as SgsstGheFuncao[];
    },
  });

  const vinculos = vinculosQuery.data;

  /**
   * Funções de um GHE.
   *
   * Devolve `null` enquanto não carregou — nunca lista vazia. Lista vazia diz
   * "grupo sem função", que é uma pendência de verdade; confundir uma com a
   * outra faria a tela acusar lacuna durante o carregamento.
   */
  const funcoesDoGhe = (gheId: string): FuncaoDoGhe[] | null => {
    if (!vinculos) return null;
    return vinculos
      .filter((v) => v.ghe_id === gheId && v.funcao)
      .map((v) => v.funcao as FuncaoDoGhe);
  };

  /** Códigos dos GHEs em que cada função está. Para o quadro de funções. */
  const ghesPorFuncao = (): Map<string, string[]> => {
    const mapa = new Map<string, string[]>();
    if (!vinculos || !listaQuery.data) return mapa;
    const codigoDe = new Map(listaQuery.data.map((g) => [g.id, g.codigo]));
    for (const v of vinculos) {
      const codigo = codigoDe.get(v.ghe_id);
      if (!codigo) continue;
      const atual = mapa.get(v.funcao_id) ?? [];
      atual.push(codigo);
      mapa.set(v.funcao_id, atual);
    }
    for (const [k, v] of mapa) mapa.set(k, v.sort());
    return mapa;
  };

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ["sgsst_ghe"] });
    queryClient.invalidateQueries({ queryKey: ["sgsst_ghe_funcoes"] });
  };

  const criar = useMutation({
    mutationFn: async (input: SgsstGheInput) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");
      const { data, error } = (await (
        supabase
          .from("sgsst_ghe" as never)
          .insert({ ...input, empresa_id: empresaId, created_by: profile?.id } as never)
          .select()
          .single() as never
      )) as RespostaSupabase<SgsstGhe>;
      if (error) throw error;
      return data as SgsstGhe;
    },
    onSuccess: () => {
      invalidar();
      toast.success("Grupo homogêneo de exposição criado!");
    },
    onError: (err: { message?: string; code?: string }) =>
      toast.error(`Erro ao criar o GHE: ${mensagemDeErroSupabase(err)}`),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, ...campos }: Partial<SgsstGheInput> & { id: string }) => {
      const { data, error } = (await (
        supabase
          .from("sgsst_ghe" as never)
          .update({ ...campos, updated_at: new Date().toISOString() } as never)
          .eq("id", id)
          .select()
          .single() as never
      )) as RespostaSupabase<SgsstGhe>;
      if (error) throw error;
      return data as SgsstGhe;
    },
    onSuccess: () => {
      invalidar();
      toast.success("GHE atualizado!");
    },
    onError: (err: { message?: string; code?: string }) =>
      toast.error(`Erro ao atualizar o GHE: ${mensagemDeErroSupabase(err)}`),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = (await (
        supabase.from("sgsst_ghe" as never).delete().eq("id", id) as never
      )) as RespostaSupabase<null>;
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      invalidar();
      // O exame e o item de inventário NÃO são excluídos: o `ghe_id` deles vai a
      // NULL (ON DELETE SET NULL). O aviso diz isso porque o usuário precisa
      // saber que a previsão continua existindo, agora sem grupo.
      toast.success("GHE excluído. Exames e riscos do grupo ficaram sem GHE vinculado.");
    },
    onError: (err: { message?: string; code?: string }) =>
      toast.error(`Erro ao excluir o GHE: ${mensagemDeErroSupabase(err)}`),
  });

  const vincularFuncao = useMutation({
    mutationFn: async ({ gheId, funcaoId }: { gheId: string; funcaoId: string }) => {
      if (!empresaId) throw new Error("Empresa não selecionada.");
      const { error } = (await (
        supabase
          .from("sgsst_ghe_funcoes" as never)
          .insert({ empresa_id: empresaId, ghe_id: gheId, funcao_id: funcaoId } as never) as never
      )) as RespostaSupabase<null>;
      if (error) throw error;
    },
    onSuccess: () => {
      invalidar();
      toast.success("Função vinculada ao GHE!");
    },
    onError: (err: { message?: string; code?: string }) =>
      toast.error(`Erro ao vincular a função ao GHE: ${mensagemDeErroSupabase(err)}`),
  });

  const desvincularFuncao = useMutation({
    mutationFn: async ({ gheId, funcaoId }: { gheId: string; funcaoId: string }) => {
      const { error } = (await (
        supabase
          .from("sgsst_ghe_funcoes" as never)
          .delete()
          .eq("ghe_id", gheId)
          .eq("funcao_id", funcaoId) as never
      )) as RespostaSupabase<null>;
      if (error) throw error;
    },
    onSuccess: () => {
      invalidar();
      toast.success("Função desvinculada do GHE.");
    },
    onError: (err: { message?: string; code?: string }) =>
      toast.error(`Erro ao desvincular a função do GHE: ${mensagemDeErroSupabase(err)}`),
  });

  return {
    ghes: listaQuery.data ?? [],
    /** `undefined` enquanto não carregou: quem precisa distinguir usa este. */
    ghesCarregados: listaQuery.data,
    isLoading: listaQuery.isLoading || vinculosQuery.isLoading,
    temErro: listaQuery.isError || vinculosQuery.isError,
    vinculos,
    funcoesDoGhe,
    ghesPorFuncao,
    criar,
    atualizar,
    excluir,
    vincularFuncao,
    desvincularFuncao,
  };
}
