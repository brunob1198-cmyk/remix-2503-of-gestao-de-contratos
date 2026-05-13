import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ClipboardList, ArrowDown, ArrowUp, Minus, FileSpreadsheet } from "lucide-react";
import { useAnaliseCustosMulti } from "@/hooks/useAnaliseCustos";
import { FCAModal } from "./FCAModal";
import { format, parseISO } from "date-fns";
import XLSX from "xlsx-js-style";
import { saveAs } from "file-saver";

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

  const totals = useMemo(() => {
    const sum = analiseRows.reduce((acc, r) => ({
      poc: acc.poc + r.poc,
      producaoLiquida: acc.producaoLiquida + r.producaoLiquida,
      moObra: acc.moObra + r.moObra,
      materiais: acc.materiais + r.materiais,
      transporte: acc.transporte + r.transporte,
      indiretos: acc.indiretos + r.indiretos,
      custoDiretoReal: acc.custoDiretoReal + r.custoDiretoReal,
      custoDiretoOrcado: acc.custoDiretoOrcado + r.custoDiretoOrcado,
      gerenciaReal: acc.gerenciaReal + r.gerenciaReal,
      gerenciaOrcada: acc.gerenciaOrcada + r.gerenciaOrcada,
      custoTotalReal: acc.custoTotalReal + r.custoTotalReal,
      custoTotalOrcado: acc.custoTotalOrcado + r.custoTotalOrcado,
      resultadoTotal: acc.resultadoTotal + r.resultadoTotal,
      mbOrcada: acc.mbOrcada + r.mbOrcada,
      mbRealizada: acc.mbRealizada + r.mbRealizada,
    }), {
      poc: 0, producaoLiquida: 0, moObra: 0, materiais: 0, transporte: 0,
      indiretos: 0,
      custoDiretoReal: 0, custoDiretoOrcado: 0,
      gerenciaReal: 0, gerenciaOrcada: 0, 
      custoTotalReal: 0, custoTotalOrcado: 0, resultadoTotal: 0,
      mbOrcada: 0, mbRealizada: 0
    });

    const avg = {
      percMbReal: sum.producaoLiquida > 0 ? sum.mbRealizada / sum.producaoLiquida : 0,
      percMbOrcada: sum.producaoLiquida > 0 ? sum.mbOrcada / sum.producaoLiquida : 0,
      percMbMkp: analiseRows.length > 0 ? 
        analiseRows.reduce((acc, r) => acc + (r.producaoLiquida * r.percMbMkp), 0) / (sum.producaoLiquida || 1) : 0
    };

    return { ...sum, ...avg };
  }, [analiseRows]);

  const exportToExcel = () => {
    const header = [
      "Referência", "Área", "Projeto", "Cliente", 
      "Produção (POC)", "% Impostos", "Receita Líquida",
      "MO", "Mat.", "Transp.", "Indir.", "Custo Direto Real", "Custo Direto Orçado", "Resultado Direto",
      "Gerência Real", "Gerência Orçada", "Resultado Gerência", "% Gerência Real", "% Gerência Orç.",
      "Custo Total Real", "Custo Total Orçado", "Resultado Total",
      "MB Orç. (R$)", "MB Real (R$)", "% MB Orç.", "% MB Real"
    ];

    const rows = analiseRows.map(row => [
      row.referencia,
      row.area,
      `${row.projetoCodigo} - ${row.projetoNome}`,
      row.cliente,
      row.poc,
      row.impostos.totalPerc,
      row.producaoLiquida,
      row.moObra,
      row.materiais,
      row.transporte,
      row.indiretos,
      row.custoDiretoReal,
      row.custoDiretoOrcado,
      row.deltaDireto,
      row.gerenciaReal,
      row.gerenciaOrcada,
      row.deltaGerencia,
      row.percGerenciaReal,
      row.percGerenciaOrcada,
      row.custoTotalReal,
      row.custoTotalOrcado,
      row.resultadoTotal,
      row.mbOrcada,
      row.mbRealizada,
      row.percMbOrcada,
      row.percMbReal
    ]);

    const totalRow = [
      "TOTAL", "", "", "",
      totals.poc, "", totals.producaoLiquida,
      totals.moObra, totals.materiais, totals.transporte, totals.indiretos,
      totals.custoDiretoReal, totals.custoDiretoOrcado, totals.custoDiretoOrcado - totals.custoDiretoReal,
      totals.gerenciaReal, totals.gerenciaOrcada, totals.gerenciaOrcada - totals.gerenciaReal,
      totals.gerenciaReal / (totals.producaoLiquida || 1), totals.gerenciaOrcada / (totals.producaoLiquida || 1),
      totals.custoTotalReal, totals.custoTotalOrcado, totals.resultadoTotal,
      totals.mbOrcada, totals.mbRealizada, totals.percMbOrcada, totals.percMbReal
    ];

    const worksheetData = [header, ...rows, totalRow];
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);

    const colors = {
      receita: "DCFCE7", // bg-green-100
      custoDireto: "DBEAFE", // bg-blue-100
      gerencia: "FEF3C7", // bg-amber-100
      custoTotal: "F3E8FF", // bg-purple-100
      mb: "F1F5F9" // bg-slate-100
    };

    const headerStyle = (color?: string) => ({
      font: { bold: true },
      fill: color ? { fgColor: { rgb: color } } : undefined,
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" }
      }
    });

    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
    
    // Apply Header styles
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_col(C) + "1";
      if (!ws[address]) continue;
      
      let color;
      if (C >= 4 && C <= 6) color = colors.receita;
      else if (C >= 7 && C <= 13) color = colors.custoDireto;
      else if (C >= 14 && C <= 18) color = colors.gerencia;
      else if (C >= 19 && C <= 21) color = colors.custoTotal;
      else if (C >= 22 && C <= 25) color = colors.mb;
      
      ws[address].s = headerStyle(color);
    }

    // Apply data styles
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      const isTotalRow = R === range.e.r;
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const address = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[address]) continue;

        const cell = ws[address];
        cell.s = cell.s || {};
        cell.s.alignment = cell.s.alignment || {};
        
        if (C >= 4) {
          cell.s.alignment.horizontal = "right";
        } else {
          cell.s.alignment.horizontal = "left";
        }

        if (isTotalRow) {
          cell.s.font = { bold: true };
          cell.s.fill = { fgColor: { rgb: "E2E8F0" } }; // Slate 200 for total row
        } else {
          let color;
          if (C >= 4 && C <= 6) color = "F0FDF4"; // bg-green-50
          else if (C >= 7 && C <= 13) color = "EFF6FF"; // bg-blue-50
          else if (C >= 14 && C <= 18) color = "FFFBEB"; // bg-amber-50
          else if (C >= 19 && C <= 21) color = "FAF5FF"; // bg-purple-50
          else if (C >= 22 && C <= 25) color = "F8FAFC"; // bg-slate-50
          
          if (color) {
            cell.s.fill = { fgColor: { rgb: color } };
          }
        }

        // Number formats
        if (C === 5 || C === 17 || C === 18 || C === 24 || C === 25) {
          cell.z = "0.00%";
        } else if (C >= 4) {
          cell.z = '"R$ "#,##0.00';
        }
      }
    }

    // Auto-width
    const colWidths = header.map((h, i) => {
      let maxLen = h.length;
      analiseRows.forEach((_, rowIndex) => {
        const val = String(rows[rowIndex][i] || "");
        if (val.length > maxLen) maxLen = val.length;
      });
      return { wch: Math.min(maxLen + 4, 40) };
    });
    ws["!cols"] = colWidths;

    // Filters
    ws["!autofilter"] = { ref: `A1:${XLSX.utils.encode_col(range.e.c)}${range.e.r - 1}` };

    // Summary Sheet
    const summaryData = [
      ["RESUMO GERAL - ANÁLISE DE CUSTOS E MARGENS"],
      [""],
      ["Data de Geração", format(new Date(), "dd/MM/yyyy HH:mm")],
      ["Período", `${format(periodoInicio, "MM/yyyy")} a ${format(periodoFim, "MM/yyyy")}`],
      [""],
      ["Métrica", "Valor"],
      ["Total de Projetos", analiseRows.length],
      ["Produção Total (POC)", totals.poc],
      ["Receita Líquida Total", totals.producaoLiquida],
      ["Custo Direto Total (Real)", totals.custoDiretoReal],
      ["Custo Direto Total (Orçado)", totals.custoDiretoOrcado],
      ["Gerência Total (Real)", totals.gerenciaReal],
      ["Gerência Total (Orçada)", totals.gerenciaOrcada],
      ["Custo Total (Real)", totals.custoTotalReal],
      ["Custo Total (Orçado)", totals.custoTotalOrcado],
      ["Resultado Total", totals.resultadoTotal],
      ["Margem Bruta Total (Real)", totals.mbRealizada],
      ["% Margem Bruta (Real)", totals.percMbReal]
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    
    // Summary styling
    wsSummary["A1"].s = { font: { bold: true, size: 14 } };
    for (let i = 5; i <= 17; i++) {
      const labelCell = XLSX.utils.encode_cell({ r: i, c: 0 });
      const valCell = XLSX.utils.encode_cell({ r: i, c: 1 });
      if (wsSummary[labelCell]) wsSummary[labelCell].s = { font: { bold: true } };
      if (wsSummary[valCell]) {
        if (i === 17) wsSummary[valCell].z = "0.00%";
        else if (i >= 7) wsSummary[valCell].z = '"R$ "#,##0.00';
      }
    }
    wsSummary["!cols"] = [{ wch: 30 }, { wch: 20 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Análise de Custos");
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo");

    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" });
    saveAs(blob, `Analise_Custos_${format(new Date(), "yyyyMMdd_HHmmss")}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3 border-b flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Análise de Custos e Margens</CardTitle>
            <CardDescription>Detalhamento de produção, custos diretos, gerência e margem bruta por projeto e período.</CardDescription>
          </div>
          <Button onClick={exportToExcel} variant="outline" size="sm" className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Exportar Excel
          </Button>
        </CardHeader>
        <div className="w-full overflow-x-auto">
          <table className="w-full text-sm border-separate border-spacing-0 whitespace-nowrap">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                <th colSpan={5} className="py-2 px-4 border-b border-r text-left">Identificação</th>
                <th colSpan={3} className="py-2 px-4 border-b border-r text-center bg-green-50 text-green-700">Receita</th>
                <th colSpan={7} className="py-2 px-4 border-b border-r text-center bg-blue-50 text-blue-700">Custo Direto</th>
                <th colSpan={5} className="py-2 px-4 border-b border-r text-center bg-amber-50 text-amber-700">Gerência</th>
                <th colSpan={3} className="py-2 px-4 border-b border-r text-center bg-purple-50 text-purple-700">Custo Total</th>
                <th colSpan={4} className="py-2 px-4 border-b text-center bg-gray-50 text-gray-700">Margem Bruta (MB)</th>
              </tr>
              <tr className="bg-muted text-muted-foreground font-semibold text-center h-12">
                <th className="py-3 px-4 border-b border-r text-left sticky left-0 z-20 bg-muted">FCA</th>
                <th className="py-3 px-4 border-b border-r text-left">Referência</th>
                <th className="py-3 px-4 border-b border-r text-left">Área</th>
                <th className="py-3 px-4 border-b border-r text-left">Projeto</th>
                <th className="py-3 px-4 border-b border-r text-left">Cliente</th>
                <th className="py-3 px-4 border-b border-r bg-green-100/50 text-green-800">Produção (POC)</th>
                <th className="py-3 px-4 border-b border-r bg-green-100/50 text-green-800">% Impostos</th>
                <th className="py-3 px-4 border-b border-r bg-green-100/50 text-green-800">Receita Líquida</th>
                <th className="py-3 px-4 border-b border-r bg-blue-100/50 text-blue-800">MO</th>
                <th className="py-3 px-4 border-b border-r bg-blue-100/50 text-blue-800">Mat.</th>
                <th className="py-3 px-4 border-b border-r bg-blue-100/50 text-blue-800">Transp.</th>
                <th className="py-3 px-4 border-b border-r bg-blue-100/50 text-blue-800">Indir.</th>
                <th className="py-3 px-4 border-b border-r bg-blue-100/50 text-blue-800 font-bold">Real</th>
                <th className="py-3 px-4 border-b border-r bg-blue-100/50 text-blue-800/60 font-normal">Orçado</th>
                <th className="py-3 px-4 border-b border-r bg-blue-100/50 text-blue-800 font-bold">Resultado Direto</th>
                <th className="py-3 px-4 border-b border-r bg-amber-100/50 text-amber-800 font-bold">Real</th>
                <th className="py-3 px-4 border-b border-r bg-amber-100/50 text-amber-800/60 font-normal">Orçado</th>
                <th className="py-3 px-4 border-b border-r bg-amber-100/50 text-amber-800 font-bold">Resultado Gerência</th>
                <th className="py-3 px-4 border-b border-r bg-amber-100/50 text-amber-800 font-bold">% Real</th>
                <th className="py-3 px-4 border-b border-r bg-amber-100/50 text-amber-800/60 font-normal">% Orç.</th>
                <th className="py-3 px-4 border-b border-r bg-purple-100/50 text-purple-800 font-bold">Real</th>
                <th className="py-3 px-4 border-b border-r bg-purple-100/50 text-purple-800/60 font-normal">Orçado</th>
                <th className="py-3 px-4 border-b border-r bg-purple-100/50 text-purple-800 font-bold">Resultado Total</th>
                <th className="py-3 px-4 border-b border-r bg-slate-100/50 text-slate-800">MB Orç. (R$)</th>
                <th className="py-3 px-4 border-b border-r bg-slate-100/50 text-slate-800 font-bold">MB Real (R$)</th>
                <th className="py-3 px-4 border-b border-r bg-slate-100/50 text-slate-800">% MB Orç.</th>
                <th className="py-3 px-4 border-b bg-slate-100/50 text-slate-800 font-bold">% MB Real</th>
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
                    <td className="py-2 px-4 border-b border-r text-center sticky left-0 z-20 bg-background">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                        onClick={() => {
                          let mesRef = "";
                          try {
                            const date = parseISO(row.referencia);
                            mesRef = format(date, 'yyyy-MM');
                          } catch (e) {
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
                    <td className={`py-2 px-4 border-b border-r bg-green-50/50 ${row.poc > 0 ? 'text-green-700 font-bold' : ''}`}>
                      {formatCurrency(row.poc)}
                    </td>
                    <td className="py-2 px-4 border-b border-r bg-green-50/50 text-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger className="underline decoration-dotted cursor-help text-green-700">
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
                              <div className="flex justify-between gap-4"><span>IRPJ:</span> <span>{formatPercent((row.impostos.irpj / (row.poc || 1)))}</span></div>
                              <div className="flex justify-between gap-4"><span>CSLL:</span> <span>{formatPercent((row.impostos.csll / (row.poc || 1)))}</span></div>
                              <div className="border-t border-muted-foreground/30 my-1 pt-1 font-bold flex justify-between">
                                <span>Total:</span> <span>{formatPercent(row.impostos.totalPerc)}</span>
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </td>
                    <td className="py-2 px-4 border-b border-r bg-green-50/50 font-bold text-green-700">
                      {formatCurrency(row.producaoLiquida)}
                    </td>

                    {/* CUSTO DIRETO */}
                    <td className="py-2 px-4 border-b border-r bg-blue-50/50 text-blue-700">{formatCurrency(row.moObra)}</td>
                    <td className="py-2 px-4 border-b border-r bg-blue-50/50 text-blue-700">{formatCurrency(row.materiais)}</td>
                    <td className="py-2 px-4 border-b border-r bg-blue-50/50 text-blue-700">{formatCurrency(row.transporte)}</td>
                    <td className="py-2 px-4 border-b border-r bg-blue-50/50 text-blue-700">{formatCurrency(row.indiretos)}</td>
                    <td className="py-2 px-4 border-b border-r bg-blue-50/50 font-bold text-blue-700">{formatCurrency(row.custoDiretoReal)}</td>
                    <td className="py-2 px-4 border-b border-r bg-blue-50/50 text-blue-700/60">{formatCurrency(row.custoDiretoOrcado)}</td>
                    <td className={`py-2 px-4 border-b border-r bg-blue-50/50 font-bold ${row.deltaDireto > 0 ? 'text-green-600' : row.deltaDireto < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      <div className="flex items-center justify-end gap-1">
                        {row.deltaDireto > 0 ? <ArrowDown className="h-3 w-3" /> : row.deltaDireto < 0 ? <ArrowUp className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                        {row.deltaDireto === 0 ? "—" : formatCurrency(Math.abs(row.deltaDireto))}
                      </div>
                    </td>

                    {/* GERENCIA */}
                    <td className="py-2 px-4 border-b border-r bg-amber-50/50 text-amber-700 font-bold">
                      <div className="flex flex-col items-end gap-1">
                        {formatCurrency(row.gerenciaReal)}
                      </div>
                    </td>
                    <td className="py-2 px-4 border-b border-r bg-amber-50/50 text-amber-700/60">{formatCurrency(row.gerenciaOrcada)}</td>
                    <td className={`py-2 px-4 border-b border-r bg-amber-50/50 font-bold ${row.deltaGerencia > 0 ? 'text-green-600' : row.deltaGerencia < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      <div className="flex items-center justify-end gap-1">
                        {row.deltaGerencia > 0 ? <ArrowDown className="h-3 w-3" /> : row.deltaGerencia < 0 ? <ArrowUp className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                        {row.deltaGerencia === 0 ? "—" : formatCurrency(Math.abs(row.deltaGerencia))}
                      </div>
                    </td>
                    <td className="py-2 px-4 border-b border-r bg-amber-50/50 text-amber-700">{formatPercent(row.percGerenciaReal)}</td>
                    <td className="py-2 px-4 border-b border-r bg-amber-50/50 text-amber-700/60">{formatPercent(row.percGerenciaOrcada)}</td>

                    {/* CUSTO TOTAL */}
                    <td className="py-2 px-4 border-b border-r bg-purple-50/50 text-purple-700 font-bold">{formatCurrency(row.custoTotalReal)}</td>
                    <td className="py-2 px-4 border-b border-r bg-purple-50/50 text-purple-700/60">{formatCurrency(row.custoTotalOrcado)}</td>
                    <td className={`py-2 px-4 border-b border-r bg-purple-50/50 font-bold ${row.resultadoTotal > 0 ? 'text-green-600' : row.resultadoTotal < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      <div className="flex items-center justify-end gap-1">
                        {row.resultadoTotal > 0 ? <ArrowDown className="h-3 w-3" /> : row.resultadoTotal < 0 ? <ArrowUp className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                        {row.resultadoTotal === 0 ? "—" : formatCurrency(Math.abs(row.resultadoTotal))}
                      </div>
                    </td>

                    {/* MB */}
                    <td className="py-2 px-4 border-b border-r bg-slate-50/50 text-slate-600">{formatCurrency(row.mbOrcada)}</td>
                    <td className={`py-2 px-4 border-b border-r bg-slate-50/50 font-bold ${row.mbRealizada >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {formatCurrency(row.mbRealizada)}
                    </td>
                    <td className="py-2 px-4 border-b border-r bg-slate-50/50 text-slate-600">{formatPercent(row.percMbOrcada)}</td>
                    <td className={`py-2 px-4 border-b bg-slate-50/50 font-bold ${row.percMbReal >= row.percMbMkp ? 'text-green-700' : 'text-red-700'}`}>
                      {formatPercent(row.percMbReal)}
                    </td>

                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="font-bold text-right sticky bottom-0 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] border-t-2 bg-slate-100 text-slate-900 border-slate-200">
              <tr>
                <td colSpan={5} className="py-3 px-4 text-left uppercase text-[10px] tracking-wider">Totais do Período</td>
                <td className="py-3 px-4 border-r bg-green-100/80">{formatCurrency(totals.poc)}</td>
                <td className="py-3 px-4 border-r bg-green-100/80">---</td>
                <td className="py-3 px-4 border-r bg-green-100/80">{formatCurrency(totals.producaoLiquida)}</td>
                <td className="py-3 px-4 border-r bg-blue-100/80">{formatCurrency(totals.moObra)}</td>
                <td className="py-3 px-4 border-r bg-blue-100/80">{formatCurrency(totals.materiais)}</td>
                <td className="py-3 px-4 border-r bg-blue-100/80">{formatCurrency(totals.transporte)}</td>
                <td className="py-3 px-4 border-r bg-blue-100/80">{formatCurrency(totals.indiretos)}</td>
                <td className="py-3 px-4 border-r bg-blue-100/80">{formatCurrency(totals.custoDiretoReal)}</td>
                <td className="py-3 px-4 border-r bg-blue-100/80 text-slate-900/60">{formatCurrency(totals.custoDiretoOrcado)}</td>
                <td className="py-3 px-4 border-r bg-blue-100/80">{formatCurrency(totals.custoDiretoOrcado - totals.custoDiretoReal)}</td>
                <td className="py-3 px-4 border-r bg-amber-100/80">{formatCurrency(totals.gerenciaReal)}</td>
                <td className="py-3 px-4 border-r bg-amber-100/80 text-slate-900/60">{formatCurrency(totals.gerenciaOrcada)}</td>
                <td className="py-3 px-4 border-r bg-amber-100/80">{formatCurrency(totals.gerenciaOrcada - totals.gerenciaReal)}</td>
                <td className="py-3 px-4 border-r bg-amber-100/80">{formatPercent(totals.gerenciaReal / (totals.producaoLiquida || 1))}</td>
                <td className="py-3 px-4 border-r bg-amber-100/80 text-slate-900/60">{formatPercent(totals.gerenciaOrcada / (totals.producaoLiquida || 1))}</td>
                <td className="py-3 px-4 border-r bg-purple-100/80">{formatCurrency(totals.custoTotalReal)}</td>
                <td className="py-3 px-4 border-r bg-purple-100/80 text-slate-900/60">{formatCurrency(totals.custoTotalOrcado)}</td>
                <td className="py-3 px-4 border-r bg-purple-100/80">{formatCurrency(totals.resultadoTotal)}</td>
                <td className="py-3 px-4 border-r bg-slate-200/80">{formatCurrency(totals.mbOrcada)}</td>
                <td className={`py-3 px-4 border-r bg-slate-200/80 ${totals.mbRealizada >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(totals.mbRealizada)}</td>
                <td className="py-3 px-4 border-r bg-slate-200/80">{formatPercent(totals.percMbOrcada)}</td>
                <td className={`py-3 px-4 bg-slate-200/80 ${totals.percMbReal >= totals.percMbMkp ? 'text-green-700' : 'text-red-700'}`}>{formatPercent(totals.percMbReal)}</td>
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