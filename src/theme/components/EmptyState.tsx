import { StyleSheet, Text, View } from "react-native";
import { tokens } from "../tokens";
import { text } from "../typography";

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.wrapper}>
      <Text style={[text.label, styles.title]}>{title}</Text>
      <Text style={[text.body, styles.description]}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center", justifyContent: "center", padding: tokens.space(8), gap: tokens.space(1.5) },
  title: { color: tokens.color.ink, textAlign: "center" },
  description: { color: tokens.color.inkSoft, textAlign: "center" },
});
