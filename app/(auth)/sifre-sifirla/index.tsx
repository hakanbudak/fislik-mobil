import { useState } from "react";
import { Link } from "expo-router";
import { MailCheck } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { requestPasswordReset } from "@/src/api/endpoints";
import { AuthShell } from "@/src/auth/AuthShell";
import { apiErrorMessage } from "@/src/lib/errors";
import { Button } from "@/src/theme/components/Button";
import { ErrorCard } from "@/src/theme/components/ErrorCard";
import { Input } from "@/src/theme/components/Input";
import { tokens } from "@/src/theme/tokens";
import { text } from "@/src/theme/typography";

/**
 * The API answers 204 whether or not the address is registered, on purpose —
 * this screen must show the exact same success copy either way so it can't
 * be used to discover which e-mails exist in the system. Never branch this
 * message on the response.
 */
export default function ResetRequestScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <View style={styles.card}>
        <View>
          <Text style={[text.title, styles.title]}>Şifremi unuttum</Text>
          <Text style={[text.caption, styles.subtitle]}>
            E-posta adresinizi girin, şifre sıfırlama bağlantısı gönderelim.
          </Text>
        </View>

        {sent ? (
          <View style={styles.confirmation}>
            <MailCheck size={18} color={tokens.color.primary} />
            <Text style={[text.body, styles.confirmationText]}>
              E-posta adresine sıfırlama bağlantısı gönderdik.
            </Text>
          </View>
        ) : (
          <>
            {error ? <ErrorCard message={error} /> : null}
            <Input
              label="E-posta"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="ornek@firma.com"
            />
            <Button title="Sıfırlama bağlantısı gönder" onPress={handleSubmit} loading={loading} />
          </>
        )}

        <View style={styles.footer}>
          <Link href="/giris">
            <Text style={[text.caption, styles.footerLinkText]}>Giriş sayfasına dön</Text>
          </Link>
        </View>
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
  title: { color: tokens.color.ink },
  subtitle: { marginTop: tokens.space(1), color: tokens.color.inkSoft },
  confirmation: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: tokens.space(2),
    padding: tokens.space(3.5),
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surface,
  },
  confirmationText: { flex: 1, color: tokens.color.ink },
  footer: { flexDirection: "row", justifyContent: "center" },
  footerLinkText: { color: tokens.color.primary },
});
