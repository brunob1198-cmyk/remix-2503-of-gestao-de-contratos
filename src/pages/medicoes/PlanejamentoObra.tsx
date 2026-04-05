import { useState, useMemo, useCallback, useRef } from "react";
import { ErrorBoundary } from "@/components/planejamento/ErrorBoundary";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProjetos } from "@/hooks/useProjetos";
import { useFrentes, useAtividades, AtividadePlanejamento } from "@/hooks/usePlanejamento";
import { useSites } from "@/hooks/useSites";
import { useRecursos } from "@/hooks/useRecursos";
import { usePersistedState } from "@/hooks/usePersistedState";
import { GanttChart } from "@/components/planejamento/GanttChart";
import { AtividadeDetailSheet } from "@/components/planejamento/AtividadeDetailSheet";
import { FrenteForm } from "@/components/planejamento/FrenteForm";
// AtividadeForm removed - escopo linking is done in FrenteForm
import { TimelineObra } from "@/components/planejamento/TimelineObra";
// SimulacaoEquipes removed
import { ProdutividadeMapa } from "@/components/planejamento/ProdutividadeMapa";
import { CurvaSDashboard } from "@/components/planejamento/CurvaSDashboard";
import { ProducaoTab } from "@/components/analise/ProducaoTab";
import { CalendarRange, BarChart3, AlertTriangle, CheckCircle2, Clock, Map, Users, MapPin, TrendingUp, Trash2, Sparkles, ClipboardList } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function PlanejamentoObra() {
  const { projetos = [] } = useProjetos();
  const [projetoId, setProjetoId] = usePersistedState<string>("planejamento_projeto_id", "");
  const [frenteFilter, setFrenteFilter] = usePersistedState<string>("planejamento_frente_filter", "all");
  const [selectedSiteIds, setSelectedSiteIds] = usePersistedState<string[]>("planejamento_site_filter_v2", []);
  const [selectedAtividade, setSelectedAtividade] = useState<AtividadePlanejamento | null>(null);
  const queryClient = useQueryClient();

  const { data: frentes = [], create: createFrente, remove: removeFrente } = useFrentes(projetoId || undefined);
  const { data: atividades = [], create: createAtividade, update: updateAtividade, analyzeGanttAi } = useAtividades(projetoId || undefined);
  const { sites } = useSites(projetoId || undefined);
  const { recursos, alocacoes } = useRecursos();

  // Recursos alocados neste projeto
  const projetoRecursos = useMemo(() => {
    if (!projetoId) return [];
    const recursoIdsAlocados = new Set(
      alocacoes
        .filter((a) => a.projeto_id === projetoId && !a.data_fim)
        .map((a) => a.recurso_id)
    );
    return recursos.filter((r) => recursoIdsAlocados.has(r.id));
  }, [projetoId, recursos, alocacoes]);

  // Load atividade_recursos for selected atividade
  const { data: atividadeRecursos = [] } = useQuery({
    queryKey: ["atividade_recursos", selectedAtividade?.id],
    queryFn: async () => {
      if (!selectedAtividade?.id) return [];
      const { data, error } = await supabase
        .from("atividade_recursos")
        .select("recurso_id")
        .eq("atividade_id", selectedAtividade.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.recurso_id);
    },
    enabled: !!selectedAtividade?.id,
  });

  const filteredAtividades = useMemo(() => {
    let result = atividades;
    if (frenteFilter !== "all") {
      result = result.filter((a) => a.frente_id === frenteFilter);
    }
    if (selectedSiteIds.length > 0) {
      const siteSet = new Set(selectedSiteIds);
      const frenteIdsForSite = new Set(frentes.filter((f) => siteSet.has((f as any).site_id)).map((f) => f.id));
      result = result.filter((a) => frenteIdsForSite.has(a.frente_id));
    }
    return result;
  }, [atividades, frenteFilter, selectedSiteIds, frentes]);

  const stats = useMemo(() => {
    const total = atividades.length;
    const adiantado = atividades.filter((a) => a.status === "adiantado").length;
    const noPrazo = atividades.filter((a) => a.status === "no_prazo").length;
    const atrasado = atividades.filter((a) => a.status === "atrasado").length;
    const concluido = atividades.filter((a) => a.status === "concluido").length;
    const avgPct = total ? atividades.reduce((s, a) => s + (a.percentual_executado || 0), 0) / total : 0;
    return { total, adiantado, noPrazo, atrasado, concluido, avgPct };
  }, [atividades]);

  const handleDragUpdate = useCallback(async (id: string, newStartDate: string) => {
    const at = atividades.find((a) => a.id === id);
    if (!at) return;
    const dur = at.duracao_dias || 1;
    const { addDays, format } = await import("date-fns");
    const newEnd = format(addDays(new Date(newStartDate), dur - 1), "yyyy-MM-dd");
    updateAtividade.mutate({ id, data_inicio: newStartDate, data_fim_prevista: newEnd });
  }, [atividades, updateAtividade]);

  const handleUpdateAtividade = useCallback((data: any) => {
    updateAtividade.mutate(data);
  }, [updateAtividade]);

  const handleUpdateRecursos = useCallback(async (atividadeId: string, recursoIds: string[]) => {
    // Delete existing
    await supabase.from("atividade_recursos").delete().eq("atividade_id", atividadeId);
    // Insert new
    if (recursoIds.length) {
      const rows = recursoIds.map((rid) => ({ atividade_id: atividadeId, recurso_id: rid }));
      await supabase.from("atividade_recursos").insert(rows);
    }
    queryClient.invalidateQueries({ queryKey: ["atividade_recursos", atividadeId] });
    toast.success("Recursos atualizados");
  }, [queryClient]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarRange className="h-6 w-6" />
            Planejamento de Obra
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Planeje e acompanhe a execução das frentes de obra com visualização Gantt e Timeline
          </p>
        </div>
      </div>

      {/* Project selector */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="w-64">
          <label className="text-sm font-medium mb-1 block">Projeto</label>
          <Select value={projetoId} onValueChange={(v) => { setProjetoId(v); setFrenteFilter("all"); setSelectedSiteIds([]); }}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o projeto" />
            </SelectTrigger>
            <SelectContent>
              {projetos.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.codigo} - {p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {projetoId && sites.length > 0 && (
          <div className="w-64">
            <label className="text-sm font-medium mb-1 block">Filtrar por Site</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between font-normal">
                  {selectedSiteIds.length === 0
                    ? "Todos os sites"
                    : selectedSiteIds.length === 1
                      ? sites.find(s => s.id === selectedSiteIds[0])?.nome || "1 site"
                      : `${selectedSiteIds.length} sites`}
                  <MapPin className="h-4 w-4 ml-2 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start">
                <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
                  <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm font-medium text-primary">
                    <Checkbox
                      checked={selectedSiteIds.length === 0}
                      onCheckedChange={() => setSelectedSiteIds([])}
                    />
                    Todos os sites
                  </label>
                  {sites.map(s => (
                    <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm">
                      <Checkbox
                        checked={selectedSiteIds.includes(s.id)}
                        onCheckedChange={(checked) => {
                          setSelectedSiteIds(prev =>
                            checked ? [...prev, s.id] : prev.filter(id => id !== s.id)
                          );
                        }}
                      />
                      {(s as any).codigo} - {s.nome}
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {projetoId ? (
        <Tabs defaultValue="gantt" className="w-full">
          <TabsList>
            <TabsTrigger value="gantt" className="gap-1.5">
              <BarChart3 className="h-4 w-4" /> Gantt
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-1.5">
              <Map className="h-4 w-4" /> Timeline
            </TabsTrigger>
            <TabsTrigger value="produtividade" className="gap-1.5">
              <MapPin className="h-4 w-4" /> Produtividade
            </TabsTrigger>
            <TabsTrigger value="curvas" className="gap-1.5">
              <TrendingUp className="h-4 w-4" /> Curva S
            </TabsTrigger>
            <TabsTrigger value="producao" className="gap-1.5">
              <ClipboardList className="h-4 w-4" /> Produção
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gantt" className="space-y-4 mt-4">
            {/* Gantt controls */}
            <div className="flex flex-wrap gap-3 items-end">

              {frentes.length > 0 && (
                <div className="w-52">
                  <label className="text-sm font-medium mb-1 block">Filtrar por Frente</label>
                  <Select value={frenteFilter} onValueChange={setFrenteFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as frentes</SelectItem>
                      {frentes.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                {atividades.length > 0 && (
                  <Button 
                    variant="secondary" 
                    onClick={() => analyzeGanttAi.mutate(filteredAtividades)} 
                    disabled={analyzeGanttAi.isPending}
                    className="gap-1.5"
                  >
                    <Sparkles className="h-4 w-4 text-purple-600" />
                    {analyzeGanttAi.isPending ? "Analisando Cronograma..." : "Analisar via IA"}
                  </Button>
                )}
                <FrenteForm
                  projetoId={projetoId}
                  sites={sites as any}
                  recursos={recursos}
                  onCreate={(data) => {
                    if (data.site_id === "none") delete data.site_id;
                    createFrente.mutate(data);
                  }}
                  isLoading={createFrente.isPending}
                />
              </div>

              {/* Frentes list with delete */}
              {frentes.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {frentes.map((f) => (
                    <div key={f.id} className="flex items-center gap-1 border rounded-md px-2 py-1 bg-muted/30 text-xs">
                      <span className="font-medium">{f.nome}</span>
                      {(f as any).site_id && (
                        <span className="text-muted-foreground">
                          ({sites.find((s) => s.id === (f as any).site_id)?.nome || "Site"})
                        </span>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button className="ml-1 text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir frente "{f.nome}"?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Todas as atividades vinculadas a esta frente serão removidas. Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => removeFrente.mutate(f.id)}>
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Stats cards */}
            {atividades.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Card>
                  <CardContent className="py-3 px-4 flex items-center gap-3">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="text-lg font-bold">{stats.total}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-3 px-4 flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Concluídas</p>
                      <p className="text-lg font-bold">{stats.concluido}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-3 px-4 flex items-center gap-3">
                    <Clock className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">No Prazo</p>
                      <p className="text-lg font-bold">{stats.noPrazo + stats.adiantado}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-3 px-4 flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Atrasadas</p>
                      <p className="text-lg font-bold">{stats.atrasado}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-3 px-4 flex items-center gap-3">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Progresso Médio</p>
                      <p className="text-lg font-bold">{stats.avgPct.toFixed(1)}%</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <GanttChart
              atividades={filteredAtividades}
              onSelectAtividade={setSelectedAtividade}
              onDragUpdate={handleDragUpdate}
            />
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            <ErrorBoundary fallbackMessage="Erro ao carregar a Timeline. Tente novamente.">
              <TimelineObra
                projetoId={projetoId}
                siteFilter={selectedSiteIds.length > 0 ? selectedSiteIds : undefined}
                sites={sites as any}
              />
            </ErrorBoundary>
          </TabsContent>


          <TabsContent value="produtividade" className="mt-4">
            <ProdutividadeMapa projetoId={projetoId} siteFilter={selectedSiteIds.length === 1 ? selectedSiteIds[0] : undefined} />
          </TabsContent>
          <TabsContent value="curvas" className="mt-4">
            <CurvaSDashboard atividades={filteredAtividades} frentes={selectedSiteIds.length > 0 ? frentes.filter(f => selectedSiteIds.includes((f as any).site_id)) : frentes} />
          </TabsContent>

          <TabsContent value="producao" className="mt-4">
            <ProducaoTab 
              projetoId={projetoId} 
              siteId={siteFilter !== "all" ? siteFilter : undefined} 
            />
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardContent className="flex items-center justify-center h-48 text-muted-foreground">
            Selecione um projeto para visualizar o planejamento
          </CardContent>
        </Card>
      )}

      <AtividadeDetailSheet
        atividade={selectedAtividade}
        onClose={() => setSelectedAtividade(null)}
        allAtividades={atividades}
        onUpdate={handleUpdateAtividade}
        projetoRecursos={projetoRecursos}
        atividadeRecursoIds={atividadeRecursos}
        onUpdateRecursos={handleUpdateRecursos}
      />
    </div>
  );
}
