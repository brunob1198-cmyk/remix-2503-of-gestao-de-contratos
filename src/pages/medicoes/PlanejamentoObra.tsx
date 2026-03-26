import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProjetos } from "@/hooks/useProjetos";
import { useFrentes, useAtividades, AtividadePlanejamento } from "@/hooks/usePlanejamento";
import { GanttChart } from "@/components/planejamento/GanttChart";
import { AtividadeDetailSheet } from "@/components/planejamento/AtividadeDetailSheet";
import { FrenteForm } from "@/components/planejamento/FrenteForm";
import { AtividadeForm } from "@/components/planejamento/AtividadeForm";
import { TimelineObra } from "@/components/planejamento/TimelineObra";
import { SimulacaoEquipes } from "@/components/planejamento/SimulacaoEquipes";
import { ProdutividadeMapa } from "@/components/planejamento/ProdutividadeMapa";
import { CurvaSDashboard } from "@/components/planejamento/CurvaSDashboard";
import { CalendarRange, BarChart3, AlertTriangle, CheckCircle2, Clock, Map, Users, MapPin, TrendingUp } from "lucide-react";

export default function PlanejamentoObra() {
  const { projetos = [] } = useProjetos();
  const [projetoId, setProjetoId] = useState<string>("");
  const [frenteFilter, setFrenteFilter] = useState<string>("all");
  const [selectedAtividade, setSelectedAtividade] = useState<AtividadePlanejamento | null>(null);

  const { data: frentes = [], create: createFrente } = useFrentes(projetoId || undefined);
  const { data: atividades = [], create: createAtividade } = useAtividades(projetoId || undefined);

  const filteredAtividades = useMemo(() => {
    if (frenteFilter === "all") return atividades;
    return atividades.filter((a) => a.frente_id === frenteFilter);
  }, [atividades, frenteFilter]);

  const stats = useMemo(() => {
    const total = atividades.length;
    const adiantado = atividades.filter((a) => a.status === "adiantado").length;
    const noPrazo = atividades.filter((a) => a.status === "no_prazo").length;
    const atrasado = atividades.filter((a) => a.status === "atrasado").length;
    const concluido = atividades.filter((a) => a.status === "concluido").length;
    const avgPct = total ? atividades.reduce((s, a) => s + (a.percentual_executado || 0), 0) / total : 0;
    return { total, adiantado, noPrazo, atrasado, concluido, avgPct };
  }, [atividades]);

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
          <Select value={projetoId} onValueChange={(v) => { setProjetoId(v); setFrenteFilter("all"); }}>
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
            <TabsTrigger value="simulacao" className="gap-1.5">
              <Users className="h-4 w-4" /> Simulação
            </TabsTrigger>
            <TabsTrigger value="produtividade" className="gap-1.5">
              <MapPin className="h-4 w-4" /> Produtividade
            </TabsTrigger>
            <TabsTrigger value="curvas" className="gap-1.5">
              <TrendingUp className="h-4 w-4" /> Curva S
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

              <div className="flex gap-2">
                <FrenteForm
                  projetoId={projetoId}
                  onCreate={(data) => createFrente.mutate(data)}
                  isLoading={createFrente.isPending}
                />
                {frentes.length > 0 && (
                  <AtividadeForm
                    frentes={frentes}
                    atividades={atividades}
                    onCreate={(data) => createAtividade.mutate(data)}
                    isLoading={createAtividade.isPending}
                  />
                )}
              </div>
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
            />
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            <TimelineObra projetoId={projetoId} />
          </TabsContent>

          <TabsContent value="simulacao" className="mt-4">
            <SimulacaoEquipes atividades={atividades} frentes={frentes} />
          </TabsContent>

          <TabsContent value="produtividade" className="mt-4">
            <ProdutividadeMapa projetoId={projetoId} />
          </TabsContent>
          <TabsContent value="curvas" className="mt-4">
            <CurvaSDashboard atividades={atividades} frentes={frentes} />
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
      />
    </div>
  );
}
