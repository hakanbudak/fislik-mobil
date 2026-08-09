import * as ImageManipulator from "expo-image-manipulator";
import { captureToQueue } from "../capture";
import * as queue from "../queue";

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
