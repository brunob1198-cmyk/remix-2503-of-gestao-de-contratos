import { useState, useCallback, useEffect, useRef } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useQueryClient } from "@tanstack/react-query";
import { useProjetos } from "@/hooks/useProjetos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDiarioObra } from "@/hooks/useDiarioObra";
import { useDiarioCalendario } from "@/hooks/useDiarioCalendario";
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
  CalendarDays, ClipboardEdit, AlertTriangle,
} from "lucide-react";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { UfMunicipioSelector } from "@/components/medicoes/UfMunicipioSelector";

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function DiarioObraPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { projetos } = useProjetos();
  const [selectedProjetoId, setSelectedProjetoId] = usePersistedState<string>("diario_obra_projeto_id", "");
  const { sites } = useSites(selectedProjetoId || undefined);
  const { recursos, getCustoAtual, getAlocacoesBySite } = useRecursos();
  const [activeTab, setActiveTab] = useState<string>("calendario");
  const [selectedSiteId, setSelectedSiteId] = usePersistedState<string>("diario_obra_site_id", "");
  const [selectedDate, setSelectedDate] = usePersistedState<string>("diario_obra_date", format(new Date(), "yyyy-MM-dd"));
  const [periodoInicio, setPeriodoInicio] = useState(() => format(subMonths(new Date(), 2), "yyyy-MM-dd"));
  const [periodoFim, setPeriodoFim] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [diarioUf, setDiarioUf] = usePersistedState<string>("diario_obra_uf", "");
  const [diarioMunicipio, setDiarioMunicipio] = usePersistedState<string>("diario_obra_municipio", "");

  // Reset site when projeto changes
  const handleProjetoChange = (projetoId: string) => {
    setSelectedProjetoId(projetoId);
    setSelectedSiteId("");
  };

  const selectedSite = sites.find(s => s.id === selectedSiteId);
  const { itensLpu } = useItensLpu(selectedSite?.projeto_id);
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
    producoes, addProducao, removeProducao,
    equipe, isLoadingEquipe, addEquipe, updateEquipe, removeEquipe,
    equipamentos, isLoadingEquipamentos, addEquipamento, updateEquipamento, removeEquipamento,
    veiculos, isLoadingVeiculos, addVeiculo, updateVeiculo, removeVeiculo,
    fotos, addFoto, removeFoto,
    totalProducao, custoTotal, margem,
    custoEquipe, custoEquipamentos, custoVeiculos,
    duplicarDiarioAnterior,
  } = useDiarioObra(selectedSiteId, selectedDate);

  const { data: calendarEntries = [] } = useDiarioCalendario(selectedSiteId, periodoInicio, periodoFim);

  // Build previsoes map (daily production targets from planejamento)
  const previsoes: Record<string, number> = {};

  // Sync uf/municipio from diario when loaded
  useEffect(() => {
    if (diario) {
      const d = diario as any;
      if (d.uf) setDiarioUf(d.uf);
      if (d.municipio) setDiarioMunicipio(d.municipio);
    }
  }, [diario]);

  const handleCalendarDayClick = (dateStr: string) => {
    setSelectedDate(dateStr);
    setActiveTab("lancamento");
  };

  const handleClimaChange = async (clima: string) => {
    const diarioId = diario?.id || (await ensureDiario());
    await atualizarClima.mutateAsync({ id: diarioId, clima });
    toast({ title: "Clima atualizado!" });
  };

  const handleUfChange = async (uf: string) => {
    setDiarioUf(uf);
    setDiarioMunicipio("");
    if (diario?.id) {
      await atualizarLocalizacao.mutateAsync({ id: diario.id, uf, municipio: "" });
    }
  };

  const handleMunicipioChange = async (municipio: string) => {
    setDiarioMunicipio(municipio);
    if (diario?.id) {
      await atualizarLocalizacao.mutateAsync({ id: diario.id, uf: diarioUf, municipio });
    }
  };

  // Production form state
  const [prodItemId, setProdItemId] = useState("");
  const [prodQtd, setProdQtd] = useState("");

  // Equipe form state
  const [eqRecursoId, setEqRecursoId] = useState("");
  const [eqHoras, setEqHoras] = useState("8");
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

  // Filtered resources
  const recursosPessoa = recursos.filter(r => r.tipo === "pessoa" && r.ativo);
  const recursosEquipamento = recursos.filter(r => r.tipo === "equipamento" && r.ativo);
  const recursosVeiculo = recursos.filter(r => r.tipo === "veiculo" && r.ativo);

  // Auto-populate allocated resources only for diaries created in the current session
  const alocacoesDoSite = selectedSiteId ? getAlocacoesBySite(selectedSiteId) : [];
  const autoPopulatedDiarios = useRef<Set<string>>(new Set());
  const autoPopulateEligibleDiarios = useRef<Set<string>>(new Set());

  // Observações
  const [obs, setObs] = useState("");

  const ensureDiario = useCallback(async () => {
    if (diario) return diario.id;
    try {
      const result = await criarDiario.mutateAsync({ site_id: selectedSiteId, data: selectedDate, uf: diarioUf || undefined, municipio: diarioMunicipio || undefined });
      autoPopulateEligibleDiarios.current.add(result.id);
      return result.id;
    } catch {
      return null;
    }
  }, [diario, criarDiario, selectedSiteId, selectedDate, diarioUf, diarioMunicipio]);

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
    if (pendingProdFiles.length === 0) {
      toast({ title: "Foto obrigatória", description: "Adicione pelo menos uma foto/arquivo antes de salvar o item de produção.", variant: "destructive" });
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
    for (let i = 0; i < pendingProdFiles.length; i++) {
      const file = pendingProdFiles[i];
      const path = `${diarioId}/${Date.now()}_${i}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("diario-fotos").upload(path, file);
      if (uploadError) {
        toast({ title: "Erro no upload", description: `${file.name}: ${uploadError.message}`, variant: "destructive" });
        continue;
      }
      const { data: urlData } = supabase.storage.from("diario-fotos").getPublicUrl(path);
      await addFoto.mutateAsync({
        diario_id: diarioId,
        url: urlData.publicUrl,
        classificacao: "execucao",
        diario_producao_id: prodData.id,
      });
    }
    setProdItemId("");
    setProdQtd("");
    setPendingProdFiles([]);
    // Invalidate queries to refresh data
    queryClient.invalidateQueries({ queryKey: ["diario_producao"] });
    queryClient.invalidateQueries({ queryKey: ["diario_calendario"] });
    toast({ title: "Produção adicionada com fotos!" });
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
    await addEquipe.mutateAsync({
      diario_id: diarioId,
      nome: recurso.nome,
      funcao: recurso.cargo || undefined,
      horas,
      custo_hora,
      custo_total,
    });
    setEqRecursoId(""); setEqHoras("8"); setEqCustoHora("");
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
    if (!veicRecursoId || !veicPlaca || !veicCusto) return;
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
    await addVeiculo.mutateAsync({
      diario_id: diarioId,
      descricao: recurso.nome,
      placa: veicPlaca,
      km_inicial: kmInicial,
      km_final: kmFinal,
      km_rodados: kmRodados,
      custo_diaria: Number(veicCusto),
    });
    setVeicRecursoId(""); setVeicPlaca(""); setVeicKmInicial(""); setVeicKmFinal(""); setVeicCusto("");
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

  const ACCEPTED_FILE_TYPES = "image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx";

  const handleUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>, classificacao: string, diarioProducaoId?: string) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const diarioId = await ensureDiario();
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const path = `${diarioId}/${Date.now()}_${i}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("diario-fotos").upload(path, file);
      if (uploadError) {
        toast({ title: "Erro no upload", description: `${file.name}: ${uploadError.message}`, variant: "destructive" });
        continue;
      }
      const { data: urlData } = supabase.storage.from("diario-fotos").getPublicUrl(path);
      await addFoto.mutateAsync({ 
        diario_id: diarioId, 
        url: urlData.publicUrl, 
        classificacao,
        ...(diarioProducaoId ? { diario_producao_id: diarioProducaoId } : {}),
      });
    }
    toast({ title: `${files.length} arquivo(s) enviado(s)!` });
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
    if (!diario) return;
    await atualizarObservacoes.mutateAsync({ id: diario.id, observacoes: obs });
    toast({ title: "Observações salvas!" });
  };

  const handleDuplicateAnterior = async () => {
    if (!selectedSiteId || !selectedDate) return;
    
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
          <div className="flex items-center gap-2 min-w-[250px]">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedProjetoId} onValueChange={handleProjetoChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o projeto" />
              </SelectTrigger>
              <SelectContent>
                {projetos.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.codigo} — {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 min-w-[250px]">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedSiteId} onValueChange={setSelectedSiteId} disabled={!selectedProjetoId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={selectedProjetoId ? "Selecione o site" : "Selecione um projeto primeiro"} />
              </SelectTrigger>
              <SelectContent>
                {sites.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.codigo} — {s.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="calendario" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Calendário
          </TabsTrigger>
          {selectedSiteId && (
            <TabsTrigger value="lancamento" className="flex items-center gap-2">
              <ClipboardEdit className="h-4 w-4" />
              Lançamento — {format(new Date(selectedDate + "T12:00:00"), "dd/MM/yyyy")}
            </TabsTrigger>
          )}
        </TabsList>

        {/* ===== CALENDAR VIEW ===== */}
        <TabsContent value="calendario">
            <DiarioCalendario
              entries={calendarEntries}
              onDayClick={selectedSiteId ? handleCalendarDayClick : undefined}
              periodoInicio={periodoInicio}
              periodoFim={periodoFim}
              onPeriodoChange={(ini, fim) => {
                setPeriodoInicio(ini);
                setPeriodoFim(fim);
              }}
            />
        </TabsContent>

      {selectedSiteId && (
          <TabsContent value="lancamento">
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
                      value={(diario as any)?.clima || ""}
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
                  <Select value={prodItemId} onValueChange={setProdItemId}>
                    <SelectTrigger><SelectValue placeholder="Selecione item" /></SelectTrigger>
                    <SelectContent>
                      {itensDisponiveis.map(i => (
                        <SelectItem key={i.id || i.item_lpu_id} value={i.item_lpu_id || ""}>
                          {i.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                      ? formatCurrency(Number(prodQtd) * Number(itensEscopo.find(i => i.item_lpu_id === prodItemId)?.valor_unitario || 0))
                      : "—"}
                    className="bg-muted"
                  />
                </div>
                <Button onClick={handleAddProducao} size="sm" disabled={!prodItemId || !prodQtd || pendingProdFiles.length === 0}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar
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
                    Anexar Fotos/Arquivos *
                  </label>
                  {pendingProdFiles.length === 0 && (
                    <span className="text-xs text-destructive">Obrigatório: adicione pelo menos 1 foto/arquivo</span>
                  )}
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
                        return (
                          <TableRow key={p.id} className="align-top">
                            <TableCell className="font-medium text-xs">{p.item_lpu?.codigo} — {p.item_lpu?.descricao}</TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {previsoes[p.item_lpu_id] ? previsoes[p.item_lpu_id] : "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              <div className="flex items-center justify-end gap-1">
                                <span className={previsoes[p.item_lpu_id] && Number(p.quantidade) < previsoes[p.item_lpu_id] ? "text-red-600 font-bold" : "text-emerald-600 font-bold"}>
                                  {Number(p.quantidade)}
                                </span>
                                {previsoes[p.item_lpu_id] && Number(p.quantidade) < previsoes[p.item_lpu_id] && (
                                  <AlertTriangle className="h-3 w-3 text-red-500" />
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{formatCurrency(Number(p.preco_unitario_congelado))}</TableCell>
                            <TableCell className="text-right tabular-nums font-medium">{formatCurrency(Number(p.valor_total))}</TableCell>
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
                                      <div key={f.id} className="relative group w-14 h-14 rounded overflow-hidden border">
                                        {isFileImage(f.url) ? (
                                          <img src={f.url} alt={f.legenda || "foto"} className="w-full h-full object-cover" />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center bg-muted text-[9px] text-center font-medium p-1">
                                            {getFileIcon(f.url) || '📎'}
                                          </div>
                                        )}
                                        <Button
                                          variant="destructive"
                                          size="icon"
                                          className="absolute top-0 right-0 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
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
                              <Button variant="ghost" size="icon" onClick={() => removeProducao.mutate(p.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
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
                      <TableHead className="text-right">Custo Unit.</TableHead>
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
                          <TableCell className="text-right tabular-nums">
                            {isEditing ? (
                              <Input type="number" value={editEquipeCustoHora} onChange={ev => setEditEquipeCustoHora(ev.target.value)} className="w-[90px] ml-auto h-8 text-right" />
                            ) : (
                              formatCurrency(Number(e.custo_hora))
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
                  <label className="text-xs text-muted-foreground mb-1 block">Placa *</label>
                  <Input value={veicPlaca} onChange={e => setVeicPlaca(e.target.value)} placeholder="ABC-1234" required />
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
                <Button onClick={handleAddVeiculo} size="sm" disabled={!veicRecursoId || !veicPlaca || !veicCusto}>
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

          {/* ===== FOTOS GERAIS ===== */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Camera className="h-5 w-5 text-pink-600" />
                Fotos Gerais (sem item específico)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                {["antes", "execucao", "problema"].map(cls => (
                  <div key={cls}>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept={ACCEPTED_FILE_TYPES}
                        multiple
                        className="hidden"
                        onChange={e => handleUploadFoto(e, cls)}
                      />
                      <div className="flex items-center gap-2 border rounded-md px-3 py-2 hover:bg-accent transition-colors">
                        <Upload className="h-4 w-4" />
                        <span className="text-sm capitalize">{cls === "execucao" ? "Execução" : cls === "antes" ? "Antes" : "Problema"}</span>
                      </div>
                    </label>
                  </div>
                ))}
              </div>

              {(() => {
                const fotosGerais = fotos.filter(f => !f.diario_producao_id);
                return fotosGerais.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {fotosGerais.map(f => (
                      <div key={f.id} className="relative group rounded-lg overflow-hidden border">
                        {isFileImage(f.url) ? (
                          <img src={f.url} alt={f.legenda || f.classificacao} className="w-full h-32 object-cover" />
                        ) : (
                          <div className="w-full h-32 flex flex-col items-center justify-center bg-muted text-sm font-medium gap-1">
                            <span className="text-2xl">{getFileIcon(f.url)?.split(' ')[0] || '📎'}</span>
                            <span className="text-xs text-muted-foreground">{getFileIcon(f.url)?.split(' ')[1] || 'Arquivo'}</span>
                          </div>
                        )}
                        <div className="absolute top-1 left-1">
                          <Badge variant="secondary" className="text-[10px] capitalize">
                            {f.classificacao === "execucao" ? "Execução" : f.classificacao === "antes" ? "Antes" : "Problema"}
                          </Badge>
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
                ) : null;
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
                value={obs || diario?.observacoes || ""}
                onChange={e => setObs(e.target.value)}
                placeholder="Anotações sobre o dia de trabalho..."
                rows={4}
              />
              <Button onClick={handleSaveObs} size="sm" disabled={!diario}>
                Salvar observações
              </Button>
            </CardContent>
          </Card>
            </div>
          </TabsContent>
      )}
      </Tabs>
    </div>
  );
}
