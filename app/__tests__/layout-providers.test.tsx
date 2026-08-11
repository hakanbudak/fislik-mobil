import { render, screen } from "@testing-library/react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import RootLayout from "../_layout";

jest.mock("expo-router", () => ({
  Slot: () => null,
  SplashScreen: { preventAutoHideAsync: jest.fn(), hideAsync: jest.fn() },
}));
jest.mock("expo-font", () => ({ useFonts: () => [true] }));
jest.mock("@/src/upload/worker", () => ({ startWorker: () => () => undefined }));
jest.mock("@/src/auth/AuthProvider", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

test("wraps the app in the gesture and safe-area providers", () => {
  render(<RootLayout />);
  expect(screen.UNSAFE_getByType(GestureHandlerRootView)).toBeTruthy();
  expect(screen.UNSAFE_getByType(SafeAreaProvider)).toBeTruthy();
});

test("GestureHandlerRootView is the outermost provider and carries flex: 1, or gesture handling silently dies on Android and the tree can collapse to zero height", () => {
  render(<RootLayout />);
  const outer = screen.UNSAFE_getByType(GestureHandlerRootView);
  expect(outer.findByType(SafeAreaProvider)).toBeTruthy();

  const flattened = Object.assign({}, ...[outer.props.style].flat());
  expect(flattened.flex).toBe(1);
});
