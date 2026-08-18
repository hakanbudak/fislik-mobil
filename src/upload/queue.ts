import AsyncStorage from "@react-native-async-storage/async-storage";
import { File } from "expo-file-system";

const KEY = "fislik.upload_queue";

export const MAX_ATTEMPTS = 5;

export type QueueStatus = "pending" | "held" | "uploading" | "failed";

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
  /**
   * When true, the record is created with status `"held"` instead of
   * `"pending"` — `nextPending` only ever matches `"pending"`, so a held
   * record is invisible to every drain path (the capture's own immediate
   * drain, the worker's 15s interval, a network-change drain) until
   * something explicitly calls `releaseHold`. This is what lets
   * `CaptureScreen` persist a shot to the queue the instant it's taken —
   * preserving the offline guarantee — while keeping it out of the upload
   * pipeline until the user resolves the "Bir tane daha çek" / "Sil" /
   * "Bitti" confirmation. Not stored on the record itself.
   */
  hold?: boolean;
}): Promise<QueueRecord> {
  return synchronized(async () => {
    const { hold, ...rest } = input;
    const record: QueueRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      ...rest,
      status: hold ? "held" : "pending",
      attempts: 0,
      createdAt: Date.now(),
    };
    await write([...(await read()), record]);
    return record;
  });
}

/**
 * Resolves a record enqueued with `hold: true`, making it eligible for
 * upload — the counterpart to `enqueue`'s `hold` option. Called when the
 * user resolves CaptureScreen's confirmation with "Bir tane daha çek" or
 * "Bitti"; "Sil" instead calls `discardIfSafe`, which never lets a held
 * record reach here.
 *
 * A no-op (not an error) when the record is no longer `"held"` — already
 * released by an earlier call, already discarded, or never existed — so a
 * duplicate resolve can never resurrect a record the user deleted or
 * clobber a status a drain has since moved on from. Runs inside the same
 * `synchronized` task as every other mutation, so there is no window for a
 * concurrent `discardIfSafe` to remove the record between reading its
 * status here and acting on it.
 */
export async function releaseHold(id: string): Promise<void> {
  return synchronized(async () => {
    const records = await read();
    await write(records.map((r) => (r.id === id && r.status === "held" ? { ...r, status: "pending" } : r)));
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
 * queued-receipt card encountered later. A single-shot capture is enqueued
 * with `hold: true` and stays `"held"` — invisible to every drain — until
 * "Bir tane daha çek"/"Bitti" calls `releaseHold`, so in normal use "Sil"
 * lands on a `"held"` record and this is a guaranteed cancellation. Burst
 * shots and gallery/PDF picks skip the confirmation screen entirely and are
 * never held, so this function still has to handle a `"pending"`,
 * `"uploading"`, or already-gone record too — and a genuinely raced
 * `"held"` record left over from before this fix, or reached through some
 * future caller that offers "Sil" without holding first. `removeRecord`
 * alone doesn't check status, so calling it blindly could silently no-op on
 * an already-uploaded record (nothing to delete, no error) or race a PUT
 * that finishes anyway, leaving a receipt on the server the user believes
 * they deleted.
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
 * - Anything else (`"held"`, `"pending"`, or `"failed"` — no successful
 *   upload happened): removed exactly like `removeRecord`.
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
