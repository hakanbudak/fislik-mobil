import { ActivityIndicator, StyleSheet, View } from "react-native";
import { tokens } from "../tokens";

export function Spinner() {
  return (
    <View style={styles.wrapper}>
      <ActivityIndicator color={tokens.color.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center", justifyContent: "center", padding: tokens.space(4) },
});
