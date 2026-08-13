import { parseISO, isBefore, addDays, startOfDay } from "date-fns";

export type StatusVencimentoTreinamento = "VALIDO" | "PROXIMO_VENCIMENTO" | "VENCIDO";

export function calculateVencimentoTreinamento(validadeStr?: string | null): StatusVencimentoTreinamento {
  if (!validadeStr) return "VALIDO"; // Treinamento com validade indeterminada/sem expiração
  try {
    const today = startOfDay(new Date());
    const validadeDate = startOfDay(parseISO(validadeStr));
    const warningThreshold = addDays(today, 30);

    if (isBefore(validadeDate, today)) {
      return "VENCIDO";
    }
    if (isBefore(validadeDate, warningThreshold) || validadeDate.getTime() === warningThreshold.getTime()) {
      return "PROXIMO_VENCIMENTO";
    }
    return "VALIDO";
  } catch {
    return "VENCIDO";
  }
}
