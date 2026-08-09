import { fireEvent, render, screen } from "@testing-library/react-native";
import { Linking } from "react-native";
import KameraScreen from "../kamera";

jest.mock("expo-router", () => ({ router: { back: jest.fn(), push: jest.fn() } }));
// KameraScreen imports src/upload/capture.ts, which pulls in the queue
// module and its real AsyncStorage import — give it the library's own jest
// mock so that load doesn't hit a native module (see uploader.test.ts).
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// The camera screen itself (a full-screen CameraView) is not meaningfully
// unit-testable — rendering it would only assert that a native view mounted,
// which proves nothing. The permission-denied branch is real, testable logic:
// it decides between an "İzin ver" retry and an "Ayarları aç" settings
// hand-off based on `canAskAgain`, and renders Turkish guidance either way.
const mockRequestPermission = jest.fn();
let mockPermission: { granted: boolean; canAskAgain: boolean } | null = null;
jest.mock("expo-camera", () => ({
  CameraView: () => null,
  useCameraPermissions: () => [mockPermission, mockRequestPermission],
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockPermission = null;
});

test("renders nothing while permission status is unknown", () => {
  mockPermission = null;
  const { toJSON } = render(<KameraScreen />);
  expect(toJSON()).toBeNull();
});

test("shows Turkish guidance and an offer to ask again when re-askable", () => {
  mockPermission = { granted: false, canAskAgain: true };
  render(<KameraScreen />);
  expect(screen.getByText("Fiş çekebilmek için kamera izni gerekiyor")).toBeOnTheScreen();
  fireEvent.press(screen.getByRole("button", { name: "İzin ver" }));
  expect(mockRequestPermission).toHaveBeenCalled();
});

test("shows a settings hand-off when the permission can no longer be asked for", () => {
  mockPermission = { granted: false, canAskAgain: false };
  const openSettings = jest.spyOn(Linking, "openSettings").mockResolvedValue();
  render(<KameraScreen />);
  expect(screen.getByText("Fiş çekebilmek için kamera izni gerekiyor")).toBeOnTheScreen();
  fireEvent.press(screen.getByRole("button", { name: "Ayarları aç" }));
  expect(openSettings).toHaveBeenCalled();
});
