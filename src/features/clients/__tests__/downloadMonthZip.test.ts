import * as Sharing from "expo-sharing";
import * as session from "@/src/auth/session";
import { downloadMonthZip, SharingUnavailableError } from "../downloadMonthZip";

// `File.downloadFileAsync` is the current (SDK 57) replacement for the
// removed legacy `downloadAsync` free function — see the module docstring.
// It rejects (rather than resolving with a status field) on a non-2xx
// response, with the status code folded into the error message.
const mockDownloadFileAsync = jest.fn();
jest.mock("expo-file-system", () => ({
  File: { downloadFileAsync: (...args: unknown[]) => mockDownloadFileAsync(...args) },
  Paths: { cache: "mock-cache-dir" },
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

jest.mock("@/src/auth/session", () => ({
  currentToken: jest.fn(),
}));

const mockedSharing = Sharing as jest.Mocked<typeof Sharing>;
const mockedSession = session as jest.Mocked<typeof session>;

beforeEach(() => {
  jest.clearAllMocks();
  mockedSession.currentToken.mockReturnValue("token-123");
  mockedSharing.isAvailableAsync.mockResolvedValue(true);
});

test("downloads with the bearer header and opens the share sheet", async () => {
  mockDownloadFileAsync.mockResolvedValue({ uri: "file:///cache/fislik-acme-2026-08.zip" });

  await downloadMonthZip("client-1", "2026-08");

  expect(mockDownloadFileAsync).toHaveBeenCalledWith(
    expect.stringContaining("/clients/client-1/receipts.zip?period=2026-08"),
    "mock-cache-dir",
    expect.objectContaining({ headers: { Authorization: "Bearer token-123" } }),
  );
  expect(mockedSharing.shareAsync).toHaveBeenCalledWith(
    "file:///cache/fislik-acme-2026-08.zip",
    expect.objectContaining({ mimeType: "application/zip" }),
  );
});

// `File.downloadFileAsync` has no structured status field to read on a
// non-2xx response (see the module docstring's investigation) — both
// native platforms fold the status into a free-text `UnableToDownload`
// message instead. These are the *actual* messages each platform throws
// (read from `ios/FileSystemDownload.swift` and
// `android/.../FileSystemDownloadTask.kt` in the installed package), not
// invented strings — this test would fail if the detection regex stopped
// matching real device wording, which is the exact silent-breakage risk
// this pins down.
test.each([
  ["iOS, File.downloadFileAsync", "response has status 404"],
  ["iOS, DownloadTask", "server returned HTTP 404"],
  ["Android, File.downloadFileAsync", "response has status: 404"],
  ["Android, DownloadTask", "HTTP 404"],
])("a 404 (%s: %j) becomes the empty-month ApiError and does not open the share sheet", async (_platform, message) => {
  mockDownloadFileAsync.mockRejectedValue(new Error(message));

  await expect(downloadMonthZip("client-1", "2026-08")).rejects.toMatchObject({
    status: 404,
    // Pinned verbatim: the coordinator flagged this exact string as a past
    // source of typos, so assert the literal Turkish copy, not just the
    // status code.
    detail: "Bu ay için indirilecek fiş yok",
  });
  expect(mockedSharing.shareAsync).not.toHaveBeenCalled();
});

test("a non-404 download failure surfaces a generic ApiError, not a crash", async () => {
  mockDownloadFileAsync.mockRejectedValue(new Error("UnableToDownload: server responded with status code 500"));

  await expect(downloadMonthZip("client-1", "2026-08")).rejects.toMatchObject({ status: 0 });
  expect(mockedSharing.shareAsync).not.toHaveBeenCalled();
});

test("an unavailable share sheet is reported and does not throw a generic error", async () => {
  mockDownloadFileAsync.mockResolvedValue({ uri: "file:///cache/x.zip" });
  mockedSharing.isAvailableAsync.mockResolvedValue(false);

  await expect(downloadMonthZip("client-1", "2026-08")).rejects.toBeInstanceOf(SharingUnavailableError);
  expect(mockedSharing.shareAsync).not.toHaveBeenCalled();
});
