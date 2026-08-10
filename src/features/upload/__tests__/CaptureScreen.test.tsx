import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { CaptureScreen } from "../CaptureScreen";
import * as capture from "@/src/upload/capture";

// KameraScreen's own permission-branch tests already cover the
// unknown/denied states end to end (app/(client)/__tests__/kamera.test.tsx),
// exercised through the thin route wrapper around this component. This
// suite covers what's new for Task 24: threading `clientId`/`period`
// through to the capture helpers, and the on-behalf reminder banner.
// CaptureScreen imports src/upload/capture.ts, which pulls in the queue
// module and its real AsyncStorage import even though capture.ts itself is
// mocked below — give it the library's own jest mock so that load doesn't
// hit a native module (see uploader.test.ts for the same pattern).
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("@/src/upload/capture");
jest.mock("expo-camera", () => ({
  CameraView: () => null,
  useCameraPermissions: () => [{ granted: true, canAskAgain: true }, jest.fn()],
}));

const mockedCapture = capture as jest.Mocked<typeof capture>;

beforeEach(() => {
  jest.clearAllMocks();
});

test("passes clientId through to pickFromLibrary for an accountant's on-behalf capture", async () => {
  mockedCapture.pickFromLibrary.mockResolvedValue([]);
  render(<CaptureScreen period="2026-08" clientId="c1" onClose={jest.fn()} />);

  fireEvent.press(screen.getByLabelText("Galeriden seç"));

  await waitFor(() => expect(mockedCapture.pickFromLibrary).toHaveBeenCalledWith("2026-08", "c1"));
});

test("passes clientId through to pickDocument for an accountant's on-behalf capture", async () => {
  mockedCapture.pickDocument.mockResolvedValue(null);
  render(<CaptureScreen period="2026-08" clientId="c1" onClose={jest.fn()} />);

  fireEvent.press(screen.getByLabelText("PDF ekle"));

  await waitFor(() => expect(mockedCapture.pickDocument).toHaveBeenCalledWith("2026-08", "c1"));
});

test("omits clientId for the client's own capture", async () => {
  mockedCapture.pickFromLibrary.mockResolvedValue([]);
  render(<CaptureScreen period="2026-08" onClose={jest.fn()} />);

  fireEvent.press(screen.getByLabelText("Galeriden seç"));

  await waitFor(() => expect(mockedCapture.pickFromLibrary).toHaveBeenCalledWith("2026-08", undefined));
});

test("shows a reminder banner naming the client and month when capturing on their behalf", () => {
  render(<CaptureScreen period="2026-08" clientId="c1" clientLabel="Yıldırım Ticaret" onClose={jest.fn()} />);
  expect(screen.getByText("Yıldırım Ticaret için — Ağustos 2026")).toBeOnTheScreen();
});

test("shows no reminder banner for the client's own capture", () => {
  render(<CaptureScreen period="2026-08" onClose={jest.fn()} />);
  expect(screen.queryByText(/için —/)).toBeNull();
});

test("calls onClose when the close button is pressed", () => {
  const onClose = jest.fn();
  render(<CaptureScreen period="2026-08" onClose={onClose} />);
  fireEvent.press(screen.getByLabelText("Kapat"));
  expect(onClose).toHaveBeenCalled();
});

test("calls onClose when Bitir is pressed", () => {
  const onClose = jest.fn();
  render(<CaptureScreen period="2026-08" onClose={onClose} />);
  fireEvent.press(screen.getByLabelText("Bitir"));
  expect(onClose).toHaveBeenCalled();
});
