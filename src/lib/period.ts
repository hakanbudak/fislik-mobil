/**
 * "Period" is the app's month-granularity unit, always formatted "YYYY-MM"
 * (zero-padded month, local calendar — never UTC). Receipts, client summaries,
 * and the month picker are all keyed by this string.
 *
 * Ported from fislik-web/src/lib/period.ts — keep behaviour identical.
 */

export const MONTHS_TR = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
] as const;

/** Current period ("YYYY-MM") derived from the device's local date, not UTC. */
export function currentPeriod(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Shifts a "YYYY-MM" period by `delta` months (negative goes back, positive forward). */
export function shiftPeriod(period: string, delta: number): string {
  const [year, month] = period.split("-").map(Number);
  const zeroBasedMonth = month - 1 + delta;
  const shiftedYear = year + Math.floor(zeroBasedMonth / 12);
  const shiftedMonth = ((zeroBasedMonth % 12) + 12) % 12;
  return `${shiftedYear}-${String(shiftedMonth + 1).padStart(2, "0")}`;
}

/** Formats a "YYYY-MM" period as a Turkish month + year label, e.g. "Ağustos 2026". */
export function formatPeriodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return `${MONTHS_TR[month - 1]} ${year}`;
}
