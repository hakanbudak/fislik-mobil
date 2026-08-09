import { apiFetch } from "./client";
import type { components } from "./generated/schema";

export type UploadOut = components["schemas"]["UploadOut"];
export type ReceiptOut = components["schemas"]["ReceiptOut"];
export type SummaryOut = components["schemas"]["SummaryOut"];
export type PeriodLockOut = components["schemas"]["PeriodLockOut"];
export type SubmissionStateOut = components["schemas"]["SubmissionStateOut"];
export type ExtractionOut = components["schemas"]["ExtractionOut"];
export type ExtractionPatchIn = components["schemas"]["ExtractionPatchIn"];

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

export function listReceipts(period: string): Promise<ReceiptOut[]> {
  return apiFetch<ReceiptOut[]>(`/receipts?period=${encodeURIComponent(period)}`);
}

export function receiptsSummary(period: string, clientId?: string): Promise<SummaryOut> {
  const params = new URLSearchParams({ period });
  if (clientId) params.set("client_id", clientId);
  return apiFetch<SummaryOut>(`/receipts/summary?${params.toString()}`);
}

/**
 * The API does not block uploads into a locked month — it re-files them into
 * the next open one. Callers must reflect that (a notice, not a guard), see
 * `app/(client)/index.tsx`. This query itself must also fail soft: an API
 * that predates the endpoint 404s, and that must read as "not locked" rather
 * than break the screen — see the 404 handling in the home screen's query.
 */
export function periodLockStatus(period: string, clientId?: string): Promise<PeriodLockOut> {
  const params = new URLSearchParams({ period });
  if (clientId) params.set("client_id", clientId);
  return apiFetch<PeriodLockOut>(`/receipts/period-lock?${params.toString()}`);
}

/**
 * Submission-to-accountant endpoints, added ahead of Task 13's UI so the
 * home screen's test mocks (which reference `getSubmissionState`) resolve
 * against a real module. Task 13 builds the submit button and status row on
 * top of these; this task only wires the plumbing.
 */
export function getSubmissionState(period: string): Promise<SubmissionStateOut> {
  return apiFetch<SubmissionStateOut>(`/receipts/submission?period=${encodeURIComponent(period)}`);
}

export function submitReceipts(period: string): Promise<SubmissionStateOut> {
  return apiFetch<SubmissionStateOut>("/receipts/submit", {
    method: "POST",
    body: JSON.stringify({ period }),
  });
}

/**
 * Sends only the fields the caller changed — the API records an `edited`
 * flag on the receipt, so PATCHing untouched fields back would wrongly mark
 * an unedited receipt as hand-verified. `ExtractionEditor` owns the diffing.
 */
export function patchExtraction(receiptId: string, data: ExtractionPatchIn): Promise<ExtractionOut> {
  return apiFetch<ExtractionOut>(`/receipts/${receiptId}/extraction`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/** Re-queues a failed extraction; the API returns it in its `pending` state. */
export function retryExtraction(receiptId: string): Promise<ExtractionOut> {
  return apiFetch<ExtractionOut>(`/receipts/${receiptId}/extraction/retry`, { method: "POST" });
}
