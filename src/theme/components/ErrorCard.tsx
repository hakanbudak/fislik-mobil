import { StyleSheet, Text, View } from "react-native";
import { AlertCircle } from "lucide-react-native";
import { tokens } from "../tokens";
import { text } from "../typography";
import { Button } from "./Button";

export function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.card}>
      <AlertCircle size={22} color={tokens.color.danger} />
      <Text style={[text.body, styles.message]}>{message}</Text>
      {onRetry ? <Button title="Tekrar dene" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: tokens.space(3),
    padding: tokens.space(4),
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.card,
    borderWidth: 1,
    borderColor: tokens.color.border,
    alignItems: "center",
  },
  message: { color: tokens.color.ink, textAlign: "center" },
});
