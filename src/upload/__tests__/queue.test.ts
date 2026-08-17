import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import {
  MAX_ATTEMPTS,
  discardIfSafe,
  enqueue,
  listQueue,
  nextPending,
  removeRecord,
  subscribe,
  updateRecord,
} from "../queue";

// The store lives on `globalThis` rather than in the factory's closure.
// `jest.resetModules()` (used by the "survives a reload" test below) re-runs
// this factory, which would otherwise wipe a closure-local store and make
// that test unable to observe persistence at all.
jest.mock("@react-native-async-storage/async-storage", () => {
  const g = globalThis as unknown as { __asyncStorageStore?: Record<string, string> };
  if (!g.__asyncStorageStore) g.__asyncStorageStore = {};
  return {
    getItem: jest.fn(async (k: string) => g.__asyncStorageStore![k] ?? null),
    setItem: jest.fn(async (k: string, v: string) => {
      g.__asyncStorageStore![k] = v;
    }),
    __reset: () => {
      g.__asyncStorageStore = {};
    },
  };
});
// expo-file-system's SDK 57 default export no longer ships the legacy
// `deleteAsync`/`documentDirectory` function API (calling `deleteAsync` from
// the bare "expo-file-system" import throws at runtime by design). The queue
// deletes local files through the current `File` class instead, so that is
// what gets mocked here. All mock state lives inside the factory itself so
// it isn't read before jest's mock hoisting initializes it.
jest.mock("expo-file-system", () => {
  const mockDeleteFile = jest.fn();
  const mockFileCtor = jest.fn().mockImplementation((uri: string) => ({
    uri,
    exists: true,
    delete: mockDeleteFile,
  }));
  return { File: mockFileCtor, __mockDeleteFile: mockDeleteFile };
});

const mockedFileCtor = FileSystem.File as unknown as jest.Mock;
const mockedFileDelete = (FileSystem as unknown as { __mockDeleteFile: jest.Mock }).__mockDeleteFile;

beforeEach(() => {
  (AsyncStorage as unknown as { __reset: () => void }).__reset();
  jest.clearAllMocks();
});

function input(overrides: Partial<{ localUri: string; contentType: string; period: string }> = {}) {
  return {
    localUri: "file:///docs/a.jpg",
    contentType: "image/jpeg",
    period: "2026-08",
    ...overrides,
  };
}

test("enqueued records start pending with no attempts", async () => {
  const record = await enqueue(input());
  expect(record.status).toBe("pending");
  expect(record.attempts).toBe(0);
  expect(record.receiptId).toBeUndefined();
});

test("the queue survives a reload from storage", async () => {
  await enqueue(input());
  jest.resetModules();
  const reloaded = await import("../queue");
  await expect(reloaded.listQueue()).resolves.toHaveLength(1);
});

test("records are processed oldest first", async () => {
  const first = await enqueue(input({ localUri: "file:///docs/1.jpg" }));
  await enqueue(input({ localUri: "file:///docs/2.jpg" }));
  await expect(nextPending()).resolves.toMatchObject({ id: first.id });
});

test("nextPending skips records already in flight", async () => {
  const record = await enqueue(input());
  await updateRecord(record.id, { status: "uploading" });
  await expect(nextPending()).resolves.toBeNull();
});

test("nextPending skips records that exhausted their attempts", async () => {
  const record = await enqueue(input());
  await updateRecord(record.id, { status: "failed", attempts: MAX_ATTEMPTS });
  await expect(nextPending()).resolves.toBeNull();
});

test("updateRecord patches without dropping other fields", async () => {
  const record = await enqueue(input());
  await updateRecord(record.id, { receiptId: "r1", uploadUrl: "https://r2/put" });
  const [stored] = await listQueue();
  expect(stored).toMatchObject({
    receiptId: "r1",
    uploadUrl: "https://r2/put",
    localUri: "file:///docs/a.jpg",
    period: "2026-08",
  });
});

test("an accountant upload keeps its clientId", async () => {
  await enqueue({ ...input(), clientId: "c1" });
  const [stored] = await listQueue();
  expect(stored.clientId).toBe("c1");
});

test("removeRecord deletes the local file", async () => {
  const record = await enqueue(input());
  await removeRecord(record.id);
  expect(mockedFileCtor).toHaveBeenCalledWith("file:///docs/a.jpg");
  expect(mockedFileDelete).toHaveBeenCalledTimes(1);
  await expect(listQueue()).resolves.toHaveLength(0);
});

// discardIfSafe is CaptureScreen's "Sil": offered at the instant of
// capture, when a drain triggered by that same capture is far more likely
// to have already grabbed the record than the queued-receipt cards'
// removeRecord ever is (those only ever call it once a record has settled
// into "failed"). It must not delete a record it can't prove is safe to
// delete — asserted here directly against the persisted queue and the
// file-system mock, not through any UI.
test("discardIfSafe removes a still-pending record, same as removeRecord", async () => {
  const record = await enqueue(input());
  await expect(discardIfSafe(record.id)).resolves.toBe("removed");
  expect(mockedFileDelete).toHaveBeenCalledTimes(1);
  await expect(listQueue()).resolves.toHaveLength(0);
});

test("discardIfSafe reports already-uploaded and leaves the queue alone when the record is gone", async () => {
  // Simulates the record having already been removed by a successful
  // upload (uploader.ts's own removeRecord) before "Sil" was pressed.
  await expect(discardIfSafe("never-enqueued")).resolves.toBe("already-uploaded");
  expect(mockedFileDelete).not.toHaveBeenCalled();
});

test("discardIfSafe refuses to delete a record that is mid-upload", async () => {
  const record = await enqueue(input());
  await updateRecord(record.id, { status: "uploading" });
  jest.clearAllMocks();

  await expect(discardIfSafe(record.id)).resolves.toBe("in-progress");
  expect(mockedFileDelete).not.toHaveBeenCalled();
  await expect(listQueue()).resolves.toHaveLength(1);
});

test("subscribers are notified on every mutation", async () => {
  const listener = jest.fn();
  const unsubscribe = subscribe(listener);
  const record = await enqueue(input());
  await updateRecord(record.id, { status: "uploading" });
  expect(listener).toHaveBeenCalledTimes(2);
  unsubscribe();
  await removeRecord(record.id);
  expect(listener).toHaveBeenCalledTimes(2);
});

test("a corrupt stored queue reads as empty rather than throwing", async () => {
  await AsyncStorage.setItem("fislik.upload_queue", "{not json");
  await expect(listQueue()).resolves.toEqual([]);
});

// Reproduces the CRITICAL race from the branch review: the 15s worker
// interval calling `updateRecord(A, {status:"uploading"})` while the
// capture screen calls `enqueue(B)` at the same moment. Both are
// unguarded read-modify-write cycles over the same AsyncStorage key with
// an await between the read and the write — if A's read is merely
// *delayed* in delivery (not started later), its eventual write can still
// land after B's, silently dropping B forever.
//
// This is made deterministic rather than timing-dependent: A's `getItem`
// call is intercepted to hang on a manually-released deferred, while B's
// enqueue is free to run (and, unserialized, fully completes) before A's
// read is finally released with the snapshot it would truly have seen —
// the state *before* B was written. Serialized, B's read-modify-write
// cannot even begin until A's finishes, so this exact interleaving is
// impossible and no write is lost.
test("a worker updateRecord racing a capture enqueue does not drop either write", async () => {
  await enqueue(input({ localUri: "file:///docs/a.jpg" }));
  const [a] = await listQueue();

  const staleSnapshot = await AsyncStorage.getItem("fislik.upload_queue");
  let releaseA: (value: string | null) => void = () => {};
  const deferredA = new Promise<string | null>((resolve) => {
    releaseA = resolve;
  });
  (AsyncStorage.getItem as jest.Mock).mockImplementationOnce(() => deferredA);

  const updatePromise = updateRecord(a.id, { status: "uploading" });
  const enqueuePromise = enqueue(input({ localUri: "file:///docs/b.jpg" }));

  // Let anything that can proceed without the delayed read do so. Unfixed,
  // that's enough for enqueue's own read-modify-write to finish in full
  // while updateRecord is still stuck on its delayed read — exactly the
  // interleaving from the bug report. Fixed, updateRecord's write hasn't
  // even started yet, so nothing else can have run either.
  await new Promise<void>((resolve) => setImmediate(resolve));

  releaseA(staleSnapshot);
  await Promise.all([updatePromise, enqueuePromise]);

  const records = await listQueue();
  expect(records).toHaveLength(2);
  expect(records.find((r) => r.id === a.id)?.status).toBe("uploading");
});
