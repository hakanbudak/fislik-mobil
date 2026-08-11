/**
 * True when a receipt's stored file is a PDF (a Turkish e-fatura/e-arşiv
 * invoice) rather than a photo. `content_type` is optional for
 * backend-rollout safety, so a receipt with no value is treated as an
 * image, matching fislik-web/src/lib/receipts.ts.
 */
export function isPdf(receipt: { content_type?: string }): boolean {
  return receipt.content_type === "application/pdf";
}
