import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { forwardRef, useImperativeHandle } from "react";
import { CaptureScreen } from "../CaptureScreen";
import * as capture from "@/src/upload/capture";
import * as queue from "@/src/upload/queue";
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
  removeRecord: jest.fn(),
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
  fireEvent.press(screen.getByLabelText("Fotoğraf çek"));
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
  mockedQueue.removeRecord.mockResolvedValue(undefined);
  renderScreen();

  await pressShutter();
  fireEvent.press(screen.getByLabelText("Sil"));

  await waitFor(() => expect(mockedQueue.removeRecord).toHaveBeenCalledWith("shot-42"));
  await waitFor(() => expect(screen.getByLabelText("Fotoğraf çek")).toBeOnTheScreen());
});

test("Bir tane daha çek enters burst mode: live shutter, no confirmation on the next shot", async () => {
  mockedCapture.captureToQueue
    .mockResolvedValueOnce(record({ id: "shot-1" }))
    .mockResolvedValueOnce(record({ id: "shot-2" }));
  renderScreen();

  await pressShutter();
  fireEvent.press(screen.getByLabelText("Bir tane daha çek"));

  expect(screen.getByLabelText("Fotoğraf çek")).toBeOnTheScreen();

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
  );
});
