import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProjetos } from "@/hooks/useProjetos";
import { useSites } from "@/hooks/useSites";
import { useLancamentosProducao, useLancamentosFaturamento } from "@/hooks/useLancamentos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronRight, ChevronDown, FileDown, Building2, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

interface ProjetoRow {
  projeto_id: string;
  projeto_codigo: string;
  projeto_nome: string;
  cliente: string;
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
  totals: {
    valor_contrato: number;
    valor_executado: number;
    valor_faturado: number;
    valor_nao_faturado: number;
    saldo_contrato: number;
    percentual_evolucao: number;
  };
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
  const { lancamentos: producao } = useLancamentosProducao();
  const { lancamentos: faturamento } = useLancamentosFaturamento();

  // Fetch all escopo_itens
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

  // Fetch diary production
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

  const [expandedClientes, setExpandedClientes] = useState<Set<string>>(new Set());

  const toggleCliente = (cliente: string) => {
    setExpandedClientes(prev => {
      const next = new Set(prev);
      if (next.has(cliente)) next.delete(cliente);
      else next.add(cliente);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedClientes(new Set(clienteGroups.map(g => g.cliente)));
  };

  const collapseAll = () => {
    setExpandedClientes(new Set());
  };

  // Build project rows
  const clienteGroups: ClienteGroup[] = useMemo(() => {
    // Map site_id -> projeto_id
    const siteProjetoMap = new Map(sites.map(s => [s.id, s.projeto_id]));

    // 1. Valor do contrato por projeto (from escopo_itens)
    const contratoByProjeto = new Map<string, number>();
    for (const item of escopoItens) {
      const projetoId = siteProjetoMap.get(item.site_id);
      if (!projetoId) continue;
      const valor = Number(item.quantidade) * Number(item.valor_unitario);
      contratoByProjeto.set(projetoId, (contratoByProjeto.get(projetoId) || 0) + valor);
    }

    // 2. Valor executado por projeto (from lancamentos_producao + diario_producao)
    const executadoByProjeto = new Map<string, number>();
    for (const p of producao) {
      const projetoId = siteProjetoMap.get(p.site_id);
      if (!projetoId) continue;
      const preco = Number(p.item_lpu?.preco_unitario || 0);
      const valor = Number(p.quantidade) * preco;
      executadoByProjeto.set(projetoId, (executadoByProjeto.get(projetoId) || 0) + valor);
    }
    for (const dp of diarioProducoes) {
      const projetoId = siteProjetoMap.get(dp.site_id);
      if (!projetoId) continue;
      const valor = dp.quantidade * dp.preco_unitario;
      executadoByProjeto.set(projetoId, (executadoByProjeto.get(projetoId) || 0) + valor);
    }

    // 3. Valor faturado por projeto (from lancamentos_faturamento)
    const faturadoByProjeto = new Map<string, number>();
    for (const f of faturamento) {
      const projetoId = siteProjetoMap.get(f.site_id);
      if (!projetoId) continue;
      const preco = Number(f.item_lpu?.preco_unitario || 0);
      const valor = f.valor_faturado ? Number(f.valor_faturado) : Number(f.quantidade) * preco;
      faturadoByProjeto.set(projetoId, (faturadoByProjeto.get(projetoId) || 0) + valor);
    }

    // Build projeto rows
    const projetoRows: ProjetoRow[] = projetos.map(p => {
      const valor_contrato = p.valor_total || 0;
      const valor_executado = executadoByProjeto.get(p.id) || 0;
      const valor_faturado = faturadoByProjeto.get(p.id) || 0;
      const valor_nao_faturado = valor_executado - valor_faturado;
      const saldo_contrato = valor_contrato - valor_executado;
      const percentual_evolucao = valor_contrato > 0 ? (valor_executado / valor_contrato) * 100 : 0;

      return {
        projeto_id: p.id,
        projeto_codigo: p.codigo,
        projeto_nome: p.nome,
        cliente: p.cliente || "Sem cliente",
        valor_contrato,
        valor_executado,
        valor_faturado,
        valor_nao_faturado,
        saldo_contrato,
        percentual_evolucao,
      };
    });

    // Group by client
    const clienteMap = new Map<string, ProjetoRow[]>();
    for (const row of projetoRows) {
      const key = row.cliente;
      if (!clienteMap.has(key)) clienteMap.set(key, []);
      clienteMap.get(key)!.push(row);
    }

    // Build groups with totals
    const groups: ClienteGroup[] = Array.from(clienteMap.entries())
      .map(([cliente, projetos]) => {
        const totals = projetos.reduce(
          (acc, p) => ({
            valor_contrato: acc.valor_contrato + p.valor_contrato,
            valor_executado: acc.valor_executado + p.valor_executado,
            valor_faturado: acc.valor_faturado + p.valor_faturado,
            valor_nao_faturado: acc.valor_nao_faturado + p.valor_nao_faturado,
            saldo_contrato: acc.saldo_contrato + p.saldo_contrato,
            percentual_evolucao: 0,
          }),
          { valor_contrato: 0, valor_executado: 0, valor_faturado: 0, valor_nao_faturado: 0, saldo_contrato: 0, percentual_evolucao: 0 }
        );
        totals.percentual_evolucao = totals.valor_contrato > 0
          ? (totals.valor_executado / totals.valor_contrato) * 100
          : 0;

        return { cliente, projetos, totals };
      })
      .sort((a, b) => a.cliente.localeCompare(b.cliente));

    return groups;
  }, [projetos, sites, escopoItens, producao, faturamento, diarioProducoes]);

  // Grand totals
  const grandTotals = useMemo(() => {
    return clienteGroups.reduce(
      (acc, g) => ({
        valor_contrato: acc.valor_contrato + g.totals.valor_contrato,
        valor_executado: acc.valor_executado + g.totals.valor_executado,
        valor_faturado: acc.valor_faturado + g.totals.valor_faturado,
        valor_nao_faturado: acc.valor_nao_faturado + g.totals.valor_nao_faturado,
        saldo_contrato: acc.saldo_contrato + g.totals.saldo_contrato,
        percentual_evolucao: 0,
      }),
      { valor_contrato: 0, valor_executado: 0, valor_faturado: 0, valor_nao_faturado: 0, saldo_contrato: 0, percentual_evolucao: 0 }
    );
  }, [clienteGroups]);

  const grandPercent = grandTotals.valor_contrato > 0
    ? (grandTotals.valor_executado / grandTotals.valor_contrato) * 100
    : 0;

  const handleExport = () => {
    const rows: any[] = [];
    for (const group of clienteGroups) {
      for (const p of group.projetos) {
        rows.push({
          Cliente: p.cliente,
          "Código Projeto": p.projeto_codigo,
          "Nome Projeto": p.projeto_nome,
          "Valor Contrato": p.valor_contrato,
          "Valor Executado": p.valor_executado,
          "Valor Faturado": p.valor_faturado,
          "Não Faturado": p.valor_nao_faturado,
          "Saldo Contrato": p.saldo_contrato,
          "% Evolução": Number((p.percentual_evolucao).toFixed(1)),
        });
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
          <CardTitle className="text-lg">
            Quadro Geral por Cliente / Projeto
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={expandAll}>Expandir Todos</Button>
            <Button variant="ghost" size="sm" onClick={collapseAll}>Recolher Todos</Button>
            {clienteGroups.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleExport}>
                <FileDown className="h-4 w-4 mr-2" />
                Exportar Excel
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {clienteGroups.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum projeto cadastrado
            </p>
          ) : (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[280px]">Cliente / Projeto</TableHead>
                    <TableHead className="text-right">Valor Contrato</TableHead>
                    <TableHead className="text-right">Valor Executado</TableHead>
                    <TableHead className="text-right">Valor Faturado</TableHead>
                    <TableHead className="text-right">Não Faturado</TableHead>
                    <TableHead className="text-right">Saldo Contrato</TableHead>
                    <TableHead className="text-center min-w-[160px]">% Evolução</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clienteGroups.map(group => {
                    const isExpanded = expandedClientes.has(group.cliente);
                    return (
                      <>
                        {/* Client row */}
                        <TableRow
                          key={`cliente-${group.cliente}`}
                          className="bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors"
                          onClick={() => toggleCliente(group.cliente)}
                        >
                          <TableCell className="font-semibold">
                            <div className="flex items-center gap-2">
                              {isExpanded
                                ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                                : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                              }
                              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span>{group.cliente}</span>
                              <span className="text-xs text-muted-foreground font-normal ml-1">
                                ({group.projetos.length} projeto{group.projetos.length !== 1 ? "s" : ""})
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(group.totals.valor_contrato)}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(group.totals.valor_executado)}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(group.totals.valor_faturado)}</TableCell>
                          <TableCell className={cn("text-right font-semibold tabular-nums", group.totals.valor_nao_faturado > 0 ? "text-orange-600" : "")}>
                            {formatCurrency(group.totals.valor_nao_faturado)}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(group.totals.saldo_contrato)}</TableCell>
                          <TableCell>
                            <MiniProgressBar value={group.totals.percentual_evolucao} />
                          </TableCell>
                        </TableRow>

                        {/* Project rows */}
                        {isExpanded && group.projetos.map(p => (
                          <TableRow key={p.projeto_id} className="hover:bg-muted/20">
                            <TableCell>
                              <div className="flex items-center gap-2 pl-10">
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
                            <TableCell>
                              <MiniProgressBar value={p.percentual_evolucao} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </>
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
                    <TableCell>
                      <MiniProgressBar value={grandPercent} />
                    </TableCell>
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
