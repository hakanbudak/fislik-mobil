import { useRef } from "react";
import { Animated, StyleSheet } from "react-native";
import { PinchGestureHandler, State, type PinchGestureHandlerStateChangeEvent } from "react-native-gesture-handler";
import { WebView } from "react-native-webview";
import { isPdf } from "@/src/lib/receipts";
import { tokens } from "@/src/theme/tokens";

const MIN_SCALE = 1;
const MAX_SCALE = 4;

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
    return <WebView source={{ uri: receipt.image_url }} style={styles.fill} originWhitelist={["*"]} />;
  }

  return (
    <PinchGestureHandler onGestureEvent={onGestureEvent} onHandlerStateChange={onHandlerStateChange}>
      <Animated.View style={styles.wrap}>
        <Animated.Image
          accessibilityLabel="Fiş görseli"
          source={{ uri: receipt.image_url }}
          resizeMode="contain"
          style={[styles.image, { transform: [{ scale }] }]}
        />
      </Animated.View>
    </PinchGestureHandler>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  wrap: { flex: 1, backgroundColor: tokens.color.surface, overflow: "hidden" },
  image: { width: "100%", height: "100%" },
});
