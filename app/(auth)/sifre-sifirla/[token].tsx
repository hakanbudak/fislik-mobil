import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { KeyRound } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { confirmPasswordReset } from "@/src/api/endpoints";
import { AuthShell } from "@/src/auth/AuthShell";
import { apiErrorMessage } from "@/src/lib/errors";
import { Button } from "@/src/theme/components/Button";
import { ErrorCard } from "@/src/theme/components/ErrorCard";
import { Input } from "@/src/theme/components/Input";
import { tokens } from "@/src/theme/tokens";
import { text } from "@/src/theme/typography";

const MIN_PASSWORD_LENGTH = 8;

export default function ResetConfirmScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı`);
      return;
    }
    setLoading(true);
    try {
      await confirmPasswordReset(token ?? "", password);
      router.replace("/giris");
    } catch (err) {
      setError(apiErrorMessage(err, { 400: "Bağlantı geçersiz veya süresi dolmuş." }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <KeyRound size={20} color={tokens.color.primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={[text.title, styles.title]}>Yeni şifre belirle</Text>
            <Text style={[text.caption, styles.subtitle]}>Hesabınız için yeni bir şifre girin.</Text>
          </View>
        </View>

        {error ? <ErrorCard message={error} /> : null}

        <Input
          label="Yeni şifre"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
        />

        <Button title="Şifreyi güncelle" onPress={handleSubmit} loading={loading} />
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: tokens.space(3.5),
    padding: tokens.space(5),
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.card,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  header: { flexDirection: "row", alignItems: "center", gap: tokens.space(3) },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: tokens.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.surface,
  },
  headerText: { flex: 1 },
  title: { color: tokens.color.ink },
  subtitle: { marginTop: tokens.space(1), color: tokens.color.inkSoft },
});
