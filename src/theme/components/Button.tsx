import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { tokens } from "../tokens";
import { text } from "../typography";

type Variant = "primary" | "secondary" | "danger";

const BACKGROUND: Record<Variant, string> = {
  primary: tokens.color.primary,
  secondary: tokens.color.card,
  danger: tokens.color.danger,
};

const FOREGROUND: Record<Variant, string> = {
  primary: tokens.color.onPrimary,
  secondary: tokens.color.ink,
  danger: tokens.color.onPrimary,
};

export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  busyTitle,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  /**
   * Text shown in place of the bare spinner while `loading` is true — e.g.
   * "Gönderiliyor…". `accessibilityLabel` always stays `title`, so a screen
   * reader user never sees the control's name change mid-action; only the
   * visible label swaps. Mirrors `fislik-web/src/components/Button.tsx`,
   * where callers swap their own busy copy in and no spinner is shown —
   * so when `busyTitle` is set, no `ActivityIndicator` renders either.
   * Omit it to keep the original spinner-only busy state.
   */
  busyTitle?: string;
}) {
  const inactive = loading || disabled;
  const showBusyTitle = loading && busyTitle !== undefined;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: BACKGROUND[variant], opacity: inactive ? 0.6 : pressed ? 0.85 : 1 },
        variant === "secondary" && styles.bordered,
      ]}
    >
      {loading && !busyTitle ? (
        <ActivityIndicator color={FOREGROUND[variant]} />
      ) : (
        <Text style={[text.label, { color: FOREGROUND[variant] }]}>
          {showBusyTitle ? busyTitle : title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 48,
    borderRadius: tokens.radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: tokens.space(4),
  },
  bordered: { borderWidth: 1, borderColor: tokens.color.border },
});
