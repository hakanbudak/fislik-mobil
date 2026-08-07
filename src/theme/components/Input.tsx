import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { tokens } from "../tokens";
import { text } from "../typography";

export function Input({
  label,
  error,
  style,
  ...rest
}: { label: string; error?: string } & TextInputProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={[text.caption, styles.label]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={tokens.color.inkSoft}
        style={[text.body, styles.input, error && styles.inputError, style]}
        {...rest}
      />
      {error ? <Text style={[text.caption, styles.error]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: tokens.space(1.5) },
  label: { color: tokens.color.inkSoft },
  input: {
    height: 46,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.card,
    color: tokens.color.ink,
    paddingHorizontal: tokens.space(3),
  },
  inputError: { borderColor: tokens.color.danger },
  error: { color: tokens.color.danger },
});
