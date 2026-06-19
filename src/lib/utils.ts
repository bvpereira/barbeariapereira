import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Converte um Date para string ISO "naive" (sem fuso) usando os componentes locais.
 * Usar ao gravar em colunas `timestamp without time zone` para preservar o horário
 * exatamente como foi inserido pelo usuário, sem conversão de fuso.
 */
export function toLocalISOString(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
