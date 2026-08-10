import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useUploadQueue } from "../useUploadQueue";
import * as queue from "../queue";
import type { QueueRecord } from "../queue";

// Automocking "../queue" still loads the real module to introspect its
// shape, which pulls in the real AsyncStorage import — give it the
// library's own jest mock so that load doesn't hit a native module (same
// reasoning as worker.test.ts).
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("../queue");
jest.mock("../worker", () => ({ drainOnce: jest.fn() }));

const mockedQueue = queue as jest.Mocked<typeof queue>;

function record(overrides: Partial<QueueRecord> = {}): QueueRecord {
  return {
    id: "q1",
    localUri: "file:///docs/a.jpg",
    contentType: "image/jpeg",
    period: "2026-08",
    status: "pending",
    attempts: 0,
    createdAt: 1,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedQueue.subscribe.mockReturnValue(() => undefined);
});

test("exposes only the records for the selected period", async () => {
  mockedQueue.listQueue.mockResolvedValue([
    record({ id: "q1", period: "2026-08" }),
    record({ id: "q2", period: "2026-07" }),
  ]);
  const { result } = renderHook(() => useUploadQueue("2026-08"));
  await waitFor(() => expect(result.current.queued).toHaveLength(1));
  expect(result.current.queued[0].id).toBe("q1");
});

test("without a clientId, exposes only the caller's own captures (no clientId set)", async () => {
  mockedQueue.listQueue.mockResolvedValue([
    record({ id: "own", period: "2026-08" }),
    record({ id: "for-client", period: "2026-08", clientId: "c1" }),
  ]);
  const { result } = renderHook(() => useUploadQueue("2026-08"));
  await waitFor(() => expect(result.current.queued).toHaveLength(1));
  expect(result.current.queued[0].id).toBe("own");
});

test("with a clientId, exposes only that client's queued captures", async () => {
  mockedQueue.listQueue.mockResolvedValue([
    record({ id: "own", period: "2026-08" }),
    record({ id: "for-c1", period: "2026-08", clientId: "c1" }),
    record({ id: "for-c2", period: "2026-08", clientId: "c2" }),
  ]);
  const { result } = renderHook(() => useUploadQueue("2026-08", "c1"));
  await waitFor(() => expect(result.current.queued).toHaveLength(1));
  expect(result.current.queued[0].id).toBe("for-c1");
});

test("retry resets a failed record to pending", async () => {
  mockedQueue.listQueue.mockResolvedValue([record({ status: "failed", attempts: 5 })]);
  const { result } = renderHook(() => useUploadQueue("2026-08"));
  await waitFor(() => expect(result.current.queued).toHaveLength(1));
  await act(() => result.current.retry("q1"));
  expect(mockedQueue.updateRecord).toHaveBeenCalledWith("q1", {
    status: "pending",
    attempts: 0,
    error: undefined,
  });
});
