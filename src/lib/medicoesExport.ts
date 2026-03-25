import * as XLSX from "xlsx";
import { ResumoProjeto, ResumoItem } from "@/types/medicoes";
import { parseLocalDate } from "./utils";

export function exportDashboardToExcel(
  resumoProjetos: ResumoProjeto[],
  resumoItens: ResumoItem[],
  totais: {
    totalProduzido: number;
    totalMedido: number;
    totalFaturado: number;
    totalAMedir: number;
    totalAFaturar: number;
  }
) {
  const workbook = XLSX.utils.book_new();

  // Resumo Geral sheet
  const resumoGeralData = [
    ["RESUMO GERAL"],
    [""],
    ["Métrica", "Valor"],
    ["Total Produzido", totais.totalProduzido],
    ["Total Medido", totais.totalMedido],
    ["Total Faturado", totais.totalFaturado],
    ["A Medir (Produzido - Medido)", totais.totalAMedir],
    ["A Faturar (Medido - Faturado)", totais.totalAFaturar],
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet(resumoGeralData);
  XLSX.utils.book_append_sheet(workbook, wsResumo, "Resumo Geral");

  // Projetos sheet
  const projetosData = [
    ["RESUMO POR PROJETO"],
    [""],
    ["Código", "Nome", "Total Produzido", "Total Medido", "Total Faturado", "A Medir", "A Faturar"],
    ...resumoProjetos.map(p => [
      p.codigo,
      p.nome,
      p.total_produzido,
      p.total_medido,
      p.total_faturado,
      p.total_a_medir,
      p.total_a_faturar,
    ])
  ];
  const wsProjetos = XLSX.utils.aoa_to_sheet(projetosData);
  XLSX.utils.book_append_sheet(workbook, wsProjetos, "Por Projeto");

  // Itens sheet - includes Projeto and Site columns to match dashboard view
  const itensData = [
    ["RESUMO POR ITEM LPU"],
    [""],
    ["Projeto", "Site", "Código", "Descrição", "Unidade", "Preço Unit.", "Qtd Produzida", "Qtd Medida", "Qtd Faturada", "Qtd A Medir", "Qtd A Faturar", "Valor Produzido", "Valor Medido", "Valor Faturado"],
    ...resumoItens.map(i => [
      i.projeto_codigo || "",
      i.site_codigo || "",
      i.codigo,
      i.descricao,
      i.unidade,
      i.preco_unitario,
      i.qtd_produzida,
      i.qtd_medida,
      i.qtd_faturada,
      i.qtd_a_medir,
      i.qtd_a_faturar,
      i.valor_produzido,
      i.valor_medido,
      i.valor_faturado,
    ])
  ];
  const wsItens = XLSX.utils.aoa_to_sheet(itensData);
  XLSX.utils.book_append_sheet(workbook, wsItens, "Por Item LPU");

  // Download
  const date = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `Relatorio_Medicoes_${date}.xlsx`);
}

export function exportLancamentosToExcel(
  lancamentos: any[],
  tipo: "producao" | "medicao" | "faturamento"
) {
  const workbook = XLSX.utils.book_new();

  const getTitulo = () => {
    switch (tipo) {
      case "producao": return "LANÇAMENTOS DE PRODUÇÃO";
      case "medicao": return "LANÇAMENTOS DE MEDIÇÃO";
      case "faturamento": return "LANÇAMENTOS DE FATURAMENTO";
    }
  };

  const getDataField = () => {
    switch (tipo) {
      case "producao": return "data_producao";
      case "medicao": return "data_medicao";
      case "faturamento": return "data_faturamento";
    }
  };

  const dataField = getDataField();

  const headers = [
    "Data",
    "Projeto",
    "Site",
    "Código Item",
    "Descrição Item",
    "Unidade",
    "Quantidade",
    "Preço Unitário",
    "Valor Total",
  ];

  if (tipo === "producao") headers.push("Empresa Executora");
  if (tipo === "medicao") headers.push("Nº Medição", "Status");
  if (tipo === "faturamento") headers.push("Nº NF", "Valor Faturado");
  headers.push("Observação");

  const data = [
    [getTitulo()],
    [""],
    headers,
    ...lancamentos.map(l => {
      const preco = Number(l.item_lpu?.preco_unitario || 0);
      const valorTotal = Number(l.quantidade) * preco;
      
      const row: any[] = [
        l[dataField] ? parseLocalDate(l[dataField]).toLocaleDateString("pt-BR") : "-",
        l.site?.projeto?.codigo || "",
        `${l.site?.codigo} - ${l.site?.nome}`,
        l.item_lpu?.codigo,
        l.item_lpu?.descricao,
        l.item_lpu?.unidade,
        Number(l.quantidade),
        preco,
        valorTotal,
      ];

      if (tipo === "producao") row.push(l.empresa_executora || "");
      if (tipo === "medicao") row.push(l.numero_medicao || "", l.status || "");
      if (tipo === "faturamento") row.push(l.numero_nf || "", l.valor_faturado || valorTotal);
      row.push(l.observacao || "");

      return row;
    })
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, ws, "Lançamentos");

  const date = new Date().toISOString().split('T')[0];
  const tipoName = tipo.charAt(0).toUpperCase() + tipo.slice(1);
  XLSX.writeFile(workbook, `Lancamentos_${tipoName}_${date}.xlsx`);
}
