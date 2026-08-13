import { parseISO, isBefore, addDays, startOfDay } from "date-fns";

export type StatusValidadeCa = "VALIDO" | "PROXIMO_VENCIMENTO" | "VENCIDO";

export function calculateValidadeCa(validadeCaStr?: string | null): StatusValidadeCa {
  if (!validadeCaStr) return "VALIDO"; // Sem data de validade de CA informada
  try {
    const today = startOfDay(new Date());
    const caDate = startOfDay(parseISO(validadeCaStr));
    const warningThreshold = addDays(today, 30);

    if (isBefore(caDate, today)) {
      return "VENCIDO";
    }
    if (isBefore(caDate, warningThreshold) || caDate.getTime() === warningThreshold.getTime()) {
      return "PROXIMO_VENCIMENTO";
    }
    return "VALIDO";
  } catch {
    return "VENCIDO";
  }
}
