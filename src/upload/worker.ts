import * as Network from "expo-network";
import type { ReceiptOut } from "@/src/api/endpoints";
import { MAX_ATTEMPTS, nextPending, updateRecord } from "./queue";
import { uploadRecord } from "./uploader";

export type UploadedHandler = (receipt: ReceiptOut, requestedPeriod: string) => void;

let draining = false;

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
        onUploaded?.(receipt, record.period);
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
 * Runs the queue for the lifetime of the app. Retries are time-based rather
 * than tight-looped so a persistent failure cannot burn the battery, and a
 * connectivity change triggers an immediate pass.
 */
export function startWorker(onUploaded?: UploadedHandler): () => void {
  let stopped = false;
  const interval = setInterval(() => {
    if (!stopped) void drainOnce(onUploaded);
  }, 15_000);

  const subscription = Network.addNetworkStateListener((state) => {
    if (!stopped && state.isConnected) void drainOnce(onUploaded);
  });

  void drainOnce(onUploaded);

  return () => {
    stopped = true;
    clearInterval(interval);
    subscription.remove();
  };
}
