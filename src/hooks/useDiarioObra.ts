import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface DiarioObra {
  id: string;
  site_id: string;
  data: string;
  observacoes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface DiarioProducao {
  id: string;
  diario_id: string;
  item_lpu_id: string;
  quantidade: number;
  preco_unitario_congelado: number;
  valor_total: number;
  created_at: string | null;
  item_lpu?: { codigo: string; descricao: string; unidade: string; preco_unitario: number };
}

export interface DiarioEquipe {
  id: string;
  diario_id: string;
  nome: string;
  funcao: string | null;
  horas: number;
  custo_hora: number;
  custo_total: number;
}

export interface DiarioEquipamento {
  id: string;
  diario_id: string;
  descricao: string;
  horas: number;
  custo_hora: number;
  custo_total: number;
}

export interface DiarioVeiculo {
  id: string;
  diario_id: string;
  descricao: string;
  placa: string | null;
  km_inicial: number;
  km_final: number;
  km_rodados: number;
  custo_diaria: number;
}

export interface DiarioFoto {
  id: string;
  diario_id: string;
  diario_producao_id: string | null;
  url: string;
  thumb_url: string | null;
  thumb_600_url: string | null;
  classificacao: string;
  legenda: string | null;
}

export function useDiarioObra(siteId?: string, data?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch or create diary for a given site+date
  const { data: diario, isLoading: loadingDiario } = useQuery({
    queryKey: ["diario_obra", siteId, data],
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 20, // 20 minutes
    queryFn: async () => {
      if (!siteId || !data) return null;
      const { data: existing, error } = await supabase
        .from("diarios_obra")
        .select("*")
        .eq("site_id", siteId)
        .eq("data", data)
        .maybeSingle();
      if (error) throw error;
      return existing as DiarioObra | null;
    },
    enabled: !!siteId && !!data,
  });

  const criarDiario = useMutation({
    mutationFn: async ({ site_id, data: dt, uf, municipio }: { site_id: string; data: string; uf?: string; municipio?: string }) => {
      const { data: d, error } = await supabase
        .from("diarios_obra")
        .insert([{ site_id, data: dt, uf, municipio } as any])
        .select()
        .single();
      if (error) throw error;
      return d as DiarioObra;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diario_obra"] });
      queryClient.invalidateQueries({ queryKey: ["diario_calendario"] });
    },
    onError: (e: Error) => toast({ title: "Erro ao criar diário", description: e.message, variant: "destructive" }),
  });

  const atualizarObservacoes = useMutation({
    mutationFn: async ({ id, observacoes }: { id: string; observacoes: string }) => {
      const { error } = await supabase.from("diarios_obra").update({ observacoes }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["diario_obra"] }),
  });

  const atualizarLocalizacao = useMutation({
    mutationFn: async ({ id, uf, municipio }: { id: string; uf: string; municipio: string }) => {
      const { error } = await supabase.from("diarios_obra").update({ uf, municipio } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diario_obra"] });
      queryClient.invalidateQueries({ queryKey: ["diario_calendario"] });
    },
  });

  const atualizarClima = useMutation({
    mutationFn: async ({ id, clima }: { id: string; clima: string }) => {
      const { error } = await supabase.from("diarios_obra").update({ clima } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diario_obra"] });
      queryClient.invalidateQueries({ queryKey: ["diario_calendario"] });
    },
  });

  const duplicarDiarioAnterior = useMutation({
    mutationFn: async ({ site_id, data: dt }: { site_id: string; data: string }) => {
      // 1. Fetch previous diary
      const { data: prevDiarios, error: fetchErr } = await supabase
        .from("diarios_obra")
        .select("*")
        .eq("site_id", site_id)
        .lt("data", dt)
        .order("data", { ascending: false })
        .limit(1);
        
      if (fetchErr) throw new Error("Erro ao buscar diário anterior");
      if (!prevDiarios || prevDiarios.length === 0) {
        throw new Error("Nenhum diário anterior encontrado para este site");
      }
      
      const prevId = prevDiarios[0].id;

      // 2. Ensure current diary exists
      let currId;
      const { data: currDiario, error: currErr } = await supabase
        .from("diarios_obra")
        .select("id")
        .eq("site_id", site_id)
        .eq("data", dt)
        .maybeSingle();
        
      if (currErr) throw currErr;
      
      if (currDiario) {
        currId = currDiario.id;
      } else {
        const { data: novo, error: insErr } = await supabase
          .from("diarios_obra")
          .insert([{ site_id, data: dt }])
          .select()
          .single();
        if (insErr) throw insErr;
        currId = novo.id;
      }

      // 3. Duplicate tables (Equipe, Equipamentos, Veiculos, Producao)
      const tables: Array<"diario_producao" | "diario_equipe" | "diario_equipamentos" | "diario_veiculos"> = [
        "diario_producao", "diario_equipe", "diario_equipamentos", "diario_veiculos"
      ];
      
      for (const table of tables) {
        const { data: records, error: recErr } = await supabase
          .from(table)
          .select("*")
          .eq("diario_id", prevId);
          
        if (recErr) throw recErr;
        
        if (records && records.length > 0) {
          const inserts = records.map((r: any) => {
            const { id, created_at, ...rest } = r;
            return { ...rest, diario_id: currId };
          });
          const { error: insRecErr } = await supabase.from(table).insert(inserts);
          if (insRecErr) {
             console.error(`Erro copiando tabela ${table}:`, insRecErr);
          }
        }
      }
      
      return currId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diario_obra"] });
      queryClient.invalidateQueries({ queryKey: ["diario_producao"] });
      queryClient.invalidateQueries({ queryKey: ["diario_producao_quadro"] });
      queryClient.invalidateQueries({ queryKey: ["diario_equipe"] });
      queryClient.invalidateQueries({ queryKey: ["diario_equipamentos"] });
      queryClient.invalidateQueries({ queryKey: ["diario_veiculos"] });
      toast({ title: "Diário duplicado com sucesso!" });
    },
    onError: (e: Error) => {
      toast({ title: "Falha ao duplicar", description: e.message, variant: "destructive" });
    }
  });

  // Production
  const { data: producoes = [], isLoading: loadingProducao } = useQuery({
    queryKey: ["diario_producao", diario?.id],
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 20,
    queryFn: async () => {
      if (!diario?.id) return [];
      const { data: d, error } = await supabase
        .from("diario_producao")
        .select("*, item_lpu:itens_lpu(codigo, descricao, unidade, preco_unitario)")
        .eq("diario_id", diario.id);
      if (error) throw error;
      return d as DiarioProducao[];
    },
    enabled: !!diario?.id,
  });

  const addProducao = useMutation({
    mutationFn: async (item: { diario_id: string; item_lpu_id: string; quantidade: number; preco_unitario_congelado: number; valor_total: number }) => {
      const { error } = await supabase.from("diario_producao").insert([item]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diario_producao"] });
      queryClient.invalidateQueries({ queryKey: ["diario_producao_quadro"] });
      queryClient.invalidateQueries({ queryKey: ["diario_calendario"] });
      toast({ title: "Produção adicionada!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const removeProducao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("diario_producao").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diario_producao"] });
      queryClient.invalidateQueries({ queryKey: ["diario_producao_quadro"] });
      queryClient.invalidateQueries({ queryKey: ["diario_calendario"] });
    },
  });

  const updateProducao = useMutation({
    mutationFn: async (item: { id: string; quantidade: number; valor_total: number }) => {
      const { error } = await supabase
        .from("diario_producao")
        .update({ quantidade: item.quantidade, valor_total: item.valor_total })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diario_producao"] });
      queryClient.invalidateQueries({ queryKey: ["diario_producao_quadro"] });
      queryClient.invalidateQueries({ queryKey: ["diario_calendario"] });
    },
    onError: (e: Error) => toast({ title: "Erro ao atualizar produção", description: e.message, variant: "destructive" }),
  });

  // Equipe
  const { data: equipe = [], isLoading: isLoadingEquipe } = useQuery({
    queryKey: ["diario_equipe", diario?.id],
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 20,
    queryFn: async () => {
      if (!diario?.id) return [];
      const { data: d, error } = await supabase.from("diario_equipe").select("*").eq("diario_id", diario.id);
      if (error) throw error;
      return d as DiarioEquipe[];
    },
    enabled: !!diario?.id,
  });

  const addEquipe = useMutation({
    mutationFn: async (item: { diario_id: string; nome: string; funcao?: string; horas: number; custo_hora: number; custo_total: number }) => {
      const { error } = await supabase.from("diario_equipe").insert([item]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diario_equipe"] });
      queryClient.invalidateQueries({ queryKey: ["diario_calendario"] });
      toast({ title: "Pessoa adicionada!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateEquipe = useMutation({
    mutationFn: async (item: { id: string; horas: number; custo_hora: number; custo_total: number }) => {
      const { error } = await supabase.from("diario_equipe").update({ horas: item.horas, custo_hora: item.custo_hora, custo_total: item.custo_total }).eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diario_equipe"] });
      queryClient.invalidateQueries({ queryKey: ["diario_calendario"] });
    },
    onError: (e: Error) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });

  const removeEquipe = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("diario_equipe").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diario_equipe"] });
      queryClient.invalidateQueries({ queryKey: ["diario_calendario"] });
    },
  });

  // Equipamentos
  const { data: equipamentos = [], isLoading: isLoadingEquipamentos } = useQuery({
    queryKey: ["diario_equipamentos", diario?.id],
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 20,
    queryFn: async () => {
      if (!diario?.id) return [];
      const { data: d, error } = await supabase.from("diario_equipamentos").select("*").eq("diario_id", diario.id);
      if (error) throw error;
      return d as DiarioEquipamento[];
    },
    enabled: !!diario?.id,
  });

  const addEquipamento = useMutation({
    mutationFn: async (item: { diario_id: string; descricao: string; horas: number; custo_hora: number; custo_total: number }) => {
      const { error } = await supabase.from("diario_equipamentos").insert([item]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diario_equipamentos"] });
      queryClient.invalidateQueries({ queryKey: ["diario_calendario"] });
      toast({ title: "Equipamento adicionado!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateEquipamento = useMutation({
    mutationFn: async (item: { id: string; horas: number; custo_hora: number; custo_total: number }) => {
      const { error } = await supabase.from("diario_equipamentos").update({ horas: item.horas, custo_hora: item.custo_hora, custo_total: item.custo_total }).eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diario_equipamentos"] });
      queryClient.invalidateQueries({ queryKey: ["diario_calendario"] });
    },
    onError: (e: Error) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });

  const removeEquipamento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("diario_equipamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diario_equipamentos"] });
      queryClient.invalidateQueries({ queryKey: ["diario_calendario"] });
    },
  });

  // Veículos
  const { data: veiculos = [], isLoading: isLoadingVeiculos } = useQuery({
    queryKey: ["diario_veiculos", diario?.id],
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 20,
    queryFn: async () => {
      if (!diario?.id) return [];
      const { data: d, error } = await supabase.from("diario_veiculos").select("*").eq("diario_id", diario.id);
      if (error) throw error;
      return d as DiarioVeiculo[];
    },
    enabled: !!diario?.id,
  });

  const addVeiculo = useMutation({
    mutationFn: async (item: { diario_id: string; descricao: string; placa?: string; km_inicial?: number; km_final?: number; km_rodados?: number; custo_diaria: number }) => {
      const { error } = await supabase.from("diario_veiculos").insert([item]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diario_veiculos"] });
      queryClient.invalidateQueries({ queryKey: ["diario_calendario"] });
      toast({ title: "Veículo adicionado!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateVeiculo = useMutation({
    mutationFn: async (item: { id: string; km_inicial?: number; km_final?: number; km_rodados?: number; custo_diaria: number }) => {
      const { error } = await supabase.from("diario_veiculos").update({ 
        km_inicial: item.km_inicial, 
        km_final: item.km_final, 
        km_rodados: item.km_rodados, 
        custo_diaria: item.custo_diaria 
      }).eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diario_veiculos"] });
      queryClient.invalidateQueries({ queryKey: ["diario_calendario"] });
    },
    onError: (e: Error) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });

  const removeVeiculo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("diario_veiculos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diario_veiculos"] });
      queryClient.invalidateQueries({ queryKey: ["diario_calendario"] });
    },
  });

  // Fotos
  const { data: fotos = [] } = useQuery({
    queryKey: ["diario_fotos", diario?.id],
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 20,
    queryFn: async () => {
      if (!diario?.id) return [];
      
      let all: any[] = [];
      let from = 0;
      let to = 999;
      while (true) {
        const { data: d, error } = await supabase
          .from("diario_fotos")
          .select("*")
          .eq("diario_id", diario.id)
          .range(from, to);
        if (error) throw error;
        if (!d || d.length === 0) break;
        all = [...all, ...d];
        if (d.length < 1000) break;
        from += 1000;
        to += 1000;
      }
      return all as DiarioFoto[];
    },
    enabled: !!diario?.id,
  });

  const addFoto = useMutation({
    mutationFn: async (item: { 
      diario_id: string; 
      url: string; 
      thumb_url?: string | null; 
      thumb_600_url?: string | null;
      classificacao: string; 
      legenda?: string; 
      diario_producao_id?: string 
    }) => {
      const { error } = await supabase.from("diario_fotos").insert([item]);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["diario_fotos"] }),
  });

  const removeFoto = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("diario_fotos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["diario_fotos"] }),
  });

  // Summaries
  const totalProducao = producoes.reduce((s, p) => s + Number(p.valor_total), 0);
  const custoEquipe = equipe.reduce((s, e) => s + Number(e.custo_total), 0);
  const custoEquipamentos = equipamentos.reduce((s, e) => s + Number(e.custo_total), 0);
  const custoVeiculos = veiculos.reduce((s, v) => s + Number(v.custo_diaria), 0);
  const custoTotal = custoEquipe + custoEquipamentos + custoVeiculos;
  const margem = totalProducao - custoTotal;

  const { data: previsoes = {} } = useQuery({
    queryKey: ["previsoes_diario", siteId],
    queryFn: async () => {
      if (!siteId) return {};
      const { data, error } = await supabase
        .from("frentes_obra")
        .select("id, atividades_planejamento(item_lpu_id, producao_diaria_prevista)")
        .eq("site_id", siteId);
      if (error) throw error;
      
      const prevMap: Record<string, number> = {};
      data?.forEach((f: any) => {
        f.atividades_planejamento?.forEach((a: any) => {
           if (a.item_lpu_id && a.producao_diaria_prevista) {
             prevMap[a.item_lpu_id] = (prevMap[a.item_lpu_id] || 0) + Number(a.producao_diaria_prevista);
           }
        });
      });
      return prevMap;
    },
    enabled: !!siteId
  });

  return {
    diario, loadingDiario, criarDiario,
    atualizarObservacoes, atualizarClima, atualizarLocalizacao,
    producoes, loadingProducao, addProducao, removeProducao, updateProducao,
    equipe, isLoadingEquipe, addEquipe, updateEquipe, removeEquipe,
    equipamentos, isLoadingEquipamentos, addEquipamento, updateEquipamento, removeEquipamento,
    veiculos, isLoadingVeiculos, addVeiculo, updateVeiculo, removeVeiculo,
    fotos, addFoto, removeFoto,
    totalProducao, custoTotal, margem,
    custoEquipe, custoEquipamentos, custoVeiculos,
    duplicarDiarioAnterior, previsoes,
  };
}
