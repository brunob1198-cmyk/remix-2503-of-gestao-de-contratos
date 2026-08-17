import * as XLSX from "xlsx-js-style";

export interface ProjetoExportRow {
  codigo: string;
  nome: string;
  area: string;
  cliente: string;
  coordenador: string;
  contratos: string;
  descricao: string;
  valorTotal: number;
  status: string;
}

const HEADERS: { key: keyof ProjetoExportRow; label: string; width: number; type: "text" | "money" }[] = [
  { key: "codigo", label: "Código", width: 16, type: "text" },
  { key: "nome", label: "Projeto", width: 46, type: "text" },
  { key: "area", label: "Área / Centro de Custo", width: 26, type: "text" },
  { key: "cliente", label: "Cliente", width: 36, type: "text" },
  { key: "coordenador", label: "Coordenador", width: 24, type: "text" },
  { key: "contratos", label: "Contratos Vinculados", width: 30, type: "text" },
  { key: "descricao", label: "Descrição / Escopo", width: 50, type: "text" },
  { key: "valorTotal", label: "Valor Total (R$)", width: 20, type: "money" },
  { key: "status", label: "Status", width: 16, type: "text" },
];

const MONEY_FMT = 'R$ #,##0.00;[Red](R$ #,##0.00);"-"';
const NAVY = "1E3A5F";

const border = {
  top: { style: "thin", color: { rgb: "D6DCE4" } },
  bottom: { style: "thin", color: { rgb: "D6DCE4" } },
  left: { style: "thin", color: { rgb: "D6DCE4" } },
  right: { style: "thin", color: { rgb: "D6DCE4" } },
};

export function exportProjetosExcel(rows: ProjetoExportRow[], meta: { geradoEm: Date }) {
  const aoa: any[][] = [];

  aoa.push([{ v: "RELATÓRIO EXECUTIVO — PROJETOS", t: "s" }]);
  aoa.push([
    {
      v: `Gerado em ${meta.geradoEm.toLocaleString("pt-BR")}  |  ${rows.length} projeto(s)`,
      t: "s",
    },
  ]);
  aoa.push([]);
  aoa.push(HEADERS.map((h) => ({ v: h.label, t: "s" })));

  rows.forEach((r) => {
    aoa.push(
      HEADERS.map((h) => {
        const raw = r[h.key];
        if (h.type === "money") return { v: Number(raw) || 0, t: "n", z: MONEY_FMT };
        return { v: raw ?? "", t: "s" };
      }),
    );
  });

  const totalRowIdx = aoa.length;
  aoa.push(
    HEADERS.map((h, i) => {
      if (i === 0) return { v: "TOTAL GERAL", t: "s" };
      if (h.type === "money") {
        const sum = rows.reduce((acc, r) => acc + (Number(r[h.key]) || 0), 0);
        return { v: sum, t: "n", z: MONEY_FMT };
      }
      return { v: "", t: "s" };
    }),
  );

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const lastCol = HEADERS.length - 1;

  ws["!cols"] = HEADERS.map((h) => ({ wch: h.width }));
  ws["!rows"] = [{ hpt: 28 }, { hpt: 18 }, { hpt: 6 }, { hpt: 24 }];
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } },
  ];
  ws["!freeze"] = { xSplit: 0, ySplit: 4 };
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 3, c: 0 }, e: { r: Math.max(totalRowIdx - 1, 4), c: lastCol } }) };

  const setStyle = (r: number, c: number, style: any) => {
    const addr = XLSX.utils.encode_cell({ r, c });
    if (!ws[addr]) ws[addr] = { v: "", t: "s" };
    ws[addr].s = { ...(ws[addr].s || {}), ...style };
  };

  for (let c = 0; c <= lastCol; c++) {
    setStyle(0, c, {
      font: { name: "Arial", sz: 14, bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: NAVY } },
      alignment: { horizontal: "left", vertical: "center" },
    });
    setStyle(1, c, {
      font: { name: "Arial", sz: 9, italic: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: NAVY } },
      alignment: { horizontal: "left", vertical: "center" },
    });
    setStyle(3, c, {
      font: { name: "Arial", sz: 10, bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "2C5282" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border,
    });
    setStyle(totalRowIdx, c, {
      font: { name: "Arial", sz: 10, bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: NAVY } },
      alignment: { horizontal: HEADERS[c].type === "money" ? "right" : "left", vertical: "center" },
      border,
    });
  }

  rows.forEach((_row, i) => {
    const r = 4 + i;
    const zebra = i % 2 === 1;
    for (let c = 0; c <= lastCol; c++) {
      const h = HEADERS[c];
      setStyle(r, c, {
        font: { name: "Arial", sz: 10, bold: c === 0 },
        fill: { fgColor: { rgb: zebra ? "F4F7FA" : "FFFFFF" } },
        alignment: {
          horizontal: h.type === "money" ? "right" : "left",
          vertical: "center",
          wrapText: h.key === "descricao" || h.key === "nome" || h.key === "contratos",
        },
        border,
      });
    }
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Projetos");
  const stamp = meta.geradoEm.toISOString().split("T")[0];
  XLSX.writeFile(wb, `projetos_${stamp}.xlsx`);
}
