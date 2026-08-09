import { useCallback, useEffect, useState } from "react";
import { listQueue, removeRecord, subscribe, updateRecord, type QueueRecord } from "./queue";
import { drainOnce } from "./worker";

/**
 * Live view of the local upload queue, scoped to one period. Subscribes to
 * `queue.ts`'s change notifications so a background worker drain (or a
 * retry/discard from this hook itself) reflects in the UI without polling.
 */
export function useUploadQueue(period: string) {
  const [queued, setQueued] = useState<QueueRecord[]>([]);

  const refresh = useCallback(async () => {
    const all = await listQueue();
    setQueued(all.filter((r) => r.period === period));
  }, [period]);

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
