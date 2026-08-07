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
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
}) {
  const inactive = loading || disabled;
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
      {loading ? (
        <ActivityIndicator color={FOREGROUND[variant]} />
      ) : (
        <Text style={[text.label, { color: FOREGROUND[variant] }]}>{title}</Text>
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
