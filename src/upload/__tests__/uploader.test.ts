import { File } from "expo-file-system";
import * as endpoints from "@/src/api/endpoints";
import { uploadRecord } from "../uploader";
import * as queue from "../queue";
import type { QueueRecord } from "../queue";

jest.mock("@/src/api/endpoints");
// Automocking "../queue" still loads the real module to introspect its
// shape, which pulls in the real AsyncStorage import — give it the
// library's own jest mock so that load doesn't hit a native module.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("../queue");

// `expo-file-system` 57 removed the legacy `uploadAsync` free function; the
// uploader does the presigned PUT through `File#upload`. `mock`-prefixed
// names are allowed inside the hoisted jest.mock factory below.
const mockUpload = jest.fn();
const mockFileState = { exists: true, size: 2048 };
jest.mock("expo-file-system", () => ({
  File: jest.fn().mockImplementation((uri: string) => ({
    uri,
    get exists() {
      return mockFileState.exists;
    },
    get size() {
      return mockFileState.size;
    },
    upload: mockUpload,
  })),
}));

const mockedEndpoints = endpoints as jest.Mocked<typeof endpoints>;
const mockedQueue = queue as jest.Mocked<typeof queue>;
const MockedFile = File as unknown as jest.Mock;

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
  mockFileState.exists = true;
  mockFileState.size = 2048;
  mockUpload.mockResolvedValue({ status: 200, body: "", headers: {} });
  mockedEndpoints.completeUpload.mockResolvedValue({ id: "r1", period: "2026-08" } as never);
});

test("runs create, put and complete in order and clears the record", async () => {
  mockedEndpoints.createUpload.mockResolvedValue({
    receipt_id: "r1",
    object_key: "k",
    upload_url: "https://r2/put",
  });
  await uploadRecord(record());
  expect(mockedEndpoints.createUpload).toHaveBeenCalledWith({
    content_type: "image/jpeg",
    period: "2026-08",
  });
  expect(MockedFile).toHaveBeenCalledWith("file:///docs/a.jpg");
  expect(mockUpload).toHaveBeenCalledWith(
    "https://r2/put",
    expect.objectContaining({ httpMethod: "PUT" }),
  );
  expect(mockedEndpoints.completeUpload).toHaveBeenCalledWith("r1", { size_bytes: 2048 });
  expect(mockedQueue.removeRecord).toHaveBeenCalledWith("q1");
});

test("passes client_id when an accountant uploads on a client's behalf", async () => {
  mockedEndpoints.createUpload.mockResolvedValue({
    receipt_id: "r1",
    object_key: "k",
    upload_url: "https://r2/put",
  });
  await uploadRecord(record({ clientId: "c1" }));
  expect(mockedEndpoints.createUpload).toHaveBeenCalledWith({
    content_type: "image/jpeg",
    period: "2026-08",
    client_id: "c1",
  });
});

test("resumes without re-creating a receipt that already exists", async () => {
  await uploadRecord(record({ receiptId: "r9", uploadUrl: "https://r2/put9" }));
  expect(mockedEndpoints.createUpload).not.toHaveBeenCalled();
  expect(mockUpload).toHaveBeenCalledWith("https://r2/put9", expect.anything());
});

test("persists the receipt id before uploading so a crash can resume", async () => {
  mockedEndpoints.createUpload.mockResolvedValue({
    receipt_id: "r1",
    object_key: "k",
    upload_url: "https://r2/put",
  });
  await uploadRecord(record());
  expect(mockedQueue.updateRecord).toHaveBeenCalledWith("q1", {
    receiptId: "r1",
    uploadUrl: "https://r2/put",
  });
});

test("returns the completed receipt, which may sit in a different period", async () => {
  // The API auto-files an upload aimed at a locked month into the next open
  // one, so the caller has to learn where it actually landed.
  mockedEndpoints.completeUpload.mockResolvedValue({ id: "r1", period: "2026-09" } as never);
  const receipt = await uploadRecord(record({ receiptId: "r1", uploadUrl: "https://r2/put" }));
  expect(receipt.period).toBe("2026-09");
});

test("sets the Content-Type header on the presigned PUT", async () => {
  await uploadRecord(record({ receiptId: "r1", uploadUrl: "https://r2/put", contentType: "application/pdf" }));
  expect(mockUpload).toHaveBeenCalledWith(
    "https://r2/put",
    expect.objectContaining({ headers: { "Content-Type": "application/pdf" } }),
  );
});

test("a failed PUT rejects and leaves the record in place", async () => {
  mockUpload.mockResolvedValue({ status: 500, body: "", headers: {} });
  await expect(uploadRecord(record({ receiptId: "r1", uploadUrl: "https://r2/put" }))).rejects.toThrow();
  expect(mockedQueue.removeRecord).not.toHaveBeenCalled();
  expect(mockedEndpoints.completeUpload).not.toHaveBeenCalled();
});

test("does not remove the record when the final confirmation fails", async () => {
  mockedEndpoints.completeUpload.mockRejectedValue(new Error("network down"));
  await expect(
    uploadRecord(record({ receiptId: "r1", uploadUrl: "https://r2/put" })),
  ).rejects.toThrow("network down");
  expect(mockedQueue.removeRecord).not.toHaveBeenCalled();
});

test("a 403 from the PUT clears receiptId and uploadUrl so the next attempt re-reserves", async () => {
  mockUpload.mockResolvedValue({ status: 403, body: "", headers: {} });
  await expect(
    uploadRecord(record({ receiptId: "r1", uploadUrl: "https://r2/put" })),
  ).rejects.toThrow();
  expect(mockedQueue.updateRecord).toHaveBeenCalledWith("q1", {
    receiptId: undefined,
    uploadUrl: undefined,
  });
});

test("a non-403 failure (500) leaves receiptId and uploadUrl intact", async () => {
  mockUpload.mockResolvedValue({ status: 500, body: "", headers: {} });
  await expect(
    uploadRecord(record({ receiptId: "r1", uploadUrl: "https://r2/put" })),
  ).rejects.toThrow();
  expect(mockedQueue.updateRecord).not.toHaveBeenCalled();
});
