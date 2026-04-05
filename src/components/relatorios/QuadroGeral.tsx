import { useState, useMemo, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProjetos } from "@/hooks/useProjetos";
import { useSites } from "@/hooks/useSites";
import { useAreas } from "@/hooks/useAreas";
import { useLancamentosProducao, useLancamentosFaturamento } from "@/hooks/useLancamentos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronRight, ChevronDown, FileDown, Building2, FolderOpen, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

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
  return { ...t, percentual_evolucao: t.valor_contrato > 0 ? (t.valor_executado / t.valor_contrato) * 100 : 0 };
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
      const { data: diarios, error: dErr } = await supabase
        .from("diarios_obra")
        .select("id, site_id")
        .limit(100000);
      if (dErr) throw dErr;
      if (!diarios || diarios.length === 0) return [];

      const { data: prods, error: pErr } = await supabase
        .from("diario_producao")
        .select("diario_id, item_lpu_id, quantidade, item_lpu:itens_lpu(preco_unitario)")
        .in("diario_id", diarios.map(d => d.id));
      if (pErr) throw pErr;

      const diarioMap = new Map(diarios.map(d => [d.id, d.site_id]));
      return (prods || []).map(p => ({
        site_id: diarioMap.get(p.diario_id) || "",
        quantidade: Number(p.quantidade),
        preco_unitario: Number((p as any).item_lpu?.preco_unitario || 0),
      }));
    },
  });

  // expanded keys: "area:XXX" and "cliente:XXX|YYY"
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Build area groups
  const areaGroups: AreaGroup[] = useMemo(() => {
    const siteProjetoMap = new Map(sites.map(s => [s.id, s.projeto_id]));
    const areaMap = new Map(areas.map(a => [a.id, a.nome]));

    const executadoByProjeto = new Map<string, number>();
    for (const p of producao) {
      const projetoId = siteProjetoMap.get(p.site_id);
      if (!projetoId) continue;
      const valor = Number(p.quantidade) * Number(p.item_lpu?.preco_unitario || 0);
      executadoByProjeto.set(projetoId, (executadoByProjeto.get(projetoId) || 0) + valor);
    }
    for (const dp of diarioProducoes) {
      const projetoId = siteProjetoMap.get(dp.site_id);
      if (!projetoId) continue;
      const valor = dp.quantidade * dp.preco_unitario;
      executadoByProjeto.set(projetoId, (executadoByProjeto.get(projetoId) || 0) + valor);
    }

    const faturadoByProjeto = new Map<string, number>();
    for (const f of faturamento) {
      const projetoId = siteProjetoMap.get(f.site_id);
      if (!projetoId) continue;
      const valor = f.valor_faturado ? Number(f.valor_faturado) : Number(f.quantidade) * Number(f.item_lpu?.preco_unitario || 0);
      faturadoByProjeto.set(projetoId, (faturadoByProjeto.get(projetoId) || 0) + valor);
    }

    const projetoRows: ProjetoRow[] = projetos.map(p => {
      const valor_contrato = p.valor_total || 0;
      const valor_executado = executadoByProjeto.get(p.id) || 0;
      const valor_faturado = faturadoByProjeto.get(p.id) || 0;
      const valor_nao_faturado = valor_executado - valor_faturado;
      const saldo_contrato = valor_contrato - valor_executado;
      const percentual_evolucao = valor_contrato > 0 ? (valor_executado / valor_contrato) * 100 : 0;
      const areaName = (p as any).area_id ? (areaMap.get((p as any).area_id) || "Sem área") : "Sem área";

      return {
        projeto_id: p.id,
        projeto_codigo: p.codigo,
        projeto_nome: p.nome,
        cliente: p.cliente || "Sem cliente",
        area: areaName,
        valor_contrato, valor_executado, valor_faturado, valor_nao_faturado, saldo_contrato, percentual_evolucao,
      };
    });

    // Group: area → cliente → projetos
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

    return groups;
  }, [projetos, sites, areas, escopoItens, producao, faturamento, diarioProducoes]);

  const grandTotals = useMemo(() => calcTotals(areaGroups.map(g => g.totals)), [areaGroups]);
  const grandPercent = grandTotals.valor_contrato > 0 ? (grandTotals.valor_executado / grandTotals.valor_contrato) * 100 : 0;

  const expandAll = () => {
    const keys = new Set<string>();
    areaGroups.forEach(ag => {
      keys.add(`area:${ag.area}`);
      ag.clientes.forEach(cg => keys.add(`cliente:${ag.area}|${cg.cliente}`));
    });
    setExpanded(keys);
  };
  const collapseAll = () => setExpanded(new Set());

  const handleExport = () => {
    const rows: any[] = [];
    for (const ag of areaGroups) {
      for (const cg of ag.clientes) {
        for (const p of cg.projetos) {
          rows.push({
            Área: p.area,
            Cliente: p.cliente,
            "Código Projeto": p.projeto_codigo,
            "Nome Projeto": p.projeto_nome,
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
      {/* Summary cards */}
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

      {/* Table */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-lg">Quadro Geral por Área / Cliente / Projeto</CardTitle>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={expandAll}>Expandir Todos</Button>
            <Button variant="ghost" size="sm" onClick={collapseAll}>Recolher Todos</Button>
            {areaGroups.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleExport}>
                <FileDown className="h-4 w-4 mr-2" />
                Exportar Excel
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {areaGroups.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum projeto cadastrado</p>
          ) : (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[320px]">Área / Cliente / Projeto</TableHead>
                    <TableHead className="text-right">Valor Contrato</TableHead>
                    <TableHead className="text-right">Valor Executado</TableHead>
                    <TableHead className="text-right">Valor Faturado</TableHead>
                    <TableHead className="text-right">Não Faturado</TableHead>
                    <TableHead className="text-right">Saldo Contrato</TableHead>
                    <TableHead className="text-center min-w-[160px]">% Evolução</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {areaGroups.map(ag => {
                    const areaKey = `area:${ag.area}`;
                    const areaExpanded = expanded.has(areaKey);
                    const totalClientes = ag.clientes.length;
                    const totalProjetos = ag.clientes.reduce((s, c) => s + c.projetos.length, 0);
                    return (
                      <Fragment key={areaKey}>
                        {/* Area row */}
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
                              {/* Cliente row */}
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

                              {/* Projeto rows */}
                              {clienteExpanded && cg.projetos.map(p => (
                                <TableRow key={p.projeto_id} className="hover:bg-muted/20">
                                  <TableCell>
                                    <div className="flex items-center gap-2 pl-16">
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
                              ))}
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
