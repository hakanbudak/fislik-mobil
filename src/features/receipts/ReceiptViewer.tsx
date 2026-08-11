import type { ComponentProps } from "react";
import { useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { PinchGestureHandler, State, type PinchGestureHandlerStateChangeEvent } from "react-native-gesture-handler";
import { WebView } from "react-native-webview";
import { isPdf } from "@/src/lib/receipts";
import { tokens } from "@/src/theme/tokens";
import { text } from "@/src/theme/typography";

const MIN_SCALE = 1;
const MAX_SCALE = 4;

// Derived from `WebView`'s own prop types rather than imported from
// `react-native-webview/lib/WebViewTypes` — that subpath is package
// internals, not part of the public API surface, and a minor version bump
// can move or rename it with no install-time signal (Task 17's review).
// Neither handler below reads a field off these events, so the derived
// type is all this file needs.
type WebViewOnErrorEvent = Parameters<NonNullable<ComponentProps<typeof WebView>["onError"]>>[0];
type WebViewOnHttpErrorEvent = Parameters<NonNullable<ComponentProps<typeof WebView>["onHttpError"]>>[0];

/**
 * Shown in place of the image/PDF when it fails to load. Worded around the
 * likely cause (a stale, time-limited R2 presigned URL — `presign_get`
 * issues them with a 1-hour `ExpiresIn`, and a screen left open past that,
 * or a cached list rendered while offline, can hold an expired one) rather
 * than implying the file itself is damaged. "Tekrar dene" just retries the
 * same URL — see this task's brief: reloading a *new* URL from the API is a
 * wider design question this task deliberately leaves alone.
 */
function LoadFailure({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.failure}>
      <Text style={[text.body, styles.failureText]}>Fiş yüklenemedi, tekrar deneyin.</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retryButton}>
        <Text style={[text.label, styles.retryText]}>Tekrar dene</Text>
      </Pressable>
    </View>
  );
}

/**
 * Full-bleed receipt view: a pinch-zoomable image for photos, or an inline
 * `WebView` pointed at `receipt.image_url` for PDFs, mirroring
 * `fislik-web/src/components/ReceiptViewer.tsx`'s image/PDF split (minus
 * the desktop-only zoom/rotate toolbar and prev/next navigation, which this
 * task's screen has no equivalent of — see the detail screen).
 *
 * Zoom is plain `react-native-gesture-handler` + RN's own `Animated` API
 * (no `react-native-reanimated`, which isn't a project dependency and would
 * have expanded this task's scope): `baseScale` holds the scale committed
 * from the previous pinch, `pinchScale` tracks the gesture in progress, and
 * their product drives the image's transform. Clamped to
 * [MIN_SCALE, MAX_SCALE] and reset to `MIN_SCALE` floor (never below fit)
 * so the receipt can't shrink past its original size.
 */
export function ReceiptViewer({ receipt }: { receipt: { image_url: string; content_type?: string } }) {
  const baseScale = useRef(new Animated.Value(MIN_SCALE)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;
  const committedScale = useRef(MIN_SCALE);
  const scale = Animated.multiply(baseScale, pinchScale);

  // Neither WebView nor Image retry on their own once they've errored, so a
  // "failed" flag plus an `attempt` counter (bumped into the `key`, forcing
  // a full remount) is what makes "Tekrar dene" actually re-issue the
  // request instead of statically re-rendering the same failed element.
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  function retry() {
    setFailed(false);
    setAttempt((a) => a + 1);
  }

  const onGestureEvent = Animated.event([{ nativeEvent: { scale: pinchScale } }], { useNativeDriver: true });

  function onHandlerStateChange(event: PinchGestureHandlerStateChangeEvent) {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const next = committedScale.current * event.nativeEvent.scale;
      committedScale.current = Math.min(Math.max(next, MIN_SCALE), MAX_SCALE);
      baseScale.setValue(committedScale.current);
      pinchScale.setValue(1);
    }
  }

  if (isPdf(receipt)) {
    if (failed) {
      return <LoadFailure onRetry={retry} />;
    }
    return (
      <WebView
        key={attempt}
        source={{ uri: receipt.image_url }}
        style={styles.fill}
        originWhitelist={["*"]}
        onError={(_event: WebViewOnErrorEvent) => setFailed(true)}
        onHttpError={(_event: WebViewOnHttpErrorEvent) => setFailed(true)}
      />
    );
  }

  if (failed) {
    return <LoadFailure onRetry={retry} />;
  }

  return (
    <PinchGestureHandler onGestureEvent={onGestureEvent} onHandlerStateChange={onHandlerStateChange}>
      <Animated.View style={styles.wrap}>
        <Animated.Image
          key={attempt}
          accessibilityLabel="Fiş görseli"
          source={{ uri: receipt.image_url }}
          resizeMode="contain"
          style={[styles.image, { transform: [{ scale }] }]}
          onError={() => setFailed(true)}
        />
      </Animated.View>
    </PinchGestureHandler>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  wrap: { flex: 1, backgroundColor: tokens.color.surface, overflow: "hidden" },
  image: { width: "100%", height: "100%" },
  failure: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.space(3),
    backgroundColor: tokens.color.surface,
    padding: tokens.space(4),
  },
  failureText: { color: tokens.color.ink, textAlign: "center" },
  retryButton: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.card,
    paddingHorizontal: tokens.space(4),
    paddingVertical: tokens.space(2),
  },
  retryText: { color: tokens.color.ink },
});
