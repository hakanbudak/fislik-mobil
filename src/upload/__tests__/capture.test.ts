import * as DocumentPicker from "expo-document-picker";
import { Paths } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { captureToQueue, pickDocument, pickFromLibrary } from "../capture";
import * as queue from "../queue";
import * as worker from "../worker";

// Automocking "../queue" still loads the real module to introspect its
// shape, which pulls in the real AsyncStorage import — give it the
// library's own jest mock so that load doesn't hit a native module (see
// uploader.test.ts for the same pattern).
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("../queue");
jest.mock("../worker", () => ({ drainOnce: jest.fn() }));
jest.mock("expo-image-manipulator", () => ({
  manipulateAsync: jest.fn(async () => ({ uri: "file:///cache/compressed.jpg" })),
  SaveFormat: { JPEG: "jpeg" },
}));
jest.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock("expo-document-picker", () => ({
  getDocumentAsync: jest.fn(),
}));

// `expo-file-system` 57 removed the legacy `documentDirectory`/`copyAsync`
// function API — `capture.ts` persists through `Directory`/`File`/`Paths`
// instead, so that is what gets mocked here (see queue.test.ts/uploader.test.ts
// for the same adaptation). `mockCopy` stands in for the instance method
// `File#copy`; asserting on it keeps the original test's intent ("the raw
// compressed file is copied into a persistent location") even though the
// call shape changed from a free function to a method.
const mockCopy = jest.fn(async (_source: { uri: string }, _destination: { uri: string }) => undefined);
jest.mock("expo-file-system", () => {
  let dirExists = false;
  class MockDirectory {
    uri: string;
    constructor(...parts: Array<string | { uri: string }>) {
      this.uri = parts.map((p) => (typeof p === "string" ? p : p.uri)).join("/");
    }
    get exists() {
      return dirExists;
    }
    create() {
      dirExists = true;
    }
  }
  class MockFile {
    uri: string;
    constructor(...parts: Array<string | { uri: string }>) {
      this.uri = parts.map((p) => (typeof p === "string" ? p : p.uri)).join("/");
    }
    copy(destination: MockFile) {
      return mockCopy(this, destination);
    }
  }
  return {
    Directory: MockDirectory,
    File: MockFile,
    Paths: { document: { uri: "file:///docs/" } },
  };
});

const manipulator = ImageManipulator as jest.Mocked<typeof ImageManipulator>;
const mockedQueue = queue as jest.Mocked<typeof queue>;
const mockedWorker = worker as jest.Mocked<typeof worker>;
const mockedImagePicker = ImagePicker as jest.Mocked<typeof ImagePicker>;
const mockedDocumentPicker = DocumentPicker as jest.Mocked<typeof DocumentPicker>;

beforeEach(() => {
  jest.clearAllMocks();
});

test("compresses, persists and enqueues a capture", async () => {
  await captureToQueue("file:///cache/raw.jpg", "2026-08");
  expect(manipulator.manipulateAsync).toHaveBeenCalledWith(
    "file:///cache/raw.jpg",
    [{ resize: { width: 1600 } }],
    expect.objectContaining({ compress: 0.7 }),
  );
  expect(mockCopy).toHaveBeenCalled();
  expect(mockedQueue.enqueue).toHaveBeenCalledWith(
    expect.objectContaining({ contentType: "image/jpeg", period: "2026-08" }),
  );
});

test("stores the capture outside the cache so it survives eviction", async () => {
  await captureToQueue("file:///cache/raw.jpg", "2026-08");
  const [, destination] = mockCopy.mock.calls[0];
  expect(destination.uri).toContain("file:///docs/");
});

test("threads clientId for an accountant's on-behalf capture", async () => {
  await captureToQueue("file:///cache/raw.jpg", "2026-08", "c1");
  expect(mockedQueue.enqueue).toHaveBeenCalledWith(expect.objectContaining({ clientId: "c1" }));
});

// CaptureScreen's single-shot confirmation depends on this: `hold: true`
// must reach `enqueue` unchanged so the record is created "held" (see
// queue.test.ts) instead of "pending", which is what keeps it out of every
// drain until the confirmation resolves.
test("threads hold: true through to enqueue for a held capture", async () => {
  await captureToQueue("file:///cache/raw.jpg", "2026-08", undefined, undefined, true);
  expect(mockedQueue.enqueue).toHaveBeenCalledWith(expect.objectContaining({ hold: true }));
});

// Default behaviour (no fifth argument, and burst-mode shots which pass
// `hold: false`) must keep enqueuing and uploading exactly as before this
// fix — no confirmation, nothing held.
test("does not hold by default", async () => {
  await captureToQueue("file:///cache/raw.jpg", "2026-08");
  expect(mockedQueue.enqueue).toHaveBeenCalledWith(expect.not.objectContaining({ hold: true }));
});

test("still drains immediately regardless of hold, so other eligible records keep moving", async () => {
  const onUploaded = jest.fn();
  await captureToQueue("file:///cache/raw.jpg", "2026-08", undefined, onUploaded, true);
  expect(mockedWorker.drainOnce).toHaveBeenCalledWith(onUploaded);
});

// Branch review, IMPORTANT: capture.ts's own drainOnce() calls used to pass
// no handler. worker.ts's `draining` guard makes the first caller win, so
// when a capture's own drain performed the upload (not the worker
// interval's), invalidateAfterUpload never ran — the receipt reached the
// server but the screen kept showing stale data, since removeRecord means
// no later drain gets a second chance. This pins that the caller-supplied
// handler reaches drainOnce; CaptureScreen.invalidate.test.tsx proves the
// full chain (drain -> upload -> handler -> cache invalidation) end to end.
test("forwards the caller's onUploaded handler to drainOnce", async () => {
  const onUploaded = jest.fn();
  await captureToQueue("file:///cache/raw.jpg", "2026-08", undefined, onUploaded);
  expect(mockedWorker.drainOnce).toHaveBeenCalledWith(onUploaded);
});

describe("pickDocument", () => {
  function pickedPdf(uri = "file:///cache/receipt.pdf") {
    mockedDocumentPicker.getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri, name: "receipt.pdf", size: 1024, mimeType: "application/pdf" }],
      output: null,
    } as never);
  }

  test("enqueues with contentType application/pdf", async () => {
    pickedPdf();
    await pickDocument("2026-08");
    expect(mockedQueue.enqueue).toHaveBeenCalledWith(expect.objectContaining({ contentType: "application/pdf" }));
  });

  // pickDocument deliberately shows no confirmation — the OS document
  // picker already confirmed the pick — so it must never hold the record
  // back from a drain the way CaptureScreen's single-shot path does.
  test("never holds the record; uploads exactly as before this fix", async () => {
    pickedPdf();
    await pickDocument("2026-08");
    expect(mockedQueue.enqueue).toHaveBeenCalledWith(expect.not.objectContaining({ hold: true }));
  });

  // The whole point of this test: a PDF must never be routed through the
  // image manipulator. If a future refactor folds pickDocument into the
  // same compress-and-persist path captureToQueue uses, this is what
  // catches it — resizing/compressing a PDF as if it were a JPEG would
  // silently corrupt or replace the stored file.
  test("never calls the image manipulator", async () => {
    pickedPdf();
    await pickDocument("2026-08");
    expect(manipulator.manipulateAsync).not.toHaveBeenCalled();
  });

  test("copies into the persistent document directory, not the cache", async () => {
    pickedPdf();
    await pickDocument("2026-08");
    const [, destination] = mockCopy.mock.calls[0];
    expect(destination.uri.startsWith(Paths.document.uri)).toBe(true);
  });

  test("returns null and enqueues nothing when cancelled", async () => {
    mockedDocumentPicker.getDocumentAsync.mockResolvedValue({
      canceled: true,
      assets: null,
      output: null,
    } as never);
    const result = await pickDocument("2026-08");
    expect(result).toBeNull();
    expect(mockedQueue.enqueue).not.toHaveBeenCalled();
  });

  test("threads clientId through to enqueue", async () => {
    pickedPdf();
    await pickDocument("2026-08", "c1");
    expect(mockedQueue.enqueue).toHaveBeenCalledWith(expect.objectContaining({ clientId: "c1" }));
  });

  test("forwards the caller's onUploaded handler to drainOnce", async () => {
    pickedPdf();
    const onUploaded = jest.fn();
    await pickDocument("2026-08", undefined, onUploaded);
    expect(mockedWorker.drainOnce).toHaveBeenCalledWith(onUploaded);
  });
});

describe("pickFromLibrary", () => {
  function pickedPhotos(uris: string[]) {
    mockedImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: uris.map((uri) => ({ uri })),
    } as never);
  }

  test("enqueues one record per selected asset, each compressed", async () => {
    pickedPhotos(["file:///cache/a.jpg", "file:///cache/b.jpg"]);
    const records = await pickFromLibrary("2026-08");
    expect(records).toHaveLength(2);
    expect(manipulator.manipulateAsync).toHaveBeenCalledTimes(2);
    expect(mockedQueue.enqueue).toHaveBeenCalledTimes(2);
  });

  // pickFromLibrary deliberately shows no confirmation — the OS photo
  // picker already confirmed the selection — so it must never hold a
  // record back from a drain the way CaptureScreen's single-shot path does.
  test("never holds any record; uploads exactly as before this fix", async () => {
    pickedPhotos(["file:///cache/a.jpg", "file:///cache/b.jpg"]);
    await pickFromLibrary("2026-08");
    for (const call of mockedQueue.enqueue.mock.calls) {
      expect(call[0]).toEqual(expect.not.objectContaining({ hold: true }));
    }
  });

  test("enqueues nothing when cancelled", async () => {
    mockedImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: true,
      assets: null,
    } as never);
    const records = await pickFromLibrary("2026-08");
    expect(records).toEqual([]);
    expect(mockedQueue.enqueue).not.toHaveBeenCalled();
  });

  test("threads clientId through to every enqueue", async () => {
    pickedPhotos(["file:///cache/a.jpg", "file:///cache/b.jpg"]);
    await pickFromLibrary("2026-08", "c1");
    expect(mockedQueue.enqueue).toHaveBeenCalledTimes(2);
    for (const call of mockedQueue.enqueue.mock.calls) {
      expect(call[0]).toEqual(expect.objectContaining({ clientId: "c1" }));
    }
  });

  test("forwards the caller's onUploaded handler to every drainOnce", async () => {
    pickedPhotos(["file:///cache/a.jpg", "file:///cache/b.jpg"]);
    const onUploaded = jest.fn();
    await pickFromLibrary("2026-08", undefined, onUploaded);
    expect(mockedWorker.drainOnce).toHaveBeenCalledTimes(2);
    for (const call of mockedWorker.drainOnce.mock.calls) {
      expect(call[0]).toBe(onUploaded);
    }
  });
});
