import { act, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, Animated } from "react-native";
import { SplashOverlay } from "../SplashOverlay";

// Assertions below compare against numeric literals derived by hand from
// the design handoff, not against `SplashOverlay`'s own exported constants
// (`PRINT_HIDDEN_Y`, `FULL_SEQUENCE_TOTAL_MS`, ...) — deliberately. A test
// that reads `PRINT_HIDDEN_Y` from the component and then asserts the
// rendered value equals `PRINT_HIDDEN_Y` passes even for a mutant that sets
// `PRINT_HIDDEN_Y = 0`, since both sides of the comparison move together.
// Same for the total-duration sum: `FULL_SEQUENCE_TOTAL_MS` is *computed*
// from `PRINT_DELAY`/`HOLD_DELAY`/etc, so comparing against it can't catch
// drift in those constants — only a fixed number computed independently,
// here, can.

// Real AccessibilityInfo.isReduceMotionEnabled() rejects in this test
// environment (no native accessibility module registered) — the component
// already treats a rejection as "not reduced" (see its `.catch`), but these
// tests need to drive both branches deliberately, so the method is spied on
// per test rather than mocking the whole `react-native` module (which would
// re-initialize native-module setup jest-expo already did once).
//
// This environment's `Animated` does not honor configured durations at
// all — measured completion times for the same "~2.05s" sequence varied
// between ~700ms and ~1040ms across otherwise-identical runs, with no fake
// timer involved. So neither fake-timer advancement nor real-timer
// wall-clock brackets can reliably pin *how long* the sequence takes; only
// generous "it does eventually finish" bounds are trustworthy from the
// outside. To actually pin the handoff's specific values (durations,
// easing, translate range) without depending on playback fidelity, one
// test below spies on `Animated.timing`/`Animated.delay` and asserts what
// they were *configured* with, and a separate test reads the rendered
// tree's values at mount (before any animation has run) rather than after.
let isReduceMotionEnabled: jest.SpyInstance;

beforeEach(() => {
  isReduceMotionEnabled = jest
    .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
    .mockResolvedValue(false);
});

// A single `afterEach`, not per-test cleanup after the last assertion: if
// an `expect` above throws, code after it in the test body never runs, so
// timer/mock teardown that lived there would be skipped and leak into
// later tests/suites. `afterEach` runs regardless of the test's outcome.
// `restoreAllMocks` covers every `jest.spyOn` created in this file (the
// AccessibilityInfo spy above, plus the Animated spies further down), not
// just one of them.
afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllTimers();
  jest.useRealTimers();
});

function flattenStyle(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...[style].flat());
}

test("renders the wordmark over the app immediately, and swallows touches (the handoff: splash has no interaction)", () => {
  render(<SplashOverlay onDone={jest.fn()} />);
  expect(screen.getByText("Fişlik")).toBeOnTheScreen();
  const overlay = screen.getByTestId("splash-overlay");
  expect(overlay).toBeOnTheScreen();
  expect(overlay.props.pointerEvents).toBe("auto");
});

// Pins the handoff's pre-print frame (README §"Motion": "Before t=0.25s the
// mark is fully hidden above the window") by reading the rendered tree at
// mount, before anything has started — the one moment this environment's
// Animated values are trustworthy to read off rendered props (see file
// header).
test("mounts with the mark translated fully above the print window and the wordmark hidden", () => {
  const { getByTestId } = render(<SplashOverlay onDone={jest.fn()} />);
  const markStyle = flattenStyle(getByTestId("splash-print-mark").props.style);
  const wordmarkStyle = flattenStyle(getByTestId("splash-wordmark").props.style);

  // -188.24 = -104% of the mark's own 181px height (handoff: "translateY(
  // -104%) → 0" inside the print window, mark is 128×181). Computed by
  // hand, not imported from `PRINT_HIDDEN_Y`.
  expect(markStyle.transform).toEqual([{ translateY: -188.24 }]);
  expect(wordmarkStyle.opacity).toBe(0);
  // 10 = the handoff's "translateY(10px) → 0" for the wordmark.
  expect(wordmarkStyle.transform).toEqual([{ translateY: 10 }]);
});

// Pins the print step's translate range (toValue: 0, i.e. it actually
// travels to rest, not just starts hidden) and the one-shot's overall
// duration by reading what the sequence was *configured* with rather than
// how long it takes to play back — a mutant that flattens or removes the
// print animation, or drifts the total away from ~2.05s, changes these
// configured values even though onDone still eventually fires either way.
test("configures the print step's translate range and the sequence's total duration to match the handoff", async () => {
  const timingSpy = jest.spyOn(Animated, "timing");
  const delaySpy = jest.spyOn(Animated, "delay");

  render(<SplashOverlay onDone={jest.fn()} />);

  // Let the effect's `AccessibilityInfo...then()` callback run (it builds
  // and starts the Animated.sequence) without waiting on any of the
  // animation's real playback.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  // The print step is the one 800ms `Animated.timing` call that ends at
  // translateY 0 — distinct from the wordmark's two 350ms calls (opacity
  // 0→1, translateY 10→0) and the exit fade's 250ms call, which also end
  // at their own rest values.
  const printTiming = timingSpy.mock.calls.find(
    ([, config]) => config.duration === 800 && config.toValue === 0,
  );
  expect(printTiming).toBeDefined();
  expect(printTiming?.[1].easing).toBeDefined();
  expect(printTiming?.[1].useNativeDriver).toBe(true);

  const wordmarkOpacityTiming = timingSpy.mock.calls.find(
    ([, config]) => config.duration === 350 && config.toValue === 1,
  );
  const exitTiming = timingSpy.mock.calls.find(([, config]) => config.duration === 250 && config.toValue === 0);
  expect(wordmarkOpacityTiming).toBeDefined();
  expect(exitTiming).toBeDefined();

  // Sums to the handoff's overall duration (as intentionally trimmed for
  // safety margin — see HOLD_DELAY's comment in SplashOverlay.tsx: the
  // handoff's literal ~2.25s was shortened to ~2.05s). The wordmark's
  // second 350ms `Animated.timing` call (translateY) is deliberately
  // excluded here: it runs inside `Animated.parallel` alongside the
  // opacity one counted above, at the same time, not one after the other,
  // so counting both would double the wordmark step's contribution to the
  // total.
  const totalDelay = delaySpy.mock.calls.reduce((sum, [ms]) => sum + ms, 0);
  const total = totalDelay + printTiming![1].duration! + wordmarkOpacityTiming![1].duration! + exitTiming![1].duration!;
  // 2050 = 250 (print delay) + 800 (print) + 350 (wordmark) + 400 (hold) +
  // 250 (exit fade), computed by hand — not imported from
  // `FULL_SEQUENCE_TOTAL_MS`, which is *derived from* those same
  // constants and so can't independently catch drift in them.
  expect(total).toBe(2050);
});

// I10: the mark's drop shadow must live on the view that actually paints
// it (the inner, non-clipping `printMark` view), not on `window` — a view
// with `overflow: "hidden"` cannot cast an iOS shadow off its own layer
// (clipping and shadow are mutually exclusive there), so a shadow placed
// on `window` silently never renders on either platform.
test("the print window clips but does not itself carry a shadow; the shadow lives on the mark it clips", () => {
  const { getByTestId } = render(<SplashOverlay onDone={jest.fn()} />);
  const windowStyle = flattenStyle(getByTestId("splash-window").props.style);
  const markStyle = flattenStyle(getByTestId("splash-print-mark").props.style);

  expect(windowStyle.overflow).toBe("hidden");
  expect(windowStyle.shadowOpacity).toBeUndefined();
  expect(windowStyle.elevation).toBeUndefined();
  expect(markStyle.shadowOpacity).toBeGreaterThan(0);
  expect(markStyle.elevation).toBeGreaterThan(0);
});

// N3: on Android, `elevation` casts a shadow off the view's background
// drawable — a view with no background at all gets no shadow regardless of
// `elevation`. An explicit fully-transparent background gives it one
// without painting anything visible.
test("the mark's shadow-casting view has an explicit transparent background, not no background at all", () => {
  const { getByTestId } = render(<SplashOverlay onDone={jest.fn()} />);
  const markStyle = flattenStyle(getByTestId("splash-print-mark").props.style);
  expect(markStyle.backgroundColor).toBe("transparent");
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
    await new Promise((resolve) => setTimeout(resolve, 2000));
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

// C1: the launch budget (`deadline`) covers font-load time, not just this
// component's own mount-to-mount time — see app/_layout.tsx's
// `splashDeadline`. These pin the two ways SplashOverlay reacts when most
// or all of that budget is already spent by the time it mounts, using the
// same "spy on what Animated was configured with" technique as the timing
// test above, since actual playback timing isn't trustworthy here (see
// file header).
test("a launch budget too tight for the full sequence takes the shortened path instead, even without reduced motion", async () => {
  const timingSpy = jest.spyOn(Animated, "timing");
  // ~600ms remaining fits the reduced path's ~500ms total but not the full
  // sequence's ~2050ms.
  render(<SplashOverlay onDone={jest.fn()} deadline={Date.now() + 600} />);

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  const printCall = timingSpy.mock.calls.find(([, config]) => config.duration === 800);
  const reducedExitCall = timingSpy.mock.calls.find(([, config]) => config.duration === 200);
  expect(printCall).toBeUndefined();
  expect(reducedExitCall).toBeDefined();
});

test("an already-exhausted launch budget skips straight to the app with no animation configured at all", async () => {
  const timingSpy = jest.spyOn(Animated, "timing");
  const onDone = jest.fn();
  render(<SplashOverlay onDone={onDone} deadline={Date.now() - 10} />);

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(onDone).toHaveBeenCalledTimes(1);
  expect(timingSpy).not.toHaveBeenCalled();
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
});

// C1's other half: the safety timer itself must count down from the
// caller-supplied `deadline`, not from a fixed 2.5s measured after this
// component happens to mount — otherwise a slow font load would silently
// extend the ceiling past what the design allows.
test("the safety timer fires relative to a caller-supplied deadline, not a fresh 2.5s from mount", async () => {
  jest.useFakeTimers();
  isReduceMotionEnabled.mockImplementation(() => new Promise(() => {}));
  const onDone = jest.fn();
  // Budget already down to 300ms by the time this mounts (e.g. fonts took
  // a while) — well under the component's own 2.5s default.
  render(<SplashOverlay onDone={onDone} deadline={Date.now() + 300} />);

  await act(async () => {
    await jest.advanceTimersByTimeAsync(300);
  });

  expect(onDone).toHaveBeenCalledTimes(1);
});
