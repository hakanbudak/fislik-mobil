/**
 * Money formatting for API decimal strings ("1234.50").
 *
 * The web app (fislik-web/src/lib/money.ts) uses `Intl.NumberFormat("tr-TR", {
 * style: "currency", currency: "TRY" })`, which renders "₺1.234,50" (symbol
 * prefix). This mobile helper instead produces a "₺" suffix ("1.234,50 ₺")
 * per this app's UI contract, and formats manually rather than relying on
 * `Intl`, whose tr-TR locale data is not guaranteed to be present in
 * Hermes's ICU build on-device. See the Task 9 report for details.
 */
export function formatMoney(value: string | null): string {
  if (value === null) return "—";

  const parsed = Number(value);
  if (Number.isNaN(parsed)) return value;

  const sign = parsed < 0 ? "-" : "";
  const [integerPart, decimalPart = "00"] = Math.abs(parsed).toFixed(2).split(".");
  const withThousands = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return `${sign}${withThousands},${decimalPart} ₺`;
}
