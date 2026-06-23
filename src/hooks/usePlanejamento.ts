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
  is_principal?: boolean;
  matriz_producao?: Record<string, number>;
  media_diaria_realizada?: number;
  unidade?: string;
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
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
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
    mutationFn: async (payload: any) => {
      const { recursos, atividades_geradas, ...frenteData } = payload;
      
      // 1. Cria a frente
      const { data, error } = await supabase.from("frentes_obra").insert(frenteData).select().single();
      if (error) throw error;
      
      const novaFrenteId = data.id;

      // 2. Vincula Recursos
      if (recursos && recursos.length > 0) {
        const recursosDb = recursos.map((rid: string) => ({
          frente_id: novaFrenteId,
          recurso_id: rid
        }));
        const { error: errRec } = await (supabase as any).from("frentes_recursos").insert(recursosDb);
        if (errRec) console.error("Erro vinculando recursos:", errRec);
      }

      // 3. Cria Atividades a partir do Escopo
      if (atividades_geradas && atividades_geradas.length > 0) {
        let ordemAtual = 1;
        const atividadesDb = atividades_geradas.map((a: any) => {
          let expectedEnd = null;
          if (frenteData.data_inicio) {
            const duracao = Math.ceil((Number(a.quantidade_total) || 1) / (Number(a.producao_diaria_prevista) || 1));
            const startStr = frenteData.data_inicio;
            const endD = new Date(startStr);
            endD.setDate(endD.getDate() + duracao - 1);
            expectedEnd = endD.toISOString().split("T")[0];
          }

          return {
            frente_id: novaFrenteId,
            item_lpu_id: a.item_lpu_id,
            nome: a.nome,
            quantidade_total: a.quantidade_total,
            producao_diaria_prevista: a.producao_diaria_prevista,
            is_principal: a.is_principal || false,
            data_inicio: frenteData.data_inicio || null,
            data_fim_prevista: expectedEnd,
            ordem: ordemAtual++
          };
        });
        
        const { error: errAtv } = await supabase.from("atividades_planejamento").insert(atividadesDb);
        if (errAtv) console.error("Erro inserindo atividades geradas:", errAtv);

        // Se tiver atividade principal sem data fim na frente, atualiza a data da frente
        if (!frenteData.data_fim) {
          const princAtiv = atividadesDb.find((a: any) => a.is_principal);
          if (princAtiv && princAtiv.data_fim_prevista) {
            await supabase.from("frentes_obra").update({ data_fim: princAtiv.data_fim_prevista }).eq("id", novaFrenteId);
          }
        }
      }

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
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
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
        .select("*, lpu:itens_lpu(unidade)")
        .in("frente_id", frenteIds)
        .order("ordem");
      if (aErr) throw aErr;

      // Get dependencies AND project sites in parallel — both depend only on
      // already-known IDs and are independent of each other.
      const atIds = (atividades ?? []).map((a) => a.id);
      const itemLpuIds = (atividades ?? [])
        .filter((a) => a.item_lpu_id)
        .map((a) => a.item_lpu_id!);

      const [depsResult, sitesResult] = await Promise.all([
        atIds.length
          ? supabase
              .from("dependencias_atividade")
              .select("*")
              .in("atividade_id", atIds)
          : Promise.resolve({ data: [] as DependenciaAtividade[] }),
        itemLpuIds.length
          ? supabase.from("sites").select("id").eq("projeto_id", projetoId)
          : Promise.resolve({ data: [] as { id: string }[] }),
      ]);

      const deps = (depsResult.data ?? []) as DependenciaAtividade[];
      const siteIds = (sitesResult.data ?? []).map((s: any) => s.id);

      let prodMap: Record<string, number> = {};
      let matrizGeral: Record<string, Record<string, number>> = {};

      // Diarios depend on siteIds, prods depend on diarioIds — keep sequential
      // but short-circuit when there's nothing to fetch.
      if (itemLpuIds.length && siteIds.length) {
        const { data: diariosDoSite } = await supabase
          .from("diarios_obra")
          .select("id, data")
          .in("site_id", siteIds);

        if (diariosDoSite && diariosDoSite.length > 0) {
          const diarioIds = diariosDoSite.map(d => d.id);
          const dataDiarioMap = Object.fromEntries(diariosDoSite.map(d => [d.id, d.data]));

          const { data: prods } = await supabase
            .from("diario_producao")
            .select("item_lpu_id, quantidade, diario_id")
            .in("diario_id", diarioIds)
            .in("item_lpu_id", itemLpuIds);

          (prods ?? []).forEach((p) => {
            const qtd = Number(p.quantidade) || 0;
            const dataRealizada = dataDiarioMap[p.diario_id];
            prodMap[p.item_lpu_id] = (prodMap[p.item_lpu_id] || 0) + qtd;
            // Matriz diária:
            if (dataRealizada) {
              if (!matrizGeral[p.item_lpu_id]) matrizGeral[p.item_lpu_id] = {};
              matrizGeral[p.item_lpu_id][dataRealizada] = (matrizGeral[p.item_lpu_id][dataRealizada] || 0) + qtd;
            }
          });
        }
      }

      const depsMap: Record<string, string[]> = {};
      deps.forEach((d) => {
        if (!depsMap[d.atividade_id]) depsMap[d.atividade_id] = [];
        depsMap[d.atividade_id].push(d.predecessora_id);
      });

      const today = new Date();

      return (atividades ?? []).map((aBase) => {
        const a = aBase as any;
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
            if (pct >= 100) status = "concluido";
            else if (pct >= pctEsperado + 5) status = "adiantado";
            else if (pct >= Math.max(0, pctEsperado - 5)) status = "no_prazo";
            else status = "atrasado";
          }
        }

        const matriz = a.item_lpu_id ? matrizGeral[a.item_lpu_id] || {} : {};
        const diasComProducao = Object.keys(matriz).length;
        const mediaDiaria = diasComProducao > 0 ? qtdProd / diasComProducao : 0;

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
          is_principal: !!a.is_principal,
          matriz_producao: matriz,
          media_diaria_realizada: mediaDiaria,
          unidade: a.lpu?.unidade || "-",
        } as AtividadePlanejamento;
      });
    },
    enabled: !!projetoId,
  });

  const create = useMutation({
    mutationFn: async (at: any) => {
      if (Array.isArray(at)) {
        // Múltiplos itens (Vindos do Vincular Escopo)
        const itemsToInsert = at.map(a => {
           const { predecessoras, ...rest } = a;
           return rest;
        });
        const { data, error } = await supabase.from("atividades_planejamento").insert(itemsToInsert).select();
        if (error) throw error;
        return data;
      } else {
        // Item Único (Legado/Geral)
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
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["atividades_planejamento", projetoId] });
      toast.success("Itens/Atividades criados com sucesso!");
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

  const analyzeGanttAi = useMutation({
    mutationFn: async (atividades: AtividadePlanejamento[]) => {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const suggestions: { id: string; nova_data_fim: string }[] = [];

      for (const a of atividades) {
        if (!a.data_inicio) continue;
        const qtdTotal = Number(a.quantidade_total) || 0;
        if (qtdTotal <= 0) continue;
        const prodPrev = Number(a.producao_diaria_prevista) || 0;
        if (prodPrev <= 0) continue;

        const inicio = new Date(a.data_inicio);
        inicio.setHours(0, 0, 0, 0);
        const qtdProd = Number(a.qtd_produzida) || 0;
        const pct = qtdProd / qtdTotal;

        // já concluída, não sugere alteração
        if (pct >= 1) continue;

        const diasPassados = Math.max(
          0,
          Math.ceil((hoje.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24))
        );

        let novaDuracao: number;
        if (hoje <= inicio) {
          // ainda não começou: mantém previsão original
          novaDuracao = Math.ceil(qtdTotal / prodPrev);
        } else if (qtdProd <= 0) {
          // atrasada sem produção: assume ritmo previsto a partir de hoje + atraso
          novaDuracao = diasPassados + Math.ceil(qtdTotal / prodPrev);
        } else {
          const ritmoReal = qtdProd / Math.max(1, diasPassados);
          // se ritmo real >= previsto, mantém duração original
          const ritmoUsado = Math.min(ritmoReal, prodPrev);
          novaDuracao = Math.ceil(qtdTotal / Math.max(0.01, ritmoUsado));
        }

        const novaFim = new Date(inicio);
        novaFim.setDate(novaFim.getDate() + novaDuracao - 1);
        suggestions.push({
          id: a.id,
          nova_data_fim: novaFim.toISOString().split("T")[0],
        });
      }

      return suggestions;
    },
    onSuccess: async (suggestions) => {
      for (const sug of suggestions) {
        await supabase.from("atividades_planejamento").update({ data_fim_prevista: sug.nova_data_fim }).eq("id", sug.id);
      }
      queryClient.invalidateQueries({ queryKey: ["atividades_planejamento", projetoId] });
      toast.success(`Cronograma recalculado (${suggestions.length} atividade(s) ajustada(s))`);
    },
    onError: (e: Error) => toast.error("Erro ao recalcular: " + e.message)
  });

  return { ...query, create, update, remove, analyzeGanttAi };
}

