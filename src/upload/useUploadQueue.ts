import { useCallback, useEffect, useState } from "react";
import { listQueue, removeRecord, subscribe, updateRecord, type QueueRecord } from "./queue";
import { drainOnce } from "./worker";

/**
 * Live view of the local upload queue, scoped to one period. Subscribes to
 * `queue.ts`'s change notifications so a background worker drain (or a
 * retry/discard from this hook itself) reflects in the UI without polling.
 *
 * `clientId` scopes which slice of the (single, device-local) queue a
 * caller sees: omitted, it's the caller's own captures (`clientId`
 * undefined on the record — the client's own home screen); passed, it's
 * one client's on-behalf captures (the accountant's per-client month
 * screen, Task 24). The exact-match filter is what keeps an accountant's
 * upload for one client from ever bleeding into another client's view, or
 * into a plain "my own uploads" view.
 */
export function useUploadQueue(period: string, clientId?: string) {
  const [queued, setQueued] = useState<QueueRecord[]>([]);

  const refresh = useCallback(async () => {
    const all = await listQueue();
    setQueued(all.filter((r) => r.period === period && r.clientId === clientId));
  }, [period, clientId]);

  useEffect(() => {
    void refresh();
    return subscribe(() => void refresh());
  }, [refresh]);

  const retry = useCallback(async (id: string) => {
    await updateRecord(id, { status: "pending", attempts: 0, error: undefined });
    void drainOnce();
  }, []);

  return { queued, retry, discard: removeRecord };
}
