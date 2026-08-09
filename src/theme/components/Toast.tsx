import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { tokens } from "../tokens";
import { text } from "../typography";

/**
 * Minimal timed confirmation card, absolutely positioned over the top-right
 * of the screen — mirrors `fislik-web`'s toast (ClientHomePage's
 * `showToast`/`toast` state), which uses the same success-dot + message
 * shape. Controlled rather than imperative (`message: string | null`,
 * `onHide`) so callers own the state and can reuse one instance for every
 * confirmation on a screen; later tasks (17, 18, 22, 23) render the same
 * component for their own success messages.
 */
export function Toast({
  message,
  onHide,
  duration = 2600,
}: {
  message: string | null;
  onHide: () => void;
  duration?: number;
}) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onHide, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onHide]);

  if (!message) return null;

  return (
    <View style={styles.toast}>
      <View style={styles.dot} />
      <Text style={[text.label, styles.text]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    top: tokens.space(4),
    right: tokens.space(4),
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space(2),
    backgroundColor: tokens.color.card,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.lg,
    paddingHorizontal: tokens.space(3.5),
    paddingVertical: tokens.space(2.75),
    shadowColor: tokens.color.ink,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.color.success },
  text: { color: tokens.color.ink },
});
