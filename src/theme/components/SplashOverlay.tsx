import { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";
import { FislikMark } from "./FislikMark";
import { tokens } from "../tokens";
import { font } from "../typography";

// Geometry from the design handoff (2a).
const MARK_WIDTH = 128;
const MARK_HEIGHT = 181;
const WINDOW_HEIGHT = 192;
const SLOT_WIDTH = 168;
const SLOT_HEIGHT = 12;
// The mark starts translated 104% of its own height above the print
// window, fully hidden behind the teal background + slot. Exported so
// tests can pin the exact starting offset instead of re-deriving it.
export const PRINT_HIDDEN_Y = -MARK_HEIGHT * 1.04;
export const WORDMARK_HIDDEN_Y = 10;

// Timings (ms) as offsets from mount, taken straight from the handoff's
// "fractions of a 2.2s one-shot". Because Animated.sequence adds durations
// rather than using absolute offsets, the delays below are gaps *between*
// steps, not offsets from t=0 — chosen so the cumulative time lines up with
// the handoff's absolute marks (0.25s print start, 1.05s wordmark start).
//
// `HOLD_DELAY` is shortened from the handoff's literal "hold until ≈2.0s"
// (which would put `FULL_SEQUENCE_TOTAL_MS` at 2250ms, only 250ms under
// `SAFETY_TIMEOUT_MS`). `Animated.sequence` step transitions are scheduled
// on the JS thread even under `useNativeDriver: true` — only the
// interpolation itself runs natively — and the JS thread is at its busiest
// during startup, so 250ms of margin is not enough: the safety timer can
// fire mid-exit-fade on a real cold start and jump-cut the overlay instead
// of letting it finish its cross-fade. Ending the hold ~200ms earlier
// trades a small, unnoticeable timing deviation for real slack.
const PRINT_DELAY = 250;
const PRINT_DURATION = 800; // ends at 1050ms
const WORDMARK_DURATION = 350; // starts at 1050ms (no extra delay needed), ends at 1400ms
const HOLD_DELAY = 400; // 1400ms -> 1800ms
const EXIT_DURATION = 250; // 1800ms -> 2050ms

export const FULL_SEQUENCE_TOTAL_MS =
  PRINT_DELAY + PRINT_DURATION + WORDMARK_DURATION + HOLD_DELAY + EXIT_DURATION;

// Reduced-motion path: skip the print/wordmark entrance entirely, show the
// composed final frame briefly, then fade out. Also used as the "shorten"
// path when the launch budget can't fit the full sequence (see below).
const REDUCED_HOLD = 300;
const REDUCED_FADE = 200;
export const REDUCED_SEQUENCE_TOTAL_MS = REDUCED_HOLD + REDUCED_FADE;

// Structural guarantee against ever trapping the user: no matter what goes
// wrong (a stalled/rejected AccessibilityInfo promise, a dropped Animated
// completion callback, ...), this fires `onDone` unconditionally once the
// launch budget is spent — the ~2.5s ceiling the design calls out ("must
// never block startup beyond ~2.5s"). Used as a fallback total when no
// `deadline` prop is supplied (e.g. rendered standalone in a test).
export const SAFETY_TIMEOUT_MS = 2500;

const PRINT_EASING = Easing.bezier(0.3, 0.7, 0.3, 1);

/**
 * Full-screen animated launch splash (design handoff "2a"). Renders once
 * over the app after fonts are loaded (see `app/_layout.tsx`): the Fişlik
 * mark "prints" out of a slot, the wordmark fades in, then the whole view
 * fades out to reveal the app. Calls `onDone` exactly once, however the
 * sequence ends (completed, reduced motion, shortened/skipped for a slow
 * launch, or safety timeout) — the caller uses that to unmount this
 * component.
 *
 * `deadline` is an absolute `Date.now()`-style timestamp for when the
 * *entire launch* (not just this component's own mount-to-mount time) must
 * have handed off to the app — see `app/_layout.tsx`'s `bootStartedAt`.
 * Without it, the component falls back to treating its own mount time as
 * the start of the budget, which is only correct when nothing delayed
 * mounting it (true in isolation/tests, not true when fonts load slowly).
 */
export function SplashOverlay({ onDone, deadline }: { onDone: () => void; deadline?: number }) {
  const sceneOpacity = useRef(new Animated.Value(1)).current;
  const printY = useRef(new Animated.Value(PRINT_HIDDEN_Y)).current;
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkY = useRef(new Animated.Value(WORDMARK_HIDDEN_Y)).current;

  const onDoneRef = useRef(onDone);
  // Kept in an effect rather than assigned during render: render-phase
  // mutation of a ref is a common idiom but strictly a side effect that
  // belongs after commit.
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    let done = false;
    let anim: ReturnType<typeof Animated.sequence> | undefined;

    // C1: the ceiling covers the whole launch (font load + this sequence),
    // not just the time since this component mounted. `deadline` (an
    // absolute timestamp set by `app/_layout.tsx` from the moment the JS
    // bundle started evaluating) already has font-load time baked in by
    // the time this effect runs, so `remaining` shrinks accordingly.
    const remaining = deadline != null ? Math.max(0, deadline - Date.now()) : SAFETY_TIMEOUT_MS;

    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(safety);
      onDoneRef.current();
    };

    const safety = setTimeout(finish, remaining);

    const runFullSequence = () => {
      anim = Animated.sequence([
        Animated.delay(PRINT_DELAY),
        Animated.timing(printY, {
          toValue: 0,
          duration: PRINT_DURATION,
          easing: PRINT_EASING,
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.timing(wordmarkOpacity, {
            toValue: 1,
            duration: WORDMARK_DURATION,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(wordmarkY, {
            toValue: 0,
            duration: WORDMARK_DURATION,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(HOLD_DELAY),
        Animated.timing(sceneOpacity, {
          toValue: 0,
          duration: EXIT_DURATION,
          useNativeDriver: true,
        }),
      ]);
      anim.start(({ finished }) => {
        if (finished) finish();
      });
    };

    const runReducedSequence = () => {
      // Skip straight to the composed final frame — no print, no fade-in —
      // so a reduced-motion user (or a launch that has already eaten most
      // of its time budget on font loading) isn't made to sit through the
      // full animation.
      printY.setValue(0);
      wordmarkOpacity.setValue(1);
      wordmarkY.setValue(0);
      anim = Animated.sequence([
        Animated.delay(REDUCED_HOLD),
        Animated.timing(sceneOpacity, {
          toValue: 0,
          duration: REDUCED_FADE,
          useNativeDriver: true,
        }),
      ]);
      anim.start(({ finished }) => {
        if (finished) finish();
      });
    };

    const runSkip = () => {
      // No time left in the launch budget at all (e.g. a very slow font
      // load already spent it) — show the composed final frame with no
      // hold and no fade. This is the handoff's "skip/shorten if assets
      // load slowly" directive taken to its limit; `finish()` fires
      // immediately after, so the overlay unmounts on its next render.
      printY.setValue(0);
      wordmarkOpacity.setValue(1);
      wordmarkY.setValue(0);
      sceneOpacity.setValue(0);
      finish();
    };

    const start = (reduced: boolean) => {
      if (remaining <= REDUCED_SEQUENCE_TOTAL_MS) runSkip();
      else if (reduced || remaining < FULL_SEQUENCE_TOTAL_MS) runReducedSequence();
      else runFullSequence();
    };

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (!done) start(reduced);
      })
      .catch(() => {
        if (!done) start(false);
      });

    return () => {
      done = true;
      clearTimeout(safety);
      anim?.stop();
    };
    // Runs exactly once per mount — this overlay is only ever mounted once
    // per cold start (see app/_layout.tsx) — and reads `deadline` as of
    // that first render, which is what we want: the budget is fixed at
    // mount time, not a moving target across re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      // I4: the splash has "no interaction" per the handoff — swallow
      // touches so a launch-time tap can't land on the live app
      // underneath it (e.g. a tab bar's raised camera button).
      pointerEvents="auto"
      style={[styles.overlay, { opacity: sceneOpacity }]}
      testID="splash-overlay"
    >
      <View style={styles.slot} />
      <View testID="splash-window" style={styles.window}>
        <Animated.View
          testID="splash-print-mark"
          style={[styles.printMark, { transform: [{ translateY: printY }] }]}
        >
          <FislikMark width={MARK_WIDTH} height={MARK_HEIGHT} bg={tokens.color.card} fg={tokens.color.primary} />
        </Animated.View>
      </View>
      <Animated.Text
        testID="splash-wordmark"
        style={[
          styles.wordmark,
          { opacity: wordmarkOpacity, transform: [{ translateY: wordmarkY }] },
        ]}
      >
        Fişlik
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: tokens.color.primary,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  slot: {
    width: SLOT_WIDTH,
    height: SLOT_HEIGHT,
    borderRadius: 6,
    backgroundColor: tokens.color.onPrimaryFaint,
    shadowColor: tokens.color.ink,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    zIndex: 2,
  },
  window: {
    height: WINDOW_HEIGHT,
    overflow: "hidden",
    marginTop: -2,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  // I10: the mark's drop shadow lives on this view — the one that
  // translates during the print — rather than on `window`. `window` sets
  // `overflow: "hidden"` to clip the print motion, and on iOS a layer that
  // both clips (`masksToBounds`) and casts a shadow (`shadowOpacity`) loses
  // the shadow entirely: the two are mutually exclusive on one layer.
  // Nesting the shadow one level in, on a plain (non-clipping) view, lets
  // it render — clipped by the ancestor's bounds like everything else
  // inside `window`, which is the correct visual result: the shadow should
  // only be visible for the portion of the "paper" that has emerged from
  // the slot. `elevation` (Android's shadow mechanism) is included here
  // too, since Android elevation was previously only set on `slot`.
  printMark: {
    shadowColor: tokens.color.ink,
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  wordmark: {
    marginTop: 20,
    fontFamily: font.extraBold,
    fontSize: 30,
    letterSpacing: -1,
    color: tokens.color.onPrimary,
  },
});
