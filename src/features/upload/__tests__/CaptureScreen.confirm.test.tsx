import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { forwardRef, useImperativeHandle } from "react";
import { CaptureScreen } from "../CaptureScreen";
import * as capture from "@/src/upload/capture";
import * as queue from "@/src/upload/queue";
import * as worker from "@/src/upload/worker";
import { createTestQueryClient } from "@/src/test/queryClient";

/**
 * Covers the single-shot confirmation flow added on top of the burst
 * camera: a capture shows the photo full-screen with "Bir tane daha çek" /
 * "Sil" / "Bitti" instead of returning straight to a live shutter (see
 * CaptureScreen.tsx's docstring). CaptureScreen.test.tsx covers everything
 * that predates this (clientId threading for gallery/PDF, the on-behalf
 * banner, close/Bitir) and is left alone; this file is only what's new.
 *
 * Unlike CaptureScreen.test.tsx, this needs a real `cameraRef.current` to
 * exercise the shutter, so `CameraView` is mocked as a ref-forwarding
 * component exposing `takePictureAsync` rather than a bare `() => null`.
 */
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("@/src/upload/capture");
jest.mock("@/src/upload/queue", () => ({
  discardIfSafe: jest.fn(),
  releaseHold: jest.fn(),
}));
jest.mock("@/src/upload/worker", () => ({ drainOnce: jest.fn() }));
// The real `useFocusEffect` needs a navigation tree this isolated render
// doesn't provide ("Couldn't find a navigation object"). This stand-in runs
// the effect once on mount (as CaptureScreen.test.tsx's identical mock
// does) AND stashes the latest effect callback in `mockFocusEffect` so a
// test can invoke it a second time to simulate the screen regaining focus
// without a real navigator — see the "re-entering the camera" test below.
const mockFocusEffect = { current: (): void => undefined };
jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void) => {
    mockFocusEffect.current = effect;
    require("react").useEffect(effect, []);
  },
}));

const mockTakePictureAsync = jest.fn();
jest.mock("expo-camera", () => {
  const react = require("react");
  return {
    CameraView: react.forwardRef((_props: unknown, ref: unknown) => {
      react.useImperativeHandle(ref, () => ({ takePictureAsync: mockTakePictureAsync }));
      return null;
    }),
    useCameraPermissions: () => [{ granted: true, canAskAgain: true }, jest.fn()],
  };
});

const mockedCapture = capture as jest.Mocked<typeof capture>;
const mockedQueue = queue as jest.Mocked<typeof queue>;
const mockedWorker = worker as jest.Mocked<typeof worker>;

function record(overrides: Partial<queue.QueueRecord> = {}): queue.QueueRecord {
  return {
    id: "shot-1",
    localUri: "file:///docs/captures/shot-1.jpg",
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
  mockTakePictureAsync.mockResolvedValue({ uri: "file:///cache/raw.jpg" });
});

function renderScreen(props: Partial<Parameters<typeof CaptureScreen>[0]> = {}) {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <CaptureScreen period="2026-08" onClose={jest.fn()} {...props} />
    </QueryClientProvider>,
  );
}

async function pressShutter() {
  // `findByLabelText` retries: "Bir tane daha çek"/"Bitti" now release the
  // hold before returning to the live shutter, so the shutter button can
  // take a tick (an awaited `releaseHold`) to reappear after a previous
  // confirmation was resolved.
  const shutter = await screen.findByLabelText("Fotoğraf çek");
  fireEvent.press(shutter);
  await waitFor(() => expect(mockedCapture.captureToQueue).toHaveBeenCalled());
}

test("a single capture shows the full-screen confirmation instead of returning to a live shutter", async () => {
  mockedCapture.captureToQueue.mockResolvedValue(record());
  renderScreen();

  await pressShutter();

  expect(screen.getByLabelText("Bir tane daha çek")).toBeOnTheScreen();
  expect(screen.getByLabelText("Sil")).toBeOnTheScreen();
  expect(screen.getByLabelText("Bitti")).toBeOnTheScreen();
  expect(screen.queryByLabelText("Fotoğraf çek")).toBeNull();
});

test("Sil removes the record from the queue, not just the screen", async () => {
  mockedCapture.captureToQueue.mockResolvedValue(record({ id: "shot-42" }));
  mockedQueue.discardIfSafe.mockResolvedValue("removed");
  renderScreen();

  await pressShutter();
  fireEvent.press(screen.getByLabelText("Sil"));

  await waitFor(() => expect(mockedQueue.discardIfSafe).toHaveBeenCalledWith("shot-42"));
  await waitFor(() => expect(screen.getByLabelText("Fotoğraf çek")).toBeOnTheScreen());
});

test("Sil tells the user the receipt was already sent instead of silently doing nothing", async () => {
  mockedCapture.captureToQueue.mockResolvedValue(record({ id: "shot-1" }));
  mockedQueue.discardIfSafe.mockResolvedValue("already-uploaded");
  renderScreen();

  await pressShutter();
  fireEvent.press(screen.getByLabelText("Sil"));

  await waitFor(() => expect(mockedQueue.discardIfSafe).toHaveBeenCalledWith("shot-1"));
  expect(await screen.findByText("Bu fiş zaten gönderildi.")).toBeOnTheScreen();
  // The confirmation screen stays up — nothing was silently removed.
  expect(screen.getByLabelText("Bitti")).toBeOnTheScreen();
});

test("Sil does not claim a cancellation it can't deliver when the upload is already in flight", async () => {
  mockedCapture.captureToQueue.mockResolvedValue(record({ id: "shot-1" }));
  mockedQueue.discardIfSafe.mockResolvedValue("in-progress");
  renderScreen();

  await pressShutter();
  fireEvent.press(screen.getByLabelText("Sil"));

  await waitFor(() => expect(mockedQueue.discardIfSafe).toHaveBeenCalledWith("shot-1"));
  expect(
    await screen.findByText("Fiş şu anda yükleniyor, işlem bitmeden silinemez."),
  ).toBeOnTheScreen();
});

test("Sil tells the user when the discard call itself fails, instead of dead-ending silently", async () => {
  mockedCapture.captureToQueue.mockResolvedValue(record({ id: "shot-1" }));
  mockedQueue.discardIfSafe.mockRejectedValue(new Error("network down"));
  renderScreen();

  await pressShutter();
  fireEvent.press(screen.getByLabelText("Sil"));

  expect(await screen.findByText("Fiş silinemedi, tekrar deneyin.")).toBeOnTheScreen();
});

test("Bir tane daha çek enters burst mode: live shutter, no confirmation on the next shot", async () => {
  mockedCapture.captureToQueue
    .mockResolvedValueOnce(record({ id: "shot-1" }))
    .mockResolvedValueOnce(record({ id: "shot-2" }));
  renderScreen();

  await pressShutter();
  fireEvent.press(screen.getByLabelText("Bir tane daha çek"));

  expect(await screen.findByLabelText("Fotoğraf çek")).toBeOnTheScreen();

  await pressShutter();

  expect(screen.queryByLabelText("Bitti")).toBeNull();
  expect(screen.getByLabelText("Fotoğraf çek")).toBeOnTheScreen();
});

test("an accountant's clientId still reaches the queued record via captureToQueue", async () => {
  mockedCapture.captureToQueue.mockResolvedValue(record({ id: "shot-1", clientId: "c1" }));
  renderScreen({ clientId: "c1" });

  await pressShutter();

  expect(mockedCapture.captureToQueue).toHaveBeenCalledWith(
    "file:///cache/raw.jpg",
    "2026-08",
    "c1",
    expect.any(Function),
    true,
  );
});

// The design this whole file covers: the shot must not become eligible for
// upload until the user decides. Asserted here at the boundary CaptureScreen
// controls — that a single (non-burst) shot is captured with `hold: true` —
// with `src/upload/__tests__/queue.test.ts` and `capture.test.ts` covering
// what that argument actually does inside the queue.
test("a single shot is captured with hold: true so it is not eligible for upload until confirmed", async () => {
  mockedCapture.captureToQueue.mockResolvedValue(record());
  renderScreen();

  await pressShutter();

  expect(mockedCapture.captureToQueue).toHaveBeenCalledWith(
    "file:///cache/raw.jpg",
    "2026-08",
    undefined,
    expect.any(Function),
    true,
  );
});

test("a burst shot is captured with hold: false, uploading immediately like before", async () => {
  mockedCapture.captureToQueue
    .mockResolvedValueOnce(record({ id: "shot-1" }))
    .mockResolvedValueOnce(record({ id: "shot-2" }));
  renderScreen();

  await pressShutter();
  fireEvent.press(screen.getByLabelText("Bir tane daha çek"));
  await pressShutter();

  expect(mockedCapture.captureToQueue).toHaveBeenLastCalledWith(
    "file:///cache/raw.jpg",
    "2026-08",
    undefined,
    expect.any(Function),
    false,
  );
});

test("Bitti releases the hold and drains before closing", async () => {
  const onClose = jest.fn();
  mockedCapture.captureToQueue.mockResolvedValue(record({ id: "shot-1" }));
  mockedQueue.releaseHold.mockResolvedValue(undefined);
  renderScreen({ onClose });

  await pressShutter();
  fireEvent.press(screen.getByLabelText("Bitti"));

  await waitFor(() => expect(mockedQueue.releaseHold).toHaveBeenCalledWith("shot-1"));
  expect(mockedWorker.drainOnce).toHaveBeenCalled();
  expect(onClose).toHaveBeenCalled();
});

test("Bir tane daha çek releases the hold and drains before returning to a live shutter", async () => {
  mockedCapture.captureToQueue.mockResolvedValue(record({ id: "shot-1" }));
  mockedQueue.releaseHold.mockResolvedValue(undefined);
  renderScreen();

  await pressShutter();
  fireEvent.press(screen.getByLabelText("Bir tane daha çek"));

  await waitFor(() => expect(mockedQueue.releaseHold).toHaveBeenCalledWith("shot-1"));
  expect(mockedWorker.drainOnce).toHaveBeenCalled();
});

test("the confirmation screen's own close button also releases the hold before closing", async () => {
  const onClose = jest.fn();
  mockedCapture.captureToQueue.mockResolvedValue(record({ id: "shot-1" }));
  mockedQueue.releaseHold.mockResolvedValue(undefined);
  renderScreen({ onClose });

  await pressShutter();
  fireEvent.press(screen.getByLabelText("Kapat"));

  await waitFor(() => expect(mockedQueue.releaseHold).toHaveBeenCalledWith("shot-1"));
  expect(onClose).toHaveBeenCalled();
});

test("Sil does not release the hold", async () => {
  mockedCapture.captureToQueue.mockResolvedValue(record({ id: "shot-1" }));
  mockedQueue.discardIfSafe.mockResolvedValue("removed");
  renderScreen();

  await pressShutter();
  fireEvent.press(screen.getByLabelText("Sil"));

  await waitFor(() => expect(mockedQueue.discardIfSafe).toHaveBeenCalledWith("shot-1"));
  expect(mockedQueue.releaseHold).not.toHaveBeenCalled();
});

// `kamera` is a flat `Tabs.Screen` (`app/(client)/_layout.tsx`), so
// CaptureScreen never unmounts between visits — leaving the confirmation
// screen up (e.g. by switching tabs instead of tapping "Sil"/"Bir tane daha
// çek"/"Bitti") and coming back used to show the OLD shot's confirmation
// instead of a live shutter. `mockFocusEffect.current()` simulates exactly
// that: the screen regaining focus, without a real navigator.
test("re-entering the camera after an unresolved capture shows a live shutter, with the held record resolved rather than orphaned", async () => {
  mockedCapture.captureToQueue.mockResolvedValue(record({ id: "shot-1" }));
  mockedQueue.releaseHold.mockResolvedValue(undefined);
  renderScreen();

  await pressShutter();
  expect(screen.getByLabelText("Bitti")).toBeOnTheScreen();

  await act(async () => {
    mockFocusEffect.current();
  });

  // Live shutter, not the previous shot's confirmation.
  expect(await screen.findByLabelText("Fotoğraf çek")).toBeOnTheScreen();
  expect(screen.queryByLabelText("Bitti")).toBeNull();

  // Asserted against the queue, not just the UI: the held record is
  // resolved exactly like "Bitti" would have — released, then drained —
  // never silently discarded. A held record is invisible to every drain
  // until `releaseHold` runs (queue.ts's `enqueue`), so skipping this would
  // strand the receipt unuploaded forever.
  expect(mockedQueue.releaseHold).toHaveBeenCalledWith("shot-1");
  expect(mockedWorker.drainOnce).toHaveBeenCalled();
});

// C1 (review fix): the reset above used to clear `busy` unconditionally,
// which is also the only thing stopping a second `handleShutter` while the
// first capture is still compressing/enqueuing. A refocus landing mid-shot
// would re-enable the shutter, letting a second concurrent capture start —
// whichever one's `setPendingShot` landed last silently stranded the
// other's record `"held"` in the queue, with no UI referring to it. Fixed
// by skipping the whole reset while `busy` is true. `captureToQueue` is
// held open with a deferred promise here to put the screen genuinely
// mid-capture (not just "about to be") when the simulated refocus lands.
test("a refocus mid-capture does not clear busy, so it cannot let a second capture start and orphan the first's held record", async () => {
  let resolveCapture!: (value: queue.QueueRecord) => void;
  mockedCapture.captureToQueue.mockReturnValue(
    new Promise<queue.QueueRecord>((resolve) => {
      resolveCapture = resolve;
    }) as never,
  );
  renderScreen();

  const shutter = await screen.findByLabelText("Fotoğraf çek");
  fireEvent.press(shutter);
  await waitFor(() => expect(mockedCapture.captureToQueue).toHaveBeenCalledTimes(1));

  // Still mid-capture: simulate the screen regaining focus (e.g. a quick
  // tab switch and back) before the first shot has resolved.
  await act(async () => {
    mockFocusEffect.current();
  });

  // The reset must not have run: nothing to release yet (pendingShot was
  // null when the effect fired), so no stray `releaseHold`/`drainOnce`.
  expect(mockedQueue.releaseHold).not.toHaveBeenCalled();
  expect(mockedWorker.drainOnce).not.toHaveBeenCalled();

  // A second shutter press, while the first capture is still in flight,
  // must not start a second one — `busy` must still be true.
  fireEvent.press(screen.getByLabelText("Fotoğraf çek"));
  expect(mockedCapture.captureToQueue).toHaveBeenCalledTimes(1);

  // Let the first (only) capture resolve.
  await act(async () => {
    resolveCapture(record({ id: "shot-1" }));
  });

  // Exactly one capture ever happened, and its record reached the
  // confirmation screen — not stranded `"held"` with nothing showing it.
  expect(mockedCapture.captureToQueue).toHaveBeenCalledTimes(1);
  expect(await screen.findByLabelText("Bitti")).toBeOnTheScreen();
  expect(mockedQueue.releaseHold).not.toHaveBeenCalled();
});

// I1 (review fix): the same unconditional reset could also land mid-`Sil`
// (`handleDiscard`), clearing `pendingShot` out from under it — `Sil`'s
// own outcome-branches (already-uploaded / in-progress / failed) set
// `discardNotice` on what they assume is still the current confirmation,
// so cutting away to the live camera mid-call would leave that notice set
// on a branch nothing renders again. Same fix, same guard: verify it holds
// for this path too.
test("a refocus mid-Sil does not cut away before the outcome notice can render", async () => {
  mockedCapture.captureToQueue.mockResolvedValue(record({ id: "shot-1" }));
  let resolveDiscard!: (value: queue.DiscardOutcome) => void;
  mockedQueue.discardIfSafe.mockReturnValue(
    new Promise<queue.DiscardOutcome>((resolve) => {
      resolveDiscard = resolve;
    }),
  );
  renderScreen();

  await pressShutter();
  fireEvent.press(screen.getByLabelText("Sil"));
  await waitFor(() => expect(mockedQueue.discardIfSafe).toHaveBeenCalledWith("shot-1"));

  // Still mid-discard: simulate a refocus before the call resolves.
  await act(async () => {
    mockFocusEffect.current();
  });

  // Not reset away — the confirmation (and its "Sil" outcome, once it
  // lands) is still the live screen.
  expect(screen.getByLabelText("Bitti")).toBeOnTheScreen();
  expect(mockedQueue.releaseHold).not.toHaveBeenCalled();

  await act(async () => {
    resolveDiscard("already-uploaded");
  });

  // The outcome notice actually renders — proof the reset didn't cut away
  // from underneath `handleDiscard` before it could show it.
  expect(await screen.findByText("Bu fiş zaten gönderildi.")).toBeOnTheScreen();
});
