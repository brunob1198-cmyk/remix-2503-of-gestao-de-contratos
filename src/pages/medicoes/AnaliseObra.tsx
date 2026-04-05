import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BarChart3, Calculator, ClipboardList, Brain, ChevronDown, X, RefreshCw } from "lucide-react";
import { VisaoExecutiva } from "@/components/analise/VisaoExecutiva";
import { AnaliseCustos } from "@/components/analise/AnaliseCustos";
import { CustosErp } from "@/components/analise/CustosErp";
import { AnaliseIA } from "@/components/analise/AnaliseIA";
import { MonthRangePicker } from "@/components/analise/MonthRangePicker";
import { usePersistedState } from "@/hooks/usePersistedState";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { startOfMonth, endOfMonth } from "date-fns";
import { useAnaliseCustos } from "@/hooks/useAnaliseCustos";

export default function AnaliseObraPage() {
  const [selectedIds, setSelectedIds] = usePersistedState<string[]>("analise_projeto_ids", []);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("executiva");
  const [periodoInicioStr, setPeriodoInicioStr] = usePersistedState<string>("analise_periodo_inicio", startOfMonth(new Date()).toISOString());
  const [periodoFimStr, setPeriodoFimStr] = usePersistedState<string>("analise_periodo_fim", endOfMonth(new Date()).toISOString());

  const periodoInicio = useMemo(() => new Date(periodoInicioStr), [periodoInicioStr]);
  const periodoFim = useMemo(() => new Date(periodoFimStr), [periodoFimStr]);

  const setPeriodoInicio = (d: Date) => setPeriodoInicioStr(d.toISOString());
  const setPeriodoFim = (d: Date) => setPeriodoFimStr(d.toISOString());

  // Single sync hook — uses first selected project but syncs all ERP data
  const { syncErp } = useAnaliseCustos(selectedIds[0] || "", "", periodoInicio, periodoFim);

  const { data: projetos = [] } = useQuery({
    queryKey: ["projetos_analise"],
    queryFn: async () => {
      const { data } = await supabase.from("projetos").select("id, codigo, nome").order("nome");
      return data || [];
    },
  });

  const allSelected = selectedIds.length === projetos.length && projetos.length > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(projetos.map(p => p.id));
    }
  };

  const toggleProject = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const filteredProjetos = useMemo(() => {
    if (!search.trim()) return projetos;
    const s = search.toLowerCase();
    return projetos.filter(p => p.codigo.toLowerCase().includes(s) || p.nome.toLowerCase().includes(s));
  }, [projetos, search]);

  const currentProjetoId = selectedIds.length === 1 ? selectedIds[0] : selectedIds.length > 0 ? selectedIds[0] : "";
  const selectedProjeto = projetos.find(p => p.id === currentProjetoId);

  const label = selectedIds.length === 0
    ? "Selecione projetos"
    : allSelected
      ? "Todos os projetos"
      : selectedIds.length === 1
        ? `${selectedProjeto?.codigo} - ${selectedProjeto?.nome}`
        : `${selectedIds.length} projetos selecionados`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">📊 Análise de Obras</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão completa de desempenho financeiro e físico</p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[320px] justify-between font-normal">
              <span className="truncate">{label}</span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-2" align="start">
            <Input
              placeholder="Buscar projeto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="mb-2 h-8 text-sm"
            />
            <div className="flex items-center gap-2 px-2 py-1.5 border-b mb-1">
              <Checkbox
                checked={allSelected}
                onCheckedChange={toggleAll}
                id="all-projects"
              />
              <label htmlFor="all-projects" className="text-sm font-medium cursor-pointer">
                Todos os projetos
              </label>
            </div>
            <ScrollArea className="max-h-[250px]">
              <div className="space-y-0.5">
                {filteredProjetos.map(p => (
                  <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer" onClick={() => toggleProject(p.id)}>
                    <Checkbox
                      checked={selectedIds.includes(p.id)}
                      onCheckedChange={() => toggleProject(p.id)}
                    />
                    <span className="text-sm truncate">{p.codigo} - {p.nome}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>

        <MonthRangePicker
          startDate={periodoInicio}
          endDate={periodoFim}
          onChangeStart={setPeriodoInicio}
          onChangeEnd={(d) => setPeriodoFim(endOfMonth(d))}
        />

        {selectedIds.length > 0 && (
          <>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => syncErp.mutate()} disabled={syncErp.isPending}>
              <RefreshCw className={`h-3.5 w-3.5 ${syncErp.isPending ? "animate-spin" : ""}`} />
              Sincronizar Conta Azul
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
              <X className="h-4 w-4 mr-1" /> Limpar
            </Button>
          </>
        )}

        {selectedIds.length > 1 && (
          <div className="flex gap-1 flex-wrap">
            {selectedIds.slice(0, 3).map(id => {
              const p = projetos.find(x => x.id === id);
              return p ? <Badge key={id} variant="secondary" className="text-xs">{p.codigo}</Badge> : null;
            })}
            {selectedIds.length > 3 && <Badge variant="secondary" className="text-xs">+{selectedIds.length - 3}</Badge>}
          </div>
        )}
      </div>

      {selectedIds.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Selecione um ou mais projetos para ver a análise
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="executiva" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Visão Executiva
            </TabsTrigger>
            <TabsTrigger value="custos-erp" className="gap-2">
              <Calculator className="h-4 w-4" />
              Análise de Custos
            </TabsTrigger>
            <TabsTrigger value="auditoria-erp" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              Auditoria ERP
            </TabsTrigger>
            <TabsTrigger value="ia" className="gap-2">
              <Brain className="h-4 w-4" />
              Análise IA
            </TabsTrigger>
          </TabsList>

          <TabsContent value="custos-erp" className="mt-0">
            <AnaliseCustos projetoIds={selectedIds} periodoInicio={periodoInicio} periodoFim={periodoFim} />
          </TabsContent>

          {selectedIds.map(pid => {
            const proj = projetos.find(x => x.id === pid);
            if (!proj) return null;
            return (
              <div key={pid} className={selectedIds.length > 1 ? "border rounded-lg p-4 space-y-4" : ""}>
                {selectedIds.length > 1 && (
                  <h3 className="text-lg font-semibold">{proj.codigo} - {proj.nome}</h3>
                )}
                <TabsContent value="executiva" className="mt-0">
                  <VisaoExecutiva projetoId={pid} projetoName={proj.nome} periodoInicio={periodoInicio} periodoFim={periodoFim} />
                </TabsContent>
                <TabsContent value="auditoria-erp" className="mt-0">
                  <CustosErp projetoId={pid} siteId="" periodoInicio={periodoInicio} periodoFim={periodoFim} />
                </TabsContent>
                <TabsContent value="ia" className="mt-0">
                  <AnaliseIA projetoId={pid} projetoName={proj.nome} />
                </TabsContent>
              </div>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}
