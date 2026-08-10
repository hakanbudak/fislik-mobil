import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import AccountantKameraScreen from "../kamera";
import * as capture from "@/src/upload/capture";
import { createTestQueryClient } from "@/src/test/queryClient";

// This route renders CaptureScreen, which imports src/upload/capture.ts,
// which pulls in the queue module and its real AsyncStorage import even
// though capture.ts itself is mocked below — give it the library's own
// jest mock so that load doesn't hit a native module.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("@/src/upload/capture");
jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));
jest.mock("expo-camera", () => ({
  CameraView: () => null,
  useCameraPermissions: () => [{ granted: true, canAskAgain: true }, jest.fn()],
}));

const mockedCapture = capture as jest.Mocked<typeof capture>;
const { router, useLocalSearchParams } = jest.requireMock("expo-router") as {
  router: { back: jest.Mock };
  useLocalSearchParams: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
});

// CaptureScreen calls useQueryClient() to bind invalidateAfterUpload into
// the capture-triggered drain handler — every render needs a provider.
function renderScreen() {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <AccountantKameraScreen />
    </QueryClientProvider>,
  );
}

test("threads the route's clientId and viewed period through to a library pick", async () => {
  useLocalSearchParams.mockReturnValue({ clientId: "c1", period: "2026-03", full_name: "Yıldırım Ticaret" });
  mockedCapture.pickFromLibrary.mockResolvedValue([]);
  renderScreen();

  fireEvent.press(screen.getByLabelText("Galeriden seç"));

  await waitFor(() =>
    expect(mockedCapture.pickFromLibrary).toHaveBeenCalledWith("2026-03", "c1", expect.any(Function)),
  );
});

test("falls back to the current period when the route arrives with none", async () => {
  useLocalSearchParams.mockReturnValue({ clientId: "c1" });
  mockedCapture.pickDocument.mockResolvedValue(null);
  renderScreen();

  fireEvent.press(screen.getByLabelText("PDF ekle"));

  await waitFor(() => expect(mockedCapture.pickDocument).toHaveBeenCalled());
  const [period] = mockedCapture.pickDocument.mock.calls[0];
  expect(typeof period).toBe("string");
  expect(period).toMatch(/^\d{4}-\d{2}$/);
});

test("shows the client name in the on-behalf reminder banner", () => {
  useLocalSearchParams.mockReturnValue({ clientId: "c1", period: "2026-03", full_name: "Yıldırım Ticaret" });
  renderScreen();
  expect(screen.getByText(/Yıldırım Ticaret için/)).toBeOnTheScreen();
});

test("closing the screen navigates back", () => {
  useLocalSearchParams.mockReturnValue({ clientId: "c1", period: "2026-03", full_name: "Yıldırım Ticaret" });
  renderScreen();
  fireEvent.press(screen.getByLabelText("Kapat"));
  expect(router.back).toHaveBeenCalled();
});
