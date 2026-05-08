import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useQueryClient } from "@tanstack/react-query";
import { useProjetos } from "@/hooks/useProjetos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown } from "lucide-react";
import { cn, safeFormat, parseLocalDate } from "@/lib/utils";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
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

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnotacoesCampoDialog } from "@/components/medicoes/AnotacoesCampoDialog";
import { CriarSiteDialog } from "@/components/medicoes/CriarSiteDialog";
import { useDiarioObra } from "@/hooks/useDiarioObra";
import { useDiarioCalendario } from "@/hooks/useDiarioCalendario";
import { useDiarioCampoAtividades } from "@/hooks/useDiarioCampo";
import { useRecursos } from "@/hooks/useRecursos";
import { useSites } from "@/hooks/useSites";
import { useItensLpu } from "@/hooks/useItensLpu";
import { useEscopos } from "@/hooks/useEscopos";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DiarioCalendario, CLIMA_OPTIONS } from "@/components/medicoes/DiarioCalendario";
import {
  Plus, Trash2, Upload, Camera, Wrench, Users, Truck,
  HardHat, TrendingUp, TrendingDown, DollarSign, Calendar, MapPin, Copy, Pencil, Check, X,
  CalendarDays, ClipboardEdit, AlertTriangle, ChevronDown, ChevronUp, FileText, Tag, Loader2,
} from "lucide-react";
import { compressImage } from "@/lib/imageCompression";
import { Progress } from "@/components/ui/progress";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { UfMunicipioSelector } from "@/components/medicoes/UfMunicipioSelector";
import * as XLSX from "xlsx";

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function DiarioObraPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { projetos } = useProjetos();
  const [selectedProjetoId, setSelectedProjetoId] = usePersistedState<string>("diario_obra_projeto_id", "");
  const { sites } = useSites(selectedProjetoId || undefined);
  const { recursos, alocacoes, getCustoAtual, getAlocacoesBySite } = useRecursos();
  const [activeTab, setActiveTab] = useState<string>("calendario");
  const [selectedSiteId, setSelectedSiteId] = usePersistedState<string>("diario_obra_site_id", "");
  const [selectedDate, setSelectedDate] = usePersistedState<string>("diario_obra_date", format(new Date(), "yyyy-MM-dd"));
  const [periodoInicio, setPeriodoInicio] = useState(() => format(subMonths(new Date(), 2), "yyyy-MM-dd"));
  const [periodoFim, setPeriodoFim] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [diarioUf, setDiarioUf] = usePersistedState<string>("diario_obra_uf", "");
  const [diarioMunicipio, setDiarioMunicipio] = usePersistedState<string>("diario_obra_municipio", "");
  const [diarioClima, setDiarioClima] = useState("");
  const [headerSaved, setHeaderSaved] = useState(false);

  // Photo groups state (persisted per site in localStorage)
  const [photoGroups, setPhotoGroups] = usePersistedState<string[]>(
    `diario_photo_groups_${selectedSiteId || "default"}`,
    ["Execução", "Vistoria"]
  );
  const [newGroupName, setNewGroupName] = useState("");
  const photoGroupUploadRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);

  // Reset site when projeto changes
  const handleProjetoChange = (projetoId: string) => {
    setSelectedProjetoId(projetoId);
    setSelectedSiteId("");
  };

  const selectedSite = sites.find(s => s.id === selectedSiteId);
  const projetoIdParaLancamento = selectedSite?.projeto_id || selectedProjetoId || undefined;
  const { itensLpu } = useItensLpu(projetoIdParaLancamento);
  const { itens: itensEscopo } = useEscopos(selectedSiteId);

  // When no escopo is registered for the site, fall back to all project LPU items
  const hasEscopo = itensEscopo.length > 0;
  const itensDisponiveis = hasEscopo
    ? itensEscopo.map(i => ({
        id: i.item_lpu_id || i.id,
        item_lpu_id: i.item_lpu_id || "",
        nome: i.nome,
        valor_unitario: i.valor_unitario,
      }))
    : itensLpu.map(i => ({
        id: i.id,
        item_lpu_id: i.id,
        nome: `${i.codigo} - ${i.descricao}`,
        valor_unitario: i.preco_unitario,
      }));

  const {
    diario, loadingDiario, criarDiario, atualizarObservacoes, atualizarClima, atualizarLocalizacao,
    producoes, addProducao, removeProducao, updateProducao, moverProducao, moverDiario,
    equipe, isLoadingEquipe, addEquipe, updateEquipe, removeEquipe,
    equipamentos, isLoadingEquipamentos, addEquipamento, updateEquipamento, removeEquipamento,
    veiculos, isLoadingVeiculos, addVeiculo, updateVeiculo, removeVeiculo,
    fotos, addFoto, atualizarFoto, removeFoto,
    totalProducao, custoTotal, margem,
    custoEquipe, custoEquipamentos, custoVeiculos,
    duplicarDiarioAnterior,
    previsoes = {}
  } = useDiarioObra(selectedSiteId, selectedDate);

  // Diário de Campo data — fetch ALL activities for the project+date (ignore site filter)
  const { atividades: atividadesCampo } = useDiarioCampoAtividades(selectedProjetoId, "", selectedDate);

  const { data: calendarEntries = [] } = useDiarioCalendario(selectedSiteId, "2000-01-01", "2099-12-31");

  // Sync uf/municipio and observacoes from diario when loaded
  const lastDiarioId = useRef<string | null>(null);
  useEffect(() => {
    if (diario && diario.id !== lastDiarioId.current) {
      console.count("DiarioObra syncHeader executado");
      lastDiarioId.current = diario.id;
      const d = diario as any;
      if (d.uf) setDiarioUf(d.uf);
      if (d.municipio) setDiarioMunicipio(d.municipio);
      setDiarioClima(d.clima || "");
      setObs(diario.observacoes || "");
      setHeaderSaved(false);
    } else if (!diario && lastDiarioId.current !== null) {
      lastDiarioId.current = null;
      setObs("");
      setDiarioClima("");
      setHeaderSaved(false);
    }
  }, [diario?.id, setDiarioUf, setDiarioMunicipio]);

  const handleCalendarDayClick = (dateStr: string) => {
    setSelectedDate(dateStr);
    setActiveTab("lancamento");
  };

  const notifySiteRequired = useCallback((acao: string) => {
    toast({
      title: "Informe um site para salvar",
      description: selectedProjetoId
        ? `Selecione ou crie um site antes de ${acao}.`
        : `Selecione um projeto e informe um site antes de ${acao}.`,
      variant: "destructive",
    });
  }, [selectedProjetoId, toast]);

  const handleClimaChange = (clima: string) => {
    setDiarioClima(clima);
    setHeaderSaved(false);
  };

  const handleUfChange = (uf: string) => {
    setDiarioUf(uf);
    setDiarioMunicipio("");
    setHeaderSaved(false);
  };

  const handleMunicipioChange = (municipio: string) => {
    setDiarioMunicipio(municipio);
    setHeaderSaved(false);
  };

  const handleSaveHeader = async () => {
    if (!selectedSiteId) {
      notifySiteRequired("salvar o cabeçalho do diário");
      return;
    }
    const diarioId = diario?.id || (await ensureDiario());
    if (!diarioId) return;

    await atualizarClima.mutateAsync({ id: diarioId, clima: diarioClima });
    await atualizarLocalizacao.mutateAsync({ id: diarioId, uf: diarioUf, municipio: diarioMunicipio });
    await atualizarObservacoes.mutateAsync({ id: diarioId, observacoes: obs });
    setHeaderSaved(true);
    toast({ title: "Diário salvo com sucesso!" });
    setTimeout(() => setHeaderSaved(false), 3000);
  };

  // Production form state
  const [prodItemId, setProdItemId] = useState("");
  const [prodQtd, setProdQtd] = useState("");

  // Equipe form state
  const [eqRecursoId, setEqRecursoId] = useState("");
  const [eqHoras, setEqHoras] = useState("0");
  const [eqCustoHora, setEqCustoHora] = useState("");

  // Equipamento form state
  const [equipRecursoId, setEquipRecursoId] = useState("");
  const [equipHoras, setEquipHoras] = useState("8");
  const [equipCustoHora, setEquipCustoHora] = useState("");

  // Veículo form state
  const [veicRecursoId, setVeicRecursoId] = useState("");
  const [veicPlaca, setVeicPlaca] = useState("");
  const [veicKmInicial, setVeicKmInicial] = useState("");
  const [veicKmFinal, setVeicKmFinal] = useState("");
  const [veicCusto, setVeicCusto] = useState("");

  // Edit states
  const [editingEquipeId, setEditingEquipeId] = useState<string | null>(null);
  const [editEquipeHoras, setEditEquipeHoras] = useState("");
  const [editEquipeCustoHora, setEditEquipeCustoHora] = useState("");

  const [editingEquipId, setEditingEquipId] = useState<string | null>(null);
  const [editEquipHoras, setEditEquipHoras] = useState("");
  const [editEquipCustoHora, setEditEquipCustoHora] = useState("");

  const [editingVeicId, setEditingVeicId] = useState<string | null>(null);
  const [editVeicKmInicial, setEditVeicKmInicial] = useState("");
  const [editVeicKmFinal, setEditVeicKmFinal] = useState("");
  const [editVeicCusto, setEditVeicCusto] = useState("");
  const [editingProducaoId, setEditingProducaoId] = useState<string | null>(null);
  const [editProducaoQtd, setEditProducaoQtd] = useState("");

  // Filtered resources — only those allocated to the selected project
  const recursosAlocadosProjeto = (() => {
    if (!selectedProjetoId) return new Set<string>();
    const today = new Date().toISOString().split("T")[0];
    const ids = new Set<string>();
    (alocacoes || []).forEach(a => {
      if (a.projeto_id === selectedProjetoId && (a.data_fim === null || a.data_fim >= today)) {
        ids.add(a.recurso_id);
      }
    });
    return ids;
  })();
  const recursosPessoa = recursos.filter(r => r.tipo === "pessoa" && r.ativo && recursosAlocadosProjeto.has(r.id));
  const recursosEquipamento = recursos.filter(r => r.tipo === "equipamento" && r.ativo && recursosAlocadosProjeto.has(r.id));
  const recursosVeiculo = recursos.filter(r => r.tipo === "veiculo" && r.ativo && recursosAlocadosProjeto.has(r.id));

  // Auto-populate allocated resources only for diaries created in the current session
  const alocacoesDoSite = selectedSiteId ? getAlocacoesBySite(selectedSiteId) : [];
  const autoPopulatedDiarios = useRef<Set<string>>(new Set());
  const autoPopulateEligibleDiarios = useRef<Set<string>>(new Set());

  // Observações
  const [obs, setObs] = useState("");

  const ensureDiario = useCallback(async () => {
    if (diario) return diario.id;

    if (!selectedSiteId) {
      notifySiteRequired("salvar no Diário de Obra");
      return null;
    }

    try {
      const result = await criarDiario.mutateAsync({ site_id: selectedSiteId, data: selectedDate, uf: diarioUf || undefined, municipio: diarioMunicipio || undefined });
      autoPopulateEligibleDiarios.current.add(result.id);
      return result.id;
    } catch {
      return null;
    }
  }, [diario, criarDiario, selectedSiteId, selectedDate, diarioUf, diarioMunicipio, notifySiteRequired]);

  useEffect(() => {
    if (!selectedSiteId || alocacoesDoSite.length === 0) return;
    if (loadingDiario || isLoadingEquipe || isLoadingEquipamentos || isLoadingVeiculos) return;
    if (!diario?.id) return;

    const diarioKey = diario.id;
    if (!autoPopulateEligibleDiarios.current.has(diarioKey)) return;
    if (autoPopulatedDiarios.current.has(diarioKey)) return;

    if (equipe.length > 0 || equipamentos.length > 0 || veiculos.length > 0) {
      autoPopulateEligibleDiarios.current.delete(diarioKey);
      autoPopulatedDiarios.current.add(diarioKey);
      return;
    }

    autoPopulateEligibleDiarios.current.delete(diarioKey);
    autoPopulatedDiarios.current.add(diarioKey);

    const autoPopulate = async () => {
      const currentDiarioId = diario.id;

      for (const aloc of alocacoesDoSite) {
        const recurso = recursos.find(r => r.id === aloc.recurso_id);
        if (!recurso || !recurso.ativo) continue;
        
        const custo = getCustoAtual(recurso.id);
        const custoVal = custo ? custo.custo_unitario : 0;

        if (recurso.tipo === "pessoa") {
          const isDia = recurso.unidade === "dia";
          await addEquipe.mutateAsync({
            diario_id: currentDiarioId,
            nome: recurso.nome,
            funcao: recurso.cargo || undefined,
            horas: 8,
            custo_hora: custoVal,
            custo_total: isDia ? custoVal : 8 * custoVal,
          });
        } else if (recurso.tipo === "equipamento") {
          const isDia = recurso.unidade === "dia";
          await addEquipamento.mutateAsync({
            diario_id: currentDiarioId,
            descricao: recurso.nome,
            horas: 8,
            custo_hora: custoVal,
            custo_total: isDia ? custoVal : 8 * custoVal,
          });
        } else if (recurso.tipo === "veiculo") {
          await addVeiculo.mutateAsync({
            diario_id: currentDiarioId,
            descricao: recurso.nome,
            placa: recurso.placa || undefined,
            custo_diaria: custoVal,
          });
        }
      }
    };

    void autoPopulate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diario?.id, selectedSiteId, alocacoesDoSite.length, loadingDiario, isLoadingEquipe, isLoadingEquipamentos, isLoadingVeiculos]);

  // Helper: check if resource already added today
  const isRecursoDuplicado = (tipo: "pessoa" | "equipamento" | "veiculo", recursoNome: string): boolean => {
    if (tipo === "pessoa") return equipe.some(e => e.nome === recursoNome);
    if (tipo === "equipamento") return equipamentos.some(e => e.descricao === recursoNome);
    return veiculos.some(v => v.descricao === recursoNome);
  };

  // Helper: compute cost based on unit type
  const computeCost = (recurso: { unidade: string }, custoUnitario: number, horas: number) => {
    if (recurso.unidade === "dia") {
      // Daily rate: always full day cost regardless of hours
      return { custo_hora: custoUnitario, custo_total: custoUnitario };
    }
    // Hourly rate
    return { custo_hora: custoUnitario, custo_total: horas * custoUnitario };
  };

  // Track pending files per production item before saving
  const [pendingProdFiles, setPendingProdFiles] = useState<File[]>([]);

  const handleAddProducao = async () => {
    if (!prodItemId || !prodQtd) return;
    if (!diarioUf || !diarioMunicipio) {
      toast({ title: "Localização obrigatória", description: "Selecione UF e Município antes de lançar produção.", variant: "destructive" });
      return;
    }
    const selectedItem = itensDisponiveis.find(i => i.item_lpu_id === prodItemId);
    if (!selectedItem) {
      toast({ title: "Erro", description: "Item não encontrado.", variant: "destructive" });
      return;
    }
    const qtd = Number(prodQtd);
    const preco = Number(selectedItem.valor_unitario);
    const diarioId = await ensureDiario();
    if (!diarioId) return;

    const { data: prodData, error: prodError } = await supabase
      .from("diario_producao")
      .insert([{
        diario_id: diarioId,
        item_lpu_id: prodItemId,
        quantidade: qtd,
        preco_unitario_congelado: preco,
        valor_total: qtd * preco,
      }])
      .select()
      .single();
    if (prodError) {
      toast({ title: "Erro", description: prodError.message, variant: "destructive" });
      return;
    }
    // Upload pending files
    // Upload pending files in parallel with compression
    const totalFiles = pendingProdFiles.length;
    setUploadProgress({ current: 0, total: totalFiles });
    
    const CHUNK_SIZE = 5;
    for (let i = 0; i < pendingProdFiles.length; i += CHUNK_SIZE) {
      const chunk = pendingProdFiles.slice(i, i + CHUNK_SIZE);
      
      await Promise.all(chunk.map(async (file, index) => {
        const fileIndex = i + index;
        try {
          let fileToUpload = file;
          if (isFileImage(file.name)) {
            fileToUpload = await compressImage(file);
          }

          const timestamp = Date.now();
          const path = `${diarioId}/${timestamp}_${fileIndex}_${file.name}`;
          const thumb300Path = `${diarioId}/thumbs/300/${timestamp}_${fileIndex}_${file.name}`;
          const thumb600Path = `${diarioId}/thumbs/600/${timestamp}_${fileIndex}_${file.name}`;
          
          let thumb300File = fileToUpload;
          let thumb600File = fileToUpload;
          
          if (isFileImage(file.name)) {
            thumb300File = await compressImage(file, 300, 0.7);
            thumb600File = await compressImage(file, 600, 0.7);
          }

          // Upload Original
          const { error: uploadError } = await supabase.storage.from("diario-fotos").upload(path, fileToUpload, {
            cacheControl: 'public, max-age=31536000, immutable'
          });
          
          if (uploadError) {
            toast({ title: "Erro no upload", description: `${file.name}: ${uploadError.message}`, variant: "destructive" });
            return;
          }

          // Upload Thumbnails
          await Promise.all([
            supabase.storage.from("diario-fotos").upload(thumb300Path, thumb300File, {
              cacheControl: 'public, max-age=31536000, immutable'
            }),
            supabase.storage.from("diario-fotos").upload(thumb600Path, thumb600File, {
              cacheControl: 'public, max-age=31536000, immutable'
            })
          ]);

          const { data: urlData } = supabase.storage.from("diario-fotos").getPublicUrl(path);
          const { data: thumb300Data } = supabase.storage.from("diario-fotos").getPublicUrl(thumb300Path);
          const { data: thumb600Data } = supabase.storage.from("diario-fotos").getPublicUrl(thumb600Path);
          await addFoto.mutateAsync({
            diario_id: diarioId,
            url: urlData.publicUrl,
            thumb_url: thumb300Data.publicUrl,
            thumb_600_url: thumb600Data.publicUrl,
            classificacao: "execucao",
            diario_producao_id: prodData.id,
          });
          setUploadProgress(prev => prev ? { ...prev, current: prev.current + 1 } : null);
        } catch (err) {
          console.error(`Erro ao processar arquivo:`, err);
        }
      }));
    }
    setUploadProgress(null);
    setProdItemId("");
    setProdQtd("");
    setPendingProdFiles([]);
    // Invalidate queries to refresh data
    queryClient.invalidateQueries({ queryKey: ["diario_producao"] });
    queryClient.invalidateQueries({ queryKey: ["diario_calendario"] });
    toast({ title: "Produção adicionada com fotos!" });
  };

  const prodUploadRef = useRef<HTMLInputElement>(null);

  const handleDownloadProducaoTemplate = () => {
    const rows = [
      { codigo: "EX001", quantidade: 10 },
      { codigo: "EX002", quantidade: 5 },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 20 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Producao");
    XLSX.writeFile(wb, "modelo_producao_diario.xlsx");
  };

  const handleUploadProducaoPlanilha = async (file: File) => {
    if (!diarioUf || !diarioMunicipio) {
      toast({ title: "Localização obrigatória", description: "Selecione UF e Município antes de lançar produção.", variant: "destructive" });
      return;
    }
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
      if (!rows.length) {
        toast({ title: "Planilha vazia", variant: "destructive" });
        return;
      }

      // Build code → item map (case-insensitive)
      const codeMap = new Map<string, { item_lpu_id: string; valor_unitario: number }>();
      const lpuByCode = new Map(itensLpu.map(i => [String(i.codigo).trim().toLowerCase(), i]));
      itensDisponiveis.forEach(i => {
        if (!i.item_lpu_id) return;
        const lpu = itensLpu.find(l => l.id === i.item_lpu_id);
        if (lpu) codeMap.set(String(lpu.codigo).trim().toLowerCase(), { item_lpu_id: i.item_lpu_id, valor_unitario: i.valor_unitario });
      });

      const toInsert: Array<{ item_lpu_id: string; quantidade: number; preco_unitario_congelado: number; valor_total: number }> = [];
      const erros: string[] = [];
      rows.forEach((r, idx) => {
        const codigo = String(r.codigo ?? r.Codigo ?? r.código ?? r.Código ?? "").trim().toLowerCase();
        const qtdRaw = r.quantidade ?? r.Quantidade ?? r.qtd ?? r.Qtd;
        const qtd = Number(String(qtdRaw).replace(",", "."));
        if (!codigo) { erros.push(`Linha ${idx + 2}: código vazio`); return; }
        if (!qtd || isNaN(qtd) || qtd <= 0) { erros.push(`Linha ${idx + 2}: quantidade inválida`); return; }
        const match = codeMap.get(codigo) || (lpuByCode.get(codigo) ? { item_lpu_id: lpuByCode.get(codigo)!.id, valor_unitario: Number(lpuByCode.get(codigo)!.preco_unitario || 0) } : null);
        if (!match) { erros.push(`Linha ${idx + 2}: código "${r.codigo}" não encontrado no ${hasEscopo ? "escopo" : "projeto"}`); return; }
        toInsert.push({
          item_lpu_id: match.item_lpu_id,
          quantidade: qtd,
          preco_unitario_congelado: match.valor_unitario,
          valor_total: qtd * match.valor_unitario,
        });
      });

      if (!toInsert.length) {
        toast({ title: "Nenhum item válido", description: erros.slice(0, 5).join(" | "), variant: "destructive" });
        return;
      }

      const diarioId = await ensureDiario();
      if (!diarioId) return;

      const payload = toInsert.map(i => ({ ...i, diario_id: diarioId }));
      const { error } = await supabase.from("diario_producao").insert(payload);
      if (error) {
        toast({ title: "Erro ao importar", description: error.message, variant: "destructive" });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["diario_producao"] });
      queryClient.invalidateQueries({ queryKey: ["diario_calendario"] });
      toast({
        title: `${toInsert.length} item(ns) importado(s)!`,
        description: erros.length ? `${erros.length} linha(s) ignorada(s).` : undefined,
      });
    } catch (e: any) {
      toast({ title: "Erro ao ler planilha", description: e.message, variant: "destructive" });
    }
  };

  const handleAddEquipe = async () => {
    if (!eqRecursoId || !eqCustoHora) return;
    const recurso = recursos.find(r => r.id === eqRecursoId);
    if (!recurso) return;

    if (isRecursoDuplicado("pessoa", recurso.nome)) {
      toast({ title: "Recurso já adicionado", description: `${recurso.nome} já está no diário de hoje.`, variant: "destructive" });
      return;
    }

    const horas = Number(eqHoras);
    const custoUnitario = Number(eqCustoHora);
    const { custo_hora, custo_total } = computeCost(recurso, custoUnitario, horas);
    const diarioId = await ensureDiario();
    if (!diarioId) return;

    await addEquipe.mutateAsync({
      diario_id: diarioId,
      nome: recurso.nome,
      funcao: recurso.cargo || undefined,
      horas,
      custo_hora,
      custo_total,
    });
    setEqRecursoId(""); setEqHoras("0"); setEqCustoHora("");
  };

  const handleAddEquipamento = async () => {
    if (!equipRecursoId || !equipCustoHora) return;
    const recurso = recursos.find(r => r.id === equipRecursoId);
    if (!recurso) return;

    if (isRecursoDuplicado("equipamento", recurso.nome)) {
      toast({ title: "Recurso já adicionado", description: `${recurso.nome} já está no diário de hoje.`, variant: "destructive" });
      return;
    }

    const horas = Number(equipHoras);
    const custoUnitario = Number(equipCustoHora);
    const { custo_hora, custo_total } = computeCost(recurso, custoUnitario, horas);
    const diarioId = await ensureDiario();
    if (!diarioId) return;

    await addEquipamento.mutateAsync({
      diario_id: diarioId,
      descricao: recurso.nome,
      horas,
      custo_hora,
      custo_total,
    });
    setEquipRecursoId(""); setEquipHoras("8"); setEquipCustoHora("");
  };

  const handleAddVeiculo = async () => {
    if (!veicRecursoId || !veicCusto) return;
    const recurso = recursos.find(r => r.id === veicRecursoId);
    if (!recurso) return;

    if (isRecursoDuplicado("veiculo", recurso.nome)) {
      toast({ title: "Recurso já adicionado", description: `${recurso.nome} já está no diário de hoje.`, variant: "destructive" });
      return;
    }

    const kmInicial = veicKmInicial ? Number(veicKmInicial) : 0;
    const kmFinal = veicKmFinal ? Number(veicKmFinal) : 0;
    const kmRodados = Math.max(0, kmFinal - kmInicial);

    const diarioId = await ensureDiario();
    if (!diarioId) return;

    await addVeiculo.mutateAsync({
      diario_id: diarioId,
      descricao: recurso.nome,
      placa: recurso.placa || "",
      km_inicial: kmInicial,
      km_final: kmFinal,
      km_rodados: kmRodados,
      custo_diaria: Number(veicCusto),
    });
    setVeicRecursoId(""); setVeicKmInicial(""); setVeicKmFinal(""); setVeicCusto("");
  };

  const handleSelectRecurso = (tipo: "pessoa" | "equipamento" | "veiculo", recursoId: string) => {
    const custo = getCustoAtual(recursoId);
    const custoVal = custo ? String(custo.custo_unitario) : "";
    const recurso = recursos.find(r => r.id === recursoId);

    if (tipo === "pessoa") {
      setEqRecursoId(recursoId);
      setEqCustoHora(custoVal);
      if (recurso?.unidade === "dia") setEqHoras("8"); // default hours for tracking
    } else if (tipo === "equipamento") {
      setEquipRecursoId(recursoId);
      setEquipCustoHora(custoVal);
      if (recurso?.unidade === "dia") setEquipHoras("8");
    } else {
      setVeicRecursoId(recursoId);
      setVeicCusto(custoVal);
      setVeicPlaca(recurso?.placa || "");
    }
  };

  // Edit handlers
  const startEditEquipe = (e: any) => {
    setEditingEquipeId(e.id);
    setEditEquipeHoras(String(e.horas));
    setEditEquipeCustoHora(String(e.custo_hora));
  };
  const saveEditEquipe = async () => {
    if (!editingEquipeId) return;
    const horas = Number(editEquipeHoras);
    const custoH = Number(editEquipeCustoHora);
    // Find if this person's resource has "dia" unit
    const recurso = recursos.find(r => r.nome === equipe.find(e => e.id === editingEquipeId)?.nome);
    const isDia = recurso?.unidade === "dia";
    const custoTotal = isDia ? custoH : horas * custoH;
    await updateEquipe.mutateAsync({ id: editingEquipeId, horas, custo_hora: custoH, custo_total: custoTotal });
    setEditingEquipeId(null);
  };

  const startEditEquip = (eq: any) => {
    setEditingEquipId(eq.id);
    setEditEquipHoras(String(eq.horas));
    setEditEquipCustoHora(String(eq.custo_hora));
  };
  const saveEditEquip = async () => {
    if (!editingEquipId) return;
    const horas = Number(editEquipHoras);
    const custoH = Number(editEquipCustoHora);
    const recurso = recursos.find(r => r.nome === equipamentos.find(e => e.id === editingEquipId)?.descricao);
    const isDia = recurso?.unidade === "dia";
    const custoTotal = isDia ? custoH : horas * custoH;
    await updateEquipamento.mutateAsync({ id: editingEquipId, horas, custo_hora: custoH, custo_total: custoTotal });
    setEditingEquipId(null);
  };

  const startEditVeic = (v: any) => {
    setEditingVeicId(v.id);
    setEditVeicKmInicial(String(v.km_inicial || 0));
    setEditVeicKmFinal(String(v.km_final || 0));
    setEditVeicCusto(String(v.custo_diaria));
  };
  const saveEditVeic = async () => {
    if (!editingVeicId) return;
    const kmInicial = Number(editVeicKmInicial);
    const kmFinal = Number(editVeicKmFinal);
    const kmRodados = Math.max(0, kmFinal - kmInicial);
    await updateVeiculo.mutateAsync({ id: editingVeicId, km_inicial: kmInicial, km_final: kmFinal, km_rodados: kmRodados, custo_diaria: Number(editVeicCusto) });
    setEditingVeicId(null);
  };

  const startEditProducao = (p: any) => {
    setEditingProducaoId(p.id);
    setEditProducaoQtd(String(p.quantidade));
  };

  const saveEditProducao = async () => {
    if (!editingProducaoId) return;
    const qtd = Number(editProducaoQtd);
    const producao = producoes.find(p => p.id === editingProducaoId);
    if (!producao) return;
    const preco = Number(producao.preco_unitario_congelado);
    await updateProducao.mutateAsync({ 
      id: editingProducaoId, 
      quantidade: qtd, 
      valor_total: qtd * preco 
    });
    setEditingProducaoId(null);
  };

  const ACCEPTED_FILE_TYPES = "image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx";

  const handleUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>, classificacao: string, diarioProducaoId?: string) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const diarioId = await ensureDiario();
    if (!diarioId) {
      e.target.value = "";
      return;
    }

    const totalFiles = files.length;
    setUploadProgress({ current: 0, total: totalFiles });
    
    // Process in chunks of 5 for better performance without overwhelming the browser/network
    const CHUNK_SIZE = 5;
    const fileList = Array.from(files);
    
    for (let i = 0; i < fileList.length; i += CHUNK_SIZE) {
      const chunk = fileList.slice(i, i + CHUNK_SIZE);
      
      await Promise.all(chunk.map(async (file, index) => {
        const fileIndex = i + index;
        try {
          // 1. Compress image if it's an image
          let fileToUpload = file;
          if (isFileImage(file.name)) {
            fileToUpload = await compressImage(file);
          }

          // 2. Upload to Storage
          const timestamp = Date.now();
          const path = `${diarioId}/${timestamp}_${fileIndex}_${file.name}`;
          const thumb300Path = `${diarioId}/thumbs/300/${timestamp}_${fileIndex}_${file.name}`;
          const thumb600Path = `${diarioId}/thumbs/600/${timestamp}_${fileIndex}_${file.name}`;

          let thumb300File = fileToUpload;
          let thumb600File = fileToUpload;
          
          if (isFileImage(file.name)) {
            thumb300File = await compressImage(file, 300, 0.7);
            thumb600File = await compressImage(file, 600, 0.7);
          }

          const { error: uploadError } = await supabase.storage.from("diario-fotos").upload(path, fileToUpload, {
            cacheControl: 'public, max-age=31536000, immutable'
          });
          
          if (uploadError) {
            console.error(`Erro no upload de ${file.name}:`, uploadError);
            toast({ title: "Erro no upload", description: `${file.name}: ${uploadError.message}`, variant: "destructive" });
            return;
          }

          // Upload Thumbnails
          await Promise.all([
            supabase.storage.from("diario-fotos").upload(thumb300Path, thumb300File, {
              cacheControl: 'public, max-age=31536000, immutable'
            }),
            supabase.storage.from("diario-fotos").upload(thumb600Path, thumb600File, {
              cacheControl: 'public, max-age=31536000, immutable'
            })
          ]);

          const { data: urlData } = supabase.storage.from("diario-fotos").getPublicUrl(path);
          const { data: thumb300Data } = supabase.storage.from("diario-fotos").getPublicUrl(thumb300Path);
          const { data: thumb600Data } = supabase.storage.from("diario-fotos").getPublicUrl(thumb600Path);

          await addFoto.mutateAsync({ 
            diario_id: diarioId, 
            url: urlData.publicUrl, 
            thumb_url: thumb300Data.publicUrl,
            thumb_600_url: thumb600Data.publicUrl,
            classificacao,
            ...(diarioProducaoId ? { diario_producao_id: diarioProducaoId } : {}),
          });

          setUploadProgress(prev => prev ? { ...prev, current: prev.current + 1 } : null);
        } catch (err) {
          console.error(`Erro ao processar ${file.name}:`, err);
        }
      }));
    }

    toast({ title: `${totalFiles} arquivo(s) processado(s)!` });
    setUploadProgress(null);
    e.target.value = "";
  };

  const isFileImage = (url: string) => {
    const ext = url.split('.').pop()?.toLowerCase() || '';
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
  };

  const getFileIcon = (url: string) => {
    const ext = url.split('.').pop()?.split('?')[0]?.toLowerCase() || '';
    if (['pdf'].includes(ext)) return '📄 PDF';
    if (['doc', 'docx'].includes(ext)) return '📝 Word';
    if (['ppt', 'pptx'].includes(ext)) return '📊 PPT';
    if (['xls', 'xlsx'].includes(ext)) return '📈 Excel';
    return null;
  };

  const handleSaveObs = async () => {
    const diarioId = diario?.id || (await ensureDiario());
    if (!diarioId) return;

    await atualizarObservacoes.mutateAsync({ id: diarioId, observacoes: obs });
    toast({ title: "Observações salvas!" });
  };

  const handleDuplicateAnterior = async () => {
    if (!selectedDate) return;
    if (!selectedSiteId) {
      notifySiteRequired("duplicar o diário anterior");
      return;
    }
    
    if (confirm("Deseja realmente duplicar o último diário preenchido deste site para a data de hoje? Qualquer item já cadastrado hoje será mantido.")) {
      await duplicarDiarioAnterior.mutateAsync({ site_id: selectedSiteId, data: selectedDate });
    }
  };

  // Get unit label for a resource by name
  const getUnidadeLabel = (nome: string, tipo: "pessoa" | "equipamento") => {
    const recurso = recursos.find(r => r.nome === nome && r.tipo === tipo);
    return recurso?.unidade === "dia" ? "diária" : "hora";
  };

  const margemPositiva = margem >= 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <HardHat className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Diário de Obra</h1>
        </div>

        {/* Projeto + Site selectors */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 min-w-[300px]">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                >
                  {selectedProjetoId
                    ? projetos.find((p) => p.id === selectedProjetoId)?.codigo + " — " + projetos.find((p) => p.id === selectedProjetoId)?.nome
                    : "Selecione o projeto"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0">
                <Command>
                  <CommandInput placeholder="Pesquisar projeto..." />
                  <CommandList>
                    <CommandEmpty>Nenhum projeto encontrado.</CommandEmpty>
                    <CommandGroup>
                      {projetos.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={`${p.codigo} ${p.nome}`}
                          onSelect={() => {
                            handleProjetoChange(p.id);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedProjetoId === p.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {p.codigo} — {p.nome}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center gap-2 min-w-[300px]">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                  disabled={!selectedProjetoId}
                >
                  {selectedSiteId
                    ? sites.find((s) => s.id === selectedSiteId)?.codigo + " — " + sites.find((s) => s.id === selectedSiteId)?.nome
                    : selectedProjetoId ? "Selecione o site" : "Selecione um projeto primeiro"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0">
                <Command>
                  <CommandInput placeholder="Pesquisar site..." />
                  <CommandList>
                    <CommandEmpty>Nenhum site encontrado.</CommandEmpty>
                    <CommandGroup>
                      {sites.map((s) => (
                        <CommandItem
                          key={s.id}
                          value={`${s.codigo} ${s.nome}`}
                          onSelect={() => {
                            setSelectedSiteId(s.id);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedSiteId === s.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {s.codigo} — {s.nome}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {selectedProjetoId && (
            <CriarSiteDialog
              projetoId={selectedProjetoId}
              onSiteCreated={(siteId) => setSelectedSiteId(siteId)}
            />
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <TabsList>
            <TabsTrigger value="calendario" className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Calendário
            </TabsTrigger>
            <TabsTrigger value="lancamento" className="flex items-center gap-2">
              <ClipboardEdit className="h-4 w-4" />
              Lançamento — {safeFormat(selectedDate, "dd/MM/yyyy")}
            </TabsTrigger>
          </TabsList>

          {activeTab === "lancamento" && diario && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Calendar className="h-4 w-4" />
                  Mudar Data do Diário
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarComponent
                  mode="single"
                  selected={parseLocalDate(selectedDate)}
                  onSelect={(date) => {
                    if (date) {
                      const dateStr = format(date, "yyyy-MM-dd");
                      if (dateStr !== selectedDate) {
                        if (window.confirm(`Deseja mover TODOS os lançamentos deste dia (${safeFormat(selectedDate, "dd/MM/yyyy")}) para o dia ${format(date, "dd/MM/yyyy")}?`)) {
                          moverDiario.mutate({ diarioId: diario.id, novaData: dateStr }, {
                            onSuccess: (data) => {
                              setSelectedDate(data.novaData);
                            }
                          });
                        }
                      }
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          )}
        </div>

        {uploadProgress && (
          <div className="bg-muted/30 border rounded-lg p-3 flex flex-col gap-2">
            <div className="flex justify-between items-center text-sm font-medium">
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Processando e enviando fotos...
              </span>
              <span>{uploadProgress.current} de {uploadProgress.total}</span>
            </div>
            <Progress value={(uploadProgress.current / uploadProgress.total) * 100} className="h-2" />
          </div>
        )}

        {/* ===== CALENDAR VIEW ===== */}
        <TabsContent value="calendario">
            <DiarioCalendario
              entries={calendarEntries}
              onDayClick={handleCalendarDayClick}
              periodoInicio={periodoInicio}
              periodoFim={periodoFim}
              onPeriodoChange={(ini, fim) => {
                setPeriodoInicio(ini);
                setPeriodoFim(fim);
              }}
            />
        </TabsContent>

          <TabsContent value="lancamento">
            {!selectedSiteId && (
              <div className="mb-4 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Tela do dia liberada sem site</p>
                    <p className="text-sm text-muted-foreground">
                      Você pode consultar as anotações de campo e preparar os lançamentos. Para salvar qualquer dado no Diário de Obra, selecione ou crie um site no topo da tela.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Sticky Summary Header */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b pb-4 mb-4">
              <div className="flex flex-col gap-4">
                {/* Date + Clima + Duplicate */}
                <div className="flex flex-wrap gap-3 items-center">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={selectedDate}
                      onChange={e => setSelectedDate(e.target.value)}
                      className="w-[180px]"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={diarioClima}
                      onValueChange={handleClimaChange}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="🌤️ Selecione o clima" />
                      </SelectTrigger>
                      <SelectContent>
                        {CLIMA_OPTIONS.map(opt => {
                          const Icon = opt.icon;
                          return (
                            <SelectItem key={opt.value} value={opt.value}>
                              <span className="flex items-center gap-2">
                                <Icon className={`h-4 w-4 ${opt.color}`} />
                                {opt.label}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <UfMunicipioSelector
                    uf={diarioUf}
                    municipio={diarioMunicipio}
                    onUfChange={handleUfChange}
                    onMunicipioChange={handleMunicipioChange}
                    required
                  />
                  <Button
                    variant={headerSaved ? "outline" : "default"}
                    size="sm"
                    onClick={handleSaveHeader}
                    disabled={atualizarClima.isPending || atualizarLocalizacao.isPending || atualizarObservacoes.isPending}
                    className={headerSaved ? "border-green-500 text-green-600" : ""}
                  >
                    {headerSaved ? (
                      <><Check className="h-4 w-4 mr-1" /> Salvo</>
                    ) : atualizarClima.isPending || atualizarLocalizacao.isPending ? (
                      "Salvando..."
                    ) : (
                      "Salvar"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    className="ml-auto"
                    onClick={handleDuplicateAnterior}
                    disabled={duplicarDiarioAnterior.isPending}
                  >
                    <Copy className="h-4 w-4 mr-2 text-muted-foreground" />
                    {duplicarDiarioAnterior.isPending ? "Duplicando..." : "Duplicar Dia Anterior"}
                  </Button>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="border-l-4 border-l-emerald-500">
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">Produção</p>
                      <p className="text-lg font-bold tabular-nums">{formatCurrency(totalProducao)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-amber-500">
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">Custo Total</p>
                      <p className="text-lg font-bold tabular-nums">{formatCurrency(custoTotal)}</p>
                    </CardContent>
                  </Card>
                  <Card className={`border-l-4 ${margemPositiva ? "border-l-emerald-600" : "border-l-red-500"}`}>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">Margem do Dia</p>
                      <div className="flex items-center gap-1">
                        {margemPositiva ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
                        <p className={`text-lg font-bold tabular-nums ${margemPositiva ? "text-emerald-600" : "text-red-500"}`}>
                          {formatCurrency(margem)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-blue-500">
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">% Margem</p>
                      <p className="text-lg font-bold tabular-nums">
                        {totalProducao > 0 ? ((margem / totalProducao) * 100).toFixed(1) + "%" : "—"}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>

            <div className="space-y-6">
          {/* ===== DIÁRIO DE CAMPO ===== */}
          {selectedProjetoId && (
            <AnotacoesCampoDialog
              atividadesCampo={atividadesCampo}
              diarioObraId={diario?.id || null}
              itensDisponiveis={itensDisponiveis}
              producoes={producoes}
              fotosObra={fotos}
              onFotoTransferred={() => {
                queryClient.invalidateQueries({ queryKey: ["diario_fotos", diario?.id] });
              }}
              ensureDiario={ensureDiario}
              selectedDate={selectedDate}
            />
          )}

          {/* ===== PRODUÇÃO ===== */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="h-5 w-5 text-emerald-600" />
                Produção
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs text-muted-foreground mb-1 block">Item LPU {hasEscopo ? "(do Escopo)" : "(do Projeto)"}</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                        <span className="truncate">
                          {prodItemId
                            ? (itensDisponiveis.find(i => i.item_lpu_id === prodItemId)?.nome || "Selecione item")
                            : "Selecione item"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[min(720px,95vw)] p-0" align="start">
                      <Command
                        filter={(value, search) => {
                          if (!search) return 1;
                          return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
                        }}
                      >
                        <CommandInput placeholder="Buscar por código ou descrição..." />
                        <CommandList className="max-h-[320px]">
                          <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
                          <CommandGroup>
                            {itensDisponiveis.map(i => (
                              <CommandItem
                                key={i.id || i.item_lpu_id}
                                value={i.nome}
                                onSelect={() => setProdItemId(i.item_lpu_id || "")}
                                className="items-start"
                              >
                                <Check className={cn("mr-2 h-4 w-4 mt-0.5 shrink-0", prodItemId === i.item_lpu_id ? "opacity-100" : "opacity-0")} />
                                <span className="whitespace-normal break-words leading-snug">{i.nome}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="w-[140px]">
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Qtd
                    {prodItemId && previsoes[prodItemId] > 0 && (
                      <Badge variant="outline" className="text-[9px] h-4 px-1 py-0 ml-1 leading-none text-blue-600 bg-blue-50">
                        Meta: {previsoes[prodItemId]}
                      </Badge>
                    )}
                  </label>
                  <Input type="number" value={prodQtd} onChange={e => setProdQtd(e.target.value)} placeholder="0" />
                </div>
                <div className="w-[140px]">
                  <label className="text-xs text-muted-foreground mb-1 block">Valor</label>
                  <Input
                    readOnly
                    value={prodItemId && prodQtd
                      ? formatCurrency(Number(prodQtd) * Number(itensDisponiveis.find(i => i.item_lpu_id === prodItemId)?.valor_unitario || 0))
                      : "—"}
                    className="bg-muted"
                  />
                </div>
                <Button onClick={handleAddProducao} size="sm" disabled={!prodItemId || !prodQtd}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar
                </Button>
                <input
                  ref={prodUploadRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadProducaoPlanilha(f);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => prodUploadRef.current?.click()}
                  title="Importar produção em lote (Excel/CSV)"
                >
                  <Upload className="h-4 w-4 mr-1" /> Upload Planilha
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleDownloadProducaoTemplate}
                  title="Baixar modelo de planilha"
                >
                  <FileText className="h-4 w-4 mr-1" /> Modelo
                </Button>
              </div>

              {/* Staging area for pending files */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs border rounded-md px-3 py-1.5 hover:bg-accent transition-colors">
                    <input
                      type="file"
                      accept={ACCEPTED_FILE_TYPES}
                      multiple
                      className="hidden"
                      onChange={e => {
                        const files = e.target.files;
                        if (files) {
                          setPendingProdFiles(prev => [...prev, ...Array.from(files)]);
                        }
                        e.target.value = "";
                      }}
                    />
                    <Camera className="h-3.5 w-3.5" />
                    Anexar Fotos/Arquivos
                  </label>
                </div>
                {pendingProdFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {pendingProdFiles.map((file, idx) => (
                      <div key={idx} className="relative group flex items-center gap-1 border rounded-md px-2 py-1 text-xs bg-muted/50">
                        <span className="max-w-[120px] truncate">{file.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 shrink-0"
                          onClick={() => setPendingProdFiles(prev => prev.filter((_, i) => i !== idx))}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {producoes.length > 0 && (
                <div className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item do Escopo</TableHead>
                        <TableHead className="text-right">Meta (Dia)</TableHead>
                        <TableHead className="text-right">Qtd Real</TableHead>
                        <TableHead className="text-right">Preço Unit.</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Fotos</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {producoes.map(p => {
                        const itemFotos = fotos.filter(f => f.diario_producao_id === p.id);
                        const isEditing = editingProducaoId === p.id;
                        return (
                          <TableRow key={p.id} className="align-top">
                            <TableCell className="font-medium text-xs">{p.item_lpu?.codigo} — {p.item_lpu?.descricao}</TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {previsoes[p.item_lpu_id] ? previsoes[p.item_lpu_id] : "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {isEditing ? (
                                <Input 
                                  type="number" 
                                  value={editProducaoQtd} 
                                  onChange={ev => setEditProducaoQtd(ev.target.value)} 
                                  className="w-[80px] ml-auto h-8 text-right" 
                                />
                              ) : (
                                <div className="flex items-center justify-end gap-1">
                                  <span className={previsoes[p.item_lpu_id] && Number(p.quantidade) < previsoes[p.item_lpu_id] ? "text-red-600 font-bold" : "text-emerald-600 font-bold"}>
                                    {Number(p.quantidade)}
                                  </span>
                                  {previsoes[p.item_lpu_id] && Number(p.quantidade) < previsoes[p.item_lpu_id] && (
                                    <AlertTriangle className="h-3 w-3 text-red-500" />
                                  )}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{formatCurrency(Number(p.preco_unitario_congelado))}</TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {isEditing 
                                ? formatCurrency(Number(editProducaoQtd) * Number(p.preco_unitario_congelado))
                                : formatCurrency(Number(p.valor_total))
                              }
                            </TableCell>
                            <TableCell>
                              <div className="space-y-2">
                               <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs border rounded-md px-2 py-1 hover:bg-accent transition-colors">
                                  <input
                                    type="file"
                                    accept={ACCEPTED_FILE_TYPES}
                                    multiple
                                    className="hidden"
                                    onChange={e => handleUploadFoto(e, "execucao", p.id)}
                                  />
                                  <Camera className="h-3 w-3" />
                                  Foto
                                </label>
                                {itemFotos.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {itemFotos.map(f => (
                                      <div key={f.id} className="relative group w-14 h-14 rounded overflow-hidden border cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all">
                                        <Dialog>
                                          <DialogTrigger asChild>
                                            <div className="w-full h-full">
                                              {isFileImage(f.url) ? (
                                                 <ResponsiveImage 
                                                   src={f.url} 
                                                   thumb300={f.thumb_url}
                                                   thumb600={f.thumb_600_url}
                                                   alt={f.legenda || "foto"} 
                                                   className="w-full h-full object-cover" 
                                                 />
                                              ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-muted text-[9px] text-center font-medium p-1">
                                                  {getFileIcon(f.url) || '📎'}
                                                </div>
                                              )}
                                            </div>
                                          </DialogTrigger>
                                          <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black border-none">
                                            <div className="flex flex-col items-center justify-center h-full max-h-[90vh]">
                                              {isFileImage(f.url) ? (
                                                <img 
                                                  src={f.url} 
                                                  alt={f.legenda || "Visualização ampliada"} 
                                                  className="max-w-full max-h-full object-contain"
                                                />
                                              ) : (
                                                <div className="p-20 text-white text-center space-y-4">
                                                  <div className="text-6xl">{getFileIcon(f.url)?.split(' ')[0] || '📎'}</div>
                                                  <p className="text-xl">{f.legenda || "Arquivo de documento"}</p>
                                                  <Button asChild variant="secondary">
                                                    <a href={f.url} target="_blank" rel="noopener noreferrer">Baixar Arquivo</a>
                                                  </Button>
                                                </div>
                                              )}
                                            </div>
                                          </DialogContent>
                                        </Dialog>
                                        <Button
                                          variant="destructive"
                                          size="icon"
                                          className="absolute top-0 right-0 h-4 w-4 z-20 shadow-sm"
                                          onClick={() => removeFoto.mutate(f.id)}
                                        >
                                          <Trash2 className="h-2.5 w-2.5" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1 justify-end">
                                {isEditing ? (
                                  <>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={saveEditProducao}>
                                      <Check className="h-4 w-4 text-emerald-600" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingProducaoId(null)}>
                                      <X className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditProducao(p)}>
                                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeProducao.mutate(p.id)}>
                                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ===== APONTAMENTO: EQUIPE ===== */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5 text-blue-600" />
                Equipe
                {custoEquipe > 0 && <Badge variant="secondary" className="ml-auto">{formatCurrency(custoEquipe)}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[150px]">
                  <label className="text-xs text-muted-foreground mb-1 block">Pessoa *</label>
                  <Select value={eqRecursoId} onValueChange={v => handleSelectRecurso("pessoa", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {recursosPessoa.map(r => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.nome}{r.cargo ? ` (${r.cargo})` : ""}
                          {r.unidade === "dia" ? " [diária]" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[80px]">
                  <label className="text-xs text-muted-foreground mb-1 block">Horas</label>
                  <Input type="number" value={eqHoras} onChange={e => setEqHoras(e.target.value)} />
                </div>
                <div className="w-[120px]">
                  <label className="text-xs text-muted-foreground mb-1 block">
                    {eqRecursoId && recursos.find(r => r.id === eqRecursoId)?.unidade === "dia" ? "R$/diária" : "R$/hora"}
                  </label>
                  <Input type="number" value={eqCustoHora} onChange={e => setEqCustoHora(e.target.value)} placeholder="0" />
                </div>
                <div className="w-[120px]">
                  <label className="text-xs text-muted-foreground mb-1 block">Custo</label>
                  <Input
                    readOnly
                    value={eqCustoHora ? (() => {
                      const recurso = recursos.find(r => r.id === eqRecursoId);
                      const custoUnit = Number(eqCustoHora);
                      if (recurso?.unidade === "dia") return formatCurrency(custoUnit);
                      return formatCurrency(Number(eqHoras) * custoUnit);
                    })() : "—"}
                    className="bg-muted"
                  />
                </div>
                <Button onClick={handleAddEquipe} size="sm" disabled={!eqRecursoId || !eqCustoHora}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar
                </Button>
              </div>
              {equipe.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Função</TableHead>
                      <TableHead className="text-right">Horas</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {equipe.map(e => {
                      const unidadeLabel = getUnidadeLabel(e.nome, "pessoa");
                      const isEditing = editingEquipeId === e.id;
                      return (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium">{e.nome}</TableCell>
                          <TableCell>{e.funcao || "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {isEditing ? (
                              <Input type="number" value={editEquipeHoras} onChange={ev => setEditEquipeHoras(ev.target.value)} className="w-[70px] ml-auto h-8 text-right" />
                            ) : (
                              <span>{Number(e.horas)} <span className="text-xs text-muted-foreground">({unidadeLabel})</span></span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">{formatCurrency(Number(e.custo_total))}</TableCell>
                          <TableCell>
                            <div className="flex gap-1 justify-end">
                              {isEditing ? (
                                <>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={saveEditEquipe}>
                                    <Check className="h-4 w-4 text-emerald-600" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingEquipeId(null)}>
                                    <X className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditEquipe(e)}>
                                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeEquipe.mutate(e.id)}>
                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* ===== EQUIPAMENTOS ===== */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Wrench className="h-5 w-5 text-orange-600" />
                Equipamentos
                {custoEquipamentos > 0 && <Badge variant="secondary" className="ml-auto">{formatCurrency(custoEquipamentos)}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs text-muted-foreground mb-1 block">Equipamento *</label>
                  <Select value={equipRecursoId} onValueChange={v => handleSelectRecurso("equipamento", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {recursosEquipamento.map(r => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.nome}
                          {r.unidade === "dia" ? " [diária]" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[80px]">
                  <label className="text-xs text-muted-foreground mb-1 block">Horas</label>
                  <Input type="number" value={equipHoras} onChange={e => setEquipHoras(e.target.value)} />
                </div>
                <div className="w-[120px]">
                  <label className="text-xs text-muted-foreground mb-1 block">
                    {equipRecursoId && recursos.find(r => r.id === equipRecursoId)?.unidade === "dia" ? "R$/diária" : "R$/hora"}
                  </label>
                  <Input type="number" value={equipCustoHora} onChange={e => setEquipCustoHora(e.target.value)} placeholder="0" />
                </div>
                <div className="w-[120px]">
                  <label className="text-xs text-muted-foreground mb-1 block">Custo</label>
                  <Input
                    readOnly
                    value={equipCustoHora ? (() => {
                      const recurso = recursos.find(r => r.id === equipRecursoId);
                      const custoUnit = Number(equipCustoHora);
                      if (recurso?.unidade === "dia") return formatCurrency(custoUnit);
                      return formatCurrency(Number(equipHoras) * custoUnit);
                    })() : "—"}
                    className="bg-muted"
                  />
                </div>
                <Button onClick={handleAddEquipamento} size="sm" disabled={!equipRecursoId || !equipCustoHora}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar
                </Button>
              </div>
              {equipamentos.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Horas</TableHead>
                      <TableHead className="text-right">Custo Unit.</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {equipamentos.map(eq => {
                      const unidadeLabel = getUnidadeLabel(eq.descricao, "equipamento");
                      const isEditing = editingEquipId === eq.id;
                      return (
                        <TableRow key={eq.id}>
                          <TableCell className="font-medium">{eq.descricao}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {isEditing ? (
                              <Input type="number" value={editEquipHoras} onChange={ev => setEditEquipHoras(ev.target.value)} className="w-[70px] ml-auto h-8 text-right" />
                            ) : (
                              <span>{Number(eq.horas)} <span className="text-xs text-muted-foreground">({unidadeLabel})</span></span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {isEditing ? (
                              <Input type="number" value={editEquipCustoHora} onChange={ev => setEditEquipCustoHora(ev.target.value)} className="w-[90px] ml-auto h-8 text-right" />
                            ) : (
                              formatCurrency(Number(eq.custo_hora))
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">{formatCurrency(Number(eq.custo_total))}</TableCell>
                          <TableCell>
                            <div className="flex gap-1 justify-end">
                              {isEditing ? (
                                <>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={saveEditEquip}>
                                    <Check className="h-4 w-4 text-emerald-600" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingEquipId(null)}>
                                    <X className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditEquip(eq)}>
                                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeEquipamento.mutate(eq.id)}>
                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* ===== VEÍCULOS ===== */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Truck className="h-5 w-5 text-violet-600" />
                Veículos
                {custoVeiculos > 0 && <Badge variant="secondary" className="ml-auto">{formatCurrency(custoVeiculos)}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[150px]">
                  <label className="text-xs text-muted-foreground mb-1 block">Veículo *</label>
                  <Select value={veicRecursoId} onValueChange={v => handleSelectRecurso("veiculo", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {recursosVeiculo.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.nome}{r.placa ? ` (${r.placa})` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[100px]">
                  <label className="text-xs text-muted-foreground mb-1 block">KM Inicial</label>
                  <Input type="number" value={veicKmInicial} onChange={e => setVeicKmInicial(e.target.value)} placeholder="0" />
                </div>
                <div className="w-[100px]">
                  <label className="text-xs text-muted-foreground mb-1 block">KM Final</label>
                  <Input type="number" value={veicKmFinal} onChange={e => setVeicKmFinal(e.target.value)} placeholder="0" />
                </div>
                <div className="w-[100px]">
                  <label className="text-xs text-muted-foreground mb-1 block">KM Rodados</label>
                  <Input 
                    readOnly 
                    value={veicKmInicial && veicKmFinal ? Math.max(0, Number(veicKmFinal) - Number(veicKmInicial)) : "—"} 
                    className="bg-muted" 
                  />
                </div>
                <div className="w-[120px]">
                  <label className="text-xs text-muted-foreground mb-1 block">Custo diária</label>
                  <Input type="number" value={veicCusto} onChange={e => setVeicCusto(e.target.value)} placeholder="0" />
                </div>
                <Button onClick={handleAddVeiculo} size="sm" disabled={!veicRecursoId || !veicCusto}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar
                </Button>
              </div>
              {veiculos.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Placa</TableHead>
                      <TableHead className="text-right">KM Inicial</TableHead>
                      <TableHead className="text-right">KM Final</TableHead>
                      <TableHead className="text-right">KM Rodados</TableHead>
                      <TableHead className="text-right">Custo Diária</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {veiculos.map(v => {
                      const isEditing = editingVeicId === v.id;
                      const kmIni = isEditing ? Number(editVeicKmInicial) : Number((v as any).km_inicial || 0);
                      const kmFim = isEditing ? Number(editVeicKmFinal) : Number((v as any).km_final || 0);
                      const kmCalc = Math.max(0, kmFim - kmIni);
                      return (
                        <TableRow key={v.id}>
                          <TableCell className="font-medium">{v.descricao}</TableCell>
                          <TableCell>{v.placa || "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {isEditing ? (
                              <Input type="number" value={editVeicKmInicial} onChange={ev => setEditVeicKmInicial(ev.target.value)} className="w-[80px] ml-auto h-8 text-right" />
                            ) : (
                              kmIni
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {isEditing ? (
                              <Input type="number" value={editVeicKmFinal} onChange={ev => setEditVeicKmFinal(ev.target.value)} className="w-[80px] ml-auto h-8 text-right" />
                            ) : (
                              kmFim
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">{kmCalc}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {isEditing ? (
                              <Input type="number" value={editVeicCusto} onChange={ev => setEditVeicCusto(ev.target.value)} className="w-[90px] ml-auto h-8 text-right" />
                            ) : (
                              formatCurrency(Number(v.custo_diaria))
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 justify-end">
                              {isEditing ? (
                                <>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={saveEditVeic}>
                                    <Check className="h-4 w-4 text-emerald-600" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingVeicId(null)}>
                                    <X className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditVeic(v)}>
                                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeVeiculo.mutate(v.id)}>
                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* ===== FOTOS GERAIS - GRUPOS PERSONALIZÁVEIS ===== */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Camera className="h-5 w-5 text-pink-600" />
                <CardTitle className="text-base">Fotos</CardTitle>
                <Badge variant="secondary" className="ml-1">
                  {fotos.filter(f => !f.diario_producao_id).length}
                </Badge>
                <div className="ml-auto flex items-center gap-2">
                  <Input
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && newGroupName.trim()) {
                        const name = newGroupName.trim();
                        if (!photoGroups.includes(name)) setPhotoGroups(prev => [...prev, name]);
                        setNewGroupName("");
                      }
                    }}
                    placeholder="Nome do grupo..."
                    className="h-8 w-[160px] text-xs"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    disabled={!newGroupName.trim()}
                    onClick={() => {
                      const name = newGroupName.trim();
                      if (name && !photoGroups.includes(name)) setPhotoGroups(prev => [...prev, name]);
                      setNewGroupName("");
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Novo Grupo
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {photoGroups.map(groupName => {
                const groupFotos = fotos.filter(
                  f => !f.diario_producao_id && 
                  (f.classificacao?.toLowerCase() === groupName.toLowerCase())
                );
                const inputRef = (el: HTMLInputElement | null) => {
                  photoGroupUploadRefs.current[groupName] = el;
                };

                const onDragOver = (e: React.DragEvent) => {
                  e.preventDefault();
                  e.currentTarget.classList.add("bg-emerald-50/50", "ring-2", "ring-emerald-500");
                };

                const onDragLeave = (e: React.DragEvent) => {
                  e.currentTarget.classList.remove("bg-emerald-50/50", "ring-2", "ring-emerald-500");
                };

                const onDrop = async (e: React.DragEvent) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("bg-emerald-50/50", "ring-2", "ring-emerald-500");
                  
                   const fotoId = e.dataTransfer.getData("fotoId");
                  const sourceGroup = e.dataTransfer.getData("sourceGroup");
                  
                  if (!fotoId) return;
                  if (sourceGroup === groupName) return;

                  try {
                    await atualizarFoto.mutateAsync({
                      id: fotoId,
                      classificacao: groupName,
                      diario_producao_id: null
                    });
                    toast({ title: "Foto movida para " + groupName });
                  } catch (err: any) {
                    toast({ title: "Erro ao mover foto", description: err.message, variant: "destructive" });
                  }
                };

                return (
                  <div 
                    key={groupName} 
                    className="space-y-2 p-3 rounded-lg border-2 border-transparent transition-all"
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                  >
                    {/* Group header */}
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="text-sm font-semibold">{groupName}</span>
                      <Badge variant="secondary" className="text-[10px]">{groupFotos.length}</Badge>
                      <div className="ml-auto flex items-center gap-2">
                        {/* Upload for this group */}
                        <input
                          ref={inputRef}
                          type="file"
                          accept={ACCEPTED_FILE_TYPES}
                          multiple
                          className="hidden"
                          onChange={e => handleUploadFoto(e, groupName)}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => photoGroupUploadRefs.current[groupName]?.click()}
                        >
                          <Upload className="h-3.5 w-3.5 mr-1" /> Enviar Fotos
                        </Button>
                        {/* Remove group only if empty */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          disabled={groupFotos.length > 0}
                          title={groupFotos.length > 0 ? "Remova as fotos antes de excluir o grupo" : "Remover grupo"}
                          onClick={() => setPhotoGroups(prev => prev.filter(g => g !== groupName))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {/* Photo grid for group */}
                    {groupFotos.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {groupFotos.map(f => (
                          <div 
                            key={f.id} 
                            draggable 
                            onDragStart={(e) => {
                              e.dataTransfer.setData("fotoId", f.id);
                              e.dataTransfer.setData("sourceGroup", groupName);
                              e.dataTransfer.effectAllowed = "move";
                            }}
                             className="relative group rounded-lg overflow-hidden border cursor-move hover:ring-2 hover:ring-primary/50 transition-all bg-card"
                          >
                            <Dialog>
                              <DialogTrigger asChild>
                                <button className="w-full h-32 text-left focus:outline-none focus:ring-2 focus:ring-primary rounded-md overflow-hidden">
                                  {isFileImage(f.url) ? (
                                      <ResponsiveImage 
                                        src={f.url} 
                                        thumb300={f.thumb_url}
                                        thumb600={f.thumb_600_url}
                                        alt={f.legenda || "foto"} 
                                        className="w-full h-full object-cover" 
                                      />
                                  ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-muted text-sm font-medium gap-1">
                                      <span className="text-2xl">{getFileIcon(f.url)?.split(' ')[0] || '📎'}</span>
                                      <span className="text-xs text-muted-foreground">{getFileIcon(f.url)?.split(' ')[1] || 'Arquivo'}</span>
                                    </div>
                                  )}
                                </button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black border-none">
                                <div className="flex flex-col items-center justify-center h-full max-h-[90vh]">
                                  {isFileImage(f.url) ? (
                                    <img 
                                      src={f.url} 
                                      alt={f.legenda || "Visualização ampliada"} 
                                      className="max-w-full max-h-full object-contain"
                                    />
                                  ) : (
                                    <div className="p-20 text-white text-center space-y-4">
                                      <div className="text-6xl">{getFileIcon(f.url)?.split(' ')[0] || '📎'}</div>
                                      <p className="text-xl">{f.legenda || "Arquivo de documento"}</p>
                                      <Button asChild variant="secondary">
                                        <a href={f.url} target="_blank" rel="noopener noreferrer">Baixar Arquivo</a>
                                      </Button>
                                    </div>
                                  )}
                                  {f.legenda && (
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-4 text-center">
                                      {f.legenda}
                                    </div>
                                  )}
                                </div>
                              </DialogContent>
                            </Dialog>
                            
                            {/* Group badge */}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 pointer-events-none z-10">
                              <span className="inline-block rounded-full bg-emerald-600 text-white text-[10px] font-semibold px-2 py-0.5 truncate max-w-full">
                                {groupName}
                              </span>
                            </div>
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => removeFoto.mutate(f.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    {groupFotos.length === 0 && (
                      <div className="rounded-md border-2 border-dashed border-border/50 py-5 flex flex-col items-center gap-1 text-muted-foreground">
                        <Camera className="h-6 w-6 opacity-30" />
                        <p className="text-xs">Nenhuma foto neste grupo ainda.</p>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Fotos sem grupo (classificacao = "execucao" antigo ou null) */}
              {(() => {
                const semGrupo = fotos.filter(
                  f => !f.diario_producao_id && 
                  !photoGroups.some(gn => gn.toLowerCase() === f.classificacao?.toLowerCase())
                );
                if (semGrupo.length === 0) return null;
                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-semibold text-muted-foreground">Outras Fotos</span>
                      <Badge variant="secondary" className="text-[10px]">{semGrupo.length}</Badge>
                    </div>
                    <div 
                      className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-lg border-2 border-transparent transition-all"
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.add("bg-muted/50", "ring-2", "ring-muted-foreground/30");
                      }}
                      onDragLeave={(e) => {
                        e.currentTarget.classList.remove("bg-muted/50", "ring-2", "ring-muted-foreground/30");
                      }}
                      onDrop={async (e) => {
                        e.preventDefault();
                        e.currentTarget.classList.remove("bg-muted/50", "ring-2", "ring-muted-foreground/30");
                        
                         const fotoId = e.dataTransfer.getData("fotoId");
                        const sourceGroup = e.dataTransfer.getData("sourceGroup");
                        
                        if (!fotoId) return;
                        if (sourceGroup === "outras") return;

                        try {
                          await atualizarFoto.mutateAsync({
                            id: fotoId,
                            classificacao: "execucao", // Volta para o padrão
                            diario_producao_id: null
                          });
                          toast({ title: "Foto movida para Geral" });
                        } catch (err: any) {
                          toast({ title: "Erro ao mover foto", description: err.message, variant: "destructive" });
                        }
                      }}
                    >
                      {semGrupo.map(f => (
                        <div 
                          key={f.id} 
                          draggable
                          onDragStart={(e) => {
                             e.dataTransfer.setData("fotoId", f.id);
                             e.dataTransfer.setData("sourceGroup", "outras");
                             e.dataTransfer.effectAllowed = "move";
                          }}
                           className="relative group rounded-lg overflow-hidden border cursor-move hover:ring-2 hover:ring-primary/50 transition-all bg-card"
                        >
                          <Dialog>
                            <DialogTrigger asChild>
                              <button className="w-full h-32 text-left focus:outline-none focus:ring-2 focus:ring-primary rounded-md overflow-hidden">
                                {isFileImage(f.url) ? (
                                <ResponsiveImage 
                                  src={f.url} 
                                  thumb300={f.thumb_url}
                                  thumb600={f.thumb_600_url}
                                  alt={f.legenda || "foto"} 
                                  className="w-full h-full object-cover" 
                                />
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center bg-muted text-sm font-medium gap-1">
                                    <span className="text-2xl">{getFileIcon(f.url)?.split(' ')[0] || '📎'}</span>
                                    <span className="text-xs text-muted-foreground">{getFileIcon(f.url)?.split(' ')[1] || 'Arquivo'}</span>
                                  </div>
                                )}
                              </button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black border-none">
                              <div className="flex flex-col items-center justify-center h-full max-h-[90vh]">
                                {isFileImage(f.url) ? (
                                  <img 
                                    src={f.url} 
                                    alt={f.legenda || "Visualização ampliada"} 
                                    className="max-w-full max-h-full object-contain"
                                  />
                                ) : (
                                  <div className="p-20 text-white text-center space-y-4">
                                    <div className="text-6xl">{getFileIcon(f.url)?.split(' ')[0] || '📎'}</div>
                                    <p className="text-xl">{f.legenda || "Arquivo de documento"}</p>
                                    <Button asChild variant="secondary">
                                      <a href={f.url} target="_blank" rel="noopener noreferrer">Baixar Arquivo</a>
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 pointer-events-none">
                            <span className="inline-block rounded-full bg-gray-600 text-white text-[10px] font-semibold px-2 py-0.5 truncate max-w-full">
                              {f.classificacao || "geral"}
                            </span>
                          </div>
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removeFoto.mutate(f.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* ===== OBSERVAÇÕES ===== */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Observações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={obs}
                onChange={e => setObs(e.target.value)}
                placeholder="Anotações sobre o dia de trabalho..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                As observações são salvas junto com o diário ao clicar em <strong>Salvar</strong> no topo da página.
              </p>
            </CardContent>
          </Card>
            </div>
          </TabsContent>
      </Tabs>
    </div>
  );
}
