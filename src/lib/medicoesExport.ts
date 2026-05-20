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

export function exportAcompanhamentoToExcel(medicoes: any[]) {
  const workbook = XLSX.utils.book_new();

  const headers = [
    "Projeto",
    "Site",
    "UF",
    "Data",
    "Período",
    "Nº Medição",
    "Valor Total",
    "Status",
    "Nº PO",
    "Observação",
    "Data Resposta",
  ];

  const data = [
    ["ACOMPANHAMENTO DE MEDIÇÕES"],
    [""],
    headers,
    ...medicoes.map(m => [
      m.projeto_codigo || "",
      `${m.site_codigo} - ${m.site_nome}`,
      m.uf || "",
      m.data_medicao ? parseLocalDate(m.data_medicao).toLocaleDateString("pt-BR") : "-",
      m.periodo_inicio ? `${m.periodo_inicio} a ${m.periodo_fim}` : "",
      m.numero_medicao || "",
      m.total_valor || 0,
      m.status || "",
      m.numero_po || "",
      m.observacao_acompanhamento || "",
      m.data_resposta ? parseLocalDate(m.data_resposta).toLocaleDateString("pt-BR") : "-",
    ])
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, ws, "Medições");

  const date = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `Acompanhamento_Medicoes_${date}.xlsx`);
}

/**
 * Exportação da Análise de Custos — otimizada para Power BI
 */
export function exportAnaliseCustosPowerBI(
  rows: any[],
  periodoLabel?: string
): void {
  const wb = XLSX.utils.book_new();

  // ── Aba 1: Tabela Fato (flat, sem cabeçalhos de resumo) ──────────────────
  const fatData = rows.map((r) => ({
    "Mes_Referencia":       r.mesReferencia,
    "Referencia_Label":     r.referencia,
    "Area":                 r.area,
    "Projeto_Codigo":       r.projetoCodigo,
    "Projeto_Nome":         r.projetoNome,
    "Cliente":              r.cliente,
    "POC_Producao_Bruta":   r.poc,
    "Perc_Impostos":        r.impostos.totalPerc,
    "Impostos_R$":          r.impostos.totalReais,
    "ISSQN":                r.impostos.issqn,
    "PIS":                  r.impostos.pis,
    "COFINS":               r.impostos.cofins,
    "INSS":                 r.impostos.inss,
    "DARA":                 r.impostos.dara,
    "ICMS":                 r.impostos.icms,
    "IRPJ":                 r.impostos.irpj,
    "CSLL":                 r.impostos.csll,
    "Receita_Liquida":      r.producaoLiquida,
    "Mao_Obra":             r.moObra,
    "Materiais":            r.materiais,
    "Transporte":           r.transporte,
    "Indiretos":            r.indiretos,
    "Custo_Direto_Real":    r.custoDiretoReal,
    "Custo_Direto_Orcado":  r.custoDiretoOrcado,
    "Resultado_Direto":     r.deltaDireto,
    "Perc_CD_Real_sPOC":    r.percCustoDiretoReal,
    "Perc_CD_Orcado":       r.percCustoDiretoOrcado,
    "Gerencia_Real":        r.gerenciaReal,
    "Gerencia_Orcada":      r.gerenciaOrcada,
    "Resultado_Gerencia":   r.deltaGerencia,
    "Perc_Gerencia_Real":   r.percGerenciaReal,
    "Perc_Gerencia_Orcada": r.percGerenciaOrcada,
    "Pendentes_IA":         r.pendentesCategorizacao,
    "Custo_Total_Real":     r.custoTotalReal,
    "Custo_Total_Orcado":   r.custoTotalOrcado,
    "Resultado_Total":      r.resultadoTotal,
    "MB_Orcada_R$":         r.mbOrcada,
    "MB_Realizada_R$":      r.mbRealizada,
    "Perc_MB_Orcada":       r.percMbOrcada,
    "Perc_MB_Realizada":    r.percMbReal,
    "Perc_MB_Target_MKP":   r.percMbMkp,
    "Alerta_MB":            r.alertaMb ? 1 : 0,
    "Alerta_Gerencia":      r.alertaGerencia ? 1 : 0,
    "Sem_MKP":              r.semMkp ? 1 : 0,
    "Sem_Impostos":         r.semImpostos ? 1 : 0,
  }));

  const wsFat = XLSX.utils.json_to_sheet(fatData);
  _autoColWidths(wsFat, fatData);
  XLSX.utils.book_append_sheet(wb, wsFat, "Fato_Analise_Custos");

  const projetosMap = new Map<string, { codigo: string; nome: string; area: string }>();
  rows.forEach((r) =>
    projetosMap.set(r.projetoId, { codigo: r.projetoCodigo, nome: r.projetoNome, area: r.area })
  );
  const dimProjData = Array.from(projetosMap.entries()).map(([id, p]) => ({
    "Projeto_ID":     id,
    "Projeto_Codigo": p.codigo,
    "Projeto_Nome":   p.nome,
    "Area":           p.area,
  }));
  const wsDimProj = XLSX.utils.json_to_sheet(dimProjData);
  _autoColWidths(wsDimProj, dimProjData);
  XLSX.utils.book_append_sheet(wb, wsDimProj, "Dim_Projeto");

  const meses = Array.from(new Set(rows.map((r) => r.mesReferencia))).sort() as string[];
  const dimCalData = meses.map((m) => {
    const [ano, mes] = m.split("-");
    return {
      "Mes_Referencia":  m,
      "Ano":             Number(ano),
      "Mes_Num":         Number(mes),
      "Mes_Nome":        _mesNome(Number(mes)),
      "Trimestre":       `T${Math.ceil(Number(mes) / 3)}/${ano}`,
      "Semestre":        Number(mes) <= 6 ? `S1/${ano}` : `S2/${ano}`,
    };
  });
  const wsDimCal = XLSX.utils.json_to_sheet(dimCalData);
  _autoColWidths(wsDimCal, dimCalData);
  XLSX.utils.book_append_sheet(wb, wsDimCal, "Dim_Calendario");

  const totalPoc       = rows.reduce((s, r) => s + r.poc, 0);
  const totalLiq       = rows.reduce((s, r) => s + r.producaoLiquida, 0);
  const totalCDReal    = rows.reduce((s, r) => s + r.custoDiretoReal, 0);
  const totalCDOrc     = rows.reduce((s, r) => s + r.custoDiretoOrcado, 0);
  const totalGerReal   = rows.reduce((s, r) => s + r.gerenciaReal, 0);
  const totalGerOrc    = rows.reduce((s, r) => s + r.gerenciaOrcada, 0);
  const totalCTReal    = rows.reduce((s, r) => s + r.custoTotalReal, 0);
  const totalCTOrc     = rows.reduce((s, r) => s + r.custoTotalOrcado, 0);
  const totalMBOrc     = rows.reduce((s, r) => s + r.mbOrcada, 0);
  const totalMBReal    = rows.reduce((s, r) => s + r.mbRealizada, 0);
  const totalResDir    = rows.reduce((s, r) => s + r.deltaDireto, 0);
  const totalResTotal  = rows.reduce((s, r) => s + r.resultadoTotal, 0);

  const resumoData = [
    { "Métrica": "POC / Produção Bruta",      "Valor": totalPoc },
    { "Métrica": "Receita Líquida",            "Valor": totalLiq },
    { "Métrica": "Custo Direto Real",          "Valor": totalCDReal },
    { "Métrica": "Custo Direto Orçado",        "Valor": totalCDOrc },
    { "Métrica": "Resultado Direto",           "Valor": totalResDir },
    { "Métrica": "Gerência Real",              "Valor": totalGerReal },
    { "Métrica": "Gerência Orçada",            "Valor": totalGerOrc },
    { "Métrica": "Resultado Gerência",         "Valor": totalGerOrc - totalGerReal },
    { "Métrica": "Custo Total Real",           "Valor": totalCTReal },
    { "Métrica": "Custo Total Orçado",         "Valor": totalCTOrc },
    { "Métrica": "Resultado Total",            "Valor": totalResTotal },
    { "Métrica": "MB Orçada (R$)",             "Valor": totalMBOrc },
    { "Métrica": "MB Realizada (R$)",          "Valor": totalMBReal },
    { "Métrica": "% MB Orçada",               "Valor": totalLiq > 0 ? totalMBOrc / totalLiq : 0 },
    { "Métrica": "% MB Realizada",            "Valor": totalLiq > 0 ? totalMBReal / totalLiq : 0 },
    { "Métrica": "Projetos distintos",         "Valor": projetosMap.size },
    { "Métrica": "Períodos analisados",        "Valor": meses.length },
  ];
  const wsRes = XLSX.utils.json_to_sheet(resumoData);
  _autoColWidths(wsRes, resumoData);
  XLSX.utils.book_append_sheet(wb, wsRes, "Resumo");

  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const filename = `Analise_Custos_PowerBI_${periodoLabel?.replace(/\//g, "-") ?? timestamp}.xlsx`;
  
  XLSX.writeFile(wb, filename);
}

function _autoColWidths(ws: XLSX.WorkSheet, data: Record<string, any>[]): void {
  if (!data.length) return;
  const keys = Object.keys(data[0]);
  const widths = keys.map((k) => {
    const maxVal = data.reduce((max, row) => {
      const v = String(row[k] ?? "");
      return Math.max(max, v.length);
    }, k.length);
    return { wch: Math.min(maxVal + 2, 40) };
  });
  ws["!cols"] = widths;
}

function _mesNome(mes: number): string {
  const nomes = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return nomes[mes - 1] ?? "";
}
