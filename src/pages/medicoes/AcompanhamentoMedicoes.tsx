import { useState, useMemo, useRef } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useLancamentosMedicao, useLancamentosProducao } from "@/hooks/useLancamentos";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProjetos } from "@/hooks/useProjetos";
import { useSites } from "@/hooks/useSites";
import { useItensLpu } from "@/hooks/useItensLpu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { parseLocalDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FileDown, Loader2, ArrowUpDown, ArrowUp, ArrowDown, Save, Plus, Eye, AlertTriangle, FileText, Camera, MapPin, Calendar, Trash2, Search, History, Upload, X } from "lucide-react";
import { exportLancamentosToExcel } from "@/lib/medicoesExport";
import { DetailMedicaoContent } from "@/components/medicoes/DetailMedicaoContent";
import { useTableFilters } from "@/hooks/useTableFilters";
import { ColumnHeader } from "@/components/medicoes/ColumnHeader";
import { TablePagination } from "@/components/medicoes/TablePagination";
import { FilterX } from "lucide-react";

type SortField = "data" | "projeto" | "site" | "uf" | "numero_medicao" | "valor" | "status";
type SortDirection = "asc" | "desc";

const STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente", color: "bg-gray-500" },
  { value: "enviada", label: "Enviada", color: "bg-blue-500" },
  { value: "aprovado", label: "Aprovada", color: "bg-green-500" },
  { value: "rejeitado", label: "Rejeitada", color: "bg-red-500" },
  { value: "finalizado", label: "Finalizado", color: "bg-purple-500" },
];

interface GeracaoItem {
  site_id: string;
  site_codigo: string;
  site_nome: string;
  item_lpu_id: string;
  item_codigo: string;
  item_descricao: string;
  unidade: string;
  preco_unitario: number;
  quantidade: number;
  quantidade_pendente: number;
  valor_total: number;
  selected: boolean;
}

interface GeracaoFoto {
  id: string;
  url: string;
  classificacao: string;
  legenda: string | null;
  item_codigo?: string;
  item_descricao?: string;
  diario_data?: string;
  site_id?: string;
  site_nome?: string;
  selected: boolean;
}

export default function AcompanhamentoMedicoesPage() {
  const queryClient = useQueryClient();
  const { lancamentos, isLoading, bulkCreateLancamento, bulkUpdateMedicaoFields, bulkDeleteMedicao } = useLancamentosMedicao();
  const { lancamentos: producoes } = useLancamentosProducao();
  const { projetos } = useProjetos();
  const { sites } = useSites();
  const { itensLpu: allItensLpu } = useItensLpu();

  // Fetch diary production (diario_producao) to merge with lancamentos_producao
  const { data: diarioProducoes = [] } = useQuery({
    queryKey: ["diario_producao_all"],
    queryFn: async () => {
      const { data: diarios, error: dErr } = await supabase
        .from("diarios_obra")
        .select("id, site_id, data")
        .limit(100000);
      if (dErr) throw dErr;
      if (!diarios || diarios.length === 0) return [];

      const diarioIds = diarios.map(d => d.id);
      const { data: prods, error: pErr } = await supabase
        .from("diario_producao")
        .select("*, item_lpu:itens_lpu(id, codigo, descricao, unidade, preco_unitario)")
        .in("diario_id", diarioIds);
      if (pErr) throw pErr;

      const diarioMap = new Map(diarios.map(d => [d.id, d]));

      return (prods || []).map(p => {
        const diario = diarioMap.get(p.diario_id);
        return {
          site_id: diario?.site_id || "",
          item_lpu_id: p.item_lpu_id,
          data_producao: diario?.data || "",
          quantidade: Number(p.quantidade),
          item_lpu: (p as any).item_lpu,
          source: "diario" as const,
        };
      });
    },
  });

  const [selectedProjetos, setSelectedProjetos] = useState<Set<string>>(new Set());
  const [selectedSites, setSelectedSites] = useState<Set<string>>(new Set());
  const [selectedStatus, setSelectedStatus] = useState<Set<string>>(new Set());
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [filterSearchProjeto, setFilterSearchProjeto] = useState("");
  const [filterSearchSite, setFilterSearchSite] = useState("");
  const [localEdits, setLocalEdits] = useState<Record<string, { status?: string; numero_po?: string; observacao_acompanhamento?: string; quantidade_aprovada?: number; quantidade_rejeitada?: number }>>({});

  // Geração de medição
  const [showGerarDialog, setShowGerarDialog] = useState(false);
  const [gerarProjetoId, setGerarProjetoId] = useState<string>("");
  const [gerarSiteId, setGerarSiteId] = useState<string>("");
  const [gerarPeriodoInicio, setGerarPeriodoInicio] = useState<string>("");
  const [gerarPeriodoFim, setGerarPeriodoFim] = useState<string>("");
  const [gerarNumeroMedicao, setGerarNumeroMedicao] = useState<string>("");
  const [geracaoItens, setGeracaoItens] = useState<GeracaoItem[]>([]);
  const [gerarTipoMedicao, setGerarTipoMedicao] = useState<"separada" | "agrupada" | "mista">("separada");
  const [geracaoFotos, setGeracaoFotos] = useState<GeracaoFoto[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [duplicateWarnings, setDuplicateWarnings] = useState<string[]>([]);
  const [loadingGeracaoFotos, setLoadingGeracaoFotos] = useState(false);
  const [capaFile, setCapaFile] = useState<File | null>(null);
  const [uploadingCapa, setUploadingCapa] = useState(false);
  const capaInputRef = useRef<HTMLInputElement>(null);

  // Detalhes
  const [detailMedicaoId, setDetailMedicaoId] = useState<string | null>(null);

  // Status history
  const [historyMedicaoId, setHistoryMedicaoId] = useState<string | null>(null);

  // Partial Approval (Revisão)
  const [partialApprovalMedicaoId, setPartialApprovalMedicaoId] = useState<string | null>(null);
  const [partialApprovalItems, setPartialApprovalItems] = useState<Record<string, number>>({});
  const [reviewRemovedIds, setReviewRemovedIds] = useState<Set<string>>(new Set());
  const [reviewNewItems, setReviewNewItems] = useState<Array<{ tempId: string; item_lpu_id: string; quantidade: number; aprovado: number }>>([]);
  const [reviewAddItemId, setReviewAddItemId] = useState<string>("");

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const formatDate = (dateStr: string) =>
    parseLocalDate(dateStr).toLocaleDateString("pt-BR");

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  };

  const getStatusBadge = (status: string) => {
    const statusOption = STATUS_OPTIONS.find(s => s.value === status);
    return (
      <Badge className={`${statusOption?.color || "bg-gray-500"} hover:${statusOption?.color || "bg-gray-600"}`}>
        {statusOption?.label || status}
      </Badge>
    );
  };

  const filteredSites = selectedProjetos.size > 0 ? sites.filter(s => selectedProjetos.has(s.projeto_id)) : sites;
  const gerarFilteredSites = gerarProjetoId ? sites.filter(s => s.projeto_id === gerarProjetoId) : sites;

  const toggleSetValue = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, value: string) => {
    setter(prev => {
      const next = new Set(prev);
      next.has(value) ? next.delete(value) : next.add(value);
      return next;
    });
  };

  // Group lancamentos by site_id + numero_medicao
  const medicoesAgrupadas = useMemo(() => {
    const grouped = new Map<string, {
      lancamentoIds: string[];
      site_id: string;
      site_codigo: string;
      site_nome: string;
      projeto_codigo: string;
      projeto_nome: string;
      uf: string;
      data_medicao: string;
      numero_medicao: string;
      total_valor: number;
      status: string;
      numero_po?: string;
      observacao_acompanhamento?: string;
      periodo_inicio?: string;
      periodo_fim?: string;
      data_resposta?: string;
      total_quantidade: number;
      total_aprovada: number;
      total_rejeitada: number;
      total_pendente: number;
      logo_empresa_url?: string;
      capa_url?: string | null;
    }>();

    let filtered = [...lancamentos];

    if (selectedProjetos.size > 0) {
      const projectSiteIds = sites.filter(s => selectedProjetos.has(s.projeto_id)).map(s => s.id);
      filtered = filtered.filter(l => projectSiteIds.includes(l.site_id));
    }
    if (selectedSites.size > 0) filtered = filtered.filter(l => selectedSites.has(l.site_id));
    if (selectedStatus.size > 0) filtered = filtered.filter(l => selectedStatus.has(l.status || "aprovado"));
    if (dataInicio) filtered = filtered.filter(l => l.data_medicao >= dataInicio);
    if (dataFim) filtered = filtered.filter(l => l.data_medicao <= dataFim);

    filtered.forEach(l => {
      const obs = (l.observacao || "").toLowerCase();
      const isAgrupadaOuMista = obs.includes("tipo:agrupada") || obs.includes("tipo:mista");
      // Para medições agrupadas/mistas, agrupar por projeto e número de medição (sem site_id),
      // já que representam uma única medição consolidada de múltiplos sites do mesmo projeto
      const projetoId = l.site?.projeto?.id || l.site?.projeto_id || 'sem_projeto';
      const key = isAgrupadaOuMista
        ? `agrupada_${projetoId}_${l.numero_medicao || 'sem_numero'}`
        : `${l.site_id}_${l.numero_medicao || 'sem_numero'}`;
      const preco = Number(l.item_lpu?.preco_unitario || 0);
      const valor = Number(l.quantidade) * preco;

      if (!grouped.has(key)) {
        grouped.set(key, {
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

    return Array.from(grouped.entries()).map(([key, value]) => ({ id: key, ...value }));
  }, [lancamentos, selectedProjetos, selectedSites, selectedStatus, dataInicio, dataFim, sites]);

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

  const totalValor = tableMedicoes.processedItems.reduce((sum, m) => sum + m.total_valor, 0);

  const handleFieldChange = (medicaoId: string, field: string, value: string | number) => {
    setLocalEdits(prev => ({ ...prev, [medicaoId]: { ...prev[medicaoId], [field]: value } }));
  };

  const handleSaveRow = async (medicao: any) => {
    const edits = localEdits[medicao.id];
    if (!edits) return;

    // If status changed, auto-set data_resposta and log history
    const statusChanged = edits.status && edits.status !== medicao.status;
    const now = new Date().toISOString();

    const updateFields: any = { ids: medicao.lancamentoIds, ...edits };

    if (statusChanged) {
      updateFields.data_resposta = now;

      // Log status history
      await supabase.from("medicao_status_historico").insert({
        site_id: medicao.site_id,
        numero_medicao: medicao.numero_medicao || null,
        status_anterior: medicao.status,
        status_novo: edits.status!,
        data_mudanca: now,
      });

      // If rejected, calculate pending quantities
      if (edits.status === "rejeitado") {
        // For rejected, set pendente = quantidade (all goes back to pending)
        const rejectedLancamentos = lancamentos.filter(l => medicao.lancamentoIds.includes(l.id));
        for (const l of rejectedLancamentos) {
          const qtdAprovada = edits.quantidade_aprovada !== undefined ? edits.quantidade_aprovada : 0;
          const pendente = Number(l.quantidade) - qtdAprovada;
          await supabase.from("lancamentos_medicao").update({
            quantidade_pendente: Math.max(0, pendente),
            quantidade_rejeitada: Math.max(0, pendente),
            data_resposta: now,
            status: "rejeitado",
          }).eq("id", l.id);
        }
        queryClient.invalidateQueries({ queryKey: ["lancamentos_medicao"] });
        queryClient.invalidateQueries({ queryKey: ["medicao_status_historico"] });
        setLocalEdits(prev => { const n = { ...prev }; delete n[medicao.id]; return n; });
        return;
      }

      // If approved, set each lancamento's quantidade_aprovada to its own quantidade
      if (edits.status === "aprovado") {
        const approvedLancamentos = lancamentos.filter(l => medicao.lancamentoIds.includes(l.id));
        for (const l of approvedLancamentos) {
          await supabase.from("lancamentos_medicao").update({
            quantidade_aprovada: Number(l.quantidade),
            quantidade_rejeitada: 0,
            quantidade_pendente: 0,
            status: "aprovado",
            data_resposta: now,
          }).eq("id", l.id);
        }
        queryClient.invalidateQueries({ queryKey: ["lancamentos_medicao"] });
        queryClient.invalidateQueries({ queryKey: ["medicao_status_historico"] });
        setLocalEdits(prev => { const n = { ...prev }; delete n[medicao.id]; return n; });
        return;
      }
    }

    bulkUpdateMedicaoFields.mutate(updateFields, {
      onSuccess: () => {
        setLocalEdits(prev => { const n = { ...prev }; delete n[medicao.id]; return n; });
        queryClient.invalidateQueries({ queryKey: ["medicao_status_historico"] });
      },
    });
  };

  const handleSavePartialReview = async () => {
    if (!partialApprovalMedicaoId) return;
    const medicao = tableMedicoes.processedItems.find(m => m.id === partialApprovalMedicaoId);
    if (!medicao) return;

    const now = new Date().toISOString();

    // Delete removed lancamentos
    if (reviewRemovedIds.size > 0) {
      for (const removedId of reviewRemovedIds) {
        await supabase.from("lancamentos_medicao").delete().eq("id", removedId);
      }
    }

    // Update existing lancamentos (excluding removed)
    // Recalculate: quantidade becomes the approved value (new measurement)
    for (const lId of medicao.lancamentoIds) {
       if (reviewRemovedIds.has(lId)) continue;
       const aprov = partialApprovalItems[lId] || 0;
       const l = lancamentos.find(x => x.id === lId);
       if (!l) continue;
       const originalQtd = Number(l.quantidade);
       const pendente = originalQtd - aprov;

       await supabase.from("lancamentos_medicao").update({
           quantidade_aprovada: aprov,
           quantidade_rejeitada: Math.max(0, pendente),
           quantidade_pendente: Math.max(0, pendente),
           status: "enviada",
           data_resposta: now
        }).eq("id", lId);
    }

    // Insert new items
    if (reviewNewItems.length > 0) {
      const firstLanc = lancamentos.find(x => medicao.lancamentoIds.includes(x.id));
      for (const ni of reviewNewItems) {
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
    setReviewRemovedIds(new Set());
    setReviewNewItems([]);
    setReviewAddItemId("");
    setPartialApprovalMedicaoId(null);
  };

  const handleDeleteMedicao = (medicao: any) => {
    bulkDeleteMedicao.mutate(medicao.lancamentoIds);
  };

  const handleExport = () => exportLancamentosToExcel(lancamentos, "medicao");

  // Fetch status history for a medicao
  const { data: statusHistory = [] } = useQuery({
    queryKey: ["medicao_status_historico", historyMedicaoId],
    queryFn: async () => {
      if (!historyMedicaoId) return [];
      const medicao = medicoesAgrupadas.find(m => m.id === historyMedicaoId);
      if (!medicao) return [];
      
      let query = supabase
        .from("medicao_status_historico")
        .select("*")
        .eq("site_id", medicao.site_id)
        .order("data_mudanca", { ascending: false });

      if (medicao.numero_medicao) {
        query = query.eq("numero_medicao", medicao.numero_medicao);
      } else {
        query = query.is("numero_medicao", null);
      }

      const { data, error } = await query;
      if (error) return [];
      return data || [];
    },
    enabled: !!historyMedicaoId,
  });

  // Gerar medição do período - with pending quantities
  const handleGerarMedicao = async () => {
    if (!gerarPeriodoInicio || !gerarPeriodoFim) return;

    // Combine lancamentos_producao and diario_producao into a unified list
    const allProducao = [
      ...producoes.map(p => ({
        site_id: p.site_id,
        item_lpu_id: p.item_lpu_id,
        data_producao: p.data_producao,
        quantidade: Number(p.quantidade),
        item_lpu: p.item_lpu,
      })),
      ...diarioProducoes.map(dp => ({
        site_id: dp.site_id,
        item_lpu_id: dp.item_lpu_id,
        data_producao: dp.data_producao,
        quantidade: dp.quantidade,
        item_lpu: dp.item_lpu,
      })),
    ];

    // Filter by period, project and site
    let filteredProducao = allProducao.filter(
      p => p.data_producao >= gerarPeriodoInicio && p.data_producao <= gerarPeriodoFim
    );

    if (gerarProjetoId) {
      const projectSiteIds = sites.filter(s => s.projeto_id === gerarProjetoId).map(s => s.id);
      filteredProducao = filteredProducao.filter(p => projectSiteIds.includes(p.site_id));
    }
    if (gerarSiteId) {
      filteredProducao = filteredProducao.filter(p => p.site_id === gerarSiteId);
    }

    // Calculate pending quantities from rejected measurements
    const pendingBySiteItem = new Map<string, number>();
    lancamentos.forEach(l => {
      if ((l as any).quantidade_pendente && Number((l as any).quantidade_pendente) > 0) {
        const key = `${l.site_id}_${l.item_lpu_id}`;
        pendingBySiteItem.set(key, (pendingBySiteItem.get(key) || 0) + Number((l as any).quantidade_pendente));
      }
    });

    // Group by site + item
    const grouped = new Map<string, GeracaoItem>();
    filteredProducao.forEach(p => {
      const key = `${p.site_id}_${p.item_lpu_id}`;
      const site = sites.find(s => s.id === p.site_id);
      const item = allItensLpu.find(i => i.id === p.item_lpu_id) || p.item_lpu;
      if (!site || !item) return;

      if (!grouped.has(key)) {
        const pendente = pendingBySiteItem.get(key) || 0;
        grouped.set(key, {
          site_id: p.site_id,
          site_codigo: site.codigo,
          site_nome: site.nome,
          item_lpu_id: p.item_lpu_id,
          item_codigo: item.codigo,
          item_descricao: item.descricao,
          unidade: item.unidade,
          preco_unitario: Number(item.preco_unitario),
          quantidade: 0,
          quantidade_pendente: pendente,
          valor_total: 0,
          selected: true,
        });
      }
      const g = grouped.get(key)!;
      g.quantidade += p.quantidade;
      g.valor_total = (g.quantidade + g.quantidade_pendente) * g.preco_unitario;
    });

    // Also add items that only have pending (no new production)
    pendingBySiteItem.forEach((pendente, key) => {
      if (!grouped.has(key) && pendente > 0) {
        const [siteIdVal, itemLpuId] = key.split("_");
        const site = sites.find(s => s.id === siteIdVal);
        const item = allItensLpu.find(i => i.id === itemLpuId);
        if (site && item) {
          // Only include if matching project/site filters
          let include = true;
          if (gerarProjetoId && site.projeto_id !== gerarProjetoId) include = false;
          if (gerarSiteId && site.id !== gerarSiteId) include = false;
          if (include) {
            grouped.set(key, {
              site_id: siteIdVal,
              site_codigo: site.codigo,
              site_nome: site.nome,
              item_lpu_id: itemLpuId,
              item_codigo: item.codigo,
              item_descricao: item.descricao,
              unidade: item.unidade,
              preco_unitario: Number(item.preco_unitario),
              quantidade: 0,
              quantidade_pendente: pendente,
              valor_total: pendente * Number(item.preco_unitario),
              selected: true,
            });
          }
        }
      }
    });

    setGeracaoItens(Array.from(grouped.values()));

    // Fetch photos for the period
    setLoadingGeracaoFotos(true);
    try {
      const siteIds = gerarSiteId
        ? [gerarSiteId]
        : gerarProjetoId
          ? sites.filter(s => s.projeto_id === gerarProjetoId).map(s => s.id)
          : [...new Set(Array.from(grouped.values()).map(g => g.site_id))];

      if (siteIds.length > 0) {
        const { data: diarios } = await supabase
          .from("diarios_obra")
          .select("id, data, site_id")
          .in("site_id", siteIds)
          .gte("data", gerarPeriodoInicio)
          .lte("data", gerarPeriodoFim);

        if (diarios && diarios.length > 0) {
          const diarioIds = diarios.map(d => d.id);
          const diarioMap = new Map(diarios.map(d => [d.id, d]));

          const { data: fotos } = await supabase
            .from("diario_fotos")
            .select("*")
            .in("diario_id", diarioIds);

          const producaoIds = (fotos || []).map(f => (f as any).diario_producao_id).filter(Boolean);
          let producaoMap = new Map<string, any>();
          if (producaoIds.length > 0) {
            const { data: prods } = await supabase
              .from("diario_producao")
              .select("id, item_lpu:itens_lpu(codigo, descricao)")
              .in("id", producaoIds);
            if (prods) producaoMap = new Map(prods.map(p => [p.id, p]));
          }

          setGeracaoFotos((fotos || []).map(f => {
            const diario = diarioMap.get(f.diario_id);
            const producao = (f as any).diario_producao_id ? producaoMap.get((f as any).diario_producao_id) : null;
            const fotoSite = diario ? sites.find(s => s.id === diario.site_id) : null;
            return {
              id: f.id,
              url: f.url,
              classificacao: f.classificacao,
              legenda: f.legenda,
              item_codigo: producao?.item_lpu?.codigo,
              item_descricao: producao?.item_lpu?.descricao,
              diario_data: diario?.data,
              site_id: diario?.site_id,
              site_nome: fotoSite ? `${fotoSite.codigo} - ${fotoSite.nome}` : undefined,
              selected: true,
            };
          }));
        } else {
          setGeracaoFotos([]);
        }
      }
    } catch {
      setGeracaoFotos([]);
    }
    setLoadingGeracaoFotos(false);

    // Check for duplicate/overlapping periods
    const warnings: string[] = [];
    const siteIdsInGeracao = [...new Set(Array.from(grouped.values()).map(g => g.site_id))];
    
    for (const sid of siteIdsInGeracao) {
      const siteName = sites.find(s => s.id === sid);
      const existingForSite = lancamentos.filter(
        l => l.site_id === sid && 
             (l.status === "aprovado" || l.status === "enviada") && 
             l.periodo_inicio && l.periodo_fim
      );
      
      for (const existing of existingForSite) {
        const exStart = existing.periodo_inicio!;
        const exEnd = existing.periodo_fim!;
        if (gerarPeriodoInicio <= exEnd && gerarPeriodoFim >= exStart) {
          const siteLabel = siteName ? `${siteName.codigo} - ${siteName.nome}` : sid;
          const statusLabel = existing.status === "aprovado" ? "aprovada" : "enviada";
          warnings.push(
            `Site ${siteLabel}: período sobrepõe medição ${existing.numero_medicao || "s/n"} (${statusLabel}) de ${formatDate(exStart)} a ${formatDate(exEnd)}`
          );
          break;
        }
      }
    }
    
    setDuplicateWarnings(warnings);
    setShowPreview(true);
  };

  const handleEnviarMedicao = async () => {
    const selectedItens = geracaoItens.filter(i => i.selected);
    if (selectedItens.length === 0) return;

    const today = new Date().toISOString().split("T")[0];
    const customLogo = localStorage.getItem("custom_logo_url") || "/logo.png";

    // Upload cover page if provided
    let capaUrl: string | null = null;
    if (capaFile) {
      setUploadingCapa(true);
      try {
        const ext = capaFile.name.split(".").pop() || "pdf";
        const path = `capas/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("medicao-capas")
          .upload(path, capaFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("medicao-capas").getPublicUrl(uploadData.path);
        capaUrl = urlData.publicUrl;
      } catch (err) {
        console.error("Erro ao fazer upload da capa:", err);
      } finally {
        setUploadingCapa(false);
      }
    }

    let items: any[];

    if (gerarTipoMedicao === "agrupada" || gerarTipoMedicao === "mista") {
      // For agrupada/mista: group items by item_lpu_id, summing quantities across sites.
      // CRITICAL: All items must share the SAME site_id so the resulting medição
      // is treated as a single consolidated record (not split by site in the listing).
      // We use the first site_id encountered as the "anchor" site.
      const anchorSiteId = selectedItens[0]?.site_id;
      const grouped = new Map<string, { item_lpu_id: string; quantidade: number }>();
      selectedItens.forEach(item => {
        const key = item.item_lpu_id;
        if (!grouped.has(key)) {
          grouped.set(key, {
            item_lpu_id: item.item_lpu_id,
            quantidade: item.quantidade + item.quantidade_pendente,
          });
        } else {
          const g = grouped.get(key)!;
          g.quantidade += item.quantidade + item.quantidade_pendente;
        }
      });

      items = Array.from(grouped.values()).map(g => ({
        site_id: anchorSiteId,
        item_lpu_id: g.item_lpu_id,
        data_medicao: today,
        quantidade: g.quantidade,
        numero_medicao: gerarNumeroMedicao || undefined,
        status: "enviada",
        periodo_inicio: gerarPeriodoInicio,
        periodo_fim: gerarPeriodoFim,
        logo_empresa_url: customLogo,
        observacao: gerarTipoMedicao === "mista" ? "tipo:mista" : "tipo:agrupada",
        capa_url: capaUrl,
      }));
    } else {
      // Separada: one entry per site+item
      items = selectedItens.map(item => ({
        site_id: item.site_id,
        item_lpu_id: item.item_lpu_id,
        data_medicao: today,
        quantidade: item.quantidade + item.quantidade_pendente,
        numero_medicao: gerarNumeroMedicao || undefined,
        status: "enviada",
        periodo_inicio: gerarPeriodoInicio,
        periodo_fim: gerarPeriodoFim,
        logo_empresa_url: customLogo,
        observacao: "tipo:separada",
        capa_url: capaUrl,
      }));
    }

    bulkCreateLancamento.mutate(items, {
      onSuccess: () => {
        // Clear pending quantities from the source lancamentos
        const pendingKeys = selectedItens.filter(i => i.quantidade_pendente > 0);
        if (pendingKeys.length > 0) {
          const rejectedIds = lancamentos
            .filter(l => Number((l as any).quantidade_pendente) > 0 && pendingKeys.some(pk => pk.site_id === l.site_id && pk.item_lpu_id === l.item_lpu_id))
            .map(l => l.id);
          if (rejectedIds.length > 0) {
            supabase.from("lancamentos_medicao").update({ quantidade_pendente: 0 }).in("id", rejectedIds).then(() => {
              queryClient.invalidateQueries({ queryKey: ["lancamentos_medicao"] });
            });
          }
        }

        setShowGerarDialog(false);
        setShowPreview(false);
        setGeracaoItens([]);
        setGeracaoFotos([]);
        setGerarNumeroMedicao("");
        setGerarPeriodoInicio("");
        setGerarPeriodoFim("");
        setGerarProjetoId("");
        setGerarSiteId("");
        setGerarTipoMedicao("separada");
        setDuplicateWarnings([]);
        setCapaFile(null);
      },
    });
  };

  const geracaoTotal = geracaoItens.filter(i => i.selected).reduce((s, i) => s + (i.quantidade + i.quantidade_pendente) * i.preco_unitario, 0);

  // Detail dialog
  const detailMedicao = medicoesAgrupadas.find(m => m.id === detailMedicaoId);
  const detailLancamentos = detailMedicao
    ? lancamentos.filter(l => detailMedicao.lancamentoIds.includes(l.id))
    : [];

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
            <Button variant="outline" onClick={handleExport}>
              <FileDown className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader><CardTitle>Filtros</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Projeto Multi-select */}
            <div className="space-y-2">
              <Label>Projeto</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start font-normal text-sm h-10 truncate">
                    {selectedProjetos.size === 0 ? "Todos os projetos" : `${selectedProjetos.size} selecionado(s)`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-3 space-y-2" align="start">
                  <Input placeholder="Pesquisar projeto..." value={filterSearchProjeto} onChange={e => setFilterSearchProjeto(e.target.value)} className="h-8 text-sm" />
                  <div className="flex gap-2 text-xs">
                    <button onClick={() => setSelectedProjetos(new Set(projetos.map(p => p.id)))} className="text-primary hover:underline">Todos</button>
                    <button onClick={() => { setSelectedProjetos(new Set()); setSelectedSites(new Set()); }} className="text-primary hover:underline">Limpar</button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {projetos.filter(p => `${p.codigo} ${p.nome}`.toLowerCase().includes(filterSearchProjeto.toLowerCase())).map(p => (
                      <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent rounded px-1 py-0.5">
                        <Checkbox checked={selectedProjetos.has(p.id)} onCheckedChange={() => toggleSetValue(setSelectedProjetos, p.id)} className="h-3.5 w-3.5" />
                        <span className="truncate">{p.codigo} - {p.nome}</span>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            {/* Site Multi-select */}
            <div className="space-y-2">
              <Label>Site</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start font-normal text-sm h-10 truncate">
                    {selectedSites.size === 0 ? "Todos os sites" : `${selectedSites.size} selecionado(s)`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-3 space-y-2" align="start">
                  <Input placeholder="Pesquisar site..." value={filterSearchSite} onChange={e => setFilterSearchSite(e.target.value)} className="h-8 text-sm" />
                  <div className="flex gap-2 text-xs">
                    <button onClick={() => setSelectedSites(new Set(filteredSites.map(s => s.id)))} className="text-primary hover:underline">Todos</button>
                    <button onClick={() => setSelectedSites(new Set())} className="text-primary hover:underline">Limpar</button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {filteredSites.filter(s => `${s.codigo} ${s.nome}`.toLowerCase().includes(filterSearchSite.toLowerCase())).map(s => (
                      <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent rounded px-1 py-0.5">
                        <Checkbox checked={selectedSites.has(s.id)} onCheckedChange={() => toggleSetValue(setSelectedSites, s.id)} className="h-3.5 w-3.5" />
                        <span className="truncate">{s.codigo} - {s.nome}</span>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            {/* Status Multi-select */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start font-normal text-sm h-10 truncate">
                    {selectedStatus.size === 0 ? "Todos os status" : `${selectedStatus.size} selecionado(s)`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-3 space-y-2" align="start">
                  <div className="flex gap-2 text-xs">
                    <button onClick={() => setSelectedStatus(new Set(STATUS_OPTIONS.map(s => s.value)))} className="text-primary hover:underline">Todos</button>
                    <button onClick={() => setSelectedStatus(new Set())} className="text-primary hover:underline">Limpar</button>
                  </div>
                  <div className="space-y-1">
                    {STATUS_OPTIONS.map(s => (
                      <label key={s.value} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent rounded px-1 py-0.5">
                        <Checkbox checked={selectedStatus.has(s.value)} onCheckedChange={() => toggleSetValue(setSelectedStatus, s.value)} className="h-3.5 w-3.5" />
                        <span>{s.label}</span>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Data Início</Label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Data Fim</Label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Medições ({tableMedicoes.processedItems.length})</span>
            {tableMedicoes.hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={tableMedicoes.clearAllFilters} title="Limpar filtros da tabela">
                <FilterX className="h-4 w-4 mr-2" /> Limpar Filtros
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tableMedicoes.processedItems.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma medição encontrada</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <ColumnHeader
                        label="Projeto"
                        sortDir={tableMedicoes.sortColumn === "projeto" ? tableMedicoes.sortDir : null}
                        onSort={() => tableMedicoes.handleSort("projeto")}
                        searchText={tableMedicoes.searchTexts["projeto"]}
                        onSearchChange={(v) => tableMedicoes.setSearchText("projeto", v)}
                        uniqueValues={tableMedicoes.uniqueValues["projeto"]}
                        selectedValues={tableMedicoes.selectedFilters["projeto"]}
                        onToggleValue={(v) => tableMedicoes.toggleValue("projeto", v)}
                        onSelectAll={() => tableMedicoes.selectAll("projeto", tableMedicoes.uniqueValues["projeto"])}
                        onClearAll={() => tableMedicoes.clearAll("projeto")}
                      />
                    </TableHead>
                    <TableHead>
                      <ColumnHeader
                        label="Site"
                        sortDir={tableMedicoes.sortColumn === "site" ? tableMedicoes.sortDir : null}
                        onSort={() => tableMedicoes.handleSort("site")}
                        searchText={tableMedicoes.searchTexts["site"]}
                        onSearchChange={(v) => tableMedicoes.setSearchText("site", v)}
                        uniqueValues={tableMedicoes.uniqueValues["site"]}
                        selectedValues={tableMedicoes.selectedFilters["site"]}
                        onToggleValue={(v) => tableMedicoes.toggleValue("site", v)}
                        onSelectAll={() => tableMedicoes.selectAll("site", tableMedicoes.uniqueValues["site"])}
                        onClearAll={() => tableMedicoes.clearAll("site")}
                      />
                    </TableHead>
                    <TableHead>
                      <ColumnHeader
                        label="UF"
                        sortDir={tableMedicoes.sortColumn === "uf" ? tableMedicoes.sortDir : null}
                        onSort={() => tableMedicoes.handleSort("uf")}
                        searchText={tableMedicoes.searchTexts["uf"]}
                        onSearchChange={(v) => tableMedicoes.setSearchText("uf", v)}
                        uniqueValues={tableMedicoes.uniqueValues["uf"]}
                        selectedValues={tableMedicoes.selectedFilters["uf"]}
                        onToggleValue={(v) => tableMedicoes.toggleValue("uf", v)}
                        onSelectAll={() => tableMedicoes.selectAll("uf", tableMedicoes.uniqueValues["uf"])}
                        onClearAll={() => tableMedicoes.clearAll("uf")}
                      />
                    </TableHead>
                    <TableHead>
                      <ColumnHeader
                        label="Data"
                        sortDir={tableMedicoes.sortColumn === "data" ? tableMedicoes.sortDir : null}
                        onSort={() => tableMedicoes.handleSort("data")}
                        searchText={tableMedicoes.searchTexts["data"]}
                        onSearchChange={(v) => tableMedicoes.setSearchText("data", v)}
                        uniqueValues={tableMedicoes.uniqueValues["data"]}
                        selectedValues={tableMedicoes.selectedFilters["data"]}
                        onToggleValue={(v) => tableMedicoes.toggleValue("data", v)}
                        onSelectAll={() => tableMedicoes.selectAll("data", tableMedicoes.uniqueValues["data"])}
                        onClearAll={() => tableMedicoes.clearAll("data")}
                      />
                    </TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>
                      <ColumnHeader
                        label="Nº Medição"
                        sortDir={tableMedicoes.sortColumn === "numero" ? tableMedicoes.sortDir : null}
                        onSort={() => tableMedicoes.handleSort("numero")}
                        searchText={tableMedicoes.searchTexts["numero"]}
                        onSearchChange={(v) => tableMedicoes.setSearchText("numero", v)}
                        uniqueValues={tableMedicoes.uniqueValues["numero"]}
                        selectedValues={tableMedicoes.selectedFilters["numero"]}
                        onToggleValue={(v) => tableMedicoes.toggleValue("numero", v)}
                        onSelectAll={() => tableMedicoes.selectAll("numero", tableMedicoes.uniqueValues["numero"])}
                        onClearAll={() => tableMedicoes.clearAll("numero")}
                      />
                    </TableHead>
                    <TableHead className="text-right">
                      <ColumnHeader
                        label="Valor Total"
                        sortDir={tableMedicoes.sortColumn === "valor" ? tableMedicoes.sortDir : null}
                        onSort={() => tableMedicoes.handleSort("valor")}
                        searchText={tableMedicoes.searchTexts["valor"]}
                        onSearchChange={(v) => tableMedicoes.setSearchText("valor", v)}
                        uniqueValues={tableMedicoes.uniqueValues["valor"]}
                        selectedValues={tableMedicoes.selectedFilters["valor"]}
                        onToggleValue={(v) => tableMedicoes.toggleValue("valor", v)}
                        onSelectAll={() => tableMedicoes.selectAll("valor", tableMedicoes.uniqueValues["valor"])}
                        onClearAll={() => tableMedicoes.clearAll("valor")}
                      />
                    </TableHead>
                    <TableHead>
                      <ColumnHeader
                        label="Status"
                        sortDir={tableMedicoes.sortColumn === "status" ? tableMedicoes.sortDir : null}
                        onSort={() => tableMedicoes.handleSort("status")}
                        searchText={tableMedicoes.searchTexts["status"]}
                        onSearchChange={(v) => tableMedicoes.setSearchText("status", v)}
                        uniqueValues={tableMedicoes.uniqueValues["status"]}
                        selectedValues={tableMedicoes.selectedFilters["status"]}
                        onToggleValue={(v) => tableMedicoes.toggleValue("status", v)}
                        onSelectAll={() => tableMedicoes.selectAll("status", tableMedicoes.uniqueValues["status"])}
                        onClearAll={() => tableMedicoes.clearAll("status")}
                      />
                    </TableHead>
                    <TableHead>Nº PO</TableHead>
                    <TableHead>Observações</TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        Data Resposta
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Search className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>Clique na lupa de cada linha para ver o histórico</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableMedicoes.paginatedItems.map((m) => {
                    const currentStatus = localEdits[m.id]?.status ?? m.status;
                    const currentPo = localEdits[m.id]?.numero_po ?? m.numero_po ?? "";
                    const currentObs = localEdits[m.id]?.observacao_acompanhamento ?? m.observacao_acompanhamento ?? "";
                    const hasChanges = !!localEdits[m.id];
                    const isRejected = currentStatus === "rejeitado";

                    return (
                      <TableRow key={m.id} className={isRejected ? "bg-red-50 dark:bg-red-950/20" : ""}>
                        <TableCell className="font-medium">{m.projeto_codigo}</TableCell>
                        <TableCell>{m.site_codigo} - {m.site_nome}</TableCell>
                        <TableCell>{m.uf || "-"}</TableCell>
                        <TableCell>{formatDate(m.data_medicao)}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {m.periodo_inicio && m.periodo_fim
                            ? `${formatDate(m.periodo_inicio)} a ${formatDate(m.periodo_fim)}`
                            : "-"}
                        </TableCell>
                        <TableCell>{m.numero_medicao || "-"}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(m.total_valor)}</TableCell>
                        <TableCell>
                          <Select value={currentStatus} onValueChange={(value) => {
                            if (value === "rejeitado") {
                              setPartialApprovalMedicaoId(m.id);
                              const initial: Record<string, number> = {};
                              const medLancamentos = lancamentos.filter(l => m.lancamentoIds.includes(l.id));
                              medLancamentos.forEach(l => {
                                initial[l.id] = Number(l.quantidade_aprovada || l.quantidade);
                              });
                              setPartialApprovalItems(initial);
                            }
                            handleFieldChange(m.id, "status", value);
                          }}>
                            <SelectTrigger className="w-32">
                              <SelectValue>{getStatusBadge(currentStatus)}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input value={currentPo} onChange={(e) => handleFieldChange(m.id, "numero_po", e.target.value)} placeholder="Nº PO" className="w-24" />
                        </TableCell>
                        <TableCell>
                          <Input value={currentObs} onChange={(e) => handleFieldChange(m.id, "observacao_acompanhamento", e.target.value)} placeholder="Observações" className="w-40" />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className="text-sm">{m.data_resposta ? formatDateTime(m.data_resposta) : "-"}</span>
                            <Popover open={historyMedicaoId === m.id} onOpenChange={(open) => setHistoryMedicaoId(open ? m.id : null)}>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6" title="Ver histórico de status">
                                  <History className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80 p-0" align="end">
                                <div className="p-3 border-b">
                                  <p className="text-sm font-semibold">Histórico de Movimentações</p>
                                  <p className="text-xs text-muted-foreground">{m.site_codigo} — {m.numero_medicao || "s/n"}</p>
                                </div>
                                <div className="max-h-60 overflow-auto p-2">
                                  {statusHistory.length === 0 ? (
                                    <p className="text-xs text-muted-foreground p-2 text-center">Nenhuma movimentação registrada</p>
                                  ) : (
                                    <div className="space-y-2">
                                      {statusHistory.map((h: any) => (
                                        <div key={h.id} className="flex items-start gap-2 text-xs border-b pb-2 last:border-b-0">
                                          <Calendar className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
                                          <div>
                                            <p className="font-medium">{formatDateTime(h.data_mudanca)}</p>
                                            <p className="text-muted-foreground">
                                              {h.status_anterior ? (
                                                <>{getStatusBadge(h.status_anterior)} → {getStatusBadge(h.status_novo)}</>
                                              ) : (
                                                <>Criado como {getStatusBadge(h.status_novo)}</>
                                              )}
                                            </p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setDetailMedicaoId(m.id)} title="Ver detalhes">
                              <Eye className="h-4 w-4" />
                            </Button>
                            {hasChanges && (
                              <Button size="sm" onClick={() => handleSaveRow(m)} disabled={bulkUpdateMedicaoFields.isPending}>
                                <Save className="h-4 w-4" />
                              </Button>
                            )}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" title="Excluir medição">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir Medição</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja excluir a medição {m.numero_medicao || ""} do site {m.site_codigo}?
                                    Esta ação excluirá {m.lancamentoIds.length} lançamento(s) e não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteMedicao(m)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={6} className="text-right">TOTAL:</TableCell>
                    <TableCell className="text-right">{formatCurrency(totalValor)}</TableCell>
                    <TableCell colSpan={5}></TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}

          {!isLoading && tableMedicoes.processedItems.length > 0 && (
            <TablePagination
              currentPage={tableMedicoes.currentPage}
              totalPages={tableMedicoes.totalPages}
              onPageChange={tableMedicoes.setCurrentPage}
              itemsPerPage={tableMedicoes.itemsPerPage}
              onItemsPerPageChange={tableMedicoes.setItemsPerPage}
              totalItems={tableMedicoes.processedItems.length}
            />
          )}

        </CardContent>
      </Card>

      {/* Dialog: Gerar Medição */}
      <Dialog open={showGerarDialog} onOpenChange={setShowGerarDialog}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerar Medição do Período</DialogTitle>
          </DialogHeader>

          {!showPreview ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Projeto</Label>
                  <Select value={gerarProjetoId || "all"} onValueChange={(v) => { setGerarProjetoId(v === "all" ? "" : v); setGerarSiteId(""); }}>
                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os projetos</SelectItem>
                      {projetos.map(p => <SelectItem key={p.id} value={p.id}>{p.codigo} - {p.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Site</Label>
                  <Select value={gerarSiteId || "all"} onValueChange={(v) => setGerarSiteId(v === "all" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os sites</SelectItem>
                      {gerarFilteredSites.map(s => <SelectItem key={s.id} value={s.id}>{s.codigo} - {s.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Período Início *</Label>
                  <Input type="date" value={gerarPeriodoInicio} onChange={(e) => setGerarPeriodoInicio(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Período Fim *</Label>
                  <Input type="date" value={gerarPeriodoFim} onChange={(e) => setGerarPeriodoFim(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Nº Medição</Label>
                  <Input value={gerarNumeroMedicao} onChange={(e) => setGerarNumeroMedicao(e.target.value)} placeholder="Ex: MED-001" />
                </div>
                <div className="space-y-2">
                  <Label>Logo da Empresa (Permanente)</Label>
                  <div className="flex items-center gap-4 p-2 border rounded-md bg-muted/20">
                    <img 
                      src={localStorage.getItem("custom_logo_url") || "/logo.png"} 
                      alt="Logo" 
                      className="h-10 object-contain" 
                    />
                    <span className="text-xs text-muted-foreground">Esta logo será fixada nesta medição</span>
                  </div>
                </div>
              </div>

              {/* Capa upload */}
              <div className="space-y-2 md:col-span-2">
                <Label>Capa da Medição (opcional)</Label>
                <div className="flex items-center gap-3">
                  <input
                    ref={capaInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setCapaFile(file);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => capaInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Importar Capa
                  </Button>
                  {capaFile && (
                    <div className="flex items-center gap-2 text-sm border rounded-md px-3 py-1.5 bg-muted/20">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate max-w-[200px]">{capaFile.name}</span>
                      <button onClick={() => setCapaFile(null)} className="text-muted-foreground hover:text-destructive">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  {!capaFile && (
                    <span className="text-xs text-muted-foreground">PDF ou Word — será adicionada como primeiras páginas</span>
                  )}
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <Label className="text-base font-semibold">Tipo de Medição</Label>
                <RadioGroup value={gerarTipoMedicao} onValueChange={(v) => setGerarTipoMedicao(v as any)} className="space-y-3">
                  <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                    <RadioGroupItem value="separada" className="mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Medição Separada por Site</p>
                      <p className="text-xs text-muted-foreground">Emite uma medição com o total de cada site de forma separada, com relatórios fotográficos individuais por site.</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                    <RadioGroupItem value="agrupada" className="mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Medição Agrupada</p>
                      <p className="text-xs text-muted-foreground">Emite uma medição única somando todos os sites numa LPU só, agrupando quantitativos e relatório fotográfico em um único documento.</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                    <RadioGroupItem value="mista" className="mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Medição Mista</p>
                      <p className="text-xs text-muted-foreground">Emite uma medição única com total do período, mas separando os relatórios fotográficos por site em sequência (ordenados do menor ao maior nome).</p>
                    </div>
                  </label>
                </RadioGroup>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowGerarDialog(false)}>Cancelar</Button>
                <Button onClick={handleGerarMedicao} disabled={!gerarPeriodoInicio || !gerarPeriodoFim}>
                  Gerar Pré-visualização
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-md bg-blue-50 dark:bg-blue-950/30 text-sm">
                <AlertTriangle className="h-4 w-4 text-blue-600" />
                <span>
                  Período: {formatDate(gerarPeriodoInicio)} a {formatDate(gerarPeriodoFim)} — {geracaoItens.filter(i => i.selected).length} itens selecionados
                  {" | Tipo: "}
                  <strong>
                    {gerarTipoMedicao === "separada" ? "Separada por Site" : gerarTipoMedicao === "agrupada" ? "Agrupada" : "Mista"}
                  </strong>
                </span>
              </div>

              {duplicateWarnings.length > 0 && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 space-y-1">
                  <div className="flex items-center gap-2 font-semibold text-destructive text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    ⚠️ Alerta de duplicidade de período!
                  </div>
                  <ul className="text-sm text-destructive/90 list-disc pl-5 space-y-0.5">
                    {duplicateWarnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {geracaoItens.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma produção encontrada no período selecionado.</p>
              ) : (
                <div className="space-y-4">
                  {/* Sites header for agrupada/mista */}
                  {(gerarTipoMedicao === "agrupada" || gerarTipoMedicao === "mista") && (() => {
                    const siteNames = [...new Set(geracaoItens.filter(i => i.selected).map(i => `${i.site_codigo} - ${i.site_nome}`))].sort();
                    return (
                      <div className="p-3 rounded-md bg-muted/40 border text-sm">
                        <p className="font-semibold mb-1">Sites incluídos na medição:</p>
                        <p className="text-muted-foreground">{siteNames.join(" | ")}</p>
                      </div>
                    );
                  })()}

                  {/* Items table */}
                  <div className="overflow-x-auto max-h-[300px]">
                    {(gerarTipoMedicao === "agrupada" || gerarTipoMedicao === "mista") ? (() => {
                      // Group items by item_lpu_id, summing quantities
                      const groupedMap = new Map<string, { item_lpu_id: string; item_codigo: string; item_descricao: string; unidade: string; preco_unitario: number; quantidade: number; quantidade_pendente: number; indices: number[] }>();
                      geracaoItens.forEach((item, idx) => {
                        const key = item.item_lpu_id;
                        if (!groupedMap.has(key)) {
                          groupedMap.set(key, {
                            item_lpu_id: item.item_lpu_id,
                            item_codigo: item.item_codigo,
                            item_descricao: item.item_descricao,
                            unidade: item.unidade,
                            preco_unitario: item.preco_unitario,
                            quantidade: item.quantidade,
                            quantidade_pendente: item.quantidade_pendente,
                            indices: [idx],
                          });
                        } else {
                          const g = groupedMap.get(key)!;
                          g.quantidade += item.quantidade;
                          g.quantidade_pendente += item.quantidade_pendente;
                          g.indices.push(idx);
                        }
                      });
                      const groupedRows = Array.from(groupedMap.values());
                      const allSelected = geracaoItens.every(i => i.selected);
                      const groupedTotal = groupedRows.filter(g => g.indices.some(idx => geracaoItens[idx]?.selected)).reduce((s, g) => {
                        const anySelected = g.indices.some(idx => geracaoItens[idx]?.selected);
                        return anySelected ? s + (g.quantidade + g.quantidade_pendente) * g.preco_unitario : s;
                      }, 0);

                      return (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10">
                                <Checkbox checked={allSelected} onCheckedChange={(checked) => setGeracaoItens(prev => prev.map(i => ({ ...i, selected: !!checked })))} />
                              </TableHead>
                              <TableHead>Item LPU</TableHead>
                              <TableHead>Unidade</TableHead>
                              <TableHead className="text-right">Qtd Total</TableHead>
                              <TableHead className="text-right">Saldo Anterior</TableHead>
                              <TableHead className="text-right">Sugerido para Medir</TableHead>
                              <TableHead className="text-right">Preço Unit.</TableHead>
                              <TableHead className="text-right">Valor Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {groupedRows.map((g) => {
                              const isSelected = g.indices.some(idx => geracaoItens[idx]?.selected);
                              return (
                                <TableRow key={g.item_lpu_id} className={!isSelected ? "opacity-50" : ""}>
                                  <TableCell>
                                    <Checkbox checked={isSelected} onCheckedChange={(checked) => {
                                      setGeracaoItens(prev => prev.map((item, idx) => g.indices.includes(idx) ? { ...item, selected: !!checked } : item));
                                    }} />
                                  </TableCell>
                                  <TableCell className="max-w-xs truncate">{g.item_codigo} - {g.item_descricao}</TableCell>
                                  <TableCell>{g.unidade}</TableCell>
                                  <TableCell className="text-right font-mono">{g.quantidade.toLocaleString("pt-BR")}</TableCell>
                                  <TableCell className="text-right font-mono">
                                    {g.quantidade_pendente > 0 ? (
                                      <Badge variant="outline" className="text-amber-600 border-amber-300">+{g.quantidade_pendente.toLocaleString("pt-BR")}</Badge>
                                    ) : "-"}
                                  </TableCell>
                                  <TableCell className="text-right font-mono font-semibold">{(g.quantidade + g.quantidade_pendente).toLocaleString("pt-BR")}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(g.preco_unitario)}</TableCell>
                                  <TableCell className="text-right font-semibold">{formatCurrency((g.quantidade + g.quantidade_pendente) * g.preco_unitario)}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                          <TableFooter>
                            <TableRow>
                              <TableCell colSpan={7} className="text-right font-bold">Total:</TableCell>
                              <TableCell className="text-right font-bold">{formatCurrency(groupedTotal)}</TableCell>
                            </TableRow>
                          </TableFooter>
                        </Table>
                      );
                    })() : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={geracaoItens.every(i => i.selected)}
                              onCheckedChange={(checked) => setGeracaoItens(prev => prev.map(i => ({ ...i, selected: !!checked })))}
                            />
                          </TableHead>
                          <TableHead>Site</TableHead>
                          <TableHead>Item LPU</TableHead>
                          <TableHead>Unidade</TableHead>
                          <TableHead className="text-right">Novo Período</TableHead>
                          <TableHead className="text-right">Saldo Anterior</TableHead>
                          <TableHead className="text-right">Sugerido para Medir</TableHead>
                          <TableHead className="text-right">Preço Unit.</TableHead>
                          <TableHead className="text-right">Valor Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {geracaoItens.map((item, idx) => (
                          <TableRow key={idx} className={!item.selected ? "opacity-50" : ""}>
                            <TableCell>
                              <Checkbox
                                checked={item.selected}
                                onCheckedChange={() => setGeracaoItens(prev => prev.map((i, j) => j === idx ? { ...i, selected: !i.selected } : i))}
                              />
                            </TableCell>
                            <TableCell>{item.site_codigo} - {item.site_nome}</TableCell>
                            <TableCell className="max-w-xs truncate">{item.item_codigo} - {item.item_descricao}</TableCell>
                            <TableCell>{item.unidade}</TableCell>
                            <TableCell className="text-right font-mono">{item.quantidade.toLocaleString("pt-BR")}</TableCell>
                            <TableCell className="text-right font-mono">
                              {item.quantidade_pendente > 0 ? (
                                <Badge variant="outline" className="text-amber-600 border-amber-300">
                                  +{item.quantidade_pendente.toLocaleString("pt-BR")}
                                </Badge>
                              ) : "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold">
                              {(item.quantidade + item.quantidade_pendente).toLocaleString("pt-BR")}
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(item.preco_unitario)}</TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency((item.quantidade + item.quantidade_pendente) * item.preco_unitario)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <TableFooter>
                        <TableRow>
                          <TableCell colSpan={8} className="text-right font-bold">Total:</TableCell>
                          <TableCell className="text-right font-bold">{formatCurrency(geracaoTotal)}</TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                    )}
                  </div>

                  {/* Photo preview */}
                  {loadingGeracaoFotos ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
                      <span className="text-sm text-muted-foreground">Carregando fotos...</span>
                    </div>
                  ) : geracaoFotos.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                          <Camera className="h-4 w-4" />
                          Relatório Fotográfico ({geracaoFotos.filter(f => f.selected).length}/{geracaoFotos.length} fotos)
                          {(gerarTipoMedicao === "separada" || gerarTipoMedicao === "mista") && (
                            <Badge variant="outline" className="text-xs">Agrupado por site</Badge>
                          )}
                        </h3>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setGeracaoFotos(prev => prev.map(f => ({ ...f, selected: true })))}>
                            Selecionar Todas
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setGeracaoFotos(prev => prev.map(f => ({ ...f, selected: false })))}>
                            Desmarcar Todas
                          </Button>
                        </div>
                      </div>

                      {(gerarTipoMedicao === "separada" || gerarTipoMedicao === "mista") ? (
                        // Group photos by site - mista includes production summary per site
                        (() => {
                          const siteGroups = new Map<string, { fotos: GeracaoFoto[]; siteId: string }>();
                          geracaoFotos.forEach(f => {
                            const key = f.site_nome || "Sem site";
                            if (!siteGroups.has(key)) siteGroups.set(key, { fotos: [], siteId: f.site_id || "" });
                            siteGroups.get(key)!.fotos.push(f);
                          });
                          const sorted = Array.from(siteGroups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
                          return (
                      <div className="space-y-6 max-h-[400px] overflow-auto">
                        {geracaoFotos.length > 500 && (
                          <div className="p-3 mb-4 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                            ⚠️ <strong>Grande volume de fotos detectado!</strong> ({geracaoFotos.length} fotos). 
                            O sistema mostrará apenas as primeiras 500 para garantir a performance, mas <strong>todas serão incluídas no PDF final</strong>.
                          </div>
                        )}
                        {sorted.map(([siteName, { fotos, siteId }]) => {
                                // For mista, show production table per site
                                const siteItems = gerarTipoMedicao === "mista"
                                  ? geracaoItens.filter(i => i.site_id === siteId && i.selected)
                                  : [];
                                return (
                                  <div key={siteName} className="border rounded-lg overflow-hidden">
                                    <div className="bg-[hsl(var(--primary))] text-primary-foreground px-4 py-2 font-semibold text-sm flex items-center gap-2">
                                      <MapPin className="h-4 w-4" />
                                      {siteName}
                                    </div>
                                    {gerarTipoMedicao === "mista" && siteItems.length > 0 && (
                                      <div className="p-3 border-b bg-muted/20">
                                        <p className="text-xs font-semibold mb-2">Produção do Site:</p>
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead className="text-xs">Item</TableHead>
                                              <TableHead className="text-xs text-right">Qtd</TableHead>
                                              <TableHead className="text-xs text-right">Valor</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {siteItems.map(si => (
                                              <TableRow key={si.item_lpu_id}>
                                                <TableCell className="text-xs py-1">{si.item_codigo} — {si.item_descricao}</TableCell>
                                                <TableCell className="text-xs text-right py-1">{(si.quantidade + si.quantidade_pendente).toLocaleString("pt-BR")} {si.unidade}</TableCell>
                                                <TableCell className="text-xs text-right py-1">{formatCurrency((si.quantidade + si.quantidade_pendente) * si.preco_unitario)}</TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    )}
                                    <div className="p-3">
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {fotos.map((foto) => {
                                          const idx = geracaoFotos.findIndex(f => f.id === foto.id);
                                          return (
                                            <div key={foto.id} className={`relative border rounded-lg overflow-hidden transition-opacity ${!foto.selected ? "opacity-40" : ""}`}>
                                              <img src={foto.url} alt={foto.item_descricao || "foto"} className="w-full h-32 object-cover" />
                                              <div className="absolute top-2 left-2">
                                                <Checkbox
                                                  checked={foto.selected}
                                                  onCheckedChange={() => setGeracaoFotos(prev => prev.map((f, j) => j === idx ? { ...f, selected: !f.selected } : f))}
                                                  className="bg-white/80"
                                                />
                                              </div>
                                              {foto.selected && (
                                                <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-6 w-6"
                                                  onClick={() => setGeracaoFotos(prev => prev.filter((_, j) => j !== idx))}>
                                                  <Trash2 className="h-3 w-3" />
                                                </Button>
                                              )}
                                              <div className="p-1.5 bg-muted/50 text-[10px] space-y-0.5">
                                                {foto.item_codigo && <p className="font-medium truncate">{foto.item_codigo}</p>}
                                                {foto.diario_data && <p className="text-muted-foreground">{formatDate(foto.diario_data)}</p>}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()
                      ) : (
                        // Agrupada: flat grid
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-[300px] overflow-auto">
                          {geracaoFotos.map((foto, idx) => (
                            <div key={foto.id} className={`relative border rounded-lg overflow-hidden transition-opacity ${!foto.selected ? "opacity-40" : ""}`}>
                              <img src={foto.url} alt={foto.item_descricao || "foto"} className="w-full h-32 object-cover" />
                              <div className="absolute top-2 left-2">
                                <Checkbox
                                  checked={foto.selected}
                                  onCheckedChange={() => setGeracaoFotos(prev => prev.map((f, j) => j === idx ? { ...f, selected: !f.selected } : f))}
                                  className="bg-white/80"
                                />
                              </div>
                              {foto.selected && (
                                <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-6 w-6"
                                  onClick={() => setGeracaoFotos(prev => prev.filter((_, j) => j !== idx))}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                              <div className="p-1.5 bg-muted/50 text-[10px] space-y-0.5">
                                {foto.item_codigo && <p className="font-medium truncate">{foto.item_codigo}</p>}
                                {foto.diario_data && <p className="text-muted-foreground">{formatDate(foto.diario_data)}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowPreview(false)}>Voltar</Button>
                <Button onClick={handleEnviarMedicao} disabled={geracaoItens.filter(i => i.selected).length === 0 || bulkCreateLancamento.isPending || uploadingCapa}>
                  {(bulkCreateLancamento.isPending || uploadingCapa) ? "Enviando..." : "Enviar Medição"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Detalhes com Relatório Fotográfico */}
      <Dialog open={!!detailMedicaoId} onOpenChange={(open) => { if (!open) setDetailMedicaoId(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Detalhes da Medição {detailMedicao?.numero_medicao || ""}
              <span className="ml-2">{detailMedicao && getStatusBadge(detailMedicao.status)}</span>
            </DialogTitle>
          </DialogHeader>
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

       {/* Dialog: Revisão Parcial (Aprovação/Rejeição por Item) */}
       <Dialog open={!!partialApprovalMedicaoId} onOpenChange={(open) => { 
         if (!open) {
           if (partialApprovalMedicaoId) {
             setLocalEdits(prev => {
               const n = {...prev};
               if (n[partialApprovalMedicaoId]) delete n[partialApprovalMedicaoId].status;
               return n;
             });
           }
           setPartialApprovalMedicaoId(null);
           setReviewRemovedIds(new Set());
           setReviewNewItems([]);
           setReviewAddItemId("");
         }
       }}>
         <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
           <DialogHeader>
              <DialogTitle>Revisão de Medição</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Ajuste as quantidades aprovadas. O saldo não aprovado ficará <b>Pendente</b> e voltará para a próxima geração de medição. Ao salvar, o status voltará para <b>Enviada</b>.
              </p>
           </DialogHeader>
           <div className="space-y-4">
             <div className="rounded-md border overflow-x-auto max-h-[400px]">
               <Table>
                  <TableHeader className="bg-muted/50">
                     <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Unid.</TableHead>
                        <TableHead className="text-right">Executado</TableHead>
                        <TableHead className="text-right w-40">Aprovado (Revisado)</TableHead>
                        <TableHead className="text-right">Pendente (Saldo)</TableHead>
                        <TableHead className="w-10"></TableHead>
                     </TableRow>
                  </TableHeader>
                   <TableBody>
                     {(() => {
                         const m = tableMedicoes.processedItems.find(x => x.id === partialApprovalMedicaoId);
                         if (!m) return null;
                         const partialLancamentos = lancamentos.filter(l => m.lancamentoIds.includes(l.id) && !reviewRemovedIds.has(l.id));
                         const existingRows = partialLancamentos.map(l => {
                             const aprov = partialApprovalItems[l.id] ?? 0;
                             const pend = Number(l.quantidade) - aprov;
                             return (
                               <TableRow key={l.id}>
                                  <TableCell className="max-w-[250px] truncate" title={`${l.item_lpu?.codigo} - ${l.item_lpu?.descricao}`}>
                                    <span className="font-mono text-xs">{l.item_lpu?.codigo}</span><br/>
                                    {l.item_lpu?.descricao}
                                  </TableCell>
                                  <TableCell>{l.item_lpu?.unidade}</TableCell>
                                  <TableCell className="text-right">{Number(l.quantidade).toLocaleString("pt-BR")}</TableCell>
                                  <TableCell className="text-right">
                                    <Input type="number" min={0} max={Number(l.quantidade)} step="any" value={aprov} onChange={e => {
                                      let v = Number(e.target.value);
                                      if (v > Number(l.quantidade)) v = Number(l.quantidade);
                                      if (v < 0) v = 0;
                                      setPartialApprovalItems(prev => ({...prev, [l.id]: v}));
                                    }} className="w-28 ml-auto text-right border-primary/50 focus-visible:ring-primary" />
                                  </TableCell>
                                  <TableCell className="text-right text-amber-600 font-bold">{pend.toLocaleString("pt-BR")}</TableCell>
                                  <TableCell>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => {
                                      setReviewRemovedIds(prev => new Set([...prev, l.id]));
                                      setPartialApprovalItems(prev => { const n = {...prev}; delete n[l.id]; return n; });
                                    }}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                               </TableRow>
                             )
                         });

                         const newRows = reviewNewItems.map(ni => {
                           const itemLpu = allItensLpu.find(i => i.id === ni.item_lpu_id);
                           const pend = ni.quantidade - ni.aprovado;
                           return (
                             <TableRow key={ni.tempId} className="bg-green-50 dark:bg-green-950/20">
                               <TableCell className="max-w-[250px] truncate">
                                 <Badge variant="outline" className="mr-1 text-xs">Novo</Badge>
                                 <span className="font-mono text-xs">{itemLpu?.codigo}</span><br/>
                                 {itemLpu?.descricao}
                               </TableCell>
                               <TableCell>{itemLpu?.unidade}</TableCell>
                               <TableCell className="text-right">
                                 <Input type="number" min={0} step="any" value={ni.quantidade} onChange={e => {
                                   const v = Math.max(0, Number(e.target.value));
                                   setReviewNewItems(prev => prev.map(x => x.tempId === ni.tempId ? {...x, quantidade: v, aprovado: Math.min(x.aprovado, v)} : x));
                                 }} className="w-28 ml-auto text-right" />
                               </TableCell>
                               <TableCell className="text-right">
                                 <Input type="number" min={0} max={ni.quantidade} step="any" value={ni.aprovado} onChange={e => {
                                   let v = Number(e.target.value);
                                   if (v > ni.quantidade) v = ni.quantidade;
                                   if (v < 0) v = 0;
                                   setReviewNewItems(prev => prev.map(x => x.tempId === ni.tempId ? {...x, aprovado: v} : x));
                                 }} className="w-28 ml-auto text-right border-primary/50 focus-visible:ring-primary" />
                               </TableCell>
                               <TableCell className="text-right text-amber-600 font-bold">{pend.toLocaleString("pt-BR")}</TableCell>
                               <TableCell>
                                 <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => {
                                   setReviewNewItems(prev => prev.filter(x => x.tempId !== ni.tempId));
                                 }}>
                                   <Trash2 className="h-4 w-4" />
                                 </Button>
                               </TableCell>
                             </TableRow>
                           );
                         });

                         return [...existingRows, ...newRows];
                     })()}
                  </TableBody>
               </Table>
             </div>

             {/* Add new item */}
             <div className="flex items-end gap-2">
               <div className="flex-1">
                 <Label className="text-xs mb-1">Adicionar Item LPU</Label>
                 <Select value={reviewAddItemId} onValueChange={setReviewAddItemId}>
                   <SelectTrigger>
                     <SelectValue placeholder="Selecione um item..." />
                   </SelectTrigger>
                   <SelectContent>
                     {allItensLpu.map(item => (
                       <SelectItem key={item.id} value={item.id}>
                         {item.codigo} - {item.descricao}
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
               <Button variant="outline" size="sm" disabled={!reviewAddItemId} onClick={() => {
                 if (!reviewAddItemId) return;
                 setReviewNewItems(prev => [...prev, {
                   tempId: crypto.randomUUID(),
                   item_lpu_id: reviewAddItemId,
                   quantidade: 0,
                   aprovado: 0,
                 }]);
                 setReviewAddItemId("");
               }}>
                 <Plus className="h-4 w-4 mr-1" /> Incluir
               </Button>
             </div>
           </div>
           <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4 sm:justify-between items-center">
              <Button variant="destructive" onClick={() => {
                  const next = {...partialApprovalItems};
                  Object.keys(next).forEach(k => next[k] = 0);
                  setPartialApprovalItems(next);
                  setReviewNewItems(prev => prev.map(x => ({...x, aprovado: 0})));
              }}>
                Zerar Tudo (Rejeitar 100%)
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => {
                   setLocalEdits(prev => {
                     const n = {...prev};
                     if (n[partialApprovalMedicaoId!]) delete n[partialApprovalMedicaoId!].status;
                     return n;
                   });
                   setPartialApprovalMedicaoId(null);
                   setReviewRemovedIds(new Set());
                   setReviewNewItems([]);
                   setReviewAddItemId("");
                }}>Cancelar</Button>
                <Button onClick={handleSavePartialReview}>
                  Confirmar Revisão e Salvar
                </Button>
              </div>
           </DialogFooter>
         </DialogContent>
       </Dialog>
     </div>
   );
 }
