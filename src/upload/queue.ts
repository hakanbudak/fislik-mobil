import AsyncStorage from "@react-native-async-storage/async-storage";
import { File } from "expo-file-system";

const KEY = "fislik.upload_queue";

export const MAX_ATTEMPTS = 5;

export type QueueStatus = "pending" | "uploading" | "failed";

export interface QueueRecord {
  id: string; // local uuid, not the server receipt id
  localUri: string; // file:// path in the app's document directory
  contentType: string; // "image/jpeg" | "application/pdf"
  period: string; // "YYYY-MM" the capture was filed under
  clientId?: string; // set only when an accountant uploads for a client (Task 24)
  status: QueueStatus;
  attempts: number;
  createdAt: number; // epoch ms, defines processing order
  receiptId?: string; // set once POST /receipts/uploads succeeds
  uploadUrl?: string; // presigned PUT url, set with receiptId
  error?: string; // last failure message, shown after MAX_ATTEMPTS
}

const listeners = new Set<() => void>();

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  for (const listener of listeners) listener();
}

async function read(): Promise<QueueRecord[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as QueueRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // A corrupt queue must not brick the app. Losing pending captures is bad;
    // never launching is worse.
    return [];
  }
}

async function write(records: QueueRecord[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(records));
  notify();
}

/**
 * `enqueue`, `updateRecord` and `removeRecord` are each a read-modify-write
 * cycle over the single `KEY` AsyncStorage entry, with an `await` between
 * the read and the write. There are two concurrent writers by design — the
 * worker's 15s interval (`worker.ts`) and the capture screen — so without
 * serialization, one's read can be based on a snapshot that is already
 * stale by the time it writes, silently reverting the other's write (see
 * `queue.test.ts`'s "racing" test for the exact interleaving this closes).
 *
 * A simple promise-chain mutex: every mutation is appended to `tail`, so
 * each one's read only starts once the previous one's write has finished.
 * Callers cannot know about each other, so this has to live here rather
 * than being pushed onto them.
 */
let tail: Promise<unknown> = Promise.resolve();

function synchronized<T>(task: () => Promise<T>): Promise<T> {
  const run = tail.then(task, task);
  // The chain must keep advancing even if a task rejects — otherwise one
  // failed mutation would wedge every mutation queued after it forever.
  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function listQueue(): Promise<QueueRecord[]> {
  return (await read()).sort((a, b) => a.createdAt - b.createdAt);
}

export async function enqueue(input: {
  localUri: string;
  contentType: string;
  period: string;
  clientId?: string;
}): Promise<QueueRecord> {
  return synchronized(async () => {
    const record: QueueRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      ...input,
      status: "pending",
      attempts: 0,
      createdAt: Date.now(),
    };
    await write([...(await read()), record]);
    return record;
  });
}

export async function updateRecord(id: string, patch: Partial<QueueRecord>): Promise<void> {
  return synchronized(async () => {
    const records = await read();
    await write(records.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  });
}

function deleteLocalFile(record: QueueRecord): void {
  try {
    const file = new File(record.localUri);
    if (file.exists) file.delete();
  } catch {
    // Missing or already-deleted files must not block queue cleanup.
  }
}

export async function removeRecord(id: string): Promise<void> {
  return synchronized(async () => {
    const records = await read();
    const record = records.find((r) => r.id === id);
    if (record) deleteLocalFile(record);
    await write(records.filter((r) => r.id !== id));
  });
}

export type DiscardOutcome = "removed" | "already-uploaded" | "in-progress";

/**
 * The status-aware counterpart to `removeRecord`, for a "Sil" offered at
 * the instant of capture (`CaptureScreen.tsx`) rather than on a
 * queued-receipt card encountered later. `captureToQueue` fires
 * `drainOnce` immediately on enqueue, so by the time this runs the record
 * may already be mid-upload or gone — `removeRecord` alone doesn't check,
 * so calling it here could silently no-op on an already-uploaded record
 * (nothing to delete, no error) or race a PUT that finishes anyway,
 * leaving a receipt on the server the user believes they deleted.
 *
 * The status check and the removal happen inside the same `synchronized`
 * task as every other queue mutation, so there is no window between
 * "read the status" and "act on it" for a drain to slip through — unlike
 * a caller doing its own `listQueue()` then `removeRecord()`, which would
 * race exactly that.
 *
 * - Record gone (drain already completed and removed it): `"already-uploaded"`.
 * - `status === "uploading"`: a PUT may already be in flight; there is no
 *   way to abort or unsend it from here, so this is left alone and
 *   reported as `"in-progress"` rather than claiming a cancellation that
 *   can't be delivered.
 * - Anything else (`"pending"`, or `"failed"` — no successful upload
 *   happened): removed exactly like `removeRecord`.
 */
export async function discardIfSafe(id: string): Promise<DiscardOutcome> {
  return synchronized(async () => {
    const records = await read();
    const record = records.find((r) => r.id === id);
    if (!record) return "already-uploaded";
    if (record.status === "uploading") return "in-progress";
    deleteLocalFile(record);
    await write(records.filter((r) => r.id !== id));
    return "removed";
  });
}

export async function nextPending(): Promise<QueueRecord | null> {
  const records = await listQueue();
  return records.find((r) => r.status === "pending" && r.attempts < MAX_ATTEMPTS) ?? null;
}
