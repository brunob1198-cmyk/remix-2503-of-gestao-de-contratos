import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface FrenteObra {
  id: string;
  projeto_id: string;
  nome: string;
  descricao?: string;
  data_inicio?: string;
  data_fim?: string;
  created_at: string;
  updated_at: string;
}

export interface AtividadePlanejamento {
  id: string;
  frente_id: string;
  item_lpu_id?: string;
  nome: string;
  quantidade_total: number;
  producao_diaria_prevista: number;
  data_inicio?: string;
  data_fim_prevista?: string;
  ordem: number;
  created_at: string;
  updated_at: string;
  // computed client-side
  frente_nome?: string;
  qtd_produzida?: number;
  percentual_executado?: number;
  status?: "adiantado" | "no_prazo" | "atrasado" | "nao_iniciado" | "concluido";
  duracao_dias?: number;
  predecessoras?: string[];
}

export interface DependenciaAtividade {
  id: string;
  atividade_id: string;
  predecessora_id: string;
}

export function useFrentes(projetoId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["frentes_obra", projetoId],
    queryFn: async () => {
      if (!projetoId) return [];
      const { data, error } = await supabase
        .from("frentes_obra")
        .select("*")
        .eq("projeto_id", projetoId)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as FrenteObra[];
    },
    enabled: !!projetoId,
  });

  const create = useMutation({
    mutationFn: async (frente: Partial<FrenteObra> & { projeto_id: string; nome: string }) => {
      const { data, error } = await supabase.from("frentes_obra").insert(frente).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["frentes_obra", projetoId] });
      toast.success("Frente criada com sucesso");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...rest }: Partial<FrenteObra> & { id: string }) => {
      const { error } = await supabase.from("frentes_obra").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["frentes_obra", projetoId] });
      toast.success("Frente atualizada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("frentes_obra").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["frentes_obra", projetoId] });
      toast.success("Frente removida");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return { ...query, create, update, remove };
}

export function useAtividades(projetoId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["atividades_planejamento", projetoId],
    queryFn: async () => {
      if (!projetoId) return [];
      // Get frentes for this project
      const { data: frentes, error: fErr } = await supabase
        .from("frentes_obra")
        .select("id, nome")
        .eq("projeto_id", projetoId);
      if (fErr) throw fErr;
      if (!frentes?.length) return [];

      const frenteIds = frentes.map((f) => f.id);
      const frenteMap = Object.fromEntries(frentes.map((f) => [f.id, f.nome]));

      const { data: atividades, error: aErr } = await supabase
        .from("atividades_planejamento")
        .select("*")
        .in("frente_id", frenteIds)
        .order("ordem");
      if (aErr) throw aErr;

      // Get dependencies
      const atIds = (atividades ?? []).map((a) => a.id);
      let deps: DependenciaAtividade[] = [];
      if (atIds.length) {
        const { data: dData } = await supabase
          .from("dependencias_atividade")
          .select("*")
          .in("atividade_id", atIds);
        deps = (dData ?? []) as DependenciaAtividade[];
      }

      // Get real production per item_lpu_id from lancamentos_producao
      const itemLpuIds = (atividades ?? [])
        .filter((a) => a.item_lpu_id)
        .map((a) => a.item_lpu_id!);

      let prodMap: Record<string, number> = {};
      if (itemLpuIds.length) {
        // Get sites for this project
        const { data: sites } = await supabase
          .from("sites")
          .select("id")
          .eq("projeto_id", projetoId);
        const siteIds = (sites ?? []).map((s) => s.id);

        if (siteIds.length) {
          const { data: prods } = await supabase
            .from("lancamentos_producao")
            .select("item_lpu_id, quantidade")
            .in("site_id", siteIds)
            .in("item_lpu_id", itemLpuIds);
          (prods ?? []).forEach((p) => {
            prodMap[p.item_lpu_id] = (prodMap[p.item_lpu_id] || 0) + Number(p.quantidade);
          });
        }
      }

      const depsMap: Record<string, string[]> = {};
      deps.forEach((d) => {
        if (!depsMap[d.atividade_id]) depsMap[d.atividade_id] = [];
        depsMap[d.atividade_id].push(d.predecessora_id);
      });

      const today = new Date();

      return (atividades ?? []).map((a) => {
        const qtdProd = a.item_lpu_id ? (prodMap[a.item_lpu_id] || 0) : 0;
        const qtdTotal = Number(a.quantidade_total) || 1;
        const pct = Math.min(100, (qtdProd / qtdTotal) * 100);
        const prodDiaria = Number(a.producao_diaria_prevista) || 1;
        const duracao = Math.ceil(qtdTotal / prodDiaria);

        let status: AtividadePlanejamento["status"] = "nao_iniciado";
        if (pct >= 100) {
          status = "concluido";
        } else if (a.data_inicio) {
          const inicio = new Date(a.data_inicio);
          if (today < inicio) {
            status = "nao_iniciado";
          } else {
            const diasPassados = Math.ceil((today.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
            const pctEsperado = Math.min(100, (diasPassados / duracao) * 100);
            if (pct >= pctEsperado + 5) status = "adiantado";
            else if (pct >= pctEsperado - 5) status = "no_prazo";
            else status = "atrasado";
          }
        }

        return {
          ...a,
          quantidade_total: Number(a.quantidade_total),
          producao_diaria_prevista: Number(a.producao_diaria_prevista),
          frente_nome: frenteMap[a.frente_id] || "",
          qtd_produzida: qtdProd,
          percentual_executado: Math.round(pct * 10) / 10,
          status,
          duracao_dias: duracao,
          predecessoras: depsMap[a.id] || [],
        } as AtividadePlanejamento;
      });
    },
    enabled: !!projetoId,
  });

  const create = useMutation({
    mutationFn: async (at: any) => {
      const { predecessoras, ...rest } = at;
      const { data, error } = await supabase.from("atividades_planejamento").insert(rest).select().single();
      if (error) throw error;

      if (predecessoras?.length) {
        const deps = predecessoras.map((pId: string) => ({
          atividade_id: data.id,
          predecessora_id: pId,
        }));
        const { error: dErr } = await supabase.from("dependencias_atividade").insert(deps);
        if (dErr) throw dErr;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["atividades_planejamento", projetoId] });
      toast.success("Atividade criada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, predecessoras, ...rest }: any) => {
      const { error } = await supabase.from("atividades_planejamento").update(rest).eq("id", id);
      if (error) throw error;

      // Update dependencies
      if (predecessoras !== undefined) {
        await supabase.from("dependencias_atividade").delete().eq("atividade_id", id);
        if (predecessoras?.length) {
          const deps = predecessoras.map((pId: string) => ({
            atividade_id: id,
            predecessora_id: pId,
          }));
          await supabase.from("dependencias_atividade").insert(deps);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["atividades_planejamento", projetoId] });
      toast.success("Atividade atualizada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("atividades_planejamento").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["atividades_planejamento", projetoId] });
      toast.success("Atividade removida");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return { ...query, create, update, remove };
}
