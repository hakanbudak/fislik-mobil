import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as ImagePicker from "expo-image-picker";
import { CaptureScreen } from "../CaptureScreen";
import { queryKeys } from "@/src/api/queryKeys";
import * as uploader from "@/src/upload/uploader";
import { createTestQueryClient } from "@/src/test/queryClient";

/**
 * Covers the IMPORTANT branch-review fix: `capture.ts`'s own `void
 * drainOnce()` calls used to pass no handler, so when a capture's own
 * drain (not the worker interval's) won the `draining` race and performed
 * the upload, `invalidateAfterUpload` never ran — the receipt reached the
 * server but the screen kept showing stale data. Unlike
 * `CaptureScreen.test.tsx`, this file deliberately leaves `capture.ts` and
 * `worker.ts` UNMOCKED so the real enqueue -> drain -> upload -> handler
 * chain runs end to end; only the network-facing edges (the uploader and
 * the native modules under it) are mocked.
 */
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("@/src/upload/uploader");
jest.mock("expo-network", () => ({ addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })) }));
jest.mock("expo-camera", () => ({
  CameraView: () => null,
  useCameraPermissions: () => [{ granted: true, canAskAgain: true }, jest.fn()],
}));
jest.mock("expo-image-manipulator", () => ({
  manipulateAsync: jest.fn(async () => ({ uri: "file:///cache/compressed.jpg" })),
  SaveFormat: { JPEG: "jpeg" },
}));
jest.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: jest.fn(),
}));
// See CaptureScreen.test.tsx's identical mock for why this is needed: the
// real `useFocusEffect` requires a navigation tree this isolated render
// doesn't provide.
jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void) => require("react").useEffect(effect, []),
}));
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
    exists = true;
    size = 1024;
    constructor(...parts: Array<string | { uri: string }>) {
      this.uri = parts.map((p) => (typeof p === "string" ? p : p.uri)).join("/");
    }
    copy(_destination: MockFile) {
      return undefined;
    }
    delete() {
      return undefined;
    }
  }
  return {
    Directory: MockDirectory,
    File: MockFile,
    Paths: { document: { uri: "file:///docs/" } },
  };
});

const mockedUploader = uploader as jest.Mocked<typeof uploader>;
const mockedImagePicker = ImagePicker as jest.Mocked<typeof ImagePicker>;

beforeEach(() => {
  jest.clearAllMocks();
  mockedUploader.uploadRecord.mockResolvedValue({ id: "r1", period: "2026-08" } as never);
  mockedImagePicker.launchImageLibraryAsync.mockResolvedValue({
    canceled: false,
    assets: [{ uri: "file:///cache/a.jpg" }],
  } as never);
});

function renderScreen(client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <CaptureScreen period="2026-08" onClose={jest.fn()} />
    </QueryClientProvider>,
  );
}

test("a capture-triggered drain invalidates the uploaded period's caches", async () => {
  const client = createTestQueryClient();
  const invalidateSpy = jest.spyOn(client, "invalidateQueries");

  renderScreen(client);
  fireEvent.press(screen.getByLabelText("Galeriden seç"));

  await waitFor(() => expect(mockedUploader.uploadRecord).toHaveBeenCalled());
  await waitFor(() =>
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.receipts("2026-08") }),
  );
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.summary("2026-08") });
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.submission("2026-08") });
});
