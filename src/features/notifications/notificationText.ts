import type { NotificationOut } from "@/src/api/endpoints";
import { formatPeriodLabel } from "@/src/lib/period";

/**
 * Turkish copy per notification `type`. Ported from
 * `fislik-web/src/pages/NotificationsPage.tsx`'s `notificationText` — same
 * eight types, same field precedence, same wording — with one deliberate
 * mobile-only difference: the web falls back to the raw `type` string for an
 * unrecognised type, which this app never does (mobile can receive a type
 * the running build doesn't know about yet, and a raw backend key is not
 * something to show a user). `payload` is untyped (`Record<string, unknown>`
 * in the generated schema), so every field is narrowed with `typeof` before
 * use — a malformed payload falls back to generic copy instead of crashing.
 */
export function notificationText(notification: NotificationOut): string {
  const { type, payload } = notification;

  if (type === "invite_accepted") {
    const name =
      typeof payload.name === "string"
        ? payload.name
        : typeof payload.accountant_name === "string"
          ? payload.accountant_name
          : "Karşı taraf";
    return `${name} davetini kabul etti`;
  }
  if (type === "grant_invite") {
    const name = typeof payload.name === "string" ? payload.name : "Bir kullanıcı";
    return payload.role === "accountant"
      ? `Muhasebeci ${name} sizi mükellefi olarak eklemek istiyor`
      : `${name}, fiş ve faturalarını paylaşmak için sizi eklemek istiyor`;
  }
  if (type === "invite_declined") {
    const name = typeof payload.name === "string" ? payload.name : "Karşı taraf";
    return `${name} davetinizi reddetti`;
  }
  if (type === "issue_opened") {
    const message = typeof payload.message === "string" ? payload.message : "";
    return `Bir fişin için sorun bildirildi: ${message}`;
  }
  if (type === "issue_resolved") {
    return "Bildirdiğin sorun çözüldü";
  }
  if (type === "receipts_submitted") {
    const clientName = typeof payload.client_name === "string" ? payload.client_name : "Mükellef";
    const period = typeof payload.period === "string" ? formatPeriodLabel(payload.period) : "";
    const count = typeof payload.receipt_count === "number" ? payload.receipt_count : 0;
    return `${clientName}, ${period} fişlerini gönderdi (${count} fiş)`;
  }
  if (type === "receipts_processed") {
    const accountantName = typeof payload.accountant_name === "string" ? payload.accountant_name : "Muhasebeciniz";
    const period = typeof payload.period === "string" ? formatPeriodLabel(payload.period) : "";
    const count = typeof payload.processed_count === "number" ? payload.processed_count : 0;
    return `${accountantName}, ${period} fişlerinizi işledi (${count} fiş)`;
  }
  if (type === "period_locked") {
    const accountantName = typeof payload.accountant_name === "string" ? payload.accountant_name : "Muhasebeciniz";
    const period = typeof payload.period === "string" ? formatPeriodLabel(payload.period) : "";
    return `${accountantName}, ${period} döneminizi kapattı`;
  }
  // Forward-compat: a type this build doesn't know about yet still needs a
  // readable label, never `undefined` and never the raw backend key.
  return "Yeni bildirim";
}
