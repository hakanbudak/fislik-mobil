import { StyleSheet, Text, View } from "react-native";
import { tokens } from "@/src/theme/tokens";
import { text } from "@/src/theme/typography";

// Placeholder screen from Task 1; styled with the design tokens (via the
// "@/" alias) so real app code exercises that alias, not just Jest/tests.
export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Fişlik</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.page,
  },
  title: {
    ...text.title,
    color: tokens.color.primary,
  },
});
