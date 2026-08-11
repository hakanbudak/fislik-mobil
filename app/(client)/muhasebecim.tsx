import { ScrollView, StyleSheet } from "react-native";
import { GrantsSection } from "@/src/features/grants/GrantsSection";
import { tokens } from "@/src/theme/tokens";

export default function MuhasebecimScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <GrantsSection role="client" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.color.page },
  content: { padding: tokens.space(3), paddingBottom: tokens.space(8) },
});
