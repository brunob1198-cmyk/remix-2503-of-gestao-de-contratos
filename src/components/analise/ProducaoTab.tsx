import { useAnaliseObra, ProducaoItem } from "@/hooks/useAnaliseObra";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ClipboardList, TrendingUp, AlertTriangle } from "lucide-react";

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
  const { data, isLoading } = useAnaliseObra(projetoId || siteId, siteId);

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
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="h-5 w-5 text-emerald-600" />
            Acompanhamento de Produção por Item
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <div className="min-w-[900px]">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2.5 font-semibold">Item</th>
                    <th className="text-left px-2 py-2.5 font-semibold w-[60px]">Und</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Planejado</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Executado</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Saldo</th>
                    <th className="text-right px-3 py-2.5 font-semibold">%</th>
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
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{item.codigo}</span>
                            <span className="text-muted-foreground truncate max-w-[200px]">{item.descricao}</span>
                            {isOver && (
                              <Badge variant="outline" className="border-amber-500 text-amber-700 text-[10px] px-1 py-0 shrink-0">Excedido</Badge>
                            )}
                            {isExtraPlan && (
                              <Badge variant="outline" className="border-blue-500 text-blue-700 text-[10px] px-1 py-0 shrink-0">Fora escopo</Badge>
                            )}
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
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmtQty(totalExecutado)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmtQty(totalSaldo)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{pctGeral.toFixed(1)}%</td>
                    <td colSpan={3}></td>
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
