import { act, render, screen } from "@testing-library/react-native";
import RootLayout from "../_layout";

/**
 * Integration coverage for the launch splash overlay (design "2a"):
 * `RootLayout` renders it over `<Slot />` once fonts are loaded, and it
 * unmounts itself once its one-shot sequence completes. The overlay's own
 * internal timing/reduced-motion behavior is covered in
 * `src/theme/components/__tests__/SplashOverlay.test.tsx`; this file only
 * pins the integration: it appears over the app, and it goes away.
 */
jest.mock("expo-router", () => ({
  Slot: () => null,
  SplashScreen: { preventAutoHideAsync: jest.fn(), hideAsync: jest.fn() },
}));
jest.mock("expo-font", () => ({ useFonts: () => [true] }));
jest.mock("@/src/upload/worker", () => ({ startWorker: () => () => undefined }));
jest.mock("@/src/auth/AuthProvider", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
// `SafeAreaProvider` only renders its children once it has received real
// insets from the native side, which never happens in this test
// environment — every other suite that needs its children visible passes
// `initialMetrics`, not available here since `RootLayout` takes no props.
// A passthrough stand-in keeps the assertions below about the splash
// overlay's presence/absence meaningful.
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

test("the splash overlay is present over the app on a cold start", () => {
  render(<RootLayout />);
  expect(screen.getByTestId("splash-overlay")).toBeOnTheScreen();
});

test("the splash overlay unmounts once its sequence finishes", async () => {
  render(<RootLayout />);
  expect(screen.getByTestId("splash-overlay")).toBeOnTheScreen();

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 2400));
  });

  expect(screen.queryByTestId("splash-overlay")).not.toBeOnTheScreen();
}, 10000);
