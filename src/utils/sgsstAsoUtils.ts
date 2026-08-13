import { parseISO, isBefore, addDays, startOfDay } from "date-fns";

export type StatusVencimentoAso = "VALIDO" | "PROXIMO_VENCIMENTO" | "VENCIDO";

export function calculateVencimentoAso(validadeStr: string): StatusVencimentoAso {
  if (!validadeStr) return "VENCIDO";
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
