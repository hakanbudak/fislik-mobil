import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { CaptureScreen } from "../CaptureScreen";
import * as capture from "@/src/upload/capture";
import { createTestQueryClient } from "@/src/test/queryClient";

// KameraScreen's own permission-branch tests already cover the
// unknown/denied states end to end (app/(client)/__tests__/kamera.test.tsx),
// exercised through the thin route wrapper around this component. This
// suite covers what's new for Task 24: threading `clientId`/`period`
// through to the capture helpers, and the on-behalf reminder banner. The
// capture-triggered-drain invalidation fix has its own dedicated,
// unmocked-capture integration test in CaptureScreen.invalidate.test.tsx.
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
// `CaptureScreen` now calls `useFocusEffect` (the per-visit-state reset —
// see CaptureScreen.tsx's docstring) which, for real, needs a navigation
// tree this isolated render doesn't have ("Couldn't find a navigation
// object"). Standing in for it with a plain mount-only effect is enough for
// this suite, which never exercises a re-focus — that's covered by
// CaptureScreen.confirm.test.tsx instead.
jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void) => require("react").useEffect(effect, []),
}));

const mockedCapture = capture as jest.Mocked<typeof capture>;

beforeEach(() => {
  jest.clearAllMocks();
});

// `CaptureScreen` now calls `useQueryClient()` to bind `invalidateAfterUpload`
// into the handler it threads through to the capture helpers (see
// CaptureScreen.invalidate.test.tsx) — every render needs a provider.
function renderScreen(props: Parameters<typeof CaptureScreen>[0]) {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <CaptureScreen {...props} />
    </QueryClientProvider>,
  );
}

test("passes clientId through to pickFromLibrary for an accountant's on-behalf capture", async () => {
  mockedCapture.pickFromLibrary.mockResolvedValue([]);
  renderScreen({ period: "2026-08", clientId: "c1", onClose: jest.fn() });

  fireEvent.press(screen.getByLabelText("Galeriden seç"));

  await waitFor(() =>
    expect(mockedCapture.pickFromLibrary).toHaveBeenCalledWith("2026-08", "c1", expect.any(Function)),
  );
});

test("passes clientId through to pickDocument for an accountant's on-behalf capture", async () => {
  mockedCapture.pickDocument.mockResolvedValue(null);
  renderScreen({ period: "2026-08", clientId: "c1", onClose: jest.fn() });

  fireEvent.press(screen.getByLabelText("PDF ekle"));

  await waitFor(() =>
    expect(mockedCapture.pickDocument).toHaveBeenCalledWith("2026-08", "c1", expect.any(Function)),
  );
});

test("omits clientId for the client's own capture", async () => {
  mockedCapture.pickFromLibrary.mockResolvedValue([]);
  renderScreen({ period: "2026-08", onClose: jest.fn() });

  fireEvent.press(screen.getByLabelText("Galeriden seç"));

  await waitFor(() =>
    expect(mockedCapture.pickFromLibrary).toHaveBeenCalledWith("2026-08", undefined, expect.any(Function)),
  );
});

test("shows a reminder banner naming the client and month when capturing on their behalf", () => {
  renderScreen({ period: "2026-08", clientId: "c1", clientLabel: "Yıldırım Ticaret", onClose: jest.fn() });
  expect(screen.getByText("Yıldırım Ticaret için — Ağustos 2026")).toBeOnTheScreen();
});

test("shows no reminder banner for the client's own capture", () => {
  renderScreen({ period: "2026-08", onClose: jest.fn() });
  expect(screen.queryByText(/için —/)).toBeNull();
});

test("calls onClose when the close button is pressed", () => {
  const onClose = jest.fn();
  renderScreen({ period: "2026-08", onClose });
  fireEvent.press(screen.getByLabelText("Kapat"));
  expect(onClose).toHaveBeenCalled();
});

test("calls onClose when Bitir is pressed", () => {
  const onClose = jest.fn();
  renderScreen({ period: "2026-08", onClose });
  fireEvent.press(screen.getByLabelText("Bitir"));
  expect(onClose).toHaveBeenCalled();
});

// The framing guide is purely visual: it must render, must not intercept
// touches, and — per the "receipts have a standard width but not a
// standard length" design — must not draw a closed box around a fixed
// area. See CaptureScreen.tsx's frameGuide comment for the reasoning.
test("renders a non-interactive framing guide that is not a closed box", () => {
  renderScreen({ period: "2026-08", onClose: jest.fn() });

  const guide = screen.getByTestId("frame-guide");
  expect(guide.props.pointerEvents).toBe("none");

  // Two open rails (left/right edges only), not four sides of a box: no
  // top/bottom border anywhere in the guide's own styling, and exactly
  // two child rails.
  const flattenStyles = (style: unknown): Record<string, unknown>[] =>
    (Array.isArray(style) ? style : [style]).filter(Boolean) as Record<string, unknown>[];

  const guideStyles = flattenStyles(guide.props.style);
  for (const s of guideStyles) {
    expect(s.borderTopWidth).toBeUndefined();
    expect(s.borderBottomWidth).toBeUndefined();
    expect(s.borderWidth).toBeUndefined();
  }

  expect(guide.children).toHaveLength(2);
});
