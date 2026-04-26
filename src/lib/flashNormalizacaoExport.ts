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
    Comentários: r.comentarios,
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
    { wch: 12 }, // Data
    { wch: 40 }, // Descrição
    { wch: 12 }, // Valor
    { wch: 20 }, // Usuário
    { wch: 30 }, // Comentários
    { wch: 18 }, // Tipo Flash
    { wch: 12 }, // Operação
    { wch: 28 }, // Categoria Conta Azul
    { wch: 28 }, // Conta Financeira Conta Azul
    { wch: 14 }, // Status
    { wch: 50 }, // Motivo
    { wch: 22 }, // ID Externo Flash
    { wch: 60 }, // Payload Pronto (JSON)
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
