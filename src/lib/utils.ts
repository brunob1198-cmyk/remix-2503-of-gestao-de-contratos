import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseLocalDate(dateStr: string | Date | null | undefined): Date {
  if (!dateStr) return new Date();
  
  if (typeof dateStr === 'string') {
    // Pega apenas a parte YYYY-MM-DD e força para o meio-dia (evita o shift do fuso horário UTC-3 no Brasil)
    const datePart = dateStr.split('T')[0];
    return new Date(`${datePart}T12:00:00`);
  }
  
  const d = new Date(dateStr);
  d.setUTCHours(12);
  return d;
}
