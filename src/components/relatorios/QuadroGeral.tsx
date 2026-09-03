import { useState, useMemo, useCallback, Fragment } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/lib/supabasePagination";
import { useProjetos } from "@/hooks/useProjetos";

import { useSites } from "@/hooks/useSites";
import { useAreas } from "@/hooks/useAreas";
import { useLancamentosProducao } from "@/hooks/useLancamentos";
import { useContratos } from "@/hooks/useContratos";
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
import { MonthRangePicker } from "@/components/analise/MonthRangePicker";
import { startOfYear, endOfYear, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";

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
  percentual_evolucao: number;
}

/**
 * `mb_orcada_rs`, `mb_real_rs` e `receita_liquida` não aparecem como coluna —
 * existem só para o rollup de % MB Orç./% MB Real em Cliente/Área/Total sair
 * de somar reais e dividir no fim, e não de tirar média de percentual.
 */
interface ProjetoRow {
  projeto_id: string;
  projeto_codigo: string;
  projeto_nome: string;
  cliente: string;
  area: string;
  valor_contrato: number;
  valor_executado: number;
  saldo_contrato: number;
  percentual_evolucao: number;
  resultado_orc: number;
  mb_orcada_rs: number;
  mb_real_rs: number;
  receita_liquida: number;
  percentual_mb_orc: number;
  percentual_mb_real: number;
  siteRows: SiteRow[];
}

interface Totals {
  valor_contrato: number;
  valor_executado: number;
  saldo_contrato: number;
  percentual_evolucao: number;
  resultado_orc: number;
  mb_orcada_rs: number;
  mb_real_rs: number;
  receita_liquida: number;
  percentual_mb_orc: number;
  percentual_mb_real: number;
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

function calcTotals(rows: { valor_contrato: number; valor_executado: number; saldo_contrato: number; resultado_orc: number; mb_orcada_rs: number; mb_real_rs: number; receita_liquida: number }[]): Totals {
  const t = rows.reduce(
    (acc, p) => ({
      valor_contrato: acc.valor_contrato + p.valor_contrato,
      valor_executado: acc.valor_executado + p.valor_executado,
      saldo_contrato: acc.saldo_contrato + p.saldo_contrato,
      resultado_orc: acc.resultado_orc + p.resultado_orc,
      mb_orcada_rs: acc.mb_orcada_rs + p.mb_orcada_rs,
      mb_real_rs: acc.mb_real_rs + p.mb_real_rs,
      receita_liquida: acc.receita_liquida + p.receita_liquida,
    }),
    { valor_contrato: 0, valor_executado: 0, saldo_contrato: 0, resultado_orc: 0, mb_orcada_rs: 0, mb_real_rs: 0, receita_liquida: 0 }
  );

  // Round totals to avoid floating point issues
  const rounded = {
    valor_contrato: Math.round(t.valor_contrato * 100) / 100,
    valor_executado: Math.round(t.valor_executado * 100) / 100,
    saldo_contrato: Math.round(t.saldo_contrato * 100) / 100,
    resultado_orc: Math.round(t.resultado_orc * 100) / 100,
    mb_orcada_rs: Math.round(t.mb_orcada_rs * 100) / 100,
    mb_real_rs: Math.round(t.mb_real_rs * 100) / 100,
    receita_liquida: Math.round(t.receita_liquida * 100) / 100,
  };

  return {
    ...rounded,
    percentual_evolucao: rounded.valor_contrato > 0 ? (rounded.valor_executado / rounded.valor_contrato) * 100 : 0,
    // % acumulado do período = soma dos reais / soma da receita líquida — nunca média das % mensais.
    percentual_mb_orc: rounded.receita_liquida > 0 ? (rounded.mb_orcada_rs / rounded.receita_liquida) * 100 : 0,
    percentual_mb_real: rounded.receita_liquida > 0 ? (rounded.mb_real_rs / rounded.receita_liquida) * 100 : 0,
  };
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatPercent = (value: number) =>
  `${value.toFixed(1)}%`;

function MiniProgressBar({ value }: { value: number }) {
  const clamped = Math.min(Math.max(value, 0), 100);
  const tone =
    value >= 80 ? { bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" } :
    value >= 50 ? { bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" } :
    value >= 25 ? { bar: "bg-orange-500", text: "text-orange-600 dark:text-orange-400" } :
    { bar: "bg-red-500", text: "text-red-600 dark:text-red-400" };

  return (
    <div className="flex items-center gap-2 min-w-[140px]" title={formatPercent(value)}>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", tone.bar)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className={cn("text-xs font-semibold tabular-nums w-[52px] text-right shrink-0", tone.text)}>
        {formatPercent(value)}
      </span>
    </div>
  );
}


export default function QuadroGeral() {
  const queryClient = useQueryClient();
  const { projetos } = useProjetos();
  const { sites } = useSites();
  const { areas } = useAreas();
  const { lancamentos: producao } = useLancamentosProducao();
  const { contratos: parentsContratos } = useContratos();

  const { data: escopoItens = [], isLoading: loadingEscopo } = useQuery({
    queryKey: ["escopo_itens_all"],
    staleTime: 1000 * 60 * 30, // 30 min cache
    gcTime: 1000 * 60 * 60,
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
    staleTime: 1000 * 60 * 30, // 30 min cache
    gcTime: 1000 * 60 * 60,
    queryFn: async () => {
      console.log("[QuadroGeral] Fetching BI production data...");
      const query = supabase
        .from("view_bi_producao")
        .select("site_id, quantidade, valor_total");
      
      const data = await fetchAllPages<any>(query);
      console.log(`[QuadroGeral] Fetched ${data.length} records from view_bi_producao`);
      
      return data.map(p => ({
        site_id: p.site_id || "",
        quantidade: Number(p.quantidade),
        valor_total: Math.round(Number(p.valor_total) * 100) / 100,
      }));
    },
  });

  // Resultado/Orç. e MB (Orç./Real) são mensais na origem (view_bi_analise_obras,
  // uma linha por projeto+mês) — mesma fonte que a tela Análise de Custos e
  // Margens. Cache compartilhado com o Dashboard: mesma query key, mesmo dado.
  const { data: biAnalise = [], isLoading: loadingBi } = useQuery({
    queryKey: ["bi_analise_dashboard"],
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("view_bi_analise_obras")
        .select("*");
      if (error) throw error;
      return data || [];
    },
  });

  const [rmPeriodoInicioStr, setRmPeriodoInicioStr] = usePersistedState<string>(
    "quadro-geral-rm-periodo-inicio",
    startOfYear(new Date()).toISOString()
  );
  const [rmPeriodoFimStr, setRmPeriodoFimStr] = usePersistedState<string>(
    "quadro-geral-rm-periodo-fim",
    endOfYear(new Date()).toISOString()
  );
  const rmPeriodoInicio = useMemo(() => new Date(rmPeriodoInicioStr), [rmPeriodoInicioStr]);
  const rmPeriodoFim = useMemo(() => new Date(rmPeriodoFimStr), [rmPeriodoFimStr]);

  // Soma por projeto dentro do período escolhido — nunca a % já pronta da
  // view, que é mensal: acumular precisa ser reais somados / reais somados.
  const biMapByProjeto = useMemo(() => {
    const map = new Map<string, { resultadoTotal: number; mbOrcada: number; mbReal: number; receitaLiquida: number }>();
    const start = startOfMonth(rmPeriodoInicio);
    const end = endOfMonth(rmPeriodoFim);
    for (const row of biAnalise as any[]) {
      const projetoId = row["ID Projeto"];
      const ano = row["Ano"];
      const mesNum = row["Mês Num"];
      if (!projetoId || !ano || !mesNum) continue;
      const dataRef = new Date(ano, mesNum - 1, 1);
      if (!isWithinInterval(dataRef, { start, end })) continue;
      const prev = map.get(projetoId) || { resultadoTotal: 0, mbOrcada: 0, mbReal: 0, receitaLiquida: 0 };
      map.set(projetoId, {
        resultadoTotal: prev.resultadoTotal + Number(row["Resultado Total"] || 0),
        mbOrcada: prev.mbOrcada + Number(row["MB Orç. (R$)"] || 0),
        mbReal: prev.mbReal + Number(row["MB Real (R$)"] || 0),
        receitaLiquida: prev.receitaLiquida + Number(row["Receita Líquida"] || 0),
      });
    }
    return map;
  }, [biAnalise, rmPeriodoInicio, rmPeriodoFim]);

  const [filterAreaArr, setFilterAreaArr] = usePersistedState<string[]>("quadro-geral-filter-area", []);
  const [filterClienteArr, setFilterClienteArr] = usePersistedState<string[]>("quadro-geral-filter-cliente", []);
  const [filterProjetoArr, setFilterProjetoArr] = usePersistedState<string[]>("quadro-geral-filter-projeto", []);
  const [filterSiteArr, setFilterSiteArr] = usePersistedState<string[]>("quadro-geral-filter-site", []);
  const [filterStatusArr, setFilterStatusArr] = usePersistedState<string[]>("quadro-geral-filter-status", []);
  const [visibleColumnsArr, setVisibleColumnsArr] = usePersistedState<string[]>("quadro-geral-visible-columns", ["Area", "Cliente", "Projeto", "Site", "Status"]);

  const filterArea = useMemo(() => new Set(filterAreaArr), [filterAreaArr]);
  const filterCliente = useMemo(() => new Set(filterClienteArr), [filterClienteArr]);
  const filterProjeto = useMemo(() => new Set(filterProjetoArr), [filterProjetoArr]);
  const filterSite = useMemo(() => new Set(filterSiteArr), [filterSiteArr]);
  const filterStatus = useMemo(() => new Set(filterStatusArr), [filterStatusArr]);
  const visibleColumns = useMemo(() => new Set(visibleColumnsArr), [visibleColumnsArr]);

  const toggleSet = (setter: (val: string[] | ((prev: string[]) => string[])) => void) => (v: string) => {
    setter(prev => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v); else next.add(v);
      return Array.from(next);
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
      const valor = Number(dp.valor_total || 0);
      executadoBySite.set(dp.site_id, (executadoBySite.get(dp.site_id) || 0) + valor);
    }


    // Aggregate per projeto
    const executadoByProjeto = new Map<string, number>();
    for (const s of sites) {
      const exec = executadoBySite.get(s.id) || 0;
      executadoByProjeto.set(s.projeto_id, (executadoByProjeto.get(s.projeto_id) || 0) + exec);
    }

    // Contracts Map for summing multiple contracts per project
    const allContratosMap = new Map<string, number>();
    const parentToTotalMap = new Map<string, number>();
    
    parentsContratos.forEach(c => {
      let parentTotal = Number(c.valor_total) || 0;
      allContratosMap.set(c.id, Number(c.valor_total) || 0);
      
      if (c.aditivos) {
        c.aditivos.forEach(a => {
          allContratosMap.set(a.id, Number(a.valor_total) || 0);
          parentTotal += Number(a.valor_total) || 0;
        });
      }
      parentToTotalMap.set(c.id, parentTotal);
    });

    const projetoRows: ProjetoRow[] = projetos.map(p => {
      let valor_contrato = p.valor_total || 0;
      
      // If project has multiple contracts linked via contrato_ids, sum their values
      if (p.contrato_ids && p.contrato_ids.length > 0) {
        const uniqueParentIds = new Set<string>();
        let totalVal = 0;
        
        p.contrato_ids.forEach(cid => {
          // Find if this ID is a parent or belongs to a parent contract
          const parent = parentsContratos.find(pc => 
            pc.id === cid || (pc.aditivos && pc.aditivos.some(a => a.id === cid))
          );
          
          if (parent) {
            if (!uniqueParentIds.has(parent.id)) {
              uniqueParentIds.add(parent.id);
              totalVal += parentToTotalMap.get(parent.id) || 0;
            }
          } else {
            // Fallback for contracts not found in parents hierarchy
            totalVal += allContratosMap.get(cid) || 0;
          }
        });
        
        // Only overwrite if the contract sum is greater than 0
        if (totalVal > 0) {
          valor_contrato = Math.round(totalVal * 100) / 100;
        }
      }

      const valor_executado = Math.round((executadoByProjeto.get(p.id) || 0) * 100) / 100;
      // Negativo é sinal de estouro de contrato — não é zerado, porque é
      // justamente o caso que precisa aparecer para virar ação.
      const saldo_contrato = Math.round((valor_contrato - valor_executado) * 100) / 100;
      const percentual_evolucao = valor_contrato > 0 ? (valor_executado / valor_contrato) * 100 : 0;
      const areaName = (p as any).area_id ? (areaMap.get((p as any).area_id) || "Sem área") : "Sem área";

      const bi = biMapByProjeto.get(p.id);
      const resultado_orc = Math.round((bi?.resultadoTotal || 0) * 100) / 100;
      const mb_orcada_rs = Math.round((bi?.mbOrcada || 0) * 100) / 100;
      const mb_real_rs = Math.round((bi?.mbReal || 0) * 100) / 100;
      const receita_liquida = Math.round((bi?.receitaLiquida || 0) * 100) / 100;
      const percentual_mb_orc = receita_liquida > 0 ? (mb_orcada_rs / receita_liquida) * 100 : 0;
      const percentual_mb_real = receita_liquida > 0 ? (mb_real_rs / receita_liquida) * 100 : 0;

      const projetoSites = sites.filter(s => s.projeto_id === p.id);
      const siteRows: SiteRow[] = projetoSites.map(s => {
        const sExec = Math.round((executadoBySite.get(s.id) || 0) * 100) / 100;
        return {
          site_id: s.id,
          site_codigo: s.codigo,
          site_nome: s.nome,
          valor_executado: sExec,
          percentual_evolucao: valor_contrato > 0 ? (sExec / valor_contrato) * 100 : 0,
        };
      });

      return {
        projeto_id: p.id,
        projeto_codigo: p.codigo,
        projeto_nome: p.nome,
        cliente: p.cliente || "Sem cliente",
        area: areaName,
        valor_contrato, valor_executado, saldo_contrato, percentual_evolucao,
        resultado_orc, mb_orcada_rs, mb_real_rs, receita_liquida, percentual_mb_orc, percentual_mb_real,
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
  }, [projetos, sites, areas, escopoItens, producao, diarioProducoes, parentsContratos, biMapByProjeto]);

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
      .filter(ag => {
        if (!visibleColumns.has("Area")) return true;
        return filterArea.size === 0 || filterArea.has(ag.area);
      })
      .map(ag => {
        const clientes = ag.clientes
          .filter(cg => {
            if (!visibleColumns.has("Cliente")) return true;
            return filterCliente.size === 0 || filterCliente.has(cg.cliente);
          })
          .map(cg => {
            const filteredProjetos = cg.projetos.filter(p => {
              if (visibleColumns.has("Projeto") && filterProjeto.size > 0 && !filterProjeto.has(p.projeto_nome)) return false;
              const proj = projetos.find(pr => pr.id === p.projeto_id);
              const st = proj?.status || "Sem status";
              if (visibleColumns.has("Status") && filterStatus.size > 0 && !filterStatus.has(st)) return false;
              if (visibleColumns.has("Site") && filterSite.size > 0) {
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
  }, [areaGroups, filterArea, filterCliente, filterProjeto, filterSite, filterStatus, projetos, visibleColumns]);

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
    const isAreaVisible = visibleColumns.has("Area");
    const isClienteVisible = visibleColumns.has("Cliente");
    const isProjetoVisible = visibleColumns.has("Projeto");
    const isSiteVisible = visibleColumns.has("Site");
    const isStatusVisible = visibleColumns.has("Status");

    for (const ag of filteredAreaGroups) {
      for (const cg of ag.clientes) {
        for (const p of cg.projetos) {
          const proj = projetos.find(pr => pr.id === p.projeto_id);
          const status = proj?.status || "Sem status";

          if (isSiteVisible && p.siteRows.length > 0) {
            for (const s of p.siteRows) {
              const row: any = {};
              if (isAreaVisible) row["Área"] = p.area;
              if (isClienteVisible) row["Cliente"] = p.cliente;
              if (isProjetoVisible) {
                row["Código Projeto"] = p.projeto_codigo;
                row["Nome Projeto"] = p.projeto_nome;
              }
              if (isStatusVisible) row["Status"] = status;
              
              row["Código Site"] = s.site_codigo;
              row["Nome Site"] = s.site_nome;
              row["Valor Contrato"] = p.valor_contrato;
              row["Valor Executado"] = s.valor_executado;
              row["Resultado/Orç."] = p.resultado_orc;
              row["% MB Orç."] = Number(p.percentual_mb_orc.toFixed(1));
              row["% MB Real"] = Number(p.percentual_mb_real.toFixed(1));
              row["Saldo Contrato"] = p.saldo_contrato;
              row["% Evolução"] = Number(s.percentual_evolucao.toFixed(1));

              rows.push(row);
            }
          } else {
            const row: any = {};
            if (isAreaVisible) row["Área"] = p.area;
            if (isClienteVisible) row["Cliente"] = p.cliente;
            if (isProjetoVisible) {
              row["Código Projeto"] = p.projeto_codigo;
              row["Nome Projeto"] = p.projeto_nome;
            }
            if (isStatusVisible) row["Status"] = status;
            
            if (isSiteVisible) {
              row["Código Site"] = "";
              row["Nome Site"] = "";
            }
            
            row["Valor Contrato"] = p.valor_contrato;
            row["Valor Executado"] = p.valor_executado;
            row["Resultado/Orç."] = p.resultado_orc;
            row["% MB Orç."] = Number(p.percentual_mb_orc.toFixed(1));
            row["% MB Real"] = Number(p.percentual_mb_real.toFixed(1));
            row["Saldo Contrato"] = p.saldo_contrato;
            row["% Evolução"] = Number(p.percentual_evolucao.toFixed(1));

            rows.push(row);
          }
        }
      }
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Quadro Geral");
    XLSX.writeFile(wb, `quadro_geral_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const isLoading = loadingEscopo || loadingDiario || loadingBi;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }


  function TotalsRow({ t }: { t: Totals }) {
    return (
      <>
        <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(t.valor_contrato)}</TableCell>
        <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(t.valor_executado)}</TableCell>
        <TableCell className={cn("text-right font-semibold tabular-nums", t.resultado_orc < 0 ? "text-red-600 dark:text-red-400" : "")}>
          {formatCurrency(t.resultado_orc)}
        </TableCell>
        <TableCell className={cn("text-right font-semibold tabular-nums", t.percentual_mb_orc < 0 ? "text-red-600 dark:text-red-400" : "")}>
          {formatPercent(t.percentual_mb_orc)}
        </TableCell>
        <TableCell className={cn("text-right font-semibold tabular-nums", t.percentual_mb_real < 0 ? "text-red-600 dark:text-red-400" : "")}>
          {formatPercent(t.percentual_mb_real)}
        </TableCell>
        <TableCell className={cn("text-right font-semibold tabular-nums", t.saldo_contrato < 0 ? "text-red-600 dark:text-red-400" : "")}>
          {formatCurrency(t.saldo_contrato)}
        </TableCell>
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
            <CardTitle className="text-xs text-muted-foreground font-medium">Saldo Contrato</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className={cn("text-lg font-bold tabular-nums", grandTotals.saldo_contrato < 0 ? "text-red-600 dark:text-red-400" : "")}>
              {formatCurrency(grandTotals.saldo_contrato)}
            </p>
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
          <div className="flex flex-wrap items-center gap-3 bg-muted/20 p-3 rounded-lg border border-dashed">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filtros e Visibilidade:</span>
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2 bg-background p-1 rounded border">
                <span className="text-xs text-muted-foreground pl-1.5" title="Período usado para acumular Resultado/Orç. e MB (Orç./Real) — esses dados são mensais na origem">
                  Período MB:
                </span>
                <MonthRangePicker
                  startDate={rmPeriodoInicio}
                  endDate={rmPeriodoFim}
                  onChangeStart={(d) => setRmPeriodoInicioStr(d.toISOString())}
                  onChangeEnd={(d) => setRmPeriodoFimStr(d.toISOString())}
                  className="h-8 text-xs"
                />
              </div>
              <div className="flex items-center gap-1 bg-background p-1 rounded border">
                <MultiSelectFilter label="Área" options={filterOptions.areas} selected={filterArea} onToggle={toggleSet(setFilterAreaArr)} onSelectAll={() => setFilterAreaArr(filterOptions.areas)} onClearAll={() => setFilterAreaArr([])} />
                <Checkbox 
                  checked={visibleColumns.has("Area")} 
                  onCheckedChange={() => toggleSet(setVisibleColumnsArr)("Area")}
                  title="Mostrar/Ocultar coluna de Área"
                />
              </div>
              <div className="flex items-center gap-1 bg-background p-1 rounded border">
                <MultiSelectFilter label="Cliente" options={filterOptions.clientes} selected={filterCliente} onToggle={toggleSet(setFilterClienteArr)} onSelectAll={() => setFilterClienteArr(filterOptions.clientes)} onClearAll={() => setFilterClienteArr([])} />
                <Checkbox 
                  checked={visibleColumns.has("Cliente")} 
                  onCheckedChange={() => toggleSet(setVisibleColumnsArr)("Cliente")}
                  title="Mostrar/Ocultar coluna de Cliente"
                />
              </div>
              <div className="flex items-center gap-1 bg-background p-1 rounded border">
                <MultiSelectFilter label="Projeto" options={filterOptions.projetos} selected={filterProjeto} onToggle={toggleSet(setFilterProjetoArr)} onSelectAll={() => setFilterProjetoArr(filterOptions.projetos)} onClearAll={() => setFilterProjetoArr([])} />
                <Checkbox 
                  checked={visibleColumns.has("Projeto")} 
                  onCheckedChange={() => toggleSet(setVisibleColumnsArr)("Projeto")}
                  title="Mostrar/Ocultar coluna de Projeto"
                />
              </div>
              <div className="flex items-center gap-1 bg-background p-1 rounded border">
                <MultiSelectFilter label="Site" options={filterOptions.sites} selected={filterSite} onToggle={toggleSet(setFilterSiteArr)} onSelectAll={() => setFilterSiteArr(filterOptions.sites)} onClearAll={() => setFilterSiteArr([])} />
                <Checkbox 
                  checked={visibleColumns.has("Site")} 
                  onCheckedChange={() => toggleSet(setVisibleColumnsArr)("Site")}
                  title="Mostrar/Ocultar coluna de Site"
                />
              </div>
              <div className="flex items-center gap-1 bg-background p-1 rounded border">
                <MultiSelectFilter label="Status" options={filterOptions.status} selected={filterStatus} onToggle={toggleSet(setFilterStatusArr)} onSelectAll={() => setFilterStatusArr(filterOptions.status)} onClearAll={() => setFilterStatusArr([])} />
                <Checkbox 
                  checked={visibleColumns.has("Status")} 
                  onCheckedChange={() => toggleSet(setVisibleColumnsArr)("Status")}
                  title="Mostrar/Ocultar filtro de Status"
                />
              </div>
              {(filterArea.size > 0 || filterCliente.size > 0 || filterProjeto.size > 0 || filterSite.size > 0 || filterStatus.size > 0) && (
                <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => { setFilterAreaArr([]); setFilterClienteArr([]); setFilterProjetoArr([]); setFilterSiteArr([]); setFilterStatusArr([]); }}>
                  Limpar filtros
                </Button>
              )}
            </div>
          </div>
          {filteredAreaGroups.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum projeto cadastrado</p>
          ) : (
            <div className="rounded-md border overflow-auto h-[calc(100vh-380px)] min-h-[500px]">
              <Table className="relative">
                <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                  <TableRow>
                    <TableHead className="min-w-[360px]">
                      {Array.from(visibleColumns)
                        .filter(c => c !== "Status") // Status doesn't have its own level in the label
                        .join(" / ") || "Dados"}
                    </TableHead>
                    <TableHead className="text-right">Valor Contrato</TableHead>
                    <TableHead className="text-right">Valor Executado</TableHead>
                    <TableHead className="text-right">Resultado/Orç.</TableHead>
                    <TableHead className="text-right">% MB Orç.</TableHead>
                    <TableHead className="text-right">% MB Real</TableHead>
                    <TableHead className="text-right">Saldo Contrato</TableHead>
                    <TableHead className="text-center min-w-[160px]">% Evolução</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAreaGroups.map(ag => {
                    const isAreaVisible = visibleColumns.has("Area");
                    const isClienteVisible = visibleColumns.has("Cliente");
                    const isProjetoVisible = visibleColumns.has("Projeto");
                    const isSiteVisible = visibleColumns.has("Site");

                    const areaKey = `area:${ag.area}`;
                    const areaExpanded = expanded.has(areaKey) || !isAreaVisible;
                    const totalClientes = ag.clientes.length;
                    const totalProjetos = ag.clientes.reduce((s, c) => s + c.projetos.length, 0);
                    return (
                      <Fragment key={areaKey}>
                        {isAreaVisible && (
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
                        )}

                        {areaExpanded && ag.clientes.map(cg => {
                          const clienteKey = `cliente:${ag.area}|${cg.cliente}`;
                          const clienteExpanded = expanded.has(clienteKey) || !isClienteVisible;
                          return (
                            <Fragment key={clienteKey}>
                              {isClienteVisible && (
                                <TableRow
                                  className="bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                                  onClick={() => toggle(clienteKey)}
                                >
                                  <TableCell className="font-semibold">
                                    <div className={cn("flex items-center gap-2", isAreaVisible ? "pl-6" : "pl-0")}>
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
                              )}

                              {clienteExpanded && cg.projetos.map(p => {
                                const projetoKey = `projeto:${p.projeto_id}`;
                                const projetoExpanded = expanded.has(projetoKey) || !isProjetoVisible;
                                const hasSites = p.siteRows.length > 0;
                                return (
                                  <Fragment key={p.projeto_id}>
                                    {isProjetoVisible && (
                                      <TableRow
                                        className={cn("hover:bg-muted/20", hasSites && "cursor-pointer")}
                                        onClick={() => hasSites && toggle(projetoKey)}
                                      >
                                        <TableCell>
                                          <div className={cn("flex items-center gap-2", isAreaVisible && isClienteVisible ? "pl-12" : isAreaVisible || isClienteVisible ? "pl-6" : "pl-0")}>
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
                                        <TableCell className={cn("text-right tabular-nums text-sm", p.resultado_orc < 0 ? "text-red-600 dark:text-red-400 font-semibold" : "")}>
                                          {formatCurrency(p.resultado_orc)}
                                        </TableCell>
                                        <TableCell className={cn("text-right tabular-nums text-sm", p.percentual_mb_orc < 0 ? "text-red-600 dark:text-red-400" : "")}>
                                          {formatPercent(p.percentual_mb_orc)}
                                        </TableCell>
                                        <TableCell className={cn("text-right tabular-nums text-sm", p.percentual_mb_real < 0 ? "text-red-600 dark:text-red-400" : "")}>
                                          {formatPercent(p.percentual_mb_real)}
                                        </TableCell>
                                        <TableCell className={cn("text-right tabular-nums text-sm", p.saldo_contrato < 0 ? "text-red-600 dark:text-red-400 font-semibold" : "")}>
                                          {formatCurrency(p.saldo_contrato)}
                                        </TableCell>
                                        <TableCell><MiniProgressBar value={p.percentual_evolucao} /></TableCell>
                                      </TableRow>
                                    )}

                                    {isSiteVisible && projetoExpanded && p.siteRows.map(s => (
                                      <TableRow key={s.site_id} className="hover:bg-muted/10">
                                        <TableCell>
                                          <div className={cn("flex items-center gap-2", isAreaVisible && isClienteVisible && isProjetoVisible ? "pl-20" : "pl-6")}>
                                            <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                            <span className="text-xs font-medium">{s.site_codigo}</span>
                                            <span className="text-xs text-muted-foreground">— {s.site_nome}</span>
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-xs text-muted-foreground">—</TableCell>
                                        <TableCell className="text-right tabular-nums text-xs">{formatCurrency(s.valor_executado)}</TableCell>
                                        <TableCell className="text-right tabular-nums text-xs text-muted-foreground">—</TableCell>
                                        <TableCell className="text-right tabular-nums text-xs text-muted-foreground">—</TableCell>
                                        <TableCell className="text-right tabular-nums text-xs text-muted-foreground">—</TableCell>
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
                    <TableCell className={cn("text-right tabular-nums", grandTotals.resultado_orc < 0 ? "text-red-600 dark:text-red-400" : "")}>
                      {formatCurrency(grandTotals.resultado_orc)}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums", grandTotals.percentual_mb_orc < 0 ? "text-red-600 dark:text-red-400" : "")}>
                      {formatPercent(grandTotals.percentual_mb_orc)}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums", grandTotals.percentual_mb_real < 0 ? "text-red-600 dark:text-red-400" : "")}>
                      {formatPercent(grandTotals.percentual_mb_real)}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums", grandTotals.saldo_contrato < 0 ? "text-red-600 dark:text-red-400" : "")}>
                      {formatCurrency(grandTotals.saldo_contrato)}
                    </TableCell>
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