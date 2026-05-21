import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/lib/supabasePagination";

import { useProjetos } from "@/hooks/useProjetos";
import { useSites } from "@/hooks/useSites";
import { useLancamentosProducao, useLancamentosMedicao, useLancamentosFaturamento } from "@/hooks/useLancamentos";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileDown, FileSpreadsheet, Filter, ArrowUpDown, ArrowUp, ArrowDown, LayoutGrid } from "lucide-react";
import QuadroGeral from "@/components/relatorios/QuadroGeral";
import ProducaoMensal from "@/components/relatorios/ProducaoMensal";
import { exportDashboardToExcel, exportLancamentosToExcel } from "@/lib/medicoesExport";
import * as XLSX from "xlsx";
import { usePersistedState } from "@/hooks/usePersistedState";

import { useAuth } from "@/contexts/AuthContext";

type CrossType = "producao_medicao" | "medicao_faturamento" | "producao_faturamento";
type CrossSortField = "projeto" | "site" | "nome" | "origem" | "destino" | "diferenca";
type SortDirection = "asc" | "desc";

export default function RelatoriosPage() {
  const [projetoId, setProjetoId] = usePersistedState<string>("relatorios_projeto_id", "");
  const [selectedSiteIds, setSelectedSiteIds] = usePersistedState<string[]>("relatorios_site_ids", []);
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [activeTab, setActiveTab] = usePersistedState<string>("relatorios_tab", "quadro_geral");
  const [crossType, setCrossType] = useState<CrossType>("producao_medicao");
  const [crossSortField, setCrossSortField] = useState<CrossSortField>("projeto");
  const [crossSortDirection, setCrossSortDirection] = useState<SortDirection>("asc");
  const [crossProjetoFilter, setCrossProjetoFilter] = useState<string>("");
  const [crossSiteFilter, setCrossSiteFilter] = useState<string>("");
  const { empresaId } = useAuth();
  const { toast } = useToast();

  const { projetos } = useProjetos();
  const { sites } = useSites();
  // useDashboard removido pois não foi encontrado no projeto
  const resumoProjetos = [];
  const resumoItens = [];
  const totais = { 
    totalProduzido: 0, 
    totalMedido: 0, 
    totalFaturado: 0, 
    totalAMedir: 0, 
    totalAFaturar: 0 
  };
  const { lancamentos: producao } = useLancamentosProducao();
  const { lancamentos: medicao } = useLancamentosMedicao();
  const { lancamentos: faturamento } = useLancamentosFaturamento();

  // Production data from Diário de Obra (RDO) — source of truth for "Total Produzido"
  const { data: diarioProducao = [] } = useQuery({
    queryKey: ["diario_producao_cruzado", projetoId, empresaId],
    queryFn: async () => {
      let query = supabase
        .from("diarios_obra")
        .select("id, data, site_id, observacoes, site:sites!inner(id, codigo, nome, projeto_id, projeto:projetos!inner(id, codigo, empresa_id))");
      
      if (empresaId) {
        query = query.eq("site.projeto.empresa_id", empresaId);
      }
      
      if (projetoId) {
        query = query.eq("site.projeto_id", projetoId);
      }
      
      const diarios = await fetchAllPages<any>(query);
      if (!diarios || diarios.length === 0) return [];

      const diarioIds = diarios.map((d: any) => d.id);
      
      const prodQuery = supabase
        .from("diario_producao")
        .select("diario_id, item_lpu_id, quantidade, valor_total, preco_unitario_congelado, item_lpu:itens_lpu(preco_unitario)")
        .in("diario_id", diarioIds);
      
      const prods = await fetchAllPages<any>(prodQuery);

      const diarioMap = new Map(diarios.map((d: any) => [d.id, d]));
      return (prods ?? []).map((p: any) => {
        const d: any = diarioMap.get(p.diario_id);
        return {
          site_id: d?.site_id,
          site: d?.site,
          data_producao: d?.data,
          observacoes_diario: d?.observacoes || "",
          quantidade: Number(p.quantidade) || 0,
          valor_total: Number(p.valor_total) || 0,
          preco_unitario_congelado: Number(p.preco_unitario_congelado) || 0,
          item_lpu: p.item_lpu,
        };
      });
    },
    staleTime: 10 * 60 * 1000,
    enabled: !!empresaId,
  });

  const filteredSites = projetoId
    ? sites.filter(s => s.projeto_id === projetoId)
    : sites;

  const handleSiteToggle = (siteId: string) => {
    setSelectedSiteIds(prev => 
      prev.includes(siteId) 
        ? prev.filter(id => id !== siteId)
        : [...prev, siteId]
    );
  };

  const handleSelectAllSites = () => {
    if (selectedSiteIds.length === filteredSites.length) {
      setSelectedSiteIds([]);
    } else {
      setSelectedSiteIds(filteredSites.map(s => s.id));
    }
  };

  const handleExportDashboard = () => {
    // Exportação desativada temporariamente devido à ausência do hook useDashboard
    // exportDashboardToExcel(resumoProjetos, resumoItens, totais);
    toast({ title: "Funcionalidade em manutenção" });
  };

  // Cross-reference report with flexible type selection
  const crossReferenceData = useMemo(() => {
    // Production source = Diário de Obra (RDO)
    let filteredProducao = [...diarioProducao];
    let filteredMedicao = [...medicao];
    let filteredFaturamento = [...faturamento];

    // Filter by project
    if (projetoId) {
      const projectSiteIds = sites.filter(s => s.projeto_id === projetoId).map(s => s.id);
      filteredProducao = filteredProducao.filter(l => projectSiteIds.includes(l.site_id));
      filteredMedicao = filteredMedicao.filter(l => projectSiteIds.includes(l.site_id));
      filteredFaturamento = filteredFaturamento.filter(l => projectSiteIds.includes(l.site_id));
    }

    // Filter by selected sites
    if (selectedSiteIds.length > 0) {
      filteredProducao = filteredProducao.filter(l => selectedSiteIds.includes(l.site_id));
      filteredMedicao = filteredMedicao.filter(l => selectedSiteIds.includes(l.site_id));
      filteredFaturamento = filteredFaturamento.filter(l => selectedSiteIds.includes(l.site_id));
    }

    // Filter by date range
    if (dataInicio) {
      filteredProducao = filteredProducao.filter(l => l.data_producao && l.data_producao >= dataInicio);
      filteredMedicao = filteredMedicao.filter(l => l.data_medicao >= dataInicio);
      filteredFaturamento = filteredFaturamento.filter(l => l.data_faturamento >= dataInicio);
    }
    if (dataFim) {
      filteredProducao = filteredProducao.filter(l => l.data_producao && l.data_producao <= dataFim);
      filteredMedicao = filteredMedicao.filter(l => l.data_medicao <= dataFim);
      filteredFaturamento = filteredFaturamento.filter(l => l.data_faturamento <= dataFim);
    }

    // Group by site based on cross type
    const siteMap = new Map<string, {
      site_codigo: string;
      site_nome: string;
      projeto_codigo: string;
      total_origem: number;
      total_destino: number;
      diferenca: number;
      observacoes_diario: string[];
    }>();

    const processData = (
      origemData: any[],
      destinoData: any[],
      origemKind: "producao" | "medicao",
      destinoField: string | null
    ) => {
      origemData.forEach(l => {
        // For Diário de Obra, prefer the frozen valor_total; fallback to quantidade * preço
        let valor: number;
        if (origemKind === "producao") {
          valor = Number(l.valor_total) || 0;
          if (!valor) {
            const preco = Number(l.preco_unitario_congelado) || Number(l.item_lpu?.preco_unitario) || 0;
            valor = Number(l.quantidade) * preco;
          }
        } else {
          const preco = Number(l.item_lpu?.preco_unitario || 0);
          valor = Number(l.quantidade) * preco;
        }
        const key = l.site_id;
        if (!key) return;

        if (!siteMap.has(key)) {
          siteMap.set(key, {
            site_codigo: l.site?.codigo || "",
            site_nome: l.site?.nome || "",
            projeto_codigo: l.site?.projeto?.codigo || "",
            total_origem: 0,
            total_destino: 0,
            diferenca: 0,
            observacoes_diario: [],
          });
        }
        
        const currentEntry = siteMap.get(key)!;
        currentEntry.total_origem += valor;
        
        if (origemKind === "producao" && l.observacoes_diario) {
          if (!currentEntry.observacoes_diario.includes(l.observacoes_diario)) {
            currentEntry.observacoes_diario.push(l.observacoes_diario);
          }
        }
      });

      destinoData.forEach(l => {
        const preco = Number(l.item_lpu?.preco_unitario || 0);
        const valor = destinoField === 'valor_faturado' && l.valor_faturado 
          ? Number(l.valor_faturado) 
          : Number(l.quantidade) * preco;
        const key = l.site_id;

        if (!siteMap.has(key)) {
          siteMap.set(key, {
            site_codigo: l.site?.codigo || "",
            site_nome: l.site?.nome || "",
            projeto_codigo: l.site?.projeto?.codigo || "",
            total_origem: 0,
            total_destino: 0,
            diferenca: 0,
            observacoes_diario: [],
          });
        }
        siteMap.get(key)!.total_destino += valor;
      });
    };

    if (crossType === "producao_medicao") {
      processData(filteredProducao, filteredMedicao, "producao", null);
    } else if (crossType === "medicao_faturamento") {
      processData(filteredMedicao, filteredFaturamento, "medicao", "valor_faturado");
    } else {
      processData(filteredProducao, filteredFaturamento, "producao", "valor_faturado");
    }

    // Calculate difference
    siteMap.forEach(site => {
      site.diferenca = site.total_origem - site.total_destino;
    });

    return Array.from(siteMap.values()).filter(s => s.total_origem > 0 || s.total_destino > 0);
  }, [diarioProducao, medicao, faturamento, projetoId, selectedSiteIds, dataInicio, dataFim, sites, crossType]);

  // Filter and sort cross reference data
  const filteredAndSortedCrossData = useMemo(() => {
    let filtered = [...crossReferenceData];

    // Apply filters
    if (crossProjetoFilter) {
      filtered = filtered.filter(s => s.projeto_codigo.toLowerCase().includes(crossProjetoFilter.toLowerCase()));
    }
    if (crossSiteFilter) {
      filtered = filtered.filter(s => 
        s.site_codigo.toLowerCase().includes(crossSiteFilter.toLowerCase()) ||
        s.site_nome.toLowerCase().includes(crossSiteFilter.toLowerCase())
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let valueA: any, valueB: any;
      switch (crossSortField) {
        case "projeto":
          valueA = a.projeto_codigo.toLowerCase();
          valueB = b.projeto_codigo.toLowerCase();
          break;
        case "site":
          valueA = a.site_codigo.toLowerCase();
          valueB = b.site_codigo.toLowerCase();
          break;
        case "nome":
          valueA = a.site_nome.toLowerCase();
          valueB = b.site_nome.toLowerCase();
          break;
        case "origem":
          valueA = a.total_origem;
          valueB = b.total_origem;
          break;
        case "destino":
          valueA = a.total_destino;
          valueB = b.total_destino;
          break;
        case "diferenca":
          valueA = a.diferenca;
          valueB = b.diferenca;
          break;
        default:
          valueA = 0;
          valueB = 0;
      }
      if (valueA < valueB) return crossSortDirection === "asc" ? -1 : 1;
      if (valueA > valueB) return crossSortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [crossReferenceData, crossProjetoFilter, crossSiteFilter, crossSortField, crossSortDirection]);

  const crossReferenceTotals = useMemo(() => ({
    totalOrigem: filteredAndSortedCrossData.reduce((sum, s) => sum + s.total_origem, 0),
    totalDestino: filteredAndSortedCrossData.reduce((sum, s) => sum + s.total_destino, 0),
    diferenca: filteredAndSortedCrossData.reduce((sum, s) => sum + s.diferenca, 0),
  }), [filteredAndSortedCrossData]);

  const handleCrossSort = (field: CrossSortField) => {
    if (crossSortField === field) {
      setCrossSortDirection(crossSortDirection === "asc" ? "desc" : "asc");
    } else {
      setCrossSortField(field);
      setCrossSortDirection("asc");
    }
  };

  const getCrossSortIcon = (field: CrossSortField) => {
    if (crossSortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    return crossSortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const getCrossTypeLabels = () => {
    switch (crossType) {
      case "producao_medicao":
        return { origem: "Total Produzido", destino: "Total Medido", diff: "A Medir" };
      case "medicao_faturamento":
        return { origem: "Total Medido", destino: "Total Faturado", diff: "A Faturar" };
      case "producao_faturamento":
        return { origem: "Total Produzido", destino: "Total Faturado", diff: "Diferença" };
    }
  };

  const labels = getCrossTypeLabels();

  const handleExportCrossReference = () => {
    const ws = XLSX.utils.json_to_sheet(filteredAndSortedCrossData.map(s => ({
      "Projeto": s.projeto_codigo,
      "Site": s.site_codigo,
      "Nome": s.site_nome,
      [labels.origem]: s.total_origem,
      [labels.destino]: s.total_destino,
      [labels.diff]: s.diferenca,
      "Relatório Descritivo / Observações Diário": s.observacoes_diario.join(" | "),
    })));

    const typeName = crossType === "producao_medicao" 
      ? "producao_x_medicao" 
      : crossType === "medicao_faturamento"
        ? "medicao_x_faturamento"
        : "producao_x_faturamento";

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório Cruzado");
    XLSX.writeFile(wb, `relatorio_${typeName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Relatórios</h1>
        <p className="text-muted-foreground">Exporte relatórios personalizados em Excel para análise</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="quadro_geral">
            <LayoutGrid className="h-4 w-4 mr-2" />
            Quadro Geral
          </TabsTrigger>
          <TabsTrigger value="cruzado">Relatórios Cruzados</TabsTrigger>
          <TabsTrigger value="producao_mensal">Produção Mensal</TabsTrigger>
        </TabsList>

        <TabsContent value="quadro_geral" className="space-y-4">
          <QuadroGeral />
        </TabsContent>

        <TabsContent value="cruzado" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Filtros do Relatório Cruzado</CardTitle>
              <CardDescription>
                Compare valores entre etapas do processo: produção, medição e faturamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Cruzamento</Label>
                  <Select value={crossType} onValueChange={(v) => setCrossType(v as CrossType)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="producao_medicao">Produção x Medição</SelectItem>
                      <SelectItem value="medicao_faturamento">Medição x Faturamento</SelectItem>
                      <SelectItem value="producao_faturamento">Produção x Faturamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Projeto</Label>
                  <Select value={projetoId || "all"} onValueChange={(v) => { setProjetoId(v === "all" ? "" : v); setSelectedSiteIds([]); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os projetos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os projetos</SelectItem>
                      {projetos.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.codigo} - {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Sites</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        <span className="truncate">
                          {selectedSiteIds.length === 0 
                            ? "Todos os sites" 
                            : `${selectedSiteIds.length} site(s)`}
                        </span>
                        <Filter className="h-4 w-4 ml-2" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="start">
                      <div className="p-3 border-b">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Selecionar sites</Label>
                          <Button variant="ghost" size="sm" onClick={handleSelectAllSites}>
                            {selectedSiteIds.length === filteredSites.length ? "Limpar" : "Todos"}
                          </Button>
                        </div>
                      </div>
                      <div className="max-h-72 overflow-auto p-2">
                        {filteredSites.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Nenhum site disponível
                          </p>
                        ) : (
                          filteredSites.map((site) => (
                            <div key={site.id} className="flex items-center space-x-2 py-1.5 px-2 hover:bg-muted rounded">
                              <Checkbox
                                id={`cross-${site.id}`}
                                checked={selectedSiteIds.includes(site.id)}
                                onCheckedChange={() => handleSiteToggle(site.id)}
                              />
                              <label htmlFor={`cross-${site.id}`} className="text-sm cursor-pointer flex-1">
                                {site.codigo} - {site.nome}
                              </label>
                            </div>
                          ))
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Data Início</Label>
                  <Input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Data Fim</Label>
                  <Input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <CardTitle>
                    Resultado: {crossType === "producao_medicao" 
                      ? "Produção x Medição" 
                      : crossType === "medicao_faturamento"
                        ? "Medição x Faturamento"
                        : "Produção x Faturamento"} ({filteredAndSortedCrossData.length})
                  </CardTitle>
                  {filteredAndSortedCrossData.length > 0 && (
                    <Button variant="outline" onClick={handleExportCrossReference}>
                      <FileDown className="h-4 w-4 mr-2" />
                      Exportar Excel
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Input
                    placeholder="Filtrar por projeto..."
                    value={crossProjetoFilter}
                    onChange={(e) => setCrossProjetoFilter(e.target.value)}
                    className="w-48"
                  />
                  <Input
                    placeholder="Filtrar por site/nome..."
                    value={crossSiteFilter}
                    onChange={(e) => setCrossSiteFilter(e.target.value)}
                    className="w-48"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {crossReferenceData.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum dado encontrado para os filtros selecionados
                </p>
              ) : filteredAndSortedCrossData.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum resultado para os filtros de tabela aplicados
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <Button variant="ghost" size="sm" onClick={() => handleCrossSort("projeto")} className="h-8 px-2 -ml-2">
                            Projeto {getCrossSortIcon("projeto")}
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button variant="ghost" size="sm" onClick={() => handleCrossSort("site")} className="h-8 px-2 -ml-2">
                            Site {getCrossSortIcon("site")}
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button variant="ghost" size="sm" onClick={() => handleCrossSort("nome")} className="h-8 px-2 -ml-2">
                            Nome {getCrossSortIcon("nome")}
                          </Button>
                        </TableHead>
                        <TableHead className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleCrossSort("origem")} className="h-8 px-2">
                            {labels.origem} {getCrossSortIcon("origem")}
                          </Button>
                        </TableHead>
                        <TableHead className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleCrossSort("destino")} className="h-8 px-2">
                            {labels.destino} {getCrossSortIcon("destino")}
                          </Button>
                        </TableHead>
                        <TableHead className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleCrossSort("diferenca")} className="h-8 px-2">
                            {labels.diff} {getCrossSortIcon("diferenca")}
                          </Button>
                        </TableHead>
                        <TableHead className="min-w-[300px]">Relatório Descritivo / Observações Diário</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAndSortedCrossData.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{row.projeto_codigo}</TableCell>
                          <TableCell>{row.site_codigo}</TableCell>
                          <TableCell>{row.site_nome}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.total_origem)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.total_destino)}</TableCell>
                          <TableCell className={`text-right font-semibold ${row.diferenca > 0 ? "text-orange-600" : row.diferenca < 0 ? "text-red-600" : ""}`}>
                            {formatCurrency(row.diferenca)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-pre-wrap break-words max-w-md">
                            {row.observacoes_diario.length > 0 ? (
                              <div className="space-y-2 group">
                                {row.observacoes_diario.map((obs, i) => (
                                  <div key={i} className={i > 0 ? "pt-2 border-t border-border/50" : ""}>
                                    {obs}
                                  </div>
                                ))}
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-6 px-2 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => {
                                    navigator.clipboard.writeText(row.observacoes_diario.join("\n---\n"));
                                    toast({
                                      description: "Relatório Descritivo / Observações copiados para a área de transferência",
                                    });
                                  }}
                                >
                                  Copiar observações
                                </Button>
                              </div>
                            ) : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell colSpan={3} className="text-right">TOTAL:</TableCell>
                        <TableCell className="text-right">{formatCurrency(crossReferenceTotals.totalOrigem)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(crossReferenceTotals.totalDestino)}</TableCell>
                        <TableCell className={`text-right ${crossReferenceTotals.diferenca > 0 ? "text-orange-600" : crossReferenceTotals.diferenca < 0 ? "text-red-600" : ""}`}>
                          {formatCurrency(crossReferenceTotals.diferenca)}
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="producao_mensal" className="space-y-4">
          <ProducaoMensal />
        </TabsContent>
      </Tabs>
    </div>
  );
}
