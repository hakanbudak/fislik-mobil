import { MONTHS_TR } from "./period";

/**
 * Date formatting, ported from fislik-web/src/lib/dates.ts. Kept
 * dependency-free (no `Intl`) for the same reason as money.ts: Hermes's
 * `Intl` support on-device is not guaranteed, and reuses the same
 * `MONTHS_TR` array `period.ts` already exports rather than a second
 * month-name list.
 */

/** Formats an ISO timestamp as a short Turkish day label, e.g. "12 Ağustos" — used on receipt tiles. */
export function formatReceiptDay(iso: string): string {
  const date = new Date(iso);
  return `${date.getDate()} ${MONTHS_TR[date.getMonth()]}`;
}

/** Formats an ISO timestamp as a full Turkish date label, e.g. "12 Ağustos 2026". */
export function formatLongDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getDate()} ${MONTHS_TR[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Formats an ISO timestamp as a full Turkish date + time label, e.g.
 * "12 Ağustos 2026, 14:30" — `formatLongDate` plus zero-padded "HH:MM".
 * Has no web counterpart (the web app never shows a time-of-day for
 * receipts); mobile needs it for notification and issue timestamps where
 * same-day events must be distinguishable.
 */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${formatLongDate(iso)}, ${hours}:${minutes}`;
}
