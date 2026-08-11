/**
 * Money formatting for API decimal strings ("1234.50").
 *
 * The web app (fislik-web/src/lib/money.ts) formats via `Intl.NumberFormat("tr-TR", {
 * style: "currency", currency: "TRY" })`, rendering e.g. "₺1.234,50" (symbol
 * prefix, "." thousands separator, "," decimal separator, two decimals). The
 * two clients render the same receipts, so this mobile helper reproduces
 * that exact output — but does so by hand instead of calling `Intl`. Hermes's
 * ICU/`Intl` support on-device is not guaranteed (it can silently fall back
 * to "en-US"-style formatting, e.g. "1,234.50"), and that failure is
 * invisible from a Jest run, which executes on Node's full ICU, not Hermes.
 * Do NOT "simplify" this back to `Intl.NumberFormat` — see the Task 9 report
 * for the investigation and the concrete values checked against `Intl`.
 *
 * `formatMoney(null)` → "—" is a mobile-only addition (the web helper takes
 * a non-null `string`): mobile renders nullable extraction fields directly.
 */
export function formatMoney(value: string | null): string {
  if (value === null) return "—";

  const parsed = Number(value);
  if (Number.isNaN(parsed)) return value;

  const sign = parsed < 0 ? "-" : "";
  const [integerPart, decimalPart = "00"] = Math.abs(parsed).toFixed(2).split(".");
  const withThousands = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return `${sign}₺${withThousands},${decimalPart}`;
}
