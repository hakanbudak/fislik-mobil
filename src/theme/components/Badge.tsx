import { StyleSheet, Text, View } from "react-native";
import { tokens } from "../tokens";
import { text } from "../typography";

type Tone = "success" | "warning" | "neutral";

const COLOR: Record<Tone, string> = {
  success: tokens.color.success,
  warning: tokens.color.warning,
  neutral: tokens.color.inkSoft,
};

export function Badge({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  return (
    <View style={[styles.badge, { backgroundColor: `${COLOR[tone]}1A` }]}>
      <View style={[styles.dot, { backgroundColor: COLOR[tone] }]} />
      <Text style={[text.caption, { color: COLOR[tone] }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space(1.5),
    paddingHorizontal: tokens.space(2),
    paddingVertical: tokens.space(1),
    borderRadius: tokens.radius.pill,
    alignSelf: "flex-start",
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
