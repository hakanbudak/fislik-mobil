/**
 * Date/time formatting, kept dependency-free (no `Intl`) so the exact
 * Turkish output does not depend on Hermes's ICU data on-device.
 * See the Task 9 report for the `Intl` investigation.
 */

const MONTHS_TR_SHORT = [
  "Oca",
  "Şub",
  "Mar",
  "Nis",
  "May",
  "Haz",
  "Tem",
  "Ağu",
  "Eyl",
  "Eki",
  "Kas",
  "Ara",
] as const;

/** Formats an ISO timestamp as a Turkish date + time label, e.g. "7 Ağu 2026, 14:30". Uses local time, matching the period module's local-calendar convention. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const day = date.getDate();
  const month = MONTHS_TR_SHORT[date.getMonth()];
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year}, ${hours}:${minutes}`;
}
