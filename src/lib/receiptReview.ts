import type { ReceiptOut } from "@/src/api/endpoints";
import type { components } from "@/src/api/generated/schema";
import { formatMoney } from "./money";
import { isPdf } from "./receipts";

/**
 * Ported from fislik-web/src/lib/receiptReview.ts — the view model + pure
 * logic behind how a receipt's derived values (labels, analysis state,
 * amount parsing, export-style formatting) are computed. Keeping this
 * React-free and free of any web/DOM concerns is what lets the accountant
 * web app and this mobile app agree on what a receipt *means*.
 *
 * NOT ported: `downloadExcel`/`downloadCsv`/`downloadJson`/`triggerDownload`/
 * `escapeHtml`/`printPdf` (browser-DOM export helpers with no mobile screen
 * behind them) and the `ReviewFilters`/`filterAndSortRows`/`EXPORT_FIELDS`
 * machinery (the desktop accountant review table's filter/sort/export UI,
 * which mobile has no equivalent of). `periodTitle` is also left out —
 * mobile already has the same "YYYY-MM" → "Ağustos 2026" behaviour in
 * `formatPeriodLabel` (`src/lib/period.ts`), and `findDuplicateIds` is left
 * out since no mobile screen needs duplicate detection yet; port it
 * alongside whatever task first does.
 */

/** The literal doc-type/payment/category/tax-id-type vocabularies, read off
 * the generated schema's `ExtractionPatchIn` (the one place the OpenAPI spec
 * keeps them as literal unions rather than widening them to `string`) so
 * this module never hand-duplicates the API's enum values. */
type DocType = NonNullable<components["schemas"]["ExtractionPatchIn"]["doc_type"]>;
type PaymentMethod = NonNullable<components["schemas"]["ExtractionPatchIn"]["payment_method"]>;
type ExpenseCategory = NonNullable<components["schemas"]["ExtractionPatchIn"]["expense_category"]>;
type TaxIdType = NonNullable<components["schemas"]["ExtractionPatchIn"]["merchant_tax_id_type"]>;

/**
 * `ExtractionOut.status` extended with two non-`ExtractionOut` states, both
 * derived from `ReceiptOut.extraction` being falsy rather than an object —
 * kept distinct because they mean very different things to the accountant:
 * - "none": extraction is missing entirely (`undefined` — uploaded before
 *   the AI pipeline existed, or an API version that doesn't send it yet).
 *   Behaves like "failed" — no analysis is coming, manual entry is the way
 *   forward — but keeps its own label so the UI never claims an analysis
 *   "failed" that never ran.
 * - "deferred": extraction is explicitly `null` — the account's monthly
 *   analysis-credit limit was exhausted at upload time, so the receipt is
 *   queued for automatic analysis next month. Nothing is wrong with this
 *   receipt; it just hasn't been analyzed YET, unlike "none"/"failed" where
 *   no analysis is ever coming on its own. Must NOT be conflated with
 *   "none" (coalescing `undefined` and `null` to the same value) — callers
 *   that render a red "no analysis" treatment for "none"/"failed" should
 *   give "deferred" its own softer, amber "queued" treatment instead.
 */
export type AnalysisState = "done" | "pending" | "failed" | "none" | "deferred";

/** Derives `AnalysisState` from `receipt.extraction` — see `AnalysisState`'s
 * docstring for why `null` and `undefined` must not be coalesced. */
export function analysisState(receipt: ReceiptOut): AnalysisState {
  const ex = receipt.extraction;
  if (ex === null) return "deferred";
  if (ex === undefined) return "none";
  if (ex.status === "pending") return "pending";
  if (ex.status === "failed") return "failed";
  return "done";
}

export interface ReviewRow {
  id: string;
  receipt: ReceiptOut;
  merchant: string | null;
  /** ISO "YYYY-MM-DD" extraction date (not the upload timestamp). */
  date: string | null;
  docType: DocType;
  no: string | null;
  taxId: string | null;
  taxType: TaxIdType | null;
  office: string | null;
  pay: PaymentMethod | null;
  category: ExpenseCategory | null;
  total: number | null;
  vat: number | null;
  vatLines: { rate: number; amount: number }[];
  st: AnalysisState;
  edited: boolean;
  processed: boolean;
  issue: ReceiptOut["open_issue"];
  pdf: boolean;
  imageUrl: string;
}

function asDocType(v: string | null | undefined): DocType {
  return v === "fis" || v === "fatura" ? v : "unknown";
}

function asPaymentMethod(v: string | null | undefined): PaymentMethod | null {
  return v === "nakit" || v === "kredi_karti" || v === "bilinmiyor" ? v : null;
}

function asTaxIdType(v: string | null | undefined): TaxIdType | null {
  return v === "vkn" || v === "tckn" ? v : null;
}

const CATEGORY_KEYS: ExpenseCategory[] = [
  "yemek",
  "market",
  "yakit",
  "ulasim",
  "konaklama",
  "ofis",
  "teknoloji",
  "iletisim",
  "saglik",
  "diger",
];

function asExpenseCategory(v: string | null | undefined): ExpenseCategory | null {
  return (CATEGORY_KEYS as string[]).includes(v ?? "") ? (v as ExpenseCategory) : null;
}

export function toReviewRow(receipt: ReceiptOut): ReviewRow {
  // Deliberately NOT coalesced to `?? null` here — `st` below must tell
  // `undefined` (never analyzed — "none") apart from `null` (deferred, see
  // `AnalysisState`'s docstring). Every other field reads through `ex?.x`,
  // which treats `undefined` and `null` identically, so the distinction
  // only needs to happen once, at `st`.
  const ex = receipt.extraction;
  const num = (v: string | null | undefined): number | null => {
    if (v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  };
  return {
    id: receipt.id,
    receipt,
    merchant: ex?.merchant_name ?? null,
    date: ex?.receipt_date ?? null,
    docType: asDocType(ex?.doc_type),
    no: ex?.receipt_number ?? null,
    taxId: ex?.merchant_tax_id ?? null,
    taxType: asTaxIdType(ex?.merchant_tax_id_type),
    office: ex?.merchant_tax_office ?? null,
    pay: asPaymentMethod(ex?.payment_method),
    category: asExpenseCategory(ex?.expense_category),
    total: num(ex?.total_amount),
    vat: num(ex?.vat_total),
    vatLines: (ex?.vat_breakdown ?? []).map((l) => ({ rate: l.rate, amount: Number(l.amount) || 0 })),
    st: analysisState(receipt),
    edited: ex?.edited ?? false,
    processed: receipt.processed,
    issue: receipt.open_issue,
    pdf: isPdf(receipt),
    imageUrl: receipt.image_url,
  };
}

export const DOC_TYPE_LABELS: Record<string, string> = {
  fis: "Fiş",
  fatura: "Fatura",
  unknown: "Bilinmiyor",
};

export const PAYMENT_LABELS: Record<string, string> = {
  nakit: "Nakit",
  kredi_karti: "Kredi Kartı",
  bilinmiyor: "Bilinmiyor",
};

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  yemek: "Yemek",
  market: "Market",
  yakit: "Yakıt",
  ulasim: "Ulaşım",
  konaklama: "Konaklama",
  ofis: "Ofis",
  teknoloji: "Teknoloji",
  iletisim: "İletişim",
  saglik: "Sağlık",
  diger: "Diğer",
};

export const ANALYSIS_LABELS: Record<AnalysisState, string> = {
  done: "Tamam",
  pending: "Bekliyor",
  failed: "Başarısız",
  none: "Analiz yok",
  deferred: "Sıraya alındı",
};

/**
 * "₺1.482,35", or "—" for a missing amount. The web builds this on
 * `Intl.NumberFormat`; mobile delegates to `formatMoney` (Task 9) instead of
 * introducing a second currency formatter, since Hermes's on-device ICU
 * support isn't guaranteed and `formatMoney` was already verified to match
 * `Intl` byte-for-byte. Only the numeric-vs-decimal-string signature is
 * adapted here.
 */
export function fmtTRY(n: number | null | undefined): string {
  return formatMoney(n === null || n === undefined ? null : String(n));
}

/**
 * Bare Turkish number ("1.482,35") for inputs and export cells; "" when
 * missing. Manual port of the web's `n.toLocaleString("tr-TR", {
 * minimumFractionDigits: 2, maximumFractionDigits: 2 })`, mirroring
 * `formatMoney`'s Hermes-safe approach (see that function's docstring) minus
 * the currency symbol. Verified empirically against Node's `Intl` output
 * (see the Task 15 report) across ordinary, thousands-grouped, negative, and
 * rounding-edge values.
 */
export function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  const sign = n < 0 ? "-" : "";
  const [integerPart, decimalPart = "00"] = Math.abs(n).toFixed(2).split(".");
  const withThousands = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${withThousands},${decimalPart}`;
}

/** ISO "YYYY-MM-DD" → "GG.AA.YYYY"; null in, null out. */
export function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/**
 * User-typed amount ("1.234,56", "1234.56", "1234") → API decimal string
 * ("1234.56"); empty → null; unparseable → undefined so callers can tell
 * "cleared" apart from "invalid". Accepts both Turkish (dot thousands, comma
 * decimal) and plain machine formats since accountants paste both.
 */
export function parseAmountInput(raw: string): string | null | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  let normalized = trimmed;
  if (trimmed.includes(",")) {
    normalized = trimmed.replace(/\./g, "").replace(",", ".");
  }
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return undefined;
  return normalized;
}

/**
 * The "YYYY-MM" month of the extracted receipt date when it differs from
 * the month the receipt is filed under; null when they agree or no date is
 * known. A July-dated receipt uploaded into August gets flagged — the
 * upload date and the receipt's own date are different things, and the
 * receipt date is the one accounting cares about.
 */
export function mismatchedPeriod(receiptDate: string | null, period: string): string | null {
  if (!receiptDate) return null;
  const month = receiptDate.slice(0, 7);
  return month === period ? null : month;
}

const TR_TRANSLIT: Record<string, string> = {
  ç: "c", Ç: "c", ğ: "g", Ğ: "g", ı: "i", İ: "i",
  ö: "o", Ö: "o", ş: "s", Ş: "s", ü: "u", Ü: "u",
};

/**
 * Lowercase ASCII slug of a (Turkish) string for file names — mirror of the
 * backend's `ascii_slug` (see fislik-api, accountant service) so the ZIP the
 * API serves and the exports this app builds name themselves consistently.
 * Turkish letters transliterate rather than drop; everything else
 * non-alphanumeric collapses to single dashes.
 */
export function slugifyTr(value: string, maxLength = 40): string {
  const slug = value
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (ch) => TR_TRANSLIT[ch])
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.slice(0, maxLength).replace(/-+$/g, "");
}
