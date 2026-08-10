import * as Network from "expo-network";
import type { ReceiptOut } from "@/src/api/endpoints";
import { MAX_ATTEMPTS, listQueue, nextPending, updateRecord } from "./queue";
import { uploadRecord } from "./uploader";

/**
 * `clientId` mirrors the queue record that produced `receipt`: set only for
 * an accountant's on-behalf upload (Task 24), undefined for the caller's
 * own — callers use it to invalidate the right query keys (an accountant's
 * per-client cache vs. their own receipts).
 */
export type UploadedHandler = (receipt: ReceiptOut, requestedPeriod: string, clientId?: string) => void;

let draining = false;

/**
 * A record left in `"uploading"` means the app was killed or crashed mid-PUT
 * — `nextPending` never returns it again, so without this it would be lost
 * silently forever, which is exactly what the queue exists to prevent.
 * Resetting to `"pending"` is only safe here, at worker start, because
 * nothing of ours can be mid-upload yet; never call this once draining may
 * be in progress. `attempts` is left untouched — an interrupted app is not
 * a failed upload — and `receiptId`/`uploadUrl` are preserved (the patch
 * only touches `status`) so the retry resumes instead of minting a second
 * receipt.
 */
async function resetStrandedUploads(): Promise<void> {
  const stranded = (await listQueue()).filter((r) => r.status === "uploading");
  await Promise.all(stranded.map((r) => updateRecord(r.id, { status: "pending" })));
}

/** One full pass over the queue. Exported for tests and pull-to-refresh. */
export async function drainOnce(onUploaded?: UploadedHandler): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    for (;;) {
      const record = await nextPending();
      if (!record) return;
      await updateRecord(record.id, { status: "uploading" });
      try {
        const receipt = await uploadRecord(record);
        onUploaded?.(receipt, record.period, record.clientId);
      } catch (error) {
        const attempts = record.attempts + 1;
        await updateRecord(record.id, {
          status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
          attempts,
          error: error instanceof Error ? error.message : "Bilinmeyen hata",
        });
        if (attempts >= MAX_ATTEMPTS) continue;
        return; // back off; the interval or a connectivity change retries
      }
    }
  } finally {
    draining = false;
  }
}

/**
 * Runs the queue for the lifetime of the app. Before the first drain, resets
 * any record stranded in `"uploading"` by a previous kill or crash back to
 * `"pending"` (see `resetStrandedUploads`). Retries are otherwise time-based
 * rather than tight-looped so a persistent failure cannot burn the battery,
 * and a connectivity change triggers an immediate pass.
 */
export function startWorker(onUploaded?: UploadedHandler): () => void {
  let stopped = false;

  // Must run before the interval and the network listener are registered
  // below — resetStrandedUploads' own contract is that it is never safe to
  // call once draining may already be in progress, and registering either
  // of those first opens a window where a 15s tick or a connectivity change
  // could start a drain before the reset has run.
  void resetStrandedUploads().then(() => {
    if (!stopped) void drainOnce(onUploaded);
  });

  const interval = setInterval(() => {
    if (!stopped) void drainOnce(onUploaded);
  }, 15_000);

  const subscription = Network.addNetworkStateListener((state) => {
    if (!stopped && state.isConnected) void drainOnce(onUploaded);
  });

  return () => {
    stopped = true;
    clearInterval(interval);
    subscription.remove();
  };
}
