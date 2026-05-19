import { useState, useMemo, useCallback } from "react";
import { uploadImage, verifyImageUrl } from "@/services/uploadImage";
import { useLancamentosMedicao } from "@/hooks/useLancamentos";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProjetos } from "@/hooks/useProjetos";
import { useSites } from "@/hooks/useSites";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseLocalDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileDown, Loader2, Plus } from "lucide-react";
import { exportLancamentosToExcel, exportAcompanhamentoToExcel } from "@/lib/medicoesExport";
import { DetailMedicaoContent } from "@/components/medicoes/DetailMedicaoContent";
import { useTableFilters } from "@/hooks/useTableFilters";
import { MedicoesTable } from "@/components/medicoes/acompanhamento/MedicoesTable";
import { GerarMedicaoDialog } from "@/components/medicoes/acompanhamento/GerarMedicaoDialog";
import { RevisaoParcialDialog } from "@/components/medicoes/acompanhamento/RevisaoParcialDialog";



const STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente", color: "bg-gray-500" },
  { value: "enviada", label: "Enviada", color: "bg-blue-500" },
  { value: "aprovado", label: "Aprovada", color: "bg-green-500" },
  { value: "rejeitado", label: "Rejeitada", color: "bg-red-500" },
  { value: "finalizado", label: "Finalizado", color: "bg-purple-500" },
];

export default function AcompanhamentoMedicoesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { lancamentos, isLoading, bulkCreateLancamento, bulkUpdateMedicaoFields, bulkDeleteMedicao } = useLancamentosMedicao();
  const { projetos } = useProjetos();
  const { sites } = useSites();

  const [localEdits, setLocalEdits] = useState<Record<string, { status?: string; numero_po?: string; observacao_acompanhamento?: string; quantidade_aprovada?: number; quantidade_rejeitada?: number }>>({});
  const [showGerarDialog, setShowGerarDialog] = useState(false);
  const [detailMedicaoId, setDetailMedicaoId] = useState<string | null>(null);
  const [partialApprovalMedicaoId, setPartialApprovalMedicaoId] = useState<string | null>(null);
  const [partialApprovalItems, setPartialApprovalItems] = useState<Record<string, number>>({});

  const formatCurrency = useCallback((value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value), []);

  const formatDate = useCallback((dateStr: string) =>
    parseLocalDate(dateStr).toLocaleDateString("pt-BR"), []);

  const formatDateTime = useCallback((dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  }, []);

  const medicoesAgrupadas = useMemo(() => {
    const grouped = new Map<string, any>();
    let filtered = [...lancamentos];

    filtered.forEach(l => {
      const obs = (l.observacao || "").toLowerCase();
      const isAgrupadaOuMista = obs.includes("tipo:agrupada") || obs.includes("tipo:mista");
      const projetoId = l.site?.projeto?.id || l.site?.projeto_id || 'sem_projeto';
      const key = isAgrupadaOuMista
        ? `agrupada_${projetoId}_${l.numero_medicao || 'sem_numero'}`
        : `${l.site_id}_${l.numero_medicao || 'sem_numero'}`;
      const preco = Number(l.item_lpu?.preco_unitario || 0);
      const valor = Number(l.quantidade) * preco;

      if (!grouped.has(key)) {
        grouped.set(key, {
          id: key,
          lancamentoIds: [l.id],
          site_id: l.site_id,
          site_codigo: l.site?.codigo || "",
          site_nome: l.site?.nome || "",
          projeto_codigo: l.site?.projeto?.codigo || "",
          logo_empresa_url: (l as any).logo_empresa_url,
          capa_url: (l as any).capa_url,
          projeto_nome: l.site?.projeto?.nome || "",
          uf: l.site?.uf || "",
          data_medicao: l.data_medicao,
          numero_medicao: l.numero_medicao || "",
          total_valor: valor,
          status: l.status || "aprovado",
          numero_po: l.numero_po,
          observacao_acompanhamento: l.observacao_acompanhamento,
          periodo_inicio: l.periodo_inicio,
          periodo_fim: l.periodo_fim,
          data_resposta: l.data_resposta,
          total_quantidade: Number(l.quantidade),
          total_aprovada: Number(l.quantidade_aprovada || 0),
          total_rejeitada: Number(l.quantidade_rejeitada || 0),
          total_pendente: Number((l as any).quantidade_pendente || 0),
        });
      } else {
        const existing = grouped.get(key)!;
        existing.lancamentoIds.push(l.id);
        existing.total_valor += valor;
        existing.total_quantidade += Number(l.quantidade);
        existing.total_aprovada += Number(l.quantidade_aprovada || 0);
        existing.total_rejeitada += Number(l.quantidade_rejeitada || 0);
        existing.total_pendente += Number((l as any).quantidade_pendente || 0);
        if (l.data_medicao < existing.data_medicao) existing.data_medicao = l.data_medicao;
      }
    });

    return Array.from(grouped.values());
  }, [lancamentos]);

  const columnsMedicoes = ["projeto", "site", "uf", "data", "periodo", "numero", "valor", "status", "po", "obs"] as const;
  const getColValueMedicao = (m: any, col: typeof columnsMedicoes[number]): string => {
    if (col === "projeto") return m.projeto_codigo;
    if (col === "site") return `${m.site_codigo} - ${m.site_nome}`;
    if (col === "uf") return m.uf || "";
    if (col === "data") return m.data_medicao; 
    if (col === "periodo") return m.periodo_inicio ? `${m.periodo_inicio} a ${m.periodo_fim}` : "";
    if (col === "numero") return m.numero_medicao || "";
    if (col === "valor") return m.total_valor.toString();
    if (col === "status") return localEdits[m.id]?.status || m.status;
    if (col === "po") return localEdits[m.id]?.numero_po ?? m.numero_po ?? "";
    if (col === "obs") return localEdits[m.id]?.observacao_acompanhamento ?? m.observacao_acompanhamento ?? "";
    return "";
  };

  const tableMedicoes = useTableFilters(medicoesAgrupadas, columnsMedicoes, getColValueMedicao, "acomp_medicoes");

  const handleFieldChange = (medicaoId: string, field: string, value: any) => {
    setLocalEdits(prev => ({ ...prev, [medicaoId]: { ...prev[medicaoId], [field]: value } }));
  };

  const handleSaveRow = async (medicao: any) => {
    const edits = localEdits[medicao.id];
    if (!edits) return;

    const statusChanged = edits.status && edits.status !== medicao.status;
    const now = new Date().toISOString();

    if (statusChanged) {
      const updateFields: any = { ids: medicao.lancamentoIds, ...edits, data_resposta: now };
      
      await supabase.from("medicao_status_historico").insert({
        site_id: medicao.site_id,
        numero_medicao: medicao.numero_medicao || null,
        status_anterior: medicao.status,
        status_novo: edits.status!,
        data_mudanca: now,
      });

      if (edits.status === "rejeitado" || edits.status === "aprovado") {
        for (const lId of medicao.lancamentoIds) {
          const l = lancamentos.find(x => x.id === lId);
          if (!l) continue;
          const qtdAprovada = edits.status === "aprovado" ? Number(l.quantidade) : 0;
          const pendente = Number(l.quantidade) - qtdAprovada;
          await supabase.from("lancamentos_medicao").update({
            quantidade_aprovada: qtdAprovada,
            quantidade_rejeitada: edits.status === "rejeitado" ? pendente : 0,
            quantidade_pendente: pendente,
            data_resposta: now,
            status: edits.status,
          }).eq("id", l.id);
        }
        queryClient.invalidateQueries({ queryKey: ["lancamentos_medicao"] });
        queryClient.invalidateQueries({ queryKey: ["medicao_status_historico"] });
        setLocalEdits(prev => { const n = { ...prev }; delete n[medicao.id]; return n; });
        return;
      }
    }

    bulkUpdateMedicaoFields.mutate({ ids: medicao.lancamentoIds, ...edits }, {
      onSuccess: () => {
        setLocalEdits(prev => { const n = { ...prev }; delete n[medicao.id]; return n; });
        queryClient.invalidateQueries({ queryKey: ["medicao_status_historico"] });
      },
    });
  };

  const handleEnviarMedicao = async (data: any) => {
    let capaUrl = null;
    if (data.capaFile) {
      try {
        capaUrl = await uploadImage(data.capaFile);
      } catch (err) {
        console.error("Erro upload capa", err);
        toast({ title: "Erro no upload da capa", description: err instanceof Error ? err.message : "Erro desconhecido", variant: "destructive" });
        return;
      }
    }


    const itemsWithCapa = data.items.map((item: any) => ({ ...item, capa_url: capaUrl }));

    bulkCreateLancamento.mutate(itemsWithCapa, {
      onSuccess: () => {
        const pendingKeys = data.selectedItens.filter((i: any) => i.quantidade_pendente > 0);
        if (pendingKeys.length > 0) {
          const rejectedIds = lancamentos
            .filter(l => Number((l as any).quantidade_pendente) > 0 && pendingKeys.some((pk: any) => pk.site_id === l.site_id && pk.item_lpu_id === l.item_lpu_id))
            .map(l => l.id);
          if (rejectedIds.length > 0) {
            supabase.from("lancamentos_medicao").update({ quantidade_pendente: 0 }).in("id", rejectedIds).then(() => {
              queryClient.invalidateQueries({ queryKey: ["lancamentos_medicao"] });
            });
          }
        }
        setShowGerarDialog(false);
      },
    });
  };

  const handleSavePartialReview = async (data: any) => {
    if (!partialApprovalMedicaoId) return;
    const medicao = medicoesAgrupadas.find(m => m.id === partialApprovalMedicaoId);
    if (!medicao) return;
    const now = new Date().toISOString();

    if (data.removedIds.size > 0) {
      for (const removedId of data.removedIds) {
        await supabase.from("lancamentos_medicao").delete().eq("id", removedId);
      }
    }

    for (const lId of medicao.lancamentoIds) {
      if (data.removedIds.has(lId)) continue;
      const aprov = data.items[lId] || 0;
      const l = lancamentos.find(x => x.id === lId);
      if (!l) continue;
      const pendente = Number(l.quantidade) - aprov;
      await supabase.from("lancamentos_medicao").update({
        quantidade_aprovada: aprov,
        quantidade_rejeitada: Math.max(0, pendente),
        quantidade_pendente: Math.max(0, pendente),
        status: "enviada",
        data_resposta: now
      }).eq("id", lId);
    }

    if (data.newItems.length > 0) {
      const firstLanc = lancamentos.find(x => medicao.lancamentoIds.includes(x.id));
      for (const ni of data.newItems) {
        const pendente = Math.max(0, ni.quantidade - ni.aprovado);
        await supabase.from("lancamentos_medicao").insert({
          item_lpu_id: ni.item_lpu_id,
          quantidade: ni.quantidade,
          quantidade_aprovada: ni.aprovado,
          quantidade_rejeitada: pendente,
          quantidade_pendente: pendente,
          data_medicao: medicao.data_medicao,
          site_id: medicao.site_id || firstLanc?.site_id || null,
          numero_medicao: medicao.numero_medicao || null,
          status: "enviada",
          data_resposta: now,
          periodo_inicio: medicao.periodo_inicio || null,
          periodo_fim: medicao.periodo_fim || null,
        });
      }
    }

    await supabase.from("medicao_status_historico").insert({
      site_id: medicao.site_id,
      numero_medicao: medicao.numero_medicao || null,
      status_anterior: medicao.status,
      status_novo: "enviada",
      data_mudanca: now,
    });

    queryClient.invalidateQueries({ queryKey: ["lancamentos_medicao"] });
    queryClient.invalidateQueries({ queryKey: ["medicao_status_historico"] });
    setLocalEdits(prev => { const n = { ...prev }; delete n[partialApprovalMedicaoId]; return n; });
    setPartialApprovalMedicaoId(null);
  };

  const detailMedicao = medicoesAgrupadas.find(m => m.id === detailMedicaoId);
  const detailLancamentos = detailMedicao ? lancamentos.filter(l => detailMedicao.lancamentoIds.includes(l.id)) : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Acompanhamento de Medições</h1>
          <p className="text-muted-foreground">Acompanhe e gerencie o status das medições</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowGerarDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Gerar Medição do Período
          </Button>
          {tableMedicoes.processedItems.length > 0 && (
            <Button variant="outline" onClick={() => exportLancamentosToExcel(lancamentos, "medicao")}>
              <FileDown className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Medições</CardTitle>
        </CardHeader>
        <CardContent>
          <MedicoesTable 
            tableMedicoes={tableMedicoes}
            localEdits={localEdits}
            handleFieldChange={handleFieldChange}
            handleSaveRow={handleSaveRow}
            handleDeleteMedicao={(m) => bulkDeleteMedicao.mutate(m.lancamentoIds)}
            setDetailMedicaoId={setDetailMedicaoId}
            setPartialApprovalMedicaoId={setPartialApprovalMedicaoId}
            setPartialApprovalItems={setPartialApprovalItems}
            formatDate={formatDate}
            formatCurrency={formatCurrency}
            formatDateTime={formatDateTime}
            STATUS_OPTIONS={STATUS_OPTIONS}
            bulkUpdateMedicaoFields={bulkUpdateMedicaoFields}
            lancamentos={lancamentos}
          />
        </CardContent>
      </Card>

      <GerarMedicaoDialog 
        isOpen={showGerarDialog}
        onOpenChange={setShowGerarDialog}
        onEnviar={handleEnviarMedicao}
        formatDate={formatDate}
        formatCurrency={formatCurrency}
      />

      <RevisaoParcialDialog 
        isOpen={!!partialApprovalMedicaoId}
        onClose={() => setPartialApprovalMedicaoId(null)}
        medicao={medicoesAgrupadas.find(m => m.id === partialApprovalMedicaoId)}
        onSave={handleSavePartialReview}
        formatCurrency={formatCurrency}
      />

      <Dialog open={!!detailMedicaoId} onOpenChange={(open) => !open && setDetailMedicaoId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {detailMedicao && (
            <DetailMedicaoContent 
              detailMedicao={detailMedicao} 
              detailLancamentos={detailLancamentos} 
              sites={sites}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
