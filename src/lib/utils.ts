import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseLocalDate(dateStr: string | Date | null | undefined): Date {
  if (!dateStr) return new Date();
  
  if (typeof dateStr === 'string') {
    // Se for apenas YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return new Date(`${dateStr}T12:00:00`);
    }
    // Se for ISO completo ou algo mais complexo, tenta parseISO primeiro
    try {
      const d = parseISO(dateStr);
      if (!isNaN(d.getTime())) return d;
    } catch (e) {
      // fallback
    }
    // Fallback manual para o split
    const datePart = dateStr.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      return new Date(`${datePart}T12:00:00`);
    }
  }
  
  const d = new Date(dateStr as any);
  if (isNaN(d.getTime())) return new Date();
  // Se não tiver hora definida (00:00:00), ajusta para o meio-dia para evitar shift de timezone
  if (d.getHours() === 0 && d.getMinutes() === 0) {
    d.setHours(12);
  }
  return d;
}

/**
 * Formata uma data de forma segura, sem travar a aplicação se o valor for inválido
 */
export function safeFormat(date: string | Date | null | undefined, formatStr: string, options?: any): string {
  try {
    if (!date) return "";
    const d = typeof date === 'string' ? parseLocalDate(date) : date;
    if (isNaN(d.getTime())) return "";
    return format(d, formatStr, options);
  } catch (error) {
    console.error("Erro ao formatar data:", date, error);
    return "";
  }
}
