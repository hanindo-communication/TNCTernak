import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Default IDR (Rupiah). Pass currency e.g. `"USD"` for other locales. */
export function formatCurrency(value: number, currency = "IDR"): string {
  const locale = currency === "IDR" ? "id-ID" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function monthKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Zona waktu untuk default bulan laporan dashboard (kalender sesuai hari ini di Jakarta). */
export const DASHBOARD_REPORT_TIMEZONE = "Asia/Jakarta";

/**
 * Bulan kalender saat ini sebagai `YYYY-MM` di zona waktu IANA (mis. Asia/Jakarta).
 */
export function monthKeyNowInTimeZone(timeZone: string): string {
  const now = new Date();
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
    }).formatToParts(now);
    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    if (year && month)
      return `${year}-${month.padStart(2, "0")}`;
  } catch {
    /* invalid timeZone */
  }
  return monthKeyFromDate(now);
}

export function parseMonthKey(key: string): Date {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

export function labelMonth(key: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(parseMonthKey(key));
}

/** `monthKey` format `YYYY-MM`, `delta` e.g. -1 = bulan sebelumnya. */
export function addMonthsToMonthKey(monthKey: string, delta: number): string {
  const d = parseMonthKey(monthKey);
  d.setMonth(d.getMonth() + delta);
  return monthKeyFromDate(d);
}
