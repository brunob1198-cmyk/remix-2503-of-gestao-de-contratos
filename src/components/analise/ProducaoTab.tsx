import { useAnaliseObra, ProducaoItem } from "@/hooks/useAnaliseObra";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ClipboardList, TrendingUp, AlertTriangle, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { format } from "date-fns";

function fmtQty(v: number) {
  if (v === 0) return "—";
  if (Math.abs(v) >= 1000) return v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function fmtAvg(v: number) {
  if (v === 0) return "—";
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

export function ProducaoTab({ siteId, projetoId }: { siteId?: string; projetoId?: string }) {
  const { data: analiseData, isLoading } = useAnaliseObra(projetoId || siteId, siteId);
  const data = analiseData as any;

  const exportToExcel = () => {
    if (!data?.producaoItems) return;

    const exportData = data.producaoItems.map((item: any) => {
      const pct = item.planejado > 0 ? (item.executado / item.planejado) : (item.executado > 0 ? 9.99 : 0);
      return {
        "Código": item.codigo,
        "Descrição": item.descricao,
        "Unidade": item.unidade,
        "Planejado": item.planejado,
        "Executado": item.executado,
        "Saldo": item.saldo,
        "% Executado": pct,
        "Dias com Produção": item.diasComProducao,
        "Ritmo / Dia Produzido": item.ritmoPorDiaProduzido,
        "Dias Período Ativo (1ª→última)": item.diasIntervaloAtivo,
        "Ritmo / Dia no Período Ativo": item.ritmoPorDiaCorridoAtivo,
      };
    });

    const workbook = XLSX.utils.book_new();
    
    // ABA 1: Detalhamento
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    
    // Configurar larguras das colunas
    const wscols = [
      { wch: 15 }, // Código
      { wch: 40 }, // Descrição
      { wch: 10 }, // Unidade
      { wch: 15 }, // Planejado
      { wch: 15 }, // Executado
      { wch: 15 }, // Saldo
      { wch: 15 }, // % Executado
      { wch: 12 }, // Dias com Produção
      { wch: 18 }, // Ritmo / Dia Produzido
      { wch: 22 }, // Dias Período Ativo
      { wch: 22 }, // Ritmo / Dia Ativo
    ];
    worksheet['!cols'] = wscols;

    // Adicionar Filtros (AutoFilter)
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    worksheet['!autofilter'] = { ref: XLSX.utils.encode_range(range) };

    // Formatação de números e percentuais
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      // Coluna G (% Executado) - index 6
      const cellG = worksheet[XLSX.utils.encode_cell({ r: R, c: 6 })];
      if (cellG) cellG.z = '0.0%';
      
      // Colunas numéricas
      [3, 4, 5, 9, 11].forEach(C => {
        const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: C })];
        if (cell) cell.z = '#,##0.00';
      });
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, "Detalhamento por Item");

    // ABA 2: Resumo Geral
    const totalPlanejado = data.producaoItems.reduce((s: number, i: any) => s + i.planejado, 0);
    const totalExecutado = data.producaoItems.reduce((s: number, i: any) => s + i.executado, 0);
    const totalSaldo = data.producaoItems.reduce((s: number, i: any) => s + Math.max(0, i.saldo), 0);
    const pctGeral = totalPlanejado > 0 ? (totalExecutado / totalPlanejado) : 0;
    
    const summaryData = [
      ["RESUMO GERAL DE PRODUÇÃO"],
      ["Data de Geração", format(new Date(), "dd/MM/yyyy HH:mm")],
      [],
      ["Métrica", "Valor"],
      ["Total de Itens", data.producaoItems.length],
      ["Total Planejado", totalPlanejado],
      ["Total Executado", totalExecutado],
      ["Saldo Total", totalSaldo],
      ["Percentual de Execução Geral", pctGeral],
      ["Itens Iniciados", data.producaoItems.filter((i: any) => i.executado > 0).length],
      ["Itens Concluídos", data.producaoItems.filter((i: any) => i.planejado > 0 && i.saldo <= 0).length]
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    
    // Formatação da aba de resumo
    summarySheet['!cols'] = [{ wch: 30 }, { wch: 20 }];
    
    // Formatação percentual no resumo (linha 9, coluna B -> R:8, C:1)
    const pctCell = summarySheet[XLSX.utils.encode_cell({ r: 8, c: 1 })];
    if (pctCell) pctCell.z = '0.0%';

    XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumo Geral");

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const fileBlob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" });
    saveAs(fileBlob, `Acompanhamento_Producao_${format(new Date(), "yyyyMMdd_HHmmss")}.xlsx`);
  };

  if (isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;
  if (!data || data.producaoItems.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p>Sem itens de escopo ou produção registrada para este site.</p>
        </CardContent>
      </Card>
    );
  }

  const items = data.producaoItems;
  const totalPlanejado = items.reduce((s, i) => s + i.planejado, 0);
  const totalExecutado = items.reduce((s, i) => s + i.executado, 0);
  const totalSaldo = items.reduce((s, i) => s + Math.max(0, i.saldo), 0);
  const pctGeral = totalPlanejado > 0 ? (totalExecutado / totalPlanejado) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold tabular-nums">{items.length}</p>
            <p className="text-xs text-muted-foreground">Itens no Escopo</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold tabular-nums">{pctGeral.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">Executado Geral</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold tabular-nums">{items.filter(i => i.executado > 0).length}</p>
            <p className="text-xs text-muted-foreground">Itens Iniciados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold tabular-nums">{items.filter(i => i.planejado > 0 && i.saldo <= 0).length}</p>
            <p className="text-xs text-muted-foreground">Itens Concluídos</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3 border-b flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="h-5 w-5 text-emerald-600" />
            Acompanhamento de Produção por Item
          </CardTitle>
          <Button onClick={exportToExcel} variant="outline" size="sm" className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Exportar Excel
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <div className="min-w-[1000px]">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2.5 font-semibold">Item</th>
                    <th className="text-left px-2 py-2.5 font-semibold w-[60px]">Und</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Planejado</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Executado</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Saldo</th>
                    <th className="text-right px-3 py-2.5 font-semibold">%</th>
                    <th className="text-center px-2 py-2.5 font-semibold w-[60px]">Dias</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Méd. Diária</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Méd. Semanal</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Méd. Mensal</th>
                    <th className="text-center px-2 py-2.5 font-semibold w-[60px]">Fotos</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => {
                    const pct = item.planejado > 0 ? (item.executado / item.planejado) * 100 : (item.executado > 0 ? 999 : 0);
                    const isOver = item.planejado > 0 && item.executado > item.planejado;
                    const isNotStarted = item.executado === 0;
                    const isExtraPlan = item.planejado === 0 && item.executado > 0;

                    return (
                      <tr key={item.itemLpuId} className="border-t hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2 min-w-[250px] max-w-[400px]">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-primary">{item.codigo}</span>
                            <span className="text-muted-foreground leading-snug">{item.descricao}</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {isOver && (
                                <Badge variant="outline" className="border-amber-500 text-amber-700 text-[10px] px-1 py-0 shrink-0">Excedido</Badge>
                              )}
                              {isExtraPlan && (
                                <Badge variant="outline" className="border-blue-500 text-blue-700 text-[10px] px-1 py-0 shrink-0">Fora escopo</Badge>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-muted-foreground">{item.unidade}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtQty(item.planejado)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtQty(item.executado)}</td>
                        <td className={`px-3 py-2 text-right tabular-nums ${item.saldo < 0 ? "text-red-600 font-medium" : ""}`}>
                          {fmtQty(item.saldo)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {item.planejado > 0 ? (
                            <span className={`tabular-nums font-medium ${
                              pct >= 100 ? "text-emerald-600" : pct >= 50 ? "text-foreground" : isNotStarted ? "text-muted-foreground" : "text-amber-600"
                            }`}>
                              {pct.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-center tabular-nums text-muted-foreground">
                          {item.diasComProducao > 0 ? item.diasComProducao : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtAvg(item.mediaDiaria)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtAvg(item.mediaSemanal)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtAvg(item.mediaMensal)}</td>
                        <td className="px-2 py-2 text-center">
                          {item.fotos && item.fotos.length > 0 ? (
                            <div className="flex justify-center -space-x-2">
                              {item.fotos.slice(0, 2).map((url, i) => (
                                <img key={i} src={url} className="w-6 h-6 rounded-full border border-white shadow-sm object-cover" alt="" />
                              ))}
                              {item.fotos.length > 2 && (
                                <div className="w-6 h-6 rounded-full bg-muted border border-white flex items-center justify-center text-[10px]">+</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-muted/30 font-semibold border-t-2">
                  <tr>
                    <td className="px-3 py-2.5" colSpan={2}>Total</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmtQty(totalPlanejado)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{totalExecutado > 0 ? fmtQty(totalExecutado) : "—"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmtQty(totalSaldo)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{pctGeral.toFixed(1)}%</td>
                    <td colSpan={4}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Items not started warning */}
      {items.filter(i => i.planejado > 0 && i.executado === 0).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Itens Não Iniciados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {items.filter(i => i.planejado > 0 && i.executado === 0).map(i => (
                <Badge key={i.itemLpuId} variant="outline" className="text-xs">
                  {i.codigo} — {fmtQty(i.planejado)} {i.unidade}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
