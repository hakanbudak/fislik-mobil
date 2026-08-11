import { act, render, screen } from "@testing-library/react-native";
import RootLayout, { __resetSplashPlayedForTests } from "../_layout";

/**
 * Integration coverage for the launch splash overlay (design "2a"):
 * `RootLayout` renders it over `<Slot />` once fonts are loaded, and it
 * unmounts itself once its one-shot sequence completes. The overlay's own
 * internal timing/reduced-motion behavior is covered in
 * `src/theme/components/__tests__/SplashOverlay.test.tsx`; this file only
 * pins the integration: it appears over the app, it goes away once its
 * sequence finishes, and a font-load failure doesn't leave the app stuck.
 *
 * `_layout.tsx` tracks "has the splash already played this cold start" in
 * a *module-scoped* variable, not React state — correct in the real app
 * (the module only evaluates once per real cold start) but it would mean
 * every test after the first in this file "inherits" whatever the previous
 * test left behind, making assertions depend on declaration order.
 * `__resetSplashPlayedForTests` resets it before each test so that isn't
 * true here.
 */
jest.mock("expo-router", () => {
  const { Text } = require("react-native");
  return {
    // Identifiable stand-in (not `null`) so tests can tell "the app
    // rendered" apart from "RootLayout returned null" — otherwise C2's
    // regression (font error leaves `return null` forever) would be
    // indistinguishable from a correctly-skipped splash: both produce a
    // tree with no splash-overlay testID.
    Slot: () => <Text testID="app-content">app</Text>,
    SplashScreen: { preventAutoHideAsync: jest.fn(), hideAsync: jest.fn() },
  };
});
jest.mock("expo-font", () => ({ useFonts: jest.fn(() => [true, undefined]) }));
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

beforeEach(() => {
  __resetSplashPlayedForTests();
});

test("the splash overlay is present over the app on mount, and unmounts once its sequence finishes", async () => {
  render(<RootLayout />);
  expect(screen.getByTestId("splash-overlay")).toBeOnTheScreen();

  // The full sequence now totals ~2.05s (see SplashOverlay's
  // FULL_SEQUENCE_TOTAL_MS) with a 2.5s safety ceiling behind it; 2.3s real
  // time clears the sequence with margin to spare without waiting all the
  // way out to the safety timeout.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 2300));
  });

  expect(screen.queryByTestId("splash-overlay")).not.toBeOnTheScreen();
}, 10000);

test("a remount before the splash finishes does not replay it (the ErrorBoundary retry case)", () => {
  // Simulates what happens when something throws inside the splash and
  // expo-router's `Try` catches it: `retry` remounts `RootLayout` from
  // scratch. The splash never called its own `onDone` (it crashed instead),
  // so if "played" were only set on completion, this remount would show it
  // again — and if the crash is deterministic, forever. The flag is set at
  // the moment `RootLayout` decides whether to show the splash (mount),
  // not when the splash finishes, specifically so a remount like this one
  // resumes at "app, no splash" instead of replaying it.
  const { unmount } = render(<RootLayout />);
  expect(screen.getByTestId("splash-overlay")).toBeOnTheScreen();
  unmount();

  render(<RootLayout />);
  expect(screen.queryByTestId("splash-overlay")).not.toBeOnTheScreen();
});

test("a font-load failure still lets the app appear, without the splash", () => {
  const useFonts = jest.requireMock("expo-font").useFonts as jest.Mock;
  useFonts.mockReturnValueOnce([false, new Error("font load failed")]);

  render(<RootLayout />);

  // `loaded` is false but `fontError` is set — the app must still render
  // (system-font fallback) rather than staying on `return null` forever.
  // Asserting `app-content` is present (not just that the splash is
  // absent) is what makes this catch the C2 regression specifically:
  // discarding `fontError` also leaves no splash-overlay testID on
  // screen, but for the wrong reason (`RootLayout` returned `null`
  // entirely) — without this, the test would pass either way.
  expect(screen.getByTestId("app-content")).toBeOnTheScreen();
  // The splash itself is skipped for a font-error launch: it needs
  // `font.extraBold` to render its wordmark faithfully, and there is
  // nothing to seamlessly hand off to in the first place if fonts never
  // resolved.
  expect(screen.queryByTestId("splash-overlay")).not.toBeOnTheScreen();
});
