import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/src/api/queryKeys";
import type { ReceiptOut } from "@/src/api/endpoints";

/**
 * Refreshes the right query cache once a queued capture finishes uploading
 * (`worker.ts`'s `UploadedHandler`, wired up in `app/_layout.tsx`).
 *
 * Two shapes, matching the two things a queued capture can be:
 * - The caller's own capture (`clientId` undefined): refreshes their own
 *   receipts/summary/submission for both the period the upload targeted and
 *   the one it actually landed in — the API re-files uploads aimed at a
 *   locked month into the next open one, so both can differ.
 * - An accountant's on-behalf capture (`clientId` set, Task 24): refreshes
 *   that client's receipts (`AccountantMonthPage`'s mobile counterpart) and
 *   the client-roster summary for both periods, plus the accountant's own
 *   `["credits"]` query — the upload is paid from THEIR balance, not the
 *   client's, mirroring `fislik-web/src/pages/AccountantMonthPage.tsx`'s
 *   `UploadDropzone.onUploaded` handler.
 */
export function invalidateAfterUpload(
  queryClient: QueryClient,
  receipt: ReceiptOut,
  requestedPeriod: string,
  clientId?: string,
): void {
  const periods = new Set([requestedPeriod, receipt.period]);

  if (clientId) {
    for (const period of periods) {
      queryClient.invalidateQueries({ queryKey: queryKeys.clientReceipts(clientId, period) });
      queryClient.invalidateQueries({ queryKey: queryKeys.clients(period) });
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.credits() });
    return;
  }

  for (const period of periods) {
    queryClient.invalidateQueries({ queryKey: queryKeys.receipts(period) });
    queryClient.invalidateQueries({ queryKey: queryKeys.summary(period) });
    queryClient.invalidateQueries({ queryKey: queryKeys.submission(period) });
  }
}
