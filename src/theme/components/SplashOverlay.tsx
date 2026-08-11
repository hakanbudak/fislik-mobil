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
// window, fully hidden behind the teal background + slot.
const PRINT_HIDDEN_Y = -MARK_HEIGHT * 1.04;
const WORDMARK_HIDDEN_Y = 10;

// Timings (ms) as offsets from mount, taken straight from the handoff's
// "fractions of a 2.2s one-shot". Because Animated.sequence adds durations
// rather than using absolute offsets, the delays below are gaps *between*
// steps, not offsets from t=0 — chosen so the cumulative time lines up with
// the handoff's absolute marks (0.25s print start, 1.05s wordmark start,
// 2.0s hold end, 2.25s exit end).
const PRINT_DELAY = 250;
const PRINT_DURATION = 800; // ends at 1050ms
const WORDMARK_DURATION = 350; // starts at 1050ms (no extra delay needed), ends at 1400ms
const HOLD_DELAY = 600; // 1400ms -> 2000ms
const EXIT_DURATION = 250; // 2000ms -> 2250ms

// Reduced-motion path: skip the print/wordmark entrance entirely, show the
// composed final frame briefly, then fade out.
const REDUCED_HOLD = 300;
const REDUCED_FADE = 200;

// Structural guarantee against ever trapping the user: no matter what goes
// wrong above (a stalled/rejected AccessibilityInfo promise, a dropped
// Animated completion callback, ...), this fires `onDone` unconditionally
// once ~2.5s have passed — the ceiling the design calls out ("must never
// block startup beyond ~2.5s").
const SAFETY_TIMEOUT_MS = 2500;

const PRINT_EASING = Easing.bezier(0.3, 0.7, 0.3, 1);

/**
 * Full-screen animated launch splash (design handoff "2a"). Renders once
 * over the app after fonts are loaded (see `app/_layout.tsx`): the Fişlik
 * mark "prints" out of a slot, the wordmark fades in, then the whole view
 * fades out to reveal the app. Calls `onDone` exactly once, however the
 * sequence ends (completed, reduced motion, or safety timeout) — the
 * caller uses that to unmount this component.
 */
export function SplashOverlay({ onDone }: { onDone: () => void }) {
  const sceneOpacity = useRef(new Animated.Value(1)).current;
  const printY = useRef(new Animated.Value(PRINT_HIDDEN_Y)).current;
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkY = useRef(new Animated.Value(WORDMARK_HIDDEN_Y)).current;

  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    let done = false;
    let anim: ReturnType<typeof Animated.sequence> | undefined;

    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(safety);
      onDoneRef.current();
    };

    const safety = setTimeout(finish, SAFETY_TIMEOUT_MS);

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
      // so a reduced-motion user isn't made to sit through the animation.
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

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (done) return;
        if (reduced) runReducedSequence();
        else runFullSequence();
      })
      .catch(() => {
        if (!done) runFullSequence();
      });

    return () => {
      done = true;
      clearTimeout(safety);
      anim?.stop();
    };
    // Runs exactly once per mount — this overlay is only ever mounted once
    // per cold start (see app/_layout.tsx).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.overlay, { opacity: sceneOpacity }]}
      testID="splash-overlay"
    >
      <View style={styles.slot} />
      <View style={styles.window}>
        <Animated.View style={{ transform: [{ translateY: printY }] }}>
          <FislikMark width={MARK_WIDTH} height={MARK_HEIGHT} bg={tokens.color.card} fg={tokens.color.primary} />
        </Animated.View>
      </View>
      <Animated.Text
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
    alignItems: "center",
    shadowColor: tokens.color.ink,
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  wordmark: {
    marginTop: 20,
    fontFamily: font.extraBold,
    fontSize: 30,
    letterSpacing: -1,
    color: tokens.color.onPrimary,
  },
});
