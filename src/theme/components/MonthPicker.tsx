import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { currentPeriod, formatPeriodLabel, shiftPeriod } from "@/src/lib/period";
import { tokens } from "../tokens";
import { text } from "../typography";

/**
 * Month navigator — chevron-left / label / chevron-right, ported from
 * fislik-web/src/components/MonthPicker.tsx. The next-month control is
 * disabled once `value` reaches the current month: periods are never
 * navigable into the future.
 */
export function MonthPicker({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const atCurrent = value === currentPeriod();

  return (
    <View style={styles.wrapper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Önceki ay"
        onPress={() => onChange(shiftPeriod(value, -1))}
        style={styles.button}
      >
        <ChevronLeft size={16} color={tokens.color.inkSoft} />
      </Pressable>
      <Text style={[text.label, styles.label]}>{formatPeriodLabel(value)}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sonraki ay"
        accessibilityState={{ disabled: atCurrent }}
        disabled={atCurrent}
        onPress={() => onChange(shiftPeriod(value, 1))}
        style={[styles.button, atCurrent && styles.disabled]}
      >
        <ChevronRight size={16} color={tokens.color.inkSoft} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space(1),
    alignSelf: "flex-start",
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.md,
    padding: tokens.space(0.75),
  },
  button: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.radius.sm,
  },
  disabled: { opacity: 0.3 },
  label: { minWidth: 112, textAlign: "center", color: tokens.color.ink },
});
