import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { tokens } from "../tokens";
import { text } from "../typography";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.wrapper}>
      <Text style={[text.label, styles.title]}>{title}</Text>
      <Text style={[text.body, styles.description]}>{description}</Text>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center", justifyContent: "center", padding: tokens.space(8), gap: tokens.space(1.5) },
  title: { color: tokens.color.ink, textAlign: "center" },
  description: { color: tokens.color.inkSoft, textAlign: "center" },
  action: { marginTop: tokens.space(2), minWidth: 160 },
});
