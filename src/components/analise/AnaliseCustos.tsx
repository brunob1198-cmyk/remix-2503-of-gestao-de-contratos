import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ClipboardList, ArrowDown, ArrowUp, Minus, FileSpreadsheet, Search, Filter, X, TrendingUp, TrendingDown, DollarSign, Percent, Target, Calculator, BarChart3, ArrowUpRight, BarChart, ChevronDown } from "lucide-react";
import { useAnaliseCustosMulti } from "@/hooks/useAnaliseCustos";

import { AnaliseCustosRow } from "@/types/analise";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { FCAModal } from "./FCAModal";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import XLSX from "xlsx-js-style";
import { saveAs } from "file-saver";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";

interface AnaliseCustosProps {
  projetoIds: string[];
  periodoInicio: Date;
  periodoFim: Date;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

const formatPercent = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

function MetricCard({ title, value, icon, className }: { title: string, value: string, icon: React.ReactNode, className?: string }) {
  return (
    <Card className={`relative flex flex-col p-3 overflow-hidden border shadow-sm transition-all hover:shadow-md min-h-[80px] ${className}`}>
      <div className="flex flex-col justify-between h-full z-10">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 leading-tight line-clamp-1 mb-1">{title}</span>
        <div className="text-base font-extrabold tracking-tight truncate">{value}</div>
      </div>
      <div className="absolute right-1 bottom-1 opacity-15">
        {icon}
      </div>
    </Card>
  );
}

export function AnaliseCustos({ projetoIds, periodoInicio, periodoFim }: AnaliseCustosProps) {
  const { analiseRows: allRows, loadCustos } = useAnaliseCustosMulti(projetoIds, periodoInicio, periodoFim);
  const [fcaState, setFcaState] = useState({
    open: false,
    projetoId: "",
    projetoNome: "",
    mesReferencia: "",
    mesLabel: "",
  });

  const [filters, setFilters] = useState(() => {
    const saved = localStorage.getItem("analise_custos_filters");
    return saved ? JSON.parse(saved) : {
      referencia: [] as string[],
      area: [] as string[],
      projeto: [] as string[],
      cliente: [] as string[],
      search: ""
    };
  });

  useEffect(() => {
    localStorage.setItem("analise_custos_filters", JSON.stringify(filters));
  }, [filters]);

  const filterOptions = useMemo(() => {
    const getFilteredRowsExcluding = (excludedKey: string) => {
      return allRows.filter(row => {
        const matchesReferencia = excludedKey === "referencia" || filters.referencia.length === 0 || filters.referencia.includes(row.referencia);
        const matchesArea = excludedKey === "area" || filters.area.length === 0 || filters.area.includes(row.area);
        const projetoStr = `${row.projetoCodigo} - ${row.projetoNome}`;
        const matchesProjeto = excludedKey === "projeto" || filters.projeto.length === 0 || filters.projeto.includes(projetoStr);
        const matchesCliente = excludedKey === "cliente" || filters.cliente.length === 0 || filters.cliente.includes(row.cliente);
        
        const searchLower = filters.search.toLowerCase();
        const matchesSearch = !filters.search || 
          row.referencia.toLowerCase().includes(searchLower) ||
          row.area.toLowerCase().includes(searchLower) ||
          projetoStr.toLowerCase().includes(searchLower) ||
          row.cliente.toLowerCase().includes(searchLower);

        return matchesReferencia && matchesArea && matchesProjeto && matchesCliente && matchesSearch;
      });
    };

    return {
      referencia: Array.from(new Set(getFilteredRowsExcluding("referencia").map(r => r.referencia))).sort(),
      area: Array.from(new Set(getFilteredRowsExcluding("area").map(r => r.area))).sort(),
      projeto: Array.from(new Set(getFilteredRowsExcluding("projeto").map(r => `${r.projetoCodigo} - ${r.projetoNome}`))).sort(),
      cliente: Array.from(new Set(getFilteredRowsExcluding("cliente").map(r => r.cliente))).sort(),
    };
  }, [allRows, filters]);

  const analiseRows = useMemo(() => {
    return allRows.filter(row => {
      const matchesReferencia = filters.referencia.length === 0 || filters.referencia.includes(row.referencia);
      const matchesArea = filters.area.length === 0 || filters.area.includes(row.area);
      const projetoStr = `${row.projetoCodigo} - ${row.projetoNome}`;
      const matchesProjeto = filters.projeto.length === 0 || filters.projeto.includes(projetoStr);
      const matchesCliente = filters.cliente.length === 0 || filters.cliente.includes(row.cliente);
      
      const searchLower = filters.search.toLowerCase();
      const matchesSearch = !filters.search || 
        row.referencia.toLowerCase().includes(searchLower) ||
        row.area.toLowerCase().includes(searchLower) ||
        projetoStr.toLowerCase().includes(searchLower) ||
        row.cliente.toLowerCase().includes(searchLower);

      return matchesReferencia && matchesArea && matchesProjeto && matchesCliente && matchesSearch;
    });
  }, [allRows, filters]);

  const totals = useMemo(() => {
    const sum = analiseRows.reduce((acc, r) => ({
      poc: acc.poc + r.poc,
      producaoLiquida: acc.producaoLiquida + r.producaoLiquida,
      moObra: acc.moObra + r.moObra,
      materiais: acc.materiais + r.materiais,
      transporte: acc.transporte + r.transporte,
      direto: acc.direto + r.direto,
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
      direto: 0,
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

  const exportToExcel = async () => {
    const header = [
      "Referência", "Área", "Projeto", "Cliente", 
      "Produção (POC)", "% Impostos", "Receita Líquida",
      "MO", "Mat.", "Transp.", "Direto", "Custo Direto Real", "Custo Direto Orçado", "Resultado Direto",
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
      totals.gerenciaReal / (totals.custoDiretoReal || 1), totals.gerenciaOrcada / (totals.custoDiretoOrcado || 1),
      totals.custoTotalReal, totals.custoTotalOrcado, totals.resultadoTotal,
      totals.mbOrcada, totals.mbRealizada, totals.percMbOrcada, totals.percMbReal
    ];

    const summaryHeaderRows = [
      ["RESUMO EXECUTIVO - ANÁLISE DE CUSTOS E MARGENS"],
      ["Data de Geração:", format(new Date(), "dd/MM/yyyy HH:mm")],
      ["Período:", `${format(periodoInicio, "MM/yyyy")} a ${format(periodoFim, "MM/yyyy")}`],
      [""],
      ["MÉTRICA", "VALOR"],
      ["Produção Total", totals.poc],
      ["Custo Total", totals.custoTotalReal],
      ["Resultado Direto", totals.custoDiretoOrcado - totals.custoDiretoReal],
      ["Resultado Total", totals.resultadoTotal],
      ["MB Orçada", totals.mbOrcada],
      ["MB Real", totals.mbRealizada],
      ["% MB Orç", totals.percMbOrcada],
      ["% MB Real", totals.percMbReal],
      [""],
      ["DETALHAMENTO POR PROJETO"],
      [""]
    ];

    const worksheetData = [...summaryHeaderRows, header, ...rows, totalRow];
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    const summaryRowsCount = summaryHeaderRows.length;

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
    
    // Apply Header styles (now at row summaryRowsCount + 1)
    const headerRowIdx = summaryRowsCount;
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_cell({ r: headerRowIdx, c: C });
      if (!ws[address]) continue;
      
      let color;
      if (C >= 4 && C <= 6) color = colors.receita;
      else if (C >= 7 && C <= 13) color = colors.custoDireto;
      else if (C >= 14 && C <= 18) color = colors.gerencia;
      else if (C >= 19 && C <= 21) color = colors.custoTotal;
      else if (C >= 22 && C <= 25) color = colors.mb;
      
      ws[address].s = headerStyle(color);
    }

    // Summary Styling (top of the sheet)
    ws["A1"].s = { font: { bold: true, size: 14 } };
    
    // Card Colors from UI
    const cardColors = [
      "DBEAFE", // Blue (Produção)
      "E0E7FF", // Indigo (Custo Total)
      "D1FAE5", // Emerald (Res. Direto)
      "F3E8FF", // Purple (Res. Total)
      "FEF3C7", // Amber (MB Orçada)
      "DCFCE7", // Green (MB Real)
      "F1F5F9", // Slate (% MB Orç)
      "E0E7FF"  // Indigo (% MB Real)
    ];

    for (let i = 5; i <= 12; i++) {
      const colorIndex = i - 5;
      const addrL = XLSX.utils.encode_cell({ r: i, c: 0 });
      const addrV = XLSX.utils.encode_cell({ r: i, c: 1 });
      
      const style = { 
        font: { bold: true },
        fill: { fgColor: { rgb: cardColors[colorIndex] } },
        border: {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" }
        }
      };
      
      if (ws[addrL]) ws[addrL].s = style;
      if (ws[addrV]) {
        ws[addrV].s = style;
        if (i >= 11) ws[addrV].z = "0.00%";
        else ws[addrV].z = '"R$ "#,##0.00';
      }
    }

    // Apply data styles
    for (let R = headerRowIdx + 1; R <= range.e.r; ++R) {
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
    // Filters - now starts at the table header row
    ws["!autofilter"] = { ref: `${XLSX.utils.encode_cell({ r: headerRowIdx, c: 0 })}:${XLSX.utils.encode_cell({ r: range.e.r - 1, c: range.e.c })}` };

    // Summary Sheet (Now matches the visual cards)
    const summaryData = [
      ["RESUMO EXECUTIVO - ANÁLISE DE CUSTOS E MARGENS"],
      [""],
      ["Data de Geração", format(new Date(), "dd/MM/yyyy HH:mm")],
      ["Período", `${format(periodoInicio, "MM/yyyy")} a ${format(periodoFim, "MM/yyyy")}`],
      [""],
      ["MÉTRICA", "VALOR"],
      ["Produção Total", totals.poc],
      ["Custo Total", totals.custoTotalReal],
      ["Resultado Direto", totals.custoDiretoOrcado - totals.custoDiretoReal],
      ["Resultado Total", totals.resultadoTotal],
      ["MB Orçada (R$)", totals.mbOrcada],
      ["MB Real (R$)", totals.mbRealizada],
      ["% MB Orçada", totals.percMbOrcada],
      ["% MB Realizada", totals.percMbReal],
      [""],
      ["DETALHES COMPLEMENTARES"],
      ["Total de Projetos", analiseRows.length],
      ["Receita Líquida Total", totals.producaoLiquida],
      ["Custo Direto Total (Real)", totals.custoDiretoReal],
      ["Custo Direto Total (Orçado)", totals.custoDiretoOrcado],
      ["Gerência Total (Real)", totals.gerenciaReal],
      ["Gerência Total (Orçada)", totals.gerenciaOrcada],
      ["Custo Total (Orçado)", totals.custoTotalOrcado]
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    
    // Summary styling
    wsSummary["A1"].s = { font: { bold: true, size: 14 } };
    for (let i = 5; i <= 23; i++) {
      const labelCell = XLSX.utils.encode_cell({ r: i, c: 0 });
      const valCell = XLSX.utils.encode_cell({ r: i, c: 1 });
      if (wsSummary[labelCell]) wsSummary[labelCell].s = { font: { bold: true } };
      if (wsSummary[valCell]) {
        // Formatos de porcentagem para as linhas de MB Orç e Real (agora i=12 e 13)
        if (i === 12 || i === 13) {
          wsSummary[valCell].z = "0.00%";
        } else if (i >= 6 && i !== 14 && i !== 15) { // Pula labels e total de projetos
          wsSummary[valCell].z = '"R$ "#,##0.00';
        }
      }
    }

    // Cores para o Resumo Executivo (combinando com os cards da tela)
    const summaryCardColors = ["DBEAFE", "E0E7FF", "DCFCE7", "F3E8FF", "FEF3C7", "D1FAE5", "F1F5F9", "F8FAFC"];
    for (let i = 0; i < 8; i++) {
      const r = i + 6;
      const addrL = XLSX.utils.encode_cell({ r, c: 0 });
      const addrV = XLSX.utils.encode_cell({ r, c: 1 });
      const style = { 
        fill: { fgColor: { rgb: summaryCardColors[i] } },
        border: { top: {style: "thin"}, bottom: {style: "thin"}, left: {style: "thin"}, right: {style: "thin"} }
      };
      if (wsSummary[addrL]) wsSummary[addrL].s = { ...wsSummary[addrL].s, ...style };
      if (wsSummary[addrV]) wsSummary[addrV].s = { ...wsSummary[addrV].s, ...style };
    }

    wsSummary["!cols"] = [{ wch: 30 }, { wch: 20 }];

    // FCA Sheet
    const fcaHeader = ["Projeto", "Mês", "Fato", "Causa", "Ação"];
    const fcaRows: any[] = [];
    
    // Fetch ALL FCA events for the selected projects within the period
    const startMonth = format(periodoInicio, "yyyy-MM");
    const endMonth = format(periodoFim, "yyyy-MM");
    
    const { data: fcaEvents } = await supabase
      .from("fca_eventos")
      .select("projeto_id, mes_referencia, fato, causa, acao")
      .in("projeto_id", projetoIds)
      .gte("mes_referencia", startMonth)
      .lte("mes_referencia", endMonth);

    if (fcaEvents && fcaEvents.length > 0) {
      // Sort by month (descending)
      const sortedEvents = [...fcaEvents].sort((a, b) => b.mes_referencia.localeCompare(a.mes_referencia));
      
      sortedEvents.forEach(evt => {
        // Find project info from allRows (even if filtered out, as long as it was loaded)
        const projectInfo = allRows.find(r => r.projetoId === evt.projeto_id);
        
        // Format month label (e.g., "2024-01" -> "Jan/2024")
        let monthLabel = evt.mes_referencia;
        try {
          const [year, month] = evt.mes_referencia.split("-");
          const date = new Date(parseInt(year), parseInt(month) - 1, 1);
          monthLabel = format(date, "MMM/yyyy", { locale: ptBR });
        } catch (e) {
          console.error("Error formatting month:", e);
        }

        fcaRows.push([
          projectInfo ? `${projectInfo.projetoCodigo} - ${projectInfo.projetoNome}` : evt.projeto_id,
          monthLabel,
          evt.fato,
          evt.causa,
          evt.acao
        ]);
      });
    }

    const wsFca = XLSX.utils.aoa_to_sheet([fcaHeader, ...fcaRows]);
    wsFca["!cols"] = [{ wch: 30 }, { wch: 15 }, { wch: 40 }, { wch: 40 }, { wch: 40 }];
    
    // FCA Styling
    const fcaRange = XLSX.utils.decode_range(wsFca["!ref"] || "A1");
    for (let C = fcaRange.s.c; C <= fcaRange.e.c; ++C) {
      const address = XLSX.utils.encode_col(C) + "1";
      if (wsFca[address]) wsFca[address].s = headerStyle("FDE68A"); // Amber 200
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Análise de Custos");
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo");
    XLSX.utils.book_append_sheet(wb, wsFca, "Eventos FCA");

    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" });
    saveAs(blob, `Analise_Custos_${format(new Date(), "yyyyMMdd_HHmmss")}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        <MetricCard 
          title="Produção Total" 
          value={formatCurrency(totals.poc)} 
          icon={<DollarSign className="h-10 w-10 text-blue-600" />}
          className="bg-blue-50/50 border-blue-200"
        />
        <MetricCard 
          title="Custo Total" 
          value={formatCurrency(totals.custoTotalReal)} 
          icon={<Calculator className="h-10 w-10 text-indigo-600" />}
          className="bg-indigo-50/50 border-indigo-200"
        />
        <MetricCard 
          title="Res. Direto" 
          value={formatCurrency(totals.custoDiretoOrcado - totals.custoDiretoReal)} 
          icon={<ArrowUpRight className="h-10 w-10 text-emerald-600" />}
          className="bg-emerald-50/50 border-emerald-200"
        />
        <MetricCard 
          title="Res. Total" 
          value={formatCurrency(totals.resultadoTotal)} 
          icon={<Target className="h-10 w-10 text-purple-600" />}
          className="bg-purple-50/50 border-purple-200"
        />
        <MetricCard 
          title="MB Orçada" 
          value={formatCurrency(totals.mbOrcada)} 
          icon={<BarChart3 className="h-10 w-10 text-amber-600" />}
          className="bg-amber-50/50 border-amber-200"
        />
        <MetricCard 
          title="MB Real" 
          value={formatCurrency(totals.mbRealizada)} 
          icon={<TrendingUp className="h-10 w-10 text-green-600" />}
          className="bg-green-50/50 border-green-200"
        />
        <MetricCard 
          title="% MB Orç" 
          value={formatPercent(totals.percMbOrcada)} 
          icon={<Percent className="h-10 w-10 text-slate-600" />}
          className="bg-slate-50/50 border-slate-200"
        />
        <MetricCard 
          title="% MB Real" 
          value={formatPercent(totals.percMbReal)} 
          icon={<Percent className="h-10 w-10 text-indigo-600" />}
          className="bg-indigo-50/50 border-indigo-200"
        />
      </div>

      <Card>
        <CardHeader className="pb-3 border-b flex flex-row items-center justify-between space-y-0">
          <div className="flex flex-1 items-center justify-between">
            <div>
              <CardTitle>Análise de Custos e Margens</CardTitle>
              <CardDescription>Detalhamento de produção, custos diretos, gerência e margem bruta por projeto e período.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar..."
                  className="pl-8 h-9"
                  value={filters.search}
                  onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    Exportar
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={exportToExcel} className="cursor-pointer">
                    <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
                    <span>Padrão Excel (Completo)</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
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
                
                {/* Referência */}
                <th className="py-3 px-4 border-b border-r text-left min-w-[120px]">
                  <div className="flex items-center justify-between gap-2">
                    <span>Referência</span>
                    <FilterPopover 
                      options={filterOptions.referencia}
                      selected={filters.referencia}
                      onSelect={(vals) => setFilters(f => ({ ...f, referencia: vals }))}
                    />
                  </div>
                </th>

                {/* Área */}
                <th className="py-3 px-4 border-b border-r text-left min-w-[120px]">
                  <div className="flex items-center justify-between gap-2">
                    <span>Área</span>
                    <FilterPopover 
                      options={filterOptions.area}
                      selected={filters.area}
                      onSelect={(vals) => setFilters(f => ({ ...f, area: vals }))}
                    />
                  </div>
                </th>

                {/* Projeto */}
                <th className="py-3 px-4 border-b border-r text-left min-w-[200px]">
                  <div className="flex items-center justify-between gap-2">
                    <span>Projeto</span>
                    <FilterPopover 
                      options={filterOptions.projeto}
                      selected={filters.projeto}
                      onSelect={(vals) => setFilters(f => ({ ...f, projeto: vals }))}
                    />
                  </div>
                </th>

                {/* Cliente */}
                <th className="py-3 px-4 border-b border-r text-left min-w-[150px]">
                  <div className="flex items-center justify-between gap-2">
                    <span>Cliente</span>
                    <FilterPopover 
                      options={filterOptions.cliente}
                      selected={filters.cliente}
                      onSelect={(vals) => setFilters(f => ({ ...f, cliente: vals }))}
                    />
                  </div>
                </th>

                <th className="py-3 px-4 border-b border-r bg-green-100/50 text-green-800">Produção (POC)</th>
                <th className="py-3 px-4 border-b border-r bg-green-100/50 text-green-800">% Impostos</th>
                <th className="py-3 px-4 border-b border-r bg-green-100/50 text-green-800">Receita Líquida</th>
                <th className="py-3 px-4 border-b border-r bg-blue-100/50 text-blue-800">MO</th>
                <th className="py-3 px-4 border-b border-r bg-blue-100/50 text-blue-800">Mat.</th>
                <th className="py-3 px-4 border-b border-r bg-blue-100/50 text-blue-800">Transp.</th>
                <th className="py-3 px-4 border-b border-r bg-blue-100/50 text-blue-800">Direto</th>
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
                          setFcaState({
                            open: true,
                            projetoId: row.projetoId,
                            projetoNome: row.projetoNome,
                            mesReferencia: row.mesReferencia,
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
                    <td className="py-2 px-4 border-b border-r bg-blue-50/50 text-blue-700">{formatCurrency(row.direto)}</td>
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
                <td className="py-3 px-4 border-r bg-blue-100/80">{formatCurrency(totals.direto)}</td>
                <td className="py-3 px-4 border-r bg-blue-100/80">{formatCurrency(totals.custoDiretoReal)}</td>
                <td className="py-3 px-4 border-r bg-blue-100/80 text-slate-900/60">{formatCurrency(totals.custoDiretoOrcado)}</td>
                <td className="py-3 px-4 border-r bg-blue-100/80">{formatCurrency(totals.custoDiretoOrcado - totals.custoDiretoReal)}</td>
                <td className="py-3 px-4 border-r bg-amber-100/80">{formatCurrency(totals.gerenciaReal)}</td>
                <td className="py-3 px-4 border-r bg-amber-100/80 text-slate-900/60">{formatCurrency(totals.gerenciaOrcada)}</td>
                <td className="py-3 px-4 border-r bg-amber-100/80">{formatCurrency(totals.gerenciaOrcada - totals.gerenciaReal)}</td>
                <td className="py-3 px-4 border-r bg-amber-100/80">{formatPercent(totals.gerenciaReal / (totals.custoDiretoReal || 1))}</td>
                <td className="py-3 px-4 border-r bg-amber-100/80 text-slate-900/60">{formatPercent(totals.gerenciaOrcada / (totals.custoDiretoOrcado || 1))}</td>
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

function FilterPopover({ 
  options, 
  selected, 
  onSelect 
}: { 
  options: string[], 
  selected: string[], 
  onSelect: (vals: string[]) => void 
}) {
  const [search, setSearch] = useState("");
  
  const filteredOptions = useMemo(() => {
    return options.filter(o => o.toLowerCase().includes(search.toLowerCase()));
  }, [options, search]);

  const toggleOption = (val: string) => {
    if (selected.includes(val)) {
      onSelect(selected.filter(v => v !== val));
    } else {
      onSelect([...selected, val]);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className={`h-7 w-7 p-0 ${selected.length > 0 ? "text-primary" : "text-muted-foreground"}`}
        >
          <Filter className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 border-none focus-visible:ring-0 px-0"
            />
            {search && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6" 
                onClick={() => setSearch("")}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          <Separator />
          <ScrollArea className="h-48">
            <div className="space-y-1">
              <div 
                className="flex items-center space-x-2 px-2 py-1 hover:bg-muted rounded-sm cursor-pointer"
                onClick={() => {
                  if (selected.length === options.length) {
                    onSelect([]);
                  } else {
                    onSelect([...options]);
                  }
                }}
              >
                <Checkbox 
                  checked={selected.length === options.length && options.length > 0} 
                  className={selected.length > 0 && selected.length < options.length ? "opacity-50" : ""}
                />
                <span className="text-xs font-semibold">Selecionar Todos</span>
              </div>
              <Separator className="my-1" />
              {filteredOptions.length === 0 ? (
                <div className="py-2 text-center text-xs text-muted-foreground">Nenhuma opção encontrada</div>
              ) : (
                filteredOptions.map((opt) => (
                  <div 
                    key={opt}
                    className="flex items-center space-x-2 px-2 py-1 hover:bg-muted rounded-sm cursor-pointer"
                    onClick={() => toggleOption(opt)}
                  >
                    <Checkbox checked={selected.includes(opt)} />
                    <span className="text-xs truncate" title={opt}>{opt}</span>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
          {selected.length > 0 && (
            <>
              <Separator />
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full h-8 text-xs" 
                onClick={() => onSelect([])}
              >
                Limpar filtros
              </Button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}