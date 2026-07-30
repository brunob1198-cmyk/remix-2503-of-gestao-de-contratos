import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useGruposFotosSite } from "@/hooks/useGruposFotosSite";
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
import { SmartImage } from "@/components/ui/SmartImage";
import ProducaoSection from "@/components/diario/ProducaoSection";
import EquipeSection from "@/components/diario/EquipeSection";
import FotosSection from "@/components/diario/FotosSection";

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

import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnotacoesCampoDialog } from "@/components/medicoes/AnotacoesCampoDialog";
import { CriarSiteDialog } from "@/components/medicoes/CriarSiteDialog";
import { TransferirApontamentoButton } from "@/components/medicoes/TransferirApontamentoButton";
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
  CalendarDays, ClipboardEdit, AlertTriangle, ChevronDown, ChevronUp, FileText, Tag, Loader2, MessageSquare, Play
} from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { format, subMonths } from "date-fns";
import { UfMunicipioSelector } from "@/components/medicoes/UfMunicipioSelector";
import * as XLSX from "xlsx";
import { uploadImageWithVariants } from "@/services/uploadImage";
// resolveFileUrl removido pois agora usamos SmartImage diretamente


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
  const [diarioStatusAtivo, setDiarioStatusAtivo] = useState("");
  const [headerSaved, setHeaderSaved] = useState(false);
  const [photoView, setPhotoView] = useState<any>(null);

  const [localPhotoGroups, setPhotoGroups] = usePersistedState<string[]>(
    `diario_photo_groups_${selectedSiteId || "default"}`,
    ["Execução", "Vistoria"]
  );
  // Grupos criados por outros usuários (persistidos no banco) + grupos locais
  const gruposCompartilhados = useGruposFotosSite(selectedSiteId || undefined);
  const photoGroups = useMemo(() => {
    const seen = new Map<string, string>();
    [...localPhotoGroups, ...gruposCompartilhados].forEach(g => {
      const key = g.trim().toLowerCase();
      if (key && !seen.has(key)) seen.set(key, g.trim());
    });
    return Array.from(seen.values());
  }, [localPhotoGroups, gruposCompartilhados]);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);

  const handleProjetoChange = (projetoId: string) => {
    setSelectedProjetoId(projetoId);
    setSelectedSiteId("");
  };

  const selectedSite = sites.find(s => s.id === selectedSiteId);
  const projetoIdParaLancamento = selectedSite?.projeto_id || selectedProjetoId || undefined;
  const { itensLpu } = useItensLpu(projetoIdParaLancamento);
  const { itens: itensEscopo } = useEscopos(selectedSiteId);

  const hasEscopo = itensEscopo.length > 0;
  const itensDisponiveis = hasEscopo
    ? itensEscopo.map(i => {
        const itemLpu = i.item_lpu_id ? itensLpu.find(l => l.id === i.item_lpu_id) : null;
        return {
          id: i.item_lpu_id || i.id,
          item_lpu_id: i.item_lpu_id || "",
          nome: itemLpu ? `${itemLpu.codigo} — ${itemLpu.descricao}` : i.nome,
          valor_unitario: i.valor_unitario,
        };
      })
    : itensLpu.map(i => ({
        id: i.id,
        item_lpu_id: i.id,
        nome: `${i.codigo} — ${i.descricao}`,
        valor_unitario: i.preco_unitario,
      }));

  const {
    diario, loadingDiario, criarDiario, atualizarObservacoes, atualizarClima, atualizarStatusAtivo, atualizarLocalizacao,
    producoes, addProducao, removeProducao, updateProducao, moverProducao, moverDiario,
    equipe, isLoadingEquipe, addEquipe, updateEquipe, removeEquipe,
    equipamentos, isLoadingEquipamentos, addEquipamento, updateEquipamento, removeEquipamento,
    veiculos, isLoadingVeiculos, addVeiculo, updateVeiculo, removeVeiculo,
    fotos, addFoto, atualizarFoto, removeFoto, reordenarFotos,
    totalProducao, custoTotal, margem,
    custoEquipe, custoEquipamentos, custoVeiculos,
    duplicarDiarioAnterior,
    previsoes = {}
  } = useDiarioObra(selectedSiteId, selectedDate);

  const { atividades: atividadesCampo } = useDiarioCampoAtividades(selectedProjetoId, "", selectedDate);
  const { data: calendarEntries = [] } = useDiarioCalendario(selectedSiteId, "2000-01-01", "2099-12-31");

  const lastDiarioId = useRef<string | null>(null);
  const [obs, setObs] = useState("");

  useEffect(() => {
    // Adiciona atividadesCampo como dependência para carregar as observações quando os dados chegarem

    if (diario && diario.id !== lastDiarioId.current) {
      lastDiarioId.current = diario.id;
      const d = diario as any;
      if (d.uf) setDiarioUf(d.uf);
      if (d.municipio) setDiarioMunicipio(d.municipio);
      setDiarioClima(d.clima || "");
      setDiarioStatusAtivo(d.status_ativo || "");
      
      setObs(diario.observacoes || "");
      
      setHeaderSaved(false);
    } else if (!diario && lastDiarioId.current !== null) {
      lastDiarioId.current = null;
      setObs("");
      setDiarioClima("");
      setDiarioStatusAtivo("");
      setHeaderSaved(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diario?.id, atividadesCampo]);

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

  const handleSaveHeader = async () => {
    if (!selectedSiteId) {
      notifySiteRequired("salvar no Diário de Obra");
      return;
    }
    const diarioId = diario?.id || (await ensureDiario());
    if (!diarioId) return;

    await atualizarClima.mutateAsync({ id: diarioId, clima: diarioClima });
    await atualizarStatusAtivo.mutateAsync({ id: diarioId, status_ativo: diarioStatusAtivo });
    await atualizarLocalizacao.mutateAsync({ id: diarioId, uf: diarioUf, municipio: diarioMunicipio });
    await atualizarObservacoes.mutateAsync({ id: diarioId, observacoes: obs });
    setHeaderSaved(true);
    toast({ title: "Diário salvo com sucesso!" });
    setTimeout(() => setHeaderSaved(false), 3000);
  };

  const ensureDiario = useCallback(async () => {
    if (diario) return diario.id;
    if (!selectedSiteId) {
      notifySiteRequired("salvar no Diário de Obra");
      return null;
    }
    try {
      const result = await criarDiario.mutateAsync({ site_id: selectedSiteId, data: selectedDate, uf: diarioUf || undefined, municipio: diarioMunicipio || undefined });
      return result.id;
    } catch {
      return null;
    }
  }, [diario, criarDiario, selectedSiteId, selectedDate, diarioUf, diarioMunicipio, notifySiteRequired]);

  const [equipRecursoId, setEquipRecursoId] = useState("");
  const [equipHoras, setEquipHoras] = useState("8");
  const [equipCustoHora, setEquipCustoHora] = useState("");
  const [veicRecursoId, setVeicRecursoId] = useState("");
  const [veicKmInicial, setVeicKmInicial] = useState("");
  const [veicKmFinal, setVeicKmFinal] = useState("");
  const [veicCusto, setVeicCusto] = useState("");
  const [editingEquipId, setEditingEquipId] = useState<string | null>(null);
  const [editEquipHoras, setEditEquipHoras] = useState("");
  const [editEquipCustoHora, setEditEquipCustoHora] = useState("");
  const [editingVeicId, setEditingVeicId] = useState<string | null>(null);
  const [editVeicKmInicial, setEditVeicKmInicial] = useState("");
  const [editVeicKmFinal, setEditVeicKmFinal] = useState("");
  const [editVeicCusto, setEditVeicCusto] = useState("");

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

  const isRecursoDuplicado = (tipo: "pessoa" | "equipamento" | "veiculo", recursoNome: string): boolean => {
    if (tipo === "pessoa") return equipe.some(e => e.nome === recursoNome);
    if (tipo === "equipamento") return equipamentos.some(e => e.descricao === recursoNome);
    return veiculos.some(v => v.descricao === recursoNome);
  };

  const computeCost = (recurso: { unidade: string }, custoUnitario: number, horas: number) => {
    if (recurso.unidade === "dia") return { custo_hora: custoUnitario, custo_total: custoUnitario };
    return { custo_hora: custoUnitario, custo_total: horas * custoUnitario };
  };

  const handleAddProducao = useCallback(async (prodItemId: string, prodQtd: string, pendingProdFiles: File[]) => {
    if (!prodItemId || !prodQtd) return;
    if (!diarioUf || !diarioMunicipio) {
      toast({ title: "Localização obrigatória", description: "Selecione UF e Município antes de lançar produção.", variant: "destructive" });
      return;
    }
    const selectedItem = itensDisponiveis.find(i => i.item_lpu_id === prodItemId);
    if (!selectedItem) return;
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

    const totalFiles = pendingProdFiles.length;
    setUploadProgress({ current: 0, total: totalFiles });

    for (let i = 0; i < pendingProdFiles.length; i++) {
      const file = pendingProdFiles[i];
      try {
        const { thumbUrl, mediumUrl, originalUrl } = await uploadImageWithVariants(file);
        await addFoto.mutateAsync({
          diario_id: diarioId,
          url: originalUrl,
          thumb_url: thumbUrl,
          thumb_600_url: mediumUrl,
          classificacao: "execucao",
          diario_producao_id: prodData.id,
        });
        setUploadProgress(prev => prev ? { ...prev, current: prev.current + 1 } : null);
      } catch (err) {
        console.error(`Erro ao processar arquivo:`, err);
      }
    }
    setUploadProgress(null);
    queryClient.invalidateQueries({ queryKey: ["diario_producao"] });
    toast({ title: "Produção adicionada com fotos!" });
  }, [diarioUf, diarioMunicipio, itensDisponiveis, ensureDiario, toast, addFoto, queryClient]);

  const handleRemoveFoto = useCallback((id: string) => {
    removeFoto.mutate(id);
  }, [removeFoto]);

  const handleUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>, classificacao: string, diarioProducaoId?: string) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const diarioId = await ensureDiario();
    if (!diarioId) { e.target.value = ""; return; }
    const totalFiles = files.length;
    setUploadProgress({ current: 0, total: totalFiles });
    for (let i = 0; i < files.length; i++) {
      try {
        const { thumbUrl, mediumUrl, originalUrl } = await uploadImageWithVariants(files[i]);
        await addFoto.mutateAsync({ 
          diario_id: diarioId, 
          url: originalUrl, 
          thumb_url: thumbUrl,
          thumb_600_url: mediumUrl,
          classificacao,
          ...(diarioProducaoId ? { diario_producao_id: diarioProducaoId } : {}),
        });
        setUploadProgress(prev => prev ? { ...prev, current: prev.current + 1 } : null);
      } catch (err) { console.error(err); }
    }
    setUploadProgress(null);
    e.target.value = "";
  };

  const handleAddEquipe = useCallback(async (eqRecursoId: string, eqHorasStr: string, eqCustoHoraStr: string) => {
    if (!eqRecursoId || !eqCustoHoraStr) return;
    const recurso = recursos.find(r => r.id === eqRecursoId);
    if (!recurso) return;
    const horas = Number(eqHorasStr);
    const custoUnitario = Number(eqCustoHoraStr);
    const { custo_hora, custo_total } = computeCost(recurso, custoUnitario, horas);
    const diarioId = await ensureDiario();
    if (!diarioId) return;
    await addEquipe.mutateAsync({ diario_id: diarioId, nome: recurso.nome, funcao: recurso.cargo || undefined, horas, custo_hora, custo_total });
  }, [recursos, isRecursoDuplicado, toast, ensureDiario, addEquipe]);

  const handleAddEquipamento = async () => {
    if (!equipRecursoId || !equipCustoHora) return;
    const recurso = recursos.find(r => r.id === equipRecursoId);
    if (!recurso) return;
    const horas = Number(equipHoras);
    const custoUnitario = Number(equipCustoHora);
    const { custo_hora, custo_total } = computeCost(recurso, custoUnitario, horas);
    const diarioId = await ensureDiario();
    if (!diarioId) return;
    await addEquipamento.mutateAsync({ diario_id: diarioId, descricao: recurso.nome, horas, custo_hora, custo_total });
    setEquipRecursoId(""); setEquipHoras("8"); setEquipCustoHora("");
  };

  const handleAddVeiculo = async () => {
    if (!veicRecursoId || !veicCusto) return;
    const recurso = recursos.find(r => r.id === veicRecursoId);
    if (!recurso) return;
    const kmInicial = veicKmInicial ? Number(veicKmInicial) : 0;
    const kmFinal = veicKmFinal ? Number(veicKmFinal) : 0;
    const kmRodados = Math.max(0, kmFinal - kmInicial);
    const diarioId = await ensureDiario();
    if (!diarioId) return;
    await addVeiculo.mutateAsync({ diario_id: diarioId, descricao: recurso.nome, placa: recurso.placa || undefined, km_inicial: kmInicial, km_final: kmFinal, km_rodados: kmRodados, custo_diaria: Number(veicCusto) });
    setVeicRecursoId(""); setVeicKmInicial(""); setVeicKmFinal(""); setVeicCusto("");
  };

  const handleUpdateProducao = useCallback(async (id: string, editProducaoQtd: string) => {
    if (!editProducaoQtd) return;
    const qtd = Number(editProducaoQtd);
    const prod = producoes.find(p => p.id === id);
    if (!prod) return;
    const valor_total = qtd * (prod.preco_unitario_congelado || 0);
    await updateProducao.mutateAsync({ id, quantidade: qtd, valor_total });
  }, [producoes, updateProducao]);

  const handleUpdateEquipe = useCallback(async (id: string, editEquipeHoras: string, editEquipeCustoHora: string) => {
    const horas = Number(editEquipeHoras);
    const custo_hora = Number(editEquipeCustoHora);
    const e = equipe.find(x => x.id === id);
    if (!e) return;
    const recurso = recursos.find(r => r.nome === e.nome && r.tipo === 'pessoa');
    const { custo_total } = computeCost(recurso || { unidade: 'hora' }, custo_hora, horas);
    await updateEquipe.mutateAsync({ id, horas, custo_hora, custo_total });
  }, [equipe, recursos, updateEquipe]);

  const handleUpdateEquipamento = async (id: string) => {
    const horas = Number(editEquipHoras);
    const custo_hora = Number(editEquipCustoHora);
    const eq = equipamentos.find(x => x.id === id);
    if (!eq) return;
    const recurso = recursos.find(r => r.nome === eq.descricao && r.tipo === 'equipamento');
    const { custo_total } = computeCost(recurso || { unidade: 'hora' }, custo_hora, horas);
    await updateEquipamento.mutateAsync({ id, horas, custo_hora, custo_total });
    setEditingEquipId(null);
  };

  const handleUpdateVeiculo = async (id: string) => {
    const km_inicial = Number(editVeicKmInicial);
    const km_final = Number(editVeicKmFinal);
    const custo_diaria = Number(editVeicCusto);
    const km_rodados = Math.max(0, km_final - km_inicial);
    await updateVeiculo.mutateAsync({ id, km_inicial, km_final, km_rodados, custo_diaria });
    setEditingVeicId(null);
  };


  const getUnidadeLabel = (nome: string, tipo: "pessoa" | "equipamento") => {
    const recurso = recursos.find(r => r.nome === nome && r.tipo === tipo);
    return recurso?.unidade === "dia" ? "diária" : "hora";
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <HardHat className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight">Diário de Obra</h1>
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2 w-full sm:min-w-[280px] sm:flex-1 sm:max-w-md">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="truncate">{selectedProjetoId ? projetos.find(p => p.id === selectedProjetoId)?.nome : "Selecione o projeto"}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[400px] p-0">
                <Command>
                  <CommandInput placeholder="Pesquisar projeto..." />
                  <CommandList>
                    <CommandEmpty>Nenhum projeto encontrado.</CommandEmpty>
                    <CommandGroup>
                      {projetos.map(p => (
                        <CommandItem key={p.id} value={p.nome} onSelect={() => handleProjetoChange(p.id)}>
                          {p.codigo} — {p.nome}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-center gap-2 w-full sm:min-w-[280px] sm:flex-1 sm:max-w-md">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between" disabled={!selectedProjetoId}>
                  <span className="truncate">{selectedSiteId ? (
                    (() => {
                      const s = sites.find(s => s.id === selectedSiteId);
                      return s ? `${s.codigo} — ${s.nome}` : "Selecione o site";
                    })()
                  ) : "Selecione o site"}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[400px] p-0">
                <Command>
                  <CommandInput placeholder="Pesquisar site..." />
                  <CommandList>
                    <CommandEmpty>Nenhum site encontrado.</CommandEmpty>
                    <CommandGroup>
                      {sites.map(s => (
                        <CommandItem key={s.id} value={s.nome} onSelect={() => setSelectedSiteId(s.id)}>
                          {s.codigo} — {s.nome}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <CriarSiteDialog
            projetoId={selectedProjetoId}
            onSiteCreated={(siteId) => setSelectedSiteId(siteId)}
          />
        </div>
      </div>


      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="calendario">Calendário</TabsTrigger>
          <TabsTrigger value="lancamento">Lançamento</TabsTrigger>
        </TabsList>

        <TabsContent value="calendario">
          <DiarioCalendario entries={calendarEntries.map(e => ({ ...e, totalProducao: e.totalProducao, totalEquipe: e.totalEquipe }))} onDayClick={handleCalendarDayClick} periodoInicio={periodoInicio} periodoFim={periodoFim} onPeriodoChange={(ini, fim) => { setPeriodoInicio(ini); setPeriodoFim(fim); }} />
        </TabsContent>

        <TabsContent value="lancamento">
          <div className="space-y-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                  <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-full sm:w-[180px]" />
                  <Select value={diarioClima} onValueChange={setDiarioClima}>
                    <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="🌤️ Clima" /></SelectTrigger>
                    <SelectContent>
                      {CLIMA_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <UfMunicipioSelector uf={diarioUf} municipio={diarioMunicipio} onUfChange={setDiarioUf} onMunicipioChange={setDiarioMunicipio} />
                  
                  <div className="flex items-center gap-2">
                    <Button 
                      onClick={handleSaveHeader}
                      className={cn(headerSaved && "bg-green-600 hover:bg-green-700")}
                    >
                      {headerSaved ? (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Salvo
                        </>
                      ) : (
                        "Salvar"
                      )}
                    </Button>

                    {diario && (
                      <TransferirApontamentoButton
                        diarioId={diario.id}
                        currentDate={selectedDate}
                        currentProjetoId={projetoIdParaLancamento}
                        moverDiarioMutation={moverDiario}
                        onTransferredData={(novaData) => setSelectedDate(novaData)}
                        onTransferredProjeto={() => {
                          setSelectedSiteId("");
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>

              <div>
                <AnotacoesCampoDialog
                  atividadesCampo={atividadesCampo}
                  diarioObraId={diario?.id || null}
                  itensDisponiveis={itensDisponiveis}
                  producoes={producoes}
                  fotosObra={fotos}
                  onFotoTransferred={() => {
                    queryClient.invalidateQueries({ queryKey: ["diario_fotos"] });
                  }}
                  ensureDiario={ensureDiario}
                  selectedDate={selectedDate}
                  photoGroups={photoGroups}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Produção Total</p>
                      <p className="text-2xl font-bold text-green-600">{formatCurrency(totalProducao)}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Custo Total</p>
                      <p className="text-2xl font-bold text-red-600">{formatCurrency(custoTotal)}</p>
                    </div>
                    <TrendingDown className="h-8 w-8 text-red-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Resultado</p>
                      <p className={cn("text-2xl font-bold", margem >= 0 ? "text-green-600" : "text-red-600")}>
                        {formatCurrency(margem)}
                      </p>
                    </div>
                    <DollarSign className="h-8 w-8 text-primary opacity-50" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Margem %</p>
                      <p className={cn("text-2xl font-bold", margem >= 0 ? "text-green-600" : "text-red-600")}>
                        {totalProducao > 0 ? ((margem / totalProducao) * 100).toFixed(1) : "0"}%
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-primary opacity-50" />
                  </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-amber-100">
            <CardHeader className="pb-3 bg-amber-50/30">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Play className="h-4 w-4 text-amber-600" />
                Status do Ativo ao Fim do Acionamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mt-2">
                <Button 
                  variant={diarioStatusAtivo === "ON" ? "default" : "outline"} 
                  className={cn(
                    "flex-1 gap-2 h-12 text-base font-semibold transition-all",
                    diarioStatusAtivo === "ON" ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100" : "hover:border-emerald-200 hover:bg-emerald-50/50"
                  )}
                  onClick={() => setDiarioStatusAtivo("ON")}
                >
                  <div className={cn(
                    "w-3 h-3 rounded-full animate-pulse",
                    diarioStatusAtivo === "ON" ? "bg-white" : "bg-emerald-500"
                  )} />
                  STATUS ON
                </Button>
                <Button 
                  variant={diarioStatusAtivo === "OFF" ? "default" : "outline"} 
                  className={cn(
                    "flex-1 gap-2 h-12 text-base font-semibold transition-all",
                    diarioStatusAtivo === "OFF" ? "bg-rose-600 hover:bg-rose-700 shadow-rose-100" : "hover:border-rose-200 hover:bg-rose-50/50"
                  )}
                  onClick={() => setDiarioStatusAtivo("OFF")}
                >
                  <div className={cn(
                    "w-3 h-3 rounded-full",
                    diarioStatusAtivo === "OFF" ? "bg-white" : "bg-rose-500"
                  )} />
                  STATUS OFF
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-3 italic">
                * Informe se o equipamento foi deixado operando (ON) ou desligado (OFF).
              </p>
            </CardContent>
          </Card>
        </div>

            <ProducaoSection
              producoes={producoes}
              itensDisponiveis={itensDisponiveis}
              diarioId={diario?.id}
              onAdd={handleAddProducao}
              onRemove={(id) => removeProducao.mutate(id)}
              onUpdate={handleUpdateProducao}
              onUploadFoto={handleUploadFoto}
              onMover={(producaoId, novaData) => moverProducao.mutate({ producaoId, novaData })}
              selectedDate={selectedDate}
              fotos={fotos}
            />


            <EquipeSection
              equipe={equipe}
              recursosPessoa={recursosPessoa}
              recursos={recursos}
              getCustoAtual={getCustoAtual}
              onAdd={handleAddEquipe}
              onRemove={(id) => removeEquipe.mutate(id)}
              onUpdate={handleUpdateEquipe}
            />

            <Card>
              <CardHeader><CardTitle>Equipamentos</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Select value={equipRecursoId} onValueChange={v => { setEquipRecursoId(v); const r = recursos.find(x => x.id === v); setEquipCustoHora(r ? String(getCustoAtual(r.id)?.custo_unitario || 0) : ""); }}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione equipamento" /></SelectTrigger>
                    <SelectContent>
                      {recursosEquipamento.map(r => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input type="number" value={equipHoras} onChange={e => setEquipHoras(e.target.value)} placeholder="Horas" className="w-24" />
                  <Input type="number" value={equipCustoHora} onChange={e => setEquipCustoHora(e.target.value)} placeholder="Custo/h" className="w-24" />
                  <Button onClick={handleAddEquipamento}>Adicionar</Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Horas</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {equipamentos.map(eq => (
                      <TableRow key={eq.id}>
                        <TableCell>{eq.descricao}</TableCell>
                        <TableCell className="text-right">
                          {editingEquipId === eq.id ? (
                            <div className="flex flex-col gap-1 items-end">
                              <Input
                                type="number"
                                value={editEquipHoras}
                                onChange={ev => setEditEquipHoras(ev.target.value)}
                                className="w-20 h-8"
                                placeholder="Horas"
                              />
                              <Input
                                type="number"
                                value={editEquipCustoHora}
                                onChange={ev => setEditEquipCustoHora(ev.target.value)}
                                className="w-20 h-8 text-xs"
                                placeholder="Custo/h"
                              />
                            </div>
                          ) : (
                            eq.horas
                          )}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(eq.custo_total)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-end">
                            {editingEquipId === eq.id ? (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => handleUpdateEquipamento(eq.id)} className="h-8 w-8 text-green-600">
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => setEditingEquipId(null)} className="h-8 w-8 text-red-600">
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setEditingEquipId(eq.id);
                                    setEditEquipHoras(String(eq.horas));
                                    setEditEquipCustoHora(String(eq.custo_hora));
                                  }}
                                  className="h-8 w-8"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => removeEquipamento.mutate(eq.id)} className="h-8 w-8 text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Veículos</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Select value={veicRecursoId} onValueChange={v => { setVeicRecursoId(v); const r = recursos.find(x => x.id === v); setVeicCusto(r ? String(getCustoAtual(r.id)?.custo_unitario || 0) : ""); }}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione veículo" /></SelectTrigger>
                    <SelectContent>
                      {recursosVeiculo.map(r => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input type="number" value={veicKmInicial} onChange={e => setVeicKmInicial(e.target.value)} placeholder="KM Ini" className="w-24" />
                  <Input type="number" value={veicKmFinal} onChange={e => setVeicKmFinal(e.target.value)} placeholder="KM Fin" className="w-24" />
                  <Input type="number" value={veicCusto} onChange={e => setVeicCusto(e.target.value)} placeholder="Custo" className="w-24" />
                  <Button onClick={handleAddVeiculo}>Adicionar</Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">KM Inicial</TableHead>
                      <TableHead className="text-right">KM Final</TableHead>
                      <TableHead className="text-right">KM Rodados</TableHead>
                      <TableHead className="text-right">Custo</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {veiculos.map(v => (
                      <TableRow key={v.id}>
                        <TableCell>{v.descricao}</TableCell>
                        <TableCell className="text-right">
                          {editingVeicId === v.id ? (
                            <Input
                              type="number"
                              value={editVeicKmInicial}
                              onChange={e => setEditVeicKmInicial(e.target.value)}
                              className="w-20 ml-auto h-8"
                            />
                          ) : (
                            v.km_inicial
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {editingVeicId === v.id ? (
                            <Input
                              type="number"
                              value={editVeicKmFinal}
                              onChange={e => setEditVeicKmFinal(e.target.value)}
                              className="w-20 ml-auto h-8"
                            />
                          ) : (
                            v.km_final
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">{v.km_rodados}</TableCell>
                        <TableCell className="text-right">
                          {editingVeicId === v.id ? (
                            <Input
                              type="number"
                              value={editVeicCusto}
                              onChange={e => setEditVeicCusto(e.target.value)}
                              className="w-20 ml-auto h-8"
                            />
                          ) : (
                            formatCurrency(v.custo_diaria)
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-end">
                            {editingVeicId === v.id ? (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => handleUpdateVeiculo(v.id)} className="h-8 w-8 text-green-600">
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => setEditingVeicId(null)} className="h-8 w-8 text-red-600">
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setEditingVeicId(v.id);
                                    setEditVeicKmInicial(String(v.km_inicial));
                                    setEditVeicKmFinal(String(v.km_final));
                                    setEditVeicCusto(String(v.custo_diaria));
                                  }}
                                  className="h-8 w-8"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => removeVeiculo.mutate(v.id)} className="h-8 w-8 text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {veiculos.length > 0 && (
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell colSpan={3}>Total</TableCell>
                        <TableCell className="text-right">{veiculos.reduce((sum, v) => sum + (v.km_rodados || 0), 0)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(veiculos.reduce((sum, v) => sum + (v.custo_diaria || 0), 0))}</TableCell>
                        <TableCell />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>Status do Ativo</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant={diarioStatusAtivo === "On" ? "default" : "outline"}
                    className={cn(diarioStatusAtivo === "On" && "bg-green-600 hover:bg-green-700")}
                    onClick={() => setDiarioStatusAtivo("On")}
                  >
                    On
                  </Button>
                  <Button
                    variant={diarioStatusAtivo === "Off" ? "default" : "outline"}
                    className={cn(diarioStatusAtivo === "Off" && "bg-red-600 hover:bg-red-700")}
                    onClick={() => setDiarioStatusAtivo("Off")}
                  >
                    Off
                  </Button>
                </div>
              </CardHeader>
            </Card>

            <FotosSection
              fotos={fotos}
              photoGroups={photoGroups}
              setPhotoGroups={setPhotoGroups}
              producoes={producoes}
              onUpload={(e, group) => handleUploadFoto(e, group)}
              onRemove={handleRemoveFoto}
              setPhotoView={setPhotoView}
              onReorder={ordens => reordenarFotos.mutate(ordens)}
              onUpdateLegenda={(id, legenda) => atualizarFoto.mutate({ id, legenda })}
            />

            <Card>
              <CardHeader><CardTitle>Relatório Descritivo / Observações</CardTitle></CardHeader>
              <CardContent>
                <Textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Relatório Descritivo / Observações do dia..." />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {photoView && (
        <Dialog open={!!photoView} onOpenChange={() => setPhotoView(null)}>
          <DialogContent className="max-w-4xl p-0">
            <SmartImage 
              src={photoView.thumb_600_url || photoView.url} 
              context="diario_fotos"
              fallbackUrls={[photoView.url]}
              className="w-full h-full object-contain" 
              alt="Visualização"
              key={photoView.id}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
