import * as XLSX from "xlsx";
import type { FlashTransactionRow } from "@/hooks/useFlashNormalizacao";

const formatDateBR = (d: string | null) => {
  if (!d) return "";
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString("pt-BR");
  } catch {
    return d || "";
  }
};

const statusLabel = (s: string | undefined) => {
  switch (s) {
    case "normalizado":
      return "Normalizado";
    case "enviado":
      return "Enviado";
    default:
      return "Pendente";
  }
};

export function exportNormalizacaoFlashToExcel(rows: FlashTransactionRow[]) {
  if (!rows.length) {
    throw new Error("Nenhum lançamento para exportar.");
  }

  const data = rows.map((r) => ({
    Data: formatDateBR(r.data),
    Descrição: r.descricao,
    Valor: r.valor,
    Usuário: r.usuario,
    "Tipo Flash": r.flash_type,
    Operação: r.tipo_operacao === "receita" ? "Receita" : "Despesa",
    "Categoria Conta Azul": r.conta_azul_category_name || "",
    "Conta Financeira Conta Azul": r.conta_azul_account_name || "",
    Status: statusLabel(r.status),
    Motivo: r.motivo || "",
    "ID Externo Flash": r.external_id,
    "Payload Pronto (JSON)": r.conta_azul_payload
      ? JSON.stringify(r.conta_azul_payload)
      : "",
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  // Larguras razoáveis
  ws["!cols"] = [
    { wch: 12 },
    { wch: 40 },
    { wch: 12 },
    { wch: 20 },
    { wch: 18 },
    { wch: 12 },
    { wch: 28 },
    { wch: 28 },
    { wch: 14 },
    { wch: 50 },
    { wch: 22 },
    { wch: 60 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Normalização Flash");

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `normalizacao_flash_${new Date().toISOString().split("T")[0]}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
