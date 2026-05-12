import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ClipboardList, AlertTriangle, Search, Settings, Target, ArrowDown, ArrowUp, Minus } from "lucide-react";
import { useAnaliseCustosMulti } from "@/hooks/useAnaliseCustos";
import { FCAModal } from "./FCAModal";
import { format, parseISO } from "date-fns";

interface AnaliseCustosProps {
  projetoIds: string[];
  periodoInicio: Date;
  periodoFim: Date;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

const formatPercent = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

export function AnaliseCustos({ projetoIds, periodoInicio, periodoFim }: AnaliseCustosProps) {
  const { analiseRows, loadCustos } = useAnaliseCustosMulti(projetoIds, periodoInicio, periodoFim);
  const [fcaState, setFcaState] = useState({
    open: false,
    projetoId: "",
    projetoNome: "",
    mesReferencia: "",
    mesLabel: "",
  });

  const alerts = useMemo(() => {
    const semMkp = analiseRows.filter(r => r.semMkp).length;
    return { semMkp };
  }, [analiseRows]);

  const totals = useMemo(() => {
    const sum = analiseRows.reduce((acc, r) => ({
      poc: acc.poc + r.poc,
      producaoLiquida: acc.producaoLiquida + r.producaoLiquida,
      moObra: acc.moObra + r.moObra,
      materiais: acc.materiais + r.materiais,
      transporte: acc.transporte + r.transporte,
      equipamentos: acc.equipamentos + r.equipamentos,
      indiretos: acc.indiretos + r.indiretos,
      custoDiretoReal: acc.custoDiretoReal + r.custoDiretoReal,
      custoDiretoOrcado: acc.custoDiretoOrcado + r.custoDiretoOrcado,
      gerenciaReal: acc.gerenciaReal + r.gerenciaReal,
      gerenciaOrcada: acc.gerenciaOrcada + r.gerenciaOrcada,
      mbOrcada: acc.mbOrcada + r.mbOrcada,
      mbRealizada: acc.mbRealizada + r.mbRealizada,
    }), {
      poc: 0, producaoLiquida: 0, moObra: 0, materiais: 0, transporte: 0,
      equipamentos: 0, indiretos: 0,
      custoDiretoReal: 0, custoDiretoOrcado: 0,
      gerenciaReal: 0, gerenciaOrcada: 0, mbOrcada: 0, mbRealizada: 0
    });

    const avg = {
      percMbReal: sum.producaoLiquida > 0 ? sum.mbRealizada / sum.producaoLiquida : 0,
      percMbOrcada: sum.producaoLiquida > 0 ? sum.mbOrcada / sum.producaoLiquida : 0,
      percMbMkp: analiseRows.length > 0 ? 
        analiseRows.reduce((acc, r) => acc + (r.producaoLiquida * r.percMbMkp), 0) / (sum.producaoLiquida || 1) : 0
    };

    return { ...sum, ...avg };
  }, [analiseRows]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {alerts.semMkp > 0 && (
          <Alert variant="destructive" className="bg-destructive/10 border-destructive/20">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Parâmetros MKP ausentes</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>{alerts.semMkp} projeto(s) sem MKP configurado.</span>
              <Button variant="link" size="sm" className="h-auto p-0 text-destructive font-bold">
                <Settings className="h-3 w-3 mr-1" /> Configurar MKP →
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle>Análise de Custos e Margens</CardTitle>
          <CardDescription>Detalhamento de produção, custos diretos, gerência e margem bruta por projeto e período.</CardDescription>
        </CardHeader>
        <div className="w-full overflow-x-auto">
          <table className="w-full text-sm border-separate border-spacing-0 whitespace-nowrap">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                <th colSpan={5} className="py-2 px-4 border-b border-r text-left">Identificação</th>
                <th colSpan={3} className="py-2 px-4 border-b border-r text-center bg-green-50 text-green-700">Receita</th>
                <th colSpan={8} className="py-2 px-4 border-b border-r text-center bg-blue-50 text-blue-700">Custo Direto</th>
                <th colSpan={5} className="py-2 px-4 border-b border-r text-center bg-amber-50 text-amber-700">Gerência</th>
                <th colSpan={4} className="py-2 px-4 border-b text-center bg-gray-50 text-gray-700">Margem Bruta (MB)</th>
              </tr>
              <tr className="bg-muted text-muted-foreground font-semibold text-center">
                <th className="py-3 px-4 border-b border-r text-left sticky left-0 z-10 bg-muted">FCA</th>
                <th className="py-3 px-4 border-b border-r text-left">Referência</th>
                <th className="py-3 px-4 border-b border-r text-left">Área</th>
                <th className="py-3 px-4 border-b border-r text-left">Projeto</th>
                <th className="py-3 px-4 border-b border-r text-left">Cliente</th>
                <th className="py-3 px-4 border-b border-r bg-green-50">Produção (POC)</th>
                <th className="py-3 px-4 border-b border-r bg-green-50">% Impostos</th>
                <th className="py-3 px-4 border-b border-r bg-green-50">Receita Líquida</th>
                <th className="py-3 px-4 border-b border-r bg-blue-50">MO</th>
                <th className="py-3 px-4 border-b border-r bg-blue-50">Mat.</th>
                <th className="py-3 px-4 border-b border-r bg-blue-50">Transp.</th>
                <th className="py-3 px-4 border-b border-r bg-blue-50">Equip.</th>
                <th className="py-3 px-4 border-b border-r bg-blue-50">Indir.</th>
                <th className="py-3 px-4 border-b border-r bg-blue-50">Real</th>
                <th className="py-3 px-4 border-b border-r bg-blue-50 text-muted-foreground/60 font-normal">Orçado</th>
                <th className="py-3 px-4 border-b border-r bg-blue-50">Δ Direto</th>
                <th className="py-3 px-4 border-b border-r bg-amber-50 text-amber-700">Real</th>
                <th className="py-3 px-4 border-b border-r bg-amber-50 text-muted-foreground/60 font-normal">Orçado</th>
                <th className="py-3 px-4 border-b border-r bg-amber-50 text-amber-700">Δ Ger.</th>
                <th className="py-3 px-4 border-b border-r bg-amber-50 text-amber-700">% Real</th>
                <th className="py-3 px-4 border-b border-r bg-amber-50 text-muted-foreground/60 font-normal">% Orç.</th>
                <th className="py-3 px-4 border-b border-r bg-gray-50">MB Orç. (R$)</th>
                <th className="py-3 px-4 border-b border-r bg-gray-50">MB Real (R$)</th>
                <th className="py-3 px-4 border-b border-r bg-gray-50">% MB Orç.</th>
                <th className="py-3 px-4 border-b border-r bg-gray-50">% MB Real</th>
                <th className="py-3 px-4 border-b bg-gray-50">% MB Alvo</th>
              </tr>
            </thead>
            <tbody>
              {loadCustos ? (
                <tr>
                  <td colSpan={24} className="py-20 text-center text-muted-foreground">Carregando dados de análise...</td>
                </tr>
              ) : analiseRows.length === 0 ? (
                <tr>
                  <td colSpan={24} className="py-20 text-center text-muted-foreground">Nenhum lançamento encontrado para o período.</td>
                </tr>
              ) : (
                analiseRows.map((row, idx) => (
                  <tr key={`${row.projetoId}-${idx}`} className="hover:bg-muted/30 transition-colors text-right">
                    <td className="py-2 px-4 border-b border-r text-center sticky left-0 z-10 bg-background">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                        onClick={() => {
                          // Try to parse reference date
                          let mesRef = "";
                          try {
                            const date = parseISO(row.referencia);
                            mesRef = format(date, 'yyyy-MM');
                          } catch (e) {
                            // Fallback if reference string is not ISO
                            mesRef = format(new Date(), 'yyyy-MM');
                          }
                          setFcaState({
                            open: true,
                            projetoId: row.projetoId,
                            projetoNome: row.projetoNome,
                            mesReferencia: mesRef,
                            mesLabel: row.referencia
                          });
                        }}
                      >
                        <ClipboardList className="h-4 w-4" />
                      </Button>
                    </td>
                    <td className="py-2 px-4 border-b border-r text-left">{row.referencia}</td>
                    <td className="py-2 px-4 border-b border-r text-left">{row.area}</td>
                    <td className="py-2 px-4 border-b border-r text-left max-w-[200px] truncate" title={`${row.projetoCodigo} - ${row.projetoNome}`}>
                      {row.projetoCodigo} - {row.projetoNome}
                    </td>
                    <td className="py-2 px-4 border-b border-r text-left">{row.cliente}</td>

                    {/* RECEITA */}
                    <td className={`py-2 px-4 border-b border-r bg-green-50/30 ${row.poc > 0 ? 'text-green-600 font-bold' : ''}`}>
                      {formatCurrency(row.poc)}
                    </td>
                    <td className="py-2 px-4 border-b border-r bg-green-50/30 text-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger className="underline decoration-dotted cursor-help">
                            {formatPercent(row.impostos.totalPerc)}
                          </TooltipTrigger>
                          <TooltipContent className="p-3 leading-relaxed">
                            <div className="space-y-1 font-mono text-[11px]">
                              <div className="flex justify-between gap-4"><span>ISSQN:</span> <span>{formatPercent((row.impostos.issqn / (row.poc || 1)))}</span></div>
                              <div className="flex justify-between gap-4"><span>PIS:</span> <span>{formatPercent((row.impostos.pis / (row.poc || 1)))}</span></div>
                              <div className="flex justify-between gap-4"><span>COFINS:</span> <span>{formatPercent((row.impostos.cofins / (row.poc || 1)))}</span></div>
                              <div className="flex justify-between gap-4"><span>INSS:</span> <span>{formatPercent((row.impostos.inss / (row.poc || 1)))}</span></div>
                              <div className="flex justify-between gap-4"><span>DARA:</span> <span>{formatPercent((row.impostos.dara / (row.poc || 1)))}</span></div>
                              <div className="flex justify-between gap-4"><span>ICMS:</span> <span>{formatPercent((row.impostos.icms / (row.poc || 1)))}</span></div>
                              <div className="border-t border-muted-foreground/30 my-1 pt-1 font-bold flex justify-between">
                                <span>Total:</span> <span>{formatPercent(row.impostos.totalPerc)}</span>
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </td>
                    <td className="py-2 px-4 border-b border-r bg-green-50/30 font-bold">
                      {formatCurrency(row.producaoLiquida)}
                    </td>

                    {/* CUSTO DIRETO */}
                    <td className="py-2 px-4 border-b border-r bg-blue-50/30">{formatCurrency(row.moObra)}</td>
                    <td className="py-2 px-4 border-b border-r bg-blue-50/30">{formatCurrency(row.materiais)}</td>
                    <td className="py-2 px-4 border-b border-r bg-blue-50/30">{formatCurrency(row.transporte)}</td>
                    <td className="py-2 px-4 border-b border-r bg-blue-50/30">{formatCurrency(row.equipamentos)}</td>
                    <td className="py-2 px-4 border-b border-r bg-blue-50/30">{formatCurrency(row.indiretos)}</td>
                    <td className="py-2 px-4 border-b border-r bg-blue-50/30 font-bold">{formatCurrency(row.custoDiretoReal)}</td>
                    <td className="py-2 px-4 border-b border-r bg-blue-50/30 text-muted-foreground/60">{formatCurrency(row.custoDiretoOrcado)}</td>
                    <td className={`py-2 px-4 border-b border-r bg-blue-50/30 font-medium ${row.deltaDireto > 0 ? 'text-green-600' : row.deltaDireto < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      <div className="flex items-center justify-end gap-1">
                        {row.deltaDireto > 0 ? <ArrowDown className="h-3 w-3" /> : row.deltaDireto < 0 ? <ArrowUp className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                        {row.deltaDireto === 0 ? "—" : formatCurrency(Math.abs(row.deltaDireto))}
                      </div>
                    </td>

                    {/* GERENCIA */}
                    <td className="py-2 px-4 border-b border-r bg-amber-50/30 text-amber-700 font-bold">
                      <div className="flex flex-col items-end gap-1">
                        {formatCurrency(row.gerenciaReal)}
                      </div>
                    </td>
                    <td className="py-2 px-4 border-b border-r bg-amber-50/30 text-muted-foreground/60">{formatCurrency(row.gerenciaOrcada)}</td>
                    <td className={`py-2 px-4 border-b border-r bg-amber-50/30 font-medium ${row.deltaGerencia > 0 ? 'text-green-600' : row.deltaGerencia < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      <div className="flex items-center justify-end gap-1">
                        {row.deltaGerencia > 0 ? <ArrowDown className="h-3 w-3" /> : row.deltaGerencia < 0 ? <ArrowUp className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                        {row.deltaGerencia === 0 ? "—" : formatCurrency(Math.abs(row.deltaGerencia))}
                      </div>
                    </td>
                    <td className="py-2 px-4 border-b border-r bg-amber-50/30 text-amber-700">{formatPercent(row.percGerenciaReal)}</td>
                    <td className="py-2 px-4 border-b border-r bg-amber-50/30 text-muted-foreground/60">{formatPercent(row.percGerenciaOrcada)}</td>

                    {/* MB */}
                    <td className="py-2 px-4 border-b border-r bg-gray-50/30 text-muted-foreground">{formatCurrency(row.mbOrcada)}</td>
                    <td className={`py-2 px-4 border-b border-r bg-gray-50/30 font-bold ${row.mbRealizada >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(row.mbRealizada)}
                    </td>
                    <td className="py-2 px-4 border-b border-r bg-gray-50/30 text-muted-foreground">{formatPercent(row.percMbOrcada)}</td>
                    <td className="py-2 px-4 border-b border-r bg-gray-50/30">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="secondary" className={`font-bold border shadow-sm whitespace-nowrap ${
                              row.percMbReal >= row.percMbMkp ? 'bg-green-50 text-green-700 border-green-200' : 
                              row.percMbReal >= row.percMbMkp * 0.85 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'
                            }`}>
                              {row.percMbReal >= row.percMbMkp ? '▲ acima do alvo' : row.percMbReal >= row.percMbMkp * 0.85 ? '≈ próximo do alvo' : '▼ abaixo do alvo'}
                              <span className="ml-1 opacity-70">({formatPercent(row.percMbReal)})</span>
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent className="p-3">
                            <div className="space-y-1 text-[11px]">
                              <div className="flex justify-between gap-6"><span>Alvo MKP:</span> <span className="font-bold">{formatPercent(row.percMbMkp)}</span></div>
                              <div className="flex justify-between gap-6"><span>Realizado:</span> <span className="font-bold">{formatPercent(row.percMbReal)}</span></div>
                              <div className="flex justify-between gap-6 border-t pt-1">
                                <span>Δ vs alvo:</span> 
                                <span className={`font-bold ${row.percMbReal >= row.percMbMkp ? 'text-green-600' : 'text-red-600'}`}>
                                  {(row.percMbReal - row.percMbMkp > 0 ? '+' : '') + ((row.percMbReal - row.percMbMkp) * 100).toFixed(1)} pp
                                </span>
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </td>
                    <td className="py-2 px-4 border-b bg-gray-50/30 italic text-muted-foreground text-xs">
                      <div className="flex items-center justify-end gap-1">
                        <Target className="h-3 w-3" />
                        {formatPercent(row.percMbMkp)}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className={`font-bold text-right sticky bottom-0 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] border-t-2 ${
              totals.percMbReal >= totals.percMbMkp ? 'bg-green-100 text-green-900 border-green-200' : 'bg-red-100 text-red-900 border-red-200'
            }`}>
              <tr>
                <td colSpan={5} className="py-3 px-4 text-left uppercase text-[10px] tracking-wider">Totais do Período</td>
                <td className="py-3 px-4 border-r">{formatCurrency(totals.poc)}</td>
                <td className="py-3 px-4 border-r">---</td>
                <td className="py-3 px-4 border-r">{formatCurrency(totals.producaoLiquida)}</td>
                <td className="py-3 px-4 border-r" colSpan={5}>---</td>
                <td className="py-3 px-4 border-r">{formatCurrency(totals.custoDiretoReal)}</td>
                <td className="py-3 px-4 border-r">{formatCurrency(totals.custoDiretoOrcado)}</td>
                <td className="py-3 px-4 border-r">{formatCurrency(totals.custoDiretoOrcado - totals.custoDiretoReal)}</td>
                <td className="py-3 px-4 border-r">{formatCurrency(totals.gerenciaReal)}</td>
                <td className="py-3 px-4 border-r">{formatCurrency(totals.gerenciaOrcada)}</td>
                <td className="py-3 px-4 border-r" colSpan={3}>---</td>
                <td className="py-3 px-4 border-r">{formatCurrency(totals.mbOrcada)}</td>
                <td className="py-3 px-4 border-r">{formatCurrency(totals.mbRealizada)}</td>
                <td className="py-3 px-4 border-r">{formatPercent(totals.percMbOrcada)}</td>
                <td className="py-3 px-4 border-r">{formatPercent(totals.percMbReal)}</td>
                <td className="py-3 px-4">{formatPercent(totals.percMbMkp)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <FCAModal 
        {...fcaState} 
        onOpenChange={(open) => setFcaState(prev => ({ ...prev, open }))} 
      />
    </div>
  );
}
