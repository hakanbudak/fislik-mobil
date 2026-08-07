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

export async function listQueue(): Promise<QueueRecord[]> {
  return (await read()).sort((a, b) => a.createdAt - b.createdAt);
}

export async function enqueue(input: {
  localUri: string;
  contentType: string;
  period: string;
  clientId?: string;
}): Promise<QueueRecord> {
  const record: QueueRecord = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    ...input,
    status: "pending",
    attempts: 0,
    createdAt: Date.now(),
  };
  await write([...(await read()), record]);
  return record;
}

export async function updateRecord(id: string, patch: Partial<QueueRecord>): Promise<void> {
  const records = await read();
  await write(records.map((r) => (r.id === id ? { ...r, ...patch } : r)));
}

export async function removeRecord(id: string): Promise<void> {
  const records = await read();
  const record = records.find((r) => r.id === id);
  if (record) {
    try {
      const file = new File(record.localUri);
      if (file.exists) file.delete();
    } catch {
      // Missing or already-deleted files must not block queue cleanup.
    }
  }
  await write(records.filter((r) => r.id !== id));
}

export async function nextPending(): Promise<QueueRecord | null> {
  const records = await listQueue();
  return records.find((r) => r.status === "pending" && r.attempts < MAX_ATTEMPTS) ?? null;
}
