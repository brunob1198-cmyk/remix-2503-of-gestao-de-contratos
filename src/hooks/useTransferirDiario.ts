import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface TransferirParaProjetoParams {
  diarioId: string;
  destinoSiteId: string;
  destinoProjetoId: string;
  novaData?: string; // opcional; default = data atual do diário
}

export interface TransferirParaProjetoResult {
  targetDiarioId: string;
  movedProducoes: number;
}

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  [
    "diario_obra",
    "diario_producao",
    "diario_equipe",
    "diario_equipamentos",
    "diario_veiculos",
    "diario_fotos",
    "diario_calendario",
    "diario_campo_atividades",
    "diario_campo_calendario",
    "rdo",
  ].forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));
}

export function useTransferirDiario() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const transferirParaProjeto = useMutation({
    mutationFn: async ({
      diarioId,
      destinoSiteId,
      destinoProjetoId,
      novaData,
    }: TransferirParaProjetoParams): Promise<TransferirParaProjetoResult> => {
      // 1) carregar diário origem
      const { data: srcDiario, error: srcErr } = await supabase
        .from("diarios_obra")
        .select("*")
        .eq("id", diarioId)
        .single();
      if (srcErr) throw srcErr;
      if (srcDiario.site_id === destinoSiteId) {
        throw new Error("O site de destino é o mesmo do diário atual.");
      }
      const dataFinal = novaData || srcDiario.data;

      // 2) carregar produções do diário origem (com codigo do item)
      const { data: producoes, error: prodErr } = await supabase
        .from("diario_producao")
        .select("id, quantidade, item_lpu_id, item_lpu:itens_lpu(id, codigo, projeto_id)")
        .eq("diario_id", diarioId);
      if (prodErr) throw prodErr;

      // 3) validar paridade de LPU
      const codigosOrigem = Array.from(
        new Set((producoes || []).map((p: any) => p.item_lpu?.codigo).filter(Boolean))
      ) as string[];

      let mapeamento = new Map<string, { id: string; preco: number }>(); // codigo -> destino
      if (codigosOrigem.length > 0) {
        const { data: itensDestino, error: idErr } = await supabase
          .from("itens_lpu")
          .select("id, codigo, preco_unitario")
          .eq("projeto_id", destinoProjetoId)
          .in("codigo", codigosOrigem);
        if (idErr) throw idErr;

        const setDestino = new Set((itensDestino || []).map((i: any) => i.codigo));
        const faltantes = codigosOrigem.filter(c => !setDestino.has(c));
        if (faltantes.length > 0) {
          throw new Error(
            `O projeto de destino não possui os seguintes itens LPU: ${faltantes.join(", ")}. ` +
              `Cadastre-os antes de transferir.`
          );
        }
        (itensDestino || []).forEach((i: any) => {
          mapeamento.set(i.codigo, { id: i.id, preco: Number(i.preco_unitario || 0) });
        });
      }

      // 4) verificar/cravar diário destino
      const { data: targetExistente, error: tgtErr } = await supabase
        .from("diarios_obra")
        .select("*")
        .eq("site_id", destinoSiteId)
        .eq("data", dataFinal)
        .maybeSingle();
      if (tgtErr) throw tgtErr;

      let targetDiarioId: string;
      if (targetExistente) {
        targetDiarioId = targetExistente.id;
        // merge campos opcionais
        const updates: any = {};
        if (srcDiario.observacoes) {
          updates.observacoes = targetExistente.observacoes
            ? `${targetExistente.observacoes}\n\n--- Transferido de outro projeto (${srcDiario.data}) ---\n${srcDiario.observacoes}`
            : srcDiario.observacoes;
        }
        if (!targetExistente.clima && srcDiario.clima) updates.clima = srcDiario.clima;
        if (!targetExistente.uf && srcDiario.uf) updates.uf = srcDiario.uf;
        if (!targetExistente.municipio && srcDiario.municipio) updates.municipio = srcDiario.municipio;
        if (Object.keys(updates).length > 0) {
          await supabase.from("diarios_obra").update(updates).eq("id", targetDiarioId);
        }
      } else {
        const { data: novo, error: novoErr } = await supabase
          .from("diarios_obra")
          .insert({
            site_id: destinoSiteId,
            data: dataFinal,
            observacoes: srcDiario.observacoes,
            clima: srcDiario.clima,
            status_ativo: srcDiario.status_ativo,
            uf: srcDiario.uf,
            municipio: srcDiario.municipio,
          })
          .select("id")
          .single();
        if (novoErr) throw novoErr;
        targetDiarioId = novo.id;
      }

      // 5) atualizar cada produção: novo diário, novo item_lpu_id e preço congelado
      for (const p of producoes || []) {
        const codigo = (p as any).item_lpu?.codigo as string | undefined;
        if (!codigo) continue;
        const dest = mapeamento.get(codigo);
        if (!dest) continue;
        const novoTotal = Number(p.quantidade || 0) * dest.preco;
        const { error: upErr } = await supabase
          .from("diario_producao")
          .update({
            diario_id: targetDiarioId,
            item_lpu_id: dest.id,
            preco_unitario_congelado: dest.preco,
            valor_total: novoTotal,
          })
          .eq("id", p.id);
        if (upErr) throw upErr;
      }

      // 6) mover demais tabelas (equipe, equipamentos, veículos, fotos)
      await supabase.from("diario_equipe").update({ diario_id: targetDiarioId }).eq("diario_id", diarioId);
      await supabase.from("diario_equipamentos").update({ diario_id: targetDiarioId }).eq("diario_id", diarioId);
      await supabase.from("diario_veiculos").update({ diario_id: targetDiarioId }).eq("diario_id", diarioId);
      await supabase.from("diario_fotos").update({ diario_id: targetDiarioId }).eq("diario_id", diarioId);

      // 7) excluir diário origem (agora vazio)
      const { error: delErr } = await supabase.from("diarios_obra").delete().eq("id", diarioId);
      if (delErr) throw delErr;

      return { targetDiarioId, movedProducoes: producoes?.length || 0 };
    },
    onSuccess: () => {
      invalidateAll(queryClient);
      toast({ title: "Apontamento transferido com sucesso!" });
    },
    onError: (e: Error) =>
      toast({ title: "Erro ao transferir apontamento", description: e.message, variant: "destructive" }),
  });

  return { transferirParaProjeto };
}
