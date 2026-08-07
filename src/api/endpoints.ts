import { apiFetch } from "./client";
import type { components } from "./generated/schema";

export type UploadOut = components["schemas"]["UploadOut"];
export type ReceiptOut = components["schemas"]["ReceiptOut"];

/**
 * Step 1 of the upload handshake: reserves a receipt row and a presigned R2
 * PUT url. `client_id` is set only when an accountant uploads on a client's
 * behalf — matches `fislik-web/src/lib/upload.ts`'s `prepareUpload`.
 */
export function createUpload(data: {
  content_type: string;
  period?: string;
  client_id?: string;
}): Promise<UploadOut> {
  return apiFetch<UploadOut>("/receipts/uploads", { method: "POST", body: JSON.stringify(data) });
}

/**
 * Step 3 of the upload handshake: confirms the bytes landed in R2. The
 * returned receipt's `period` may differ from the one requested at
 * `createUpload` time — the API re-files uploads aimed at a locked month
 * into the next open one.
 */
export function completeUpload(receiptId: string, data: { size_bytes?: number }): Promise<ReceiptOut> {
  return apiFetch<ReceiptOut>(`/receipts/${receiptId}/complete`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
