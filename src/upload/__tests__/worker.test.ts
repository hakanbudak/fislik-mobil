import { drainOnce, startWorker } from "../worker";
import * as queue from "../queue";
import * as uploader from "../uploader";
import type { QueueRecord } from "../queue";

// Automocking "../queue" still loads the real module to introspect its
// shape, which pulls in the real AsyncStorage import — give it the
// library's own jest mock so that load doesn't hit a native module.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("../queue");
jest.mock("../uploader");
jest.mock("expo-network", () => ({ addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })) }));

const mockedQueue = queue as jest.Mocked<typeof queue>;
const mockedUploader = uploader as jest.Mocked<typeof uploader>;

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

/** Flushes the microtask queue so chained promises (reset -> drain) settle. */
function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedUploader.uploadRecord.mockResolvedValue({ id: "r1", period: "2026-08" } as never);
  mockedQueue.listQueue.mockResolvedValue([]);
});

test("marks a record uploading before handing it to the uploader", async () => {
  mockedQueue.nextPending.mockResolvedValueOnce(record()).mockResolvedValue(null);
  await drainOnce();
  expect(mockedQueue.updateRecord).toHaveBeenCalledWith("q1", { status: "uploading" });
  expect(mockedUploader.uploadRecord).toHaveBeenCalled();
});

test("reports the requested and actual periods to its callback", async () => {
  mockedQueue.nextPending.mockResolvedValueOnce(record({ period: "2026-08" })).mockResolvedValue(null);
  mockedUploader.uploadRecord.mockResolvedValue({ id: "r1", period: "2026-09" } as never);
  const onUploaded = jest.fn();
  await drainOnce(onUploaded);
  expect(onUploaded).toHaveBeenCalledWith(expect.objectContaining({ period: "2026-09" }), "2026-08");
});

test("returns a failed record to pending with an incremented attempt count", async () => {
  mockedQueue.nextPending.mockResolvedValueOnce(record()).mockResolvedValue(null);
  mockedUploader.uploadRecord.mockRejectedValue(new Error("boom"));
  await drainOnce();
  expect(mockedQueue.updateRecord).toHaveBeenCalledWith("q1", {
    status: "pending",
    attempts: 1,
    error: "boom",
  });
});

test("gives up after the maximum number of attempts", async () => {
  mockedQueue.nextPending
    .mockResolvedValueOnce(record({ attempts: queue.MAX_ATTEMPTS - 1 }))
    .mockResolvedValue(null);
  mockedUploader.uploadRecord.mockRejectedValue(new Error("boom"));
  await drainOnce();
  expect(mockedQueue.updateRecord).toHaveBeenCalledWith("q1", {
    status: "failed",
    attempts: queue.MAX_ATTEMPTS,
    error: "boom",
  });
});

test("drains every pending record in one pass", async () => {
  mockedQueue.nextPending
    .mockResolvedValueOnce(record({ id: "q1" }))
    .mockResolvedValueOnce(record({ id: "q2" }))
    .mockResolvedValue(null);
  await drainOnce();
  expect(mockedUploader.uploadRecord).toHaveBeenCalledTimes(2);
});

test("concurrent drains do not double-process a record", async () => {
  mockedQueue.nextPending.mockResolvedValueOnce(record()).mockResolvedValue(null);
  await Promise.all([drainOnce(), drainOnce()]);
  expect(mockedUploader.uploadRecord).toHaveBeenCalledTimes(1);
});

test("startWorker resets a stranded uploading record to pending without touching attempts, receiptId or uploadUrl", async () => {
  mockedQueue.listQueue.mockResolvedValue([
    record({ id: "q1", status: "uploading", attempts: 2, receiptId: "r1", uploadUrl: "https://r2/put" }),
  ]);
  mockedQueue.nextPending.mockResolvedValue(null);
  const stop = startWorker();
  await flush();
  await flush();
  expect(mockedQueue.updateRecord).toHaveBeenCalledWith("q1", { status: "pending" });
  stop();
});

test("drainOnce alone (no startWorker) never resets stranded uploads", async () => {
  mockedQueue.nextPending.mockResolvedValueOnce(record()).mockResolvedValue(null);
  await drainOnce();
  expect(mockedQueue.listQueue).not.toHaveBeenCalled();
});
