import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export interface ItemDisponivel {
  site_id: string;
  site_codigo: string;
  site_nome: string;
  site_municipio: string;
  site_uf: string;
  projeto_id: string;
  projeto_codigo: string;
  projeto_nome: string;
  item_lpu_id: string;
  item_codigo: string;
  item_descricao: string;
  unidade: string;
  preco_unitario: number;
  qtd_aprovada: number;
  valor_aprovado: number;
  qtd_ja_faturada: number;
  valor_ja_faturado: number;
  qtd_saldo: number;
  valor_saldo: number;
}

export interface Faturamento {
  id: string;
  projeto_id: string;
  numero_fatura: string | null;
  data_emissao: string;
  valor_bruto: number;
  impostos_percentual: number;
  impostos_valor: number;
  descontos: number;
  valor_liquido: number;
  status: string;
  observacao: string | null;
  created_at: string;
  updated_at: string;
  projeto?: { codigo: string; nome: string };
  itens?: FaturamentoItem[];
}

export interface FaturamentoItem {
  id: string;
  faturamento_id: string;
  site_id: string;
  item_lpu_id: string;
  quantidade_faturada: number;
  valor_unitario: number;
  valor_faturado: number;
  created_at: string;
}

export function useItensDisponiveis(projetoId?: string) {
  return useQuery({
    queryKey: ["itens_disponiveis_faturamento", projetoId],
    queryFn: async () => {
      // 1. Buscar medições aprovadas
      let qMedicoes = supabase
        .from("lancamentos_medicao")
        .select("site_id, item_lpu_id, quantidade, quantidade_aprovada, site:sites(codigo, nome, municipio, uf, projeto_id, projeto:projetos(id, codigo, nome)), item_lpu:itens_lpu(codigo, descricao, unidade, preco_unitario)")
        .in("status", ["aprovado", "finalizado"])
        .limit(100000);

      if (projetoId) {
        // Filter by project via sites
        const { data: projSites } = await supabase
          .from("sites")
          .select("id")
          .eq("projeto_id", projetoId);
        if (projSites && projSites.length > 0) {
          qMedicoes = qMedicoes.in("site_id", projSites.map(s => s.id));
        } else {
          return [];
        }
      }

      const { data: medicoes, error: errMed } = await qMedicoes;
      if (errMed) throw errMed;

      // 2. Buscar faturamentos já feitos
      const { data: fatItens, error: errFat } = await supabase
        .from("faturamento_itens")
        .select("site_id, item_lpu_id, quantidade_faturada, valor_faturado")
        .limit(100000);
      if (errFat) throw errFat;

      // 3. Agregar aprovados por site+item
      const mapAprovado = new Map<string, {
        site_id: string; site_codigo: string; site_nome: string;
        site_municipio: string; site_uf: string;
        projeto_id: string; projeto_codigo: string; projeto_nome: string;
        item_lpu_id: string; item_codigo: string; item_descricao: string;
        unidade: string; preco_unitario: number;
        qtd_aprovada: number; valor_aprovado: number;
      }>();

      for (const m of (medicoes || [])) {
        const site = m.site as any;
        const item = m.item_lpu as any;
        if (!site || !item) continue;
        const proj = site.projeto as any;
        const key = `${m.site_id}__${m.item_lpu_id}`;
        const qtdAprov = m.quantidade_aprovada || m.quantidade || 0;
        const existing = mapAprovado.get(key);
        if (existing) {
          existing.qtd_aprovada += qtdAprov;
          existing.valor_aprovado += qtdAprov * item.preco_unitario;
        } else {
          mapAprovado.set(key, {
            site_id: m.site_id,
            site_codigo: site.codigo,
            site_nome: site.nome,
            site_municipio: site.municipio || "",
            site_uf: site.uf || "",
            projeto_id: proj?.id || "",
            projeto_codigo: proj?.codigo || "",
            projeto_nome: proj?.nome || "",
            item_lpu_id: m.item_lpu_id,
            item_codigo: item.codigo,
            item_descricao: item.descricao,
            unidade: item.unidade,
            preco_unitario: item.preco_unitario,
            qtd_aprovada: qtdAprov,
            valor_aprovado: qtdAprov * item.preco_unitario,
          });
        }
      }

      // 4. Agregar já faturado
      const mapFaturado = new Map<string, { qtd: number; valor: number }>();
      for (const fi of (fatItens || [])) {
        const key = `${fi.site_id}__${fi.item_lpu_id}`;
        const existing = mapFaturado.get(key);
        if (existing) {
          existing.qtd += fi.quantidade_faturada;
          existing.valor += fi.valor_faturado;
        } else {
          mapFaturado.set(key, { qtd: fi.quantidade_faturada, valor: fi.valor_faturado });
        }
      }

      // 5. Calcular saldo
      const result: ItemDisponivel[] = [];
      for (const [key, aprov] of mapAprovado) {
        const fat = mapFaturado.get(key) || { qtd: 0, valor: 0 };
        const qtdSaldo = aprov.qtd_aprovada - fat.qtd;
        if (qtdSaldo <= 0) continue; // sem saldo
        result.push({
          ...aprov,
          qtd_ja_faturada: fat.qtd,
          valor_ja_faturado: fat.valor,
          qtd_saldo: qtdSaldo,
          valor_saldo: qtdSaldo * aprov.preco_unitario,
        });
      }

      return result;
    },
    enabled: true,
  });
}

export function useFaturamentos(projetoId?: string) {
  return useQuery({
    queryKey: ["faturamentos", projetoId],
    queryFn: async () => {
      let query = supabase
        .from("faturamentos")
        .select("*, projeto:projetos(codigo, nome), itens:faturamento_itens(*)")
        .order("data_emissao", { ascending: false })
        .limit(100000);

      if (projetoId) {
        query = query.eq("projeto_id", projetoId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Faturamento[];
    },
  });
}

export function useFaturamentoItens(faturamentoId?: string) {
  return useQuery({
    queryKey: ["faturamento_itens", faturamentoId],
    queryFn: async () => {
      if (!faturamentoId) return [];
      const { data, error } = await supabase
        .from("faturamento_itens")
        .select("*")
        .eq("faturamento_id", faturamentoId);
      if (error) throw error;
      return data as FaturamentoItem[];
    },
    enabled: !!faturamentoId,
  });
}

export function useGerarFaturamento() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { empresaId } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      projeto_id: string;
      numero_fatura?: string;
      data_emissao: string;
      impostos_percentual: number;
      descontos: number;
      observacao?: string;
      itens: {
        site_id: string;
        item_lpu_id: string;
        quantidade_faturada: number;
        valor_unitario: number;
        valor_faturado: number;
      }[];
    }) => {
      const valor_bruto = params.itens.reduce((s, i) => s + i.valor_faturado, 0);
      const impostos_valor = valor_bruto * (params.impostos_percentual / 100);
      const valor_liquido = valor_bruto - impostos_valor - params.descontos;

      // 1. Criar fatura
      const { data: fatura, error: errFat } = await supabase
        .from("faturamentos")
        .insert({
          projeto_id: params.projeto_id,
          numero_fatura: params.numero_fatura || null,
          data_emissao: params.data_emissao,
          valor_bruto,
          impostos_percentual: params.impostos_percentual,
          impostos_valor,
          descontos: params.descontos,
          valor_liquido,
          observacao: params.observacao || null,
          status: "emitido",
        })
        .select("*, projeto:projetos(codigo, nome, cliente)")
        .single();
      if (errFat) throw errFat;

      // 2. Criar itens
      const itensInsert = params.itens.map(i => ({
        faturamento_id: fatura.id,
        site_id: i.site_id,
        item_lpu_id: i.item_lpu_id,
        quantidade_faturada: i.quantidade_faturada,
        valor_unitario: i.valor_unitario,
        valor_faturado: i.valor_faturado,
      }));

      const { error: errItens } = await supabase
        .from("faturamento_itens")
        .insert(itensInsert);
      if (errItens) throw errItens;

      // 3. Auto-send to ERP if configured
      if (empresaId) {
        try {
          const { data: configs } = await supabase
            .from("integracoes_erp_config")
            .select("id")
            .eq("empresa_id", empresaId)
            .eq("ativo", true)
            .limit(1);

          if (configs && configs.length > 0) {
            const projeto = fatura.projeto as any;
            await supabase.functions.invoke("send-erp-webhook", {
              body: {
                action: "send",
                config_id: configs[0].id,
                empresa_id: empresaId,
                evento: "faturamento_criado",
                payload: {
                  faturamento_id: fatura.id,
                  numero_fatura: fatura.numero_fatura,
                  obra: projeto?.nome || "",
                  cliente: projeto?.cliente || "",
                  valor: valor_liquido,
                  valor_bruto,
                  impostos: impostos_valor,
                  descontos: params.descontos,
                  data: params.data_emissao,
                  itens: params.itens.map(i => ({
                    site_id: i.site_id,
                    item_lpu_id: i.item_lpu_id,
                    quantidade: i.quantidade_faturada,
                    valor_unitario: i.valor_unitario,
                    valor_total: i.valor_faturado,
                  })),
                },
              },
            });
          }
        } catch (erpErr) {
          console.error("ERP auto-send failed:", erpErr);
          // Don't fail the faturamento creation
        }
      }

      return fatura;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faturamentos"] });
      queryClient.invalidateQueries({ queryKey: ["faturamento_itens"] });
      queryClient.invalidateQueries({ queryKey: ["itens_disponiveis_faturamento"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["erp_logs"] });
      toast({ title: "Faturamento gerado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao gerar faturamento", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateFaturamentoStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("faturamentos")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faturamentos"] });
      toast({ title: "Status da fatura atualizado!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" });
    },
  });
}
