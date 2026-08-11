import { act, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { SplashOverlay } from "../SplashOverlay";

// Real AccessibilityInfo.isReduceMotionEnabled() rejects in this test
// environment (no native accessibility module registered) — the component
// already treats a rejection as "not reduced" (see its `.catch`), but these
// tests need to drive both branches deliberately, so the method is spied on
// per test rather than mocking the whole `react-native` module (which would
// re-initialize native-module setup jest-expo already did once).
//
// These tests use REAL timers, not fake ones: `Animated.timing` with
// `useNativeDriver: true` drives its clock off `requestAnimationFrame`,
// which (under this environment's fake timers) resolves in a single tick
// regardless of the configured duration — so mid-sequence checkpoints
// driven by `jest.advanceTimersByTime` are not trustworthy here. The
// component's `setTimeout`-based safety fallback is unaffected by that and
// is covered separately with fake timers below.
let isReduceMotionEnabled: jest.SpyInstance;

beforeEach(() => {
  isReduceMotionEnabled = jest
    .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
    .mockResolvedValue(false);
});

afterEach(() => {
  isReduceMotionEnabled.mockRestore();
});

test("renders the wordmark over the app immediately", () => {
  render(<SplashOverlay onDone={jest.fn()} />);
  expect(screen.getByText("Fişlik")).toBeOnTheScreen();
  expect(screen.getByTestId("splash-overlay")).toBeOnTheScreen();
});

test("does not call onDone in the first 100ms (the print alone starts 250ms in)", async () => {
  const onDone = jest.fn();
  render(<SplashOverlay onDone={onDone} />);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
  expect(onDone).not.toHaveBeenCalled();
});

test("calls onDone exactly once once the full sequence completes", async () => {
  const onDone = jest.fn();
  render(<SplashOverlay onDone={onDone} />);

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 2400));
  });

  expect(onDone).toHaveBeenCalledTimes(1);
}, 10000);

test("reduced motion skips the print animation and finishes well before the full sequence would", async () => {
  isReduceMotionEnabled.mockResolvedValue(true);
  const onDone = jest.fn();
  render(<SplashOverlay onDone={onDone} />);

  // The full sequence's print step alone doesn't even start until 250ms and
  // runs to 1050ms; reduced motion (300ms hold + 200ms fade) must already
  // be done well before that.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 700));
  });

  expect(onDone).toHaveBeenCalledTimes(1);
});

test("a stalled reduced-motion check does not trap the user past the safety timeout", async () => {
  jest.useFakeTimers();
  isReduceMotionEnabled.mockImplementation(() => new Promise(() => {}));
  const onDone = jest.fn();
  render(<SplashOverlay onDone={onDone} />);

  await act(async () => {
    await jest.advanceTimersByTimeAsync(2500);
  });

  expect(onDone).toHaveBeenCalledTimes(1);

  // Guards against leaking a pending timer into another suite.
  jest.clearAllTimers();
  jest.useRealTimers();
});
