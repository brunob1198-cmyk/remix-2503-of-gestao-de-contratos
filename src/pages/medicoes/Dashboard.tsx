import { useState, useMemo } from "react";
import { DashboardCards } from "@/components/medicoes/DashboardCards";
import { useDashboard } from "@/hooks/useDashboard";
import { useProjetos } from "@/hooks/useProjetos";
import { useSites } from "@/hooks/useSites";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FileDown, Loader2, ArrowUpDown, ArrowUp, ArrowDown, Search, Filter, X } from "lucide-react";
import { exportDashboardToExcel } from "@/lib/medicoesExport";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { usePersistedState } from "@/hooks/usePersistedState";

type SortField = "projeto" | "site" | "codigo" | "descricao" | "qtd_produzida" | "qtd_medida" | "qtd_faturada" | "qtd_a_medir" | "qtd_a_faturar" | "valor_produzido";
type SortDirection = "asc" | "desc";

export default function DashboardPage() {
  const [projetoId, setProjetoId] = usePersistedState<string>("dashboard_projeto_id", "");
  const [selectedSiteIds, setSelectedSiteIds] = usePersistedState<string[]>("dashboard_site_ids", []);
  const { projetos } = useProjetos();
  const { sites } = useSites();
  const { resumoProjetos, resumoItens, totais, isLoading } = useDashboard(
    projetoId || undefined,
    selectedSiteIds.length > 0 ? selectedSiteIds : undefined
  );

  const [sortField, setSortField] = useState<SortField>("valor_produzido");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [projetoFilter, setProjetoFilter] = useState<string>("");
  const [siteFilter, setSiteFilter] = useState<string>("");

  const filteredSitesForSelection = projetoId 
    ? sites.filter(s => s.projeto_id === projetoId)
    : sites;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleExport = () => {
    exportDashboardToExcel(resumoProjetos, resumoItens, totais);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    return sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const handleSiteToggle = (siteId: string) => {
    setSelectedSiteIds(prev => 
      prev.includes(siteId) 
        ? prev.filter(id => id !== siteId)
        : [...prev, siteId]
    );
  };

  const handleSelectAllSites = () => {
    if (selectedSiteIds.length === filteredSitesForSelection.length) {
      setSelectedSiteIds([]);
    } else {
      setSelectedSiteIds(filteredSitesForSelection.map(s => s.id));
    }
  };

  const filteredAndSortedItems = useMemo(() => {
    let items = [...resumoItens];

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      items = items.filter(
        item => 
          item.codigo.toLowerCase().includes(term) || 
          item.descricao.toLowerCase().includes(term)
      );
    }

    // Filter by projeto in header
    if (projetoFilter) {
      const term = projetoFilter.toLowerCase();
      items = items.filter(item => 
        item.projeto_codigo?.toLowerCase().includes(term) ||
        item.projeto_nome?.toLowerCase().includes(term)
      );
    }

    // Filter by site in header
    if (siteFilter) {
      const term = siteFilter.toLowerCase();
      items = items.filter(item => 
        item.site_codigo?.toLowerCase().includes(term) ||
        item.site_nome?.toLowerCase().includes(term)
      );
    }

    // Sort
    items.sort((a, b) => {
      let valueA: any = a[sortField as keyof typeof a];
      let valueB: any = b[sortField as keyof typeof b];

      if (sortField === "projeto") {
        valueA = a.projeto_codigo || "";
        valueB = b.projeto_codigo || "";
      } else if (sortField === "site") {
        valueA = a.site_codigo || "";
        valueB = b.site_codigo || "";
      }

      if (typeof valueA === "string") {
        valueA = valueA.toLowerCase();
        valueB = (valueB as string).toLowerCase();
      }

      if (valueA < valueB) return sortDirection === "asc" ? -1 : 1;
      if (valueA > valueB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return items;
  }, [resumoItens, sortField, sortDirection, searchTerm, projetoFilter, siteFilter]);

  // Chart data - use filtered data from resumoProjetos
  const chartData = resumoProjetos.filter(p => p.total_produzido > 0 || p.total_medido > 0 || p.total_faturado > 0).map(p => ({
    name: p.codigo,
    Produzido: p.total_produzido,
    Medido: p.total_medido,
    Faturado: p.total_faturado,
  }));

  // Pie chart: % Medição e % Faturamento em cima do total de Produção
  const pieData = useMemo(() => {
    if (totais.totalProduzido === 0) return [];
    
    const percentMedido = (totais.totalMedido / totais.totalProduzido) * 100;
    const percentFaturado = (totais.totalFaturado / totais.totalProduzido) * 100;
    const percentRestante = 100 - percentMedido;
    
    return [
      { name: `Faturado (${percentFaturado.toFixed(1)}%)`, value: totais.totalFaturado, color: "#10b981" },
      { name: `Medido não Faturado (${((totais.totalMedido - totais.totalFaturado) / totais.totalProduzido * 100).toFixed(1)}%)`, value: Math.max(0, totais.totalMedido - totais.totalFaturado), color: "#22c55e" },
      { name: `A Medir (${(totais.totalAMedir / totais.totalProduzido * 100).toFixed(1)}%)`, value: Math.max(0, totais.totalAMedir), color: "#f97316" },
    ].filter(d => d.value > 0);
  }, [totais]);

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
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral de produção, medição e faturamento</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={projetoId || "all"} onValueChange={(v) => { setProjetoId(v === "all" ? "" : v); setSelectedSiteIds([]); }}>
            <SelectTrigger className="w-64">
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

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-64 justify-between">
                <span className="truncate">
                  {selectedSiteIds.length === 0 
                    ? "Todos os sites" 
                    : `${selectedSiteIds.length} site(s) selecionado(s)`}
                </span>
                <Filter className="h-4 w-4 ml-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
              <div className="p-3 border-b">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Filtrar por sites</Label>
                  <Button variant="ghost" size="sm" onClick={handleSelectAllSites}>
                    {selectedSiteIds.length === filteredSitesForSelection.length ? "Limpar" : "Selecionar todos"}
                  </Button>
                </div>
              </div>
              <div className="max-h-60 overflow-auto p-2">
                {filteredSitesForSelection.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {projetoId ? "Nenhum site neste projeto" : "Nenhum site cadastrado"}
                  </p>
                ) : (
                  filteredSitesForSelection.map((site) => (
                    <div key={site.id} className="flex items-center space-x-2 py-1.5 px-2 hover:bg-muted rounded">
                      <Checkbox
                        id={site.id}
                        checked={selectedSiteIds.includes(site.id)}
                        onCheckedChange={() => handleSiteToggle(site.id)}
                      />
                      <label htmlFor={site.id} className="text-sm cursor-pointer flex-1">
                        {site.codigo} - {site.nome}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>

          <Button variant="outline" onClick={handleExport}>
            <FileDown className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
        </div>
      </div>

      <DashboardCards totais={totais} />

      <div className="grid gap-6 lg:grid-cols-2">
        {chartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Valores por Projeto</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="Produzido" fill="#3b82f6" />
                  <Bar dataKey="Medido" fill="#22c55e" />
                  <Bar dataKey="Faturado" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {pieData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Status Geral (% sobre Produção)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name }) => name}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="text-center text-sm text-muted-foreground mt-2">
                Total Produzido: {formatCurrency(totais.totalProduzido)}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle>Resumo por Item LPU</CardTitle>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar código ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredAndSortedItems.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum lançamento encontrado</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <div className="space-y-1">
                        <Button variant="ghost" size="sm" onClick={() => handleSort("projeto")} className="h-8 px-2 -ml-2">
                          Projeto {getSortIcon("projeto")}
                        </Button>
                        <Input
                          placeholder="Filtrar..."
                          value={projetoFilter}
                          onChange={(e) => setProjetoFilter(e.target.value)}
                          className="h-7 text-xs"
                        />
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="space-y-1">
                        <Button variant="ghost" size="sm" onClick={() => handleSort("site")} className="h-8 px-2 -ml-2">
                          Site {getSortIcon("site")}
                        </Button>
                        <Input
                          placeholder="Filtrar..."
                          value={siteFilter}
                          onChange={(e) => setSiteFilter(e.target.value)}
                          className="h-7 text-xs"
                        />
                      </div>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" onClick={() => handleSort("codigo")} className="h-8 px-2 -ml-2">
                        Código {getSortIcon("codigo")}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" onClick={() => handleSort("descricao")} className="h-8 px-2 -ml-2">
                        Descrição {getSortIcon("descricao")}
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleSort("qtd_produzida")} className="h-8 px-2">
                        Qtd Produzida {getSortIcon("qtd_produzida")}
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleSort("qtd_medida")} className="h-8 px-2">
                        Qtd Medida {getSortIcon("qtd_medida")}
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleSort("qtd_faturada")} className="h-8 px-2">
                        Qtd Faturada {getSortIcon("qtd_faturada")}
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleSort("qtd_a_medir")} className="h-8 px-2">
                        A Medir {getSortIcon("qtd_a_medir")}
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleSort("qtd_a_faturar")} className="h-8 px-2">
                        A Faturar {getSortIcon("qtd_a_faturar")}
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleSort("valor_produzido")} className="h-8 px-2">
                        Valor Produzido {getSortIcon("valor_produzido")}
                      </Button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedItems.slice(0, 100).map((item, index) => (
                    <TableRow key={`${item.item_lpu_id}_${item.site_codigo}_${index}`}>
                      <TableCell className="font-medium">{item.projeto_codigo}</TableCell>
                      <TableCell>{item.site_codigo}</TableCell>
                      <TableCell className="font-mono">{item.codigo}</TableCell>
                      <TableCell className="max-w-xs truncate">{item.descricao}</TableCell>
                      <TableCell className="text-right">{item.qtd_produzida.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right">{item.qtd_medida.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right">{item.qtd_faturada.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className={`text-right ${item.qtd_a_medir > 0 ? "text-orange-600 font-semibold" : ""}`}>
                        {item.qtd_a_medir.toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className={`text-right ${item.qtd_a_faturar > 0 ? "text-yellow-600 font-semibold" : ""}`}>
                        {item.qtd_a_faturar.toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(item.valor_produzido)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredAndSortedItems.length > 50 && (
                <p className="text-center text-muted-foreground mt-4 text-sm">
                  Mostrando 50 de {filteredAndSortedItems.length} itens
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
