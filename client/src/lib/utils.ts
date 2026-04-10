import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR");
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const d = phone.replace(/\D/g, "");
  if (d.length === 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  return phone;
}

export const STATUS_LABELS: Record<string, string> = {
  aguarda_retorno_saldo: "Aguarda Retorno",
  aguarda_desbloqueio: "Aguarda Desbloqueio",
  pendente_formalizacao: "Pend. Formalização",
  aprovado: "Aprovado",
  cancelado: "Cancelado",
};

export const STATUS_COLORS: Record<string, string> = {
  aguarda_retorno_saldo: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  aguarda_desbloqueio: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  pendente_formalizacao: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  aprovado: "bg-green-500/20 text-green-400 border-green-500/30",
  cancelado: "bg-red-500/20 text-red-400 border-red-500/30",
};
