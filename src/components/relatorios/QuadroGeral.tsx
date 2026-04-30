import { useState, useMemo, useCallback, Fragment } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProjetos } from "@/hooks/useProjetos";
import { useSites } from "@/hooks/useSites";
import { useAreas } from "@/hooks/useAreas";
import { useLancamentosProducao, useLancamentosFaturamento } from "@/hooks/useLancamentos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ChevronRight, ChevronDown, FileDown, Building2, FolderOpen, Layers, MapPin, Filter } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

function MultiSelectFilter({ label, options, selected, onToggle, onSelectAll, onClearAll }: {
  label: string;
  options: string[];
  selected: Set<string>;
  onToggle: (v: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = options.filter(v => v.toLowerCase().includes(search.toLowerCase()));
  const isActive = selected.size > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs", isActive && "border-primary text-primary")}>
          <Filter className="h-3.5 w-3.5" />
          {label}
          {isActive && <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-[10px]">{selected.size}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 space-y-2" align="start">
        <Input
          placeholder={`Pesquisar ${label.toLowerCase()}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm"
        />
        <div className="flex gap-2 text-xs">
          <button onClick={onSelectAll} className="text-primary hover:underline">Todos</button>
          <button onClick={onClearAll} className="text-primary hover:underline">Limpar</button>
        </div>
        <div className="max-h-48 overflow-y-auto space-y-1">
          {filtered.map(v => (
            <label key={v} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent rounded px-1 py-0.5">
              <Checkbox
                checked={selected.has(v)}
                onCheckedChange={() => onToggle(v)}
                className="h-3.5 w-3.5"
              />
              <span className="truncate">{v}</span>
            </label>
          ))}
          {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Nenhum resultado</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface SiteRow {
  site_id: string;
  site_codigo: string;
  site_nome: string;
  valor_executado: number;
  valor_faturado: number;
  valor_nao_faturado: number;
  percentual_evolucao: number;
}

interface ProjetoRow {
  projeto_id: string;
  projeto_codigo: string;
  projeto_nome: string;
  cliente: string;
  area: string;
  valor_contrato: number;
  valor_executado: number;
  valor_faturado: number;
  valor_nao_faturado: number;
  saldo_contrato: number;
  percentual_evolucao: number;
  siteRows: SiteRow[];
}

interface Totals {
  valor_contrato: number;
  valor_executado: number;
  valor_faturado: number;
  valor_nao_faturado: number;
  saldo_contrato: number;
  percentual_evolucao: number;
}

interface ClienteGroup {
  cliente: string;
  projetos: ProjetoRow[];
  totals: Totals;
}

interface AreaGroup {
  area: string;
  clientes: ClienteGroup[];
  totals: Totals;
}

function calcTotals(rows: { valor_contrato: number; valor_executado: number; valor_faturado: number; valor_nao_faturado: number; saldo_contrato: number }[]): Totals {
  const t = rows.reduce(
    (acc, p) => ({
      valor_contrato: acc.valor_contrato + p.valor_contrato,
      valor_executado: acc.valor_executado + p.valor_executado,
      valor_faturado: acc.valor_faturado + p.valor_faturado,
      valor_nao_faturado: acc.valor_nao_faturado + p.valor_nao_faturado,
      saldo_contrato: acc.saldo_contrato + p.saldo_contrato,
    }),
    { valor_contrato: 0, valor_executado: 0, valor_faturado: 0, valor_nao_faturado: 0, saldo_contrato: 0 }
  );
  
  // Round totals to avoid floating point issues
  const rounded = {
    valor_contrato: Math.round(t.valor_contrato * 100) / 100,
    valor_executado: Math.round(t.valor_executado * 100) / 100,
    valor_faturado: Math.round(t.valor_faturado * 100) / 100,
    valor_nao_faturado: Math.round(t.valor_nao_faturado * 100) / 100,
    saldo_contrato: Math.round(t.saldo_contrato * 100) / 100,
  };

  return { ...rounded, percentual_evolucao: rounded.valor_contrato > 0 ? (rounded.valor_executado / rounded.valor_contrato) * 100 : 0 };
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatPercent = (value: number) =>
  `${Math.min(value, 100).toFixed(1)}%`;

function MiniProgressBar({ value }: { value: number }) {
  const clamped = Math.min(Math.max(value, 0), 100);
  const color =
    clamped >= 80 ? "bg-emerald-500" :
    clamped >= 50 ? "bg-amber-500" :
    clamped >= 25 ? "bg-orange-500" :
    "bg-red-400";

  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <div className="flex-1 h-5 bg-muted rounded-sm overflow-hidden relative">
        <div
          className={cn("h-full rounded-sm transition-all duration-500", color)}
          style={{ width: `${clamped}%` }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums mix-blend-difference text-white">
          {formatPercent(value)}
        </span>
      </div>
    </div>
  );
}

export default function QuadroGeral() {
  const queryClient = useQueryClient();
  const { projetos } = useProjetos();
  const { sites } = useSites();
  const { areas } = useAreas();
  const { lancamentos: producao } = useLancamentosProducao();
  const { lancamentos: faturamento } = useLancamentosFaturamento();

  const { data: escopoItens = [], isLoading: loadingEscopo } = useQuery({
    queryKey: ["escopo_itens_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("escopo_itens")
        .select("site_id, quantidade, valor_unitario")
        .limit(100000);
      if (error) throw error;
      return data;
    },
  });

  const { data: diarioProducoes = [], isLoading: loadingDiario } = useQuery({
    queryKey: ["diario_producao_quadro"],
    queryFn: async () => {
      let allData: any[] = [];
      let from = 0;
      const step = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("diario_producao")
          .select("quantidade, valor_total, item_lpu:itens_lpu(preco_unitario), diario:diarios_obra!inner(site_id)")
          .range(from, from + step - 1);
        
        if (error) throw error;
        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allData = [...allData, ...data];
          if (data.length < step) {
            hasMore = false;
          } else {
            from += step;
          }
        }
      }

      console.log(`[QuadroGeral] Fetched ${allData.length} production records`);
      return allData.map(p => ({
        site_id: (p as any).diario?.site_id || "",
        quantidade: Number(p.quantidade),
        preco_unitario: Number((p as any).item_lpu?.preco_unitario || 0),
        valor_total: Math.round(Number(p.valor_total || (Number(p.quantidade) * Number((p as any).item_lpu?.preco_unitario || 0))) * 100) / 100,
      }));
    },
  });

  const [filterArea, setFilterArea] = useState<Set<string>>(new Set());
  const [filterCliente, setFilterCliente] = useState<Set<string>>(new Set());
  const [filterProjeto, setFilterProjeto] = useState<Set<string>>(new Set());
  const [filterSite, setFilterSite] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<Set<string>>(new Set());

  const toggleSet = (setter: React.Dispatch<React.SetStateAction<Set<string>>>) => (v: string) => {
    setter(prev => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v); else next.add(v);
      return next;
    });
  };

  const [expandedArr, setExpandedArr] = usePersistedState<string[]>("quadro-geral-expanded", []);
  const expanded = useMemo(() => new Set(expandedArr), [expandedArr]);
  const setExpanded = useCallback((v: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    if (typeof v === "function") {
      setExpandedArr(prev => Array.from(v(new Set(prev))));
    } else {
      setExpandedArr(Array.from(v));
    }
  }, [setExpandedArr]);

  const toggle = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const memoData = useMemo(() => {
    const siteProjetoMap = new Map(sites.map(s => [s.id, s.projeto_id]));
    const areaMap = new Map(areas.map(a => [a.id, a.nome]));

    // Per-site executado
    const executadoBySite = new Map<string, number>();
    for (const p of producao) {
      const valor = Number(p.quantidade) * Number(p.item_lpu?.preco_unitario || 0);
      executadoBySite.set(p.site_id, (executadoBySite.get(p.site_id) || 0) + valor);
    }
    for (const dp of diarioProducoes) {
      const valor = (dp as any).valor_total || (dp.quantidade * dp.preco_unitario);
      executadoBySite.set(dp.site_id, (executadoBySite.get(dp.site_id) || 0) + valor);
    }

    // Per-site faturado
    const faturadoBySite = new Map<string, number>();
    for (const f of faturamento) {
      const valor = f.valor_faturado ? Number(f.valor_faturado) : Number(f.quantidade) * Number(f.item_lpu?.preco_unitario || 0);
      faturadoBySite.set(f.site_id, (faturadoBySite.get(f.site_id) || 0) + valor);
    }

    // Aggregate per projeto
    const executadoByProjeto = new Map<string, number>();
    const faturadoByProjeto = new Map<string, number>();
    for (const s of sites) {
      const exec = executadoBySite.get(s.id) || 0;
      const fat = faturadoBySite.get(s.id) || 0;
      executadoByProjeto.set(s.projeto_id, (executadoByProjeto.get(s.projeto_id) || 0) + exec);
      faturadoByProjeto.set(s.projeto_id, (faturadoByProjeto.get(s.projeto_id) || 0) + fat);
    }

    const projetoRows: ProjetoRow[] = projetos.map(p => {
      const valor_contrato = p.valor_total || 0;
      const valor_executado = Math.round((executadoByProjeto.get(p.id) || 0) * 100) / 100;
      const valor_faturado = Math.round((faturadoByProjeto.get(p.id) || 0) * 100) / 100;
      const valor_nao_faturado = Math.round((valor_executado - valor_faturado) * 100) / 100;
      const saldo_contrato = Math.max(0, Math.round((valor_contrato - valor_executado) * 100) / 100);
      const percentual_evolucao = valor_contrato > 0 ? (valor_executado / valor_contrato) * 100 : 0;
      const areaName = (p as any).area_id ? (areaMap.get((p as any).area_id) || "Sem área") : "Sem área";

      const projetoSites = sites.filter(s => s.projeto_id === p.id);
      const siteRows: SiteRow[] = projetoSites.map(s => {
        const sExec = Math.round((executadoBySite.get(s.id) || 0) * 100) / 100;
        const sFat = Math.round((faturadoBySite.get(s.id) || 0) * 100) / 100;
        return {
          site_id: s.id,
          site_codigo: s.codigo,
          site_nome: s.nome,
          valor_executado: sExec,
          valor_faturado: sFat,
          valor_nao_faturado: Math.round((sExec - sFat) * 100) / 100,
          percentual_evolucao: valor_contrato > 0 ? (sExec / valor_contrato) * 100 : 0,
        };
      });

      return {
        projeto_id: p.id,
        projeto_codigo: p.codigo,
        projeto_nome: p.nome,
        cliente: p.cliente || "Sem cliente",
        area: areaName,
        valor_contrato, valor_executado, valor_faturado, valor_nao_faturado, saldo_contrato, percentual_evolucao,
        siteRows,
      };
    });

    const areaClienteMap = new Map<string, Map<string, ProjetoRow[]>>();
    for (const row of projetoRows) {
      if (!areaClienteMap.has(row.area)) areaClienteMap.set(row.area, new Map());
      const clienteMap = areaClienteMap.get(row.area)!;
      if (!clienteMap.has(row.cliente)) clienteMap.set(row.cliente, []);
      clienteMap.get(row.cliente)!.push(row);
    }

    const groups: AreaGroup[] = Array.from(areaClienteMap.entries())
      .map(([area, clienteMap]) => {
        const clientes: ClienteGroup[] = Array.from(clienteMap.entries())
          .map(([cliente, projetos]) => ({ cliente, projetos, totals: calcTotals(projetos) }))
          .sort((a, b) => a.cliente.localeCompare(b.cliente));
        const allProjetos = clientes.flatMap(c => c.projetos);
        return { area, clientes, totals: calcTotals(allProjetos) };
      })
      .sort((a, b) => a.area.localeCompare(b.area));

    return { areaGroups: groups, allProjetoRows: projetoRows };
  }, [projetos, sites, areas, escopoItens, producao, faturamento, diarioProducoes]);

  const areaGroups = memoData.areaGroups;
  const allProjetoRows = memoData.allProjetoRows;

  // Extract unique filter options
  const filterOptions = useMemo(() => {
    const areasSet = new Set<string>();
    const clientesSet = new Set<string>();
    const projetosSet = new Set<string>();
    const sitesSet = new Set<string>();
    const statusSet = new Set<string>();
    for (const ag of areaGroups) {
      areasSet.add(ag.area);
      for (const cg of ag.clientes) {
        clientesSet.add(cg.cliente);
        for (const p of cg.projetos) {
          projetosSet.add(p.projeto_nome);
          const proj = projetos.find(pr => pr.id === p.projeto_id);
          statusSet.add(proj?.status || "Sem status");
          for (const s of p.siteRows) {
            sitesSet.add(`${s.site_codigo} - ${s.site_nome}`);
          }
        }
      }
    }
    return {
      areas: Array.from(areasSet).sort(),
      clientes: Array.from(clientesSet).sort(),
      projetos: Array.from(projetosSet).sort(),
      sites: Array.from(sitesSet).sort(),
      status: Array.from(statusSet).sort(),
    };
  }, [areaGroups, projetos]);

  // Apply filters
  const filteredAreaGroups = useMemo(() => {
    return areaGroups
      .filter(ag => filterArea.size === 0 || filterArea.has(ag.area))
      .map(ag => {
        const clientes = ag.clientes
          .filter(cg => filterCliente.size === 0 || filterCliente.has(cg.cliente))
          .map(cg => {
            const filteredProjetos = cg.projetos.filter(p => {
              if (filterProjeto.size > 0 && !filterProjeto.has(p.projeto_nome)) return false;
              const proj = projetos.find(pr => pr.id === p.projeto_id);
              const st = proj?.status || "Sem status";
              if (filterStatus.size > 0 && !filterStatus.has(st)) return false;
              if (filterSite.size > 0) {
                const hasSiteMatch = p.siteRows.some(s => filterSite.has(`${s.site_codigo} - ${s.site_nome}`));
                if (!hasSiteMatch) return false;
              }
              return true;
            });
            if (filteredProjetos.length === 0) return null;
            return { ...cg, projetos: filteredProjetos, totals: calcTotals(filteredProjetos) };
          })
          .filter(Boolean) as ClienteGroup[];
        if (clientes.length === 0) return null;
        const allProjetos = clientes.flatMap(c => c.projetos);
        return { ...ag, clientes, totals: calcTotals(allProjetos) };
      })
      .filter(Boolean) as AreaGroup[];
  }, [areaGroups, filterArea, filterCliente, filterProjeto, filterSite, filterStatus, projetos]);

  const grandTotals = useMemo(() => calcTotals(filteredAreaGroups.map(g => g.totals)), [filteredAreaGroups]);
  const grandPercent = grandTotals.valor_contrato > 0 ? (grandTotals.valor_executado / grandTotals.valor_contrato) * 100 : 0;

  const expandAll = () => {
    const keys = new Set<string>();
    filteredAreaGroups.forEach(ag => {
      keys.add(`area:${ag.area}`);
      ag.clientes.forEach(cg => {
        keys.add(`cliente:${ag.area}|${cg.cliente}`);
        cg.projetos.forEach(p => {
          if (p.siteRows.length > 0) keys.add(`projeto:${p.projeto_id}`);
        });
      });
    });
    setExpanded(keys);
  };
  const collapseAll = () => setExpanded(new Set());

  const handleExport = () => {
    const rows: any[] = [];
    for (const ag of filteredAreaGroups) {
      for (const cg of ag.clientes) {
        for (const p of cg.projetos) {
          if (p.siteRows.length > 0) {
            for (const s of p.siteRows) {
              rows.push({
                Área: p.area,
                Cliente: p.cliente,
                "Código Projeto": p.projeto_codigo,
                "Nome Projeto": p.projeto_nome,
                "Código Site": s.site_codigo,
                "Nome Site": s.site_nome,
                "Valor Contrato": p.valor_contrato,
                "Valor Executado": s.valor_executado,
                "Valor Faturado": s.valor_faturado,
                "Não Faturado": s.valor_nao_faturado,
                "Saldo Contrato": "",
                "% Evolução": Number(s.percentual_evolucao.toFixed(1)),
              });
            }
          } else {
            rows.push({
              Área: p.area,
              Cliente: p.cliente,
              "Código Projeto": p.projeto_codigo,
              "Nome Projeto": p.projeto_nome,
              "Código Site": "",
              "Nome Site": "",
              "Valor Contrato": p.valor_contrato,
              "Valor Executado": p.valor_executado,
              "Valor Faturado": p.valor_faturado,
              "Não Faturado": p.valor_nao_faturado,
              "Saldo Contrato": p.saldo_contrato,
              "% Evolução": Number(p.percentual_evolucao.toFixed(1)),
            });
          }
        }
      }
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Quadro Geral");
    XLSX.writeFile(wb, `quadro_geral_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const isLoading = loadingEscopo || loadingDiario;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }


  function TotalsRow({ t, naoFaturadoHighlight = true }: { t: Totals; naoFaturadoHighlight?: boolean }) {
    return (
      <>
        <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(t.valor_contrato)}</TableCell>
        <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(t.valor_executado)}</TableCell>
        <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(t.valor_faturado)}</TableCell>
        <TableCell className={cn("text-right font-semibold tabular-nums", naoFaturadoHighlight && t.valor_nao_faturado > 0 ? "text-orange-600" : "")}>
          {formatCurrency(t.valor_nao_faturado)}
        </TableCell>
        <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(t.saldo_contrato)}</TableCell>
        <TableCell><MiniProgressBar value={t.percentual_evolucao} /></TableCell>
      </>
    );
  }

  return (
    <div className="space-y-4">

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-medium">Valor Total Contratos</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-lg font-bold tabular-nums">{formatCurrency(grandTotals.valor_contrato)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-medium">Total Executado</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-lg font-bold tabular-nums">{formatCurrency(grandTotals.valor_executado)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-medium">Total Faturado</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-lg font-bold tabular-nums">{formatCurrency(grandTotals.valor_faturado)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-medium">Evolução Geral</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <MiniProgressBar value={grandPercent} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-lg">Quadro Geral por Área / Cliente / Projeto / Site</CardTitle>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={expandAll}>Expandir Todos</Button>
            <Button variant="ghost" size="sm" onClick={collapseAll}>Recolher Todos</Button>
            {filteredAreaGroups.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleExport}>
                <FileDown className="h-4 w-4 mr-2" />
                Exportar Excel
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <MultiSelectFilter label="Área" options={filterOptions.areas} selected={filterArea} onToggle={toggleSet(setFilterArea)} onSelectAll={() => setFilterArea(new Set(filterOptions.areas))} onClearAll={() => setFilterArea(new Set())} />
            <MultiSelectFilter label="Cliente" options={filterOptions.clientes} selected={filterCliente} onToggle={toggleSet(setFilterCliente)} onSelectAll={() => setFilterCliente(new Set(filterOptions.clientes))} onClearAll={() => setFilterCliente(new Set())} />
            <MultiSelectFilter label="Projeto" options={filterOptions.projetos} selected={filterProjeto} onToggle={toggleSet(setFilterProjeto)} onSelectAll={() => setFilterProjeto(new Set(filterOptions.projetos))} onClearAll={() => setFilterProjeto(new Set())} />
            <MultiSelectFilter label="Site" options={filterOptions.sites} selected={filterSite} onToggle={toggleSet(setFilterSite)} onSelectAll={() => setFilterSite(new Set(filterOptions.sites))} onClearAll={() => setFilterSite(new Set())} />
            <MultiSelectFilter label="Status" options={filterOptions.status} selected={filterStatus} onToggle={toggleSet(setFilterStatus)} onSelectAll={() => setFilterStatus(new Set(filterOptions.status))} onClearAll={() => setFilterStatus(new Set())} />
            {(filterArea.size > 0 || filterCliente.size > 0 || filterProjeto.size > 0 || filterSite.size > 0 || filterStatus.size > 0) && (
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setFilterArea(new Set()); setFilterCliente(new Set()); setFilterProjeto(new Set()); setFilterSite(new Set()); setFilterStatus(new Set()); }}>
                Limpar filtros
              </Button>
            )}
          </div>
          {filteredAreaGroups.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum projeto cadastrado</p>
          ) : (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[360px]">Área / Cliente / Projeto / Site</TableHead>
                    <TableHead className="text-right">Valor Contrato</TableHead>
                    <TableHead className="text-right">Valor Executado</TableHead>
                    <TableHead className="text-right">Valor Faturado</TableHead>
                    <TableHead className="text-right">Não Faturado</TableHead>
                    <TableHead className="text-right">Saldo Contrato</TableHead>
                    <TableHead className="text-center min-w-[160px]">% Evolução</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAreaGroups.map(ag => {
                    const areaKey = `area:${ag.area}`;
                    const areaExpanded = expanded.has(areaKey);
                    const totalClientes = ag.clientes.length;
                    const totalProjetos = ag.clientes.reduce((s, c) => s + c.projetos.length, 0);
                    return (
                      <Fragment key={areaKey}>
                        <TableRow
                          className="bg-muted/60 cursor-pointer hover:bg-muted/80 transition-colors"
                          onClick={() => toggle(areaKey)}
                        >
                          <TableCell className="font-bold">
                            <div className="flex items-center gap-2">
                              {areaExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                              <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span>{ag.area}</span>
                              <span className="text-xs text-muted-foreground font-normal ml-1">
                                ({totalClientes} cliente{totalClientes !== 1 ? "s" : ""}, {totalProjetos} projeto{totalProjetos !== 1 ? "s" : ""})
                              </span>
                            </div>
                          </TableCell>
                          <TotalsRow t={ag.totals} />
                        </TableRow>

                        {areaExpanded && ag.clientes.map(cg => {
                          const clienteKey = `cliente:${ag.area}|${cg.cliente}`;
                          const clienteExpanded = expanded.has(clienteKey);
                          return (
                            <Fragment key={clienteKey}>
                              <TableRow
                                className="bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => toggle(clienteKey)}
                              >
                                <TableCell className="font-semibold">
                                  <div className="flex items-center gap-2 pl-6">
                                    {clienteExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <span>{cg.cliente}</span>
                                    <span className="text-xs text-muted-foreground font-normal ml-1">
                                      ({cg.projetos.length} projeto{cg.projetos.length !== 1 ? "s" : ""})
                                    </span>
                                  </div>
                                </TableCell>
                                <TotalsRow t={cg.totals} />
                              </TableRow>

                              {clienteExpanded && cg.projetos.map(p => {
                                const projetoKey = `projeto:${p.projeto_id}`;
                                const projetoExpanded = expanded.has(projetoKey);
                                const hasSites = p.siteRows.length > 0;
                                return (
                                  <Fragment key={p.projeto_id}>
                                    <TableRow
                                      className={cn("hover:bg-muted/20", hasSites && "cursor-pointer")}
                                      onClick={() => hasSites && toggle(projetoKey)}
                                    >
                                      <TableCell>
                                        <div className="flex items-center gap-2 pl-12">
                                          {hasSites ? (
                                            projetoExpanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                                          ) : (
                                            <span className="w-3.5" />
                                          )}
                                          <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                                          <span className="font-medium text-sm">{p.projeto_codigo}</span>
                                          <span className="text-muted-foreground text-sm">— {p.projeto_nome}</span>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-right tabular-nums text-sm">{formatCurrency(p.valor_contrato)}</TableCell>
                                      <TableCell className="text-right tabular-nums text-sm">{formatCurrency(p.valor_executado)}</TableCell>
                                      <TableCell className="text-right tabular-nums text-sm">{formatCurrency(p.valor_faturado)}</TableCell>
                                      <TableCell className={cn("text-right tabular-nums text-sm", p.valor_nao_faturado > 0 ? "text-orange-600" : "")}>
                                        {formatCurrency(p.valor_nao_faturado)}
                                      </TableCell>
                                      <TableCell className="text-right tabular-nums text-sm">{formatCurrency(p.saldo_contrato)}</TableCell>
                                      <TableCell><MiniProgressBar value={p.percentual_evolucao} /></TableCell>
                                    </TableRow>

                                    {projetoExpanded && p.siteRows.map(s => (
                                      <TableRow key={s.site_id} className="hover:bg-muted/10">
                                        <TableCell>
                                          <div className="flex items-center gap-2 pl-20">
                                            <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                            <span className="text-xs font-medium">{s.site_codigo}</span>
                                            <span className="text-xs text-muted-foreground">— {s.site_nome}</span>
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-xs text-muted-foreground">—</TableCell>
                                        <TableCell className="text-right tabular-nums text-xs">{formatCurrency(s.valor_executado)}</TableCell>
                                        <TableCell className="text-right tabular-nums text-xs">{formatCurrency(s.valor_faturado)}</TableCell>
                                        <TableCell className={cn("text-right tabular-nums text-xs", s.valor_nao_faturado > 0 ? "text-orange-600" : "")}>
                                          {formatCurrency(s.valor_nao_faturado)}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-xs text-muted-foreground">—</TableCell>
                                        <TableCell><MiniProgressBar value={s.percentual_evolucao} /></TableCell>
                                      </TableRow>
                                    ))}
                                  </Fragment>
                                );
                              })}
                            </Fragment>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>TOTAL GERAL</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(grandTotals.valor_contrato)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(grandTotals.valor_executado)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(grandTotals.valor_faturado)}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", grandTotals.valor_nao_faturado > 0 ? "text-orange-600" : "")}>
                      {formatCurrency(grandTotals.valor_nao_faturado)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(grandTotals.saldo_contrato)}</TableCell>
                    <TableCell><MiniProgressBar value={grandPercent} /></TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}