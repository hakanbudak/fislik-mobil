import { useState } from "react";
import { Link, router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/src/auth/AuthProvider";
import { AuthShell } from "@/src/auth/AuthShell";
import { apiErrorMessage } from "@/src/lib/errors";
import { Button } from "@/src/theme/components/Button";
import { ErrorCard } from "@/src/theme/components/ErrorCard";
import { Input } from "@/src/theme/components/Input";
import { tokens } from "@/src/theme/tokens";
import { text } from "@/src/theme/typography";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      // Route through the app's own entry point rather than straight to a
      // role shell: `app/index.tsx` is what decides tour vs. shell for an
      // authed user, and a sign-in that bypassed it would strand anyone
      // whose intro flag is unset (every existing user, after the intro
      // moved post-login and its storage key changed) without ever seeing
      // the new tour until their next cold start.
      await signIn(email, password);
      router.replace("/");
    } catch (err) {
      // Login's 401 gets its own copy — the shared status map's default
      // ("Oturumun sona ermiş...") assumes an expired session, not a
      // rejected credential pair.
      setError(apiErrorMessage(err, { 401: "E-posta veya şifre hatalı" }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell active="giris">
      <View style={styles.card}>
        <View>
          <Text style={[text.title, styles.title]}>Giriş yapın</Text>
          <Text style={[text.caption, styles.subtitle]}>
            Hesabınıza erişmek için bilgilerinizi girin.
          </Text>
        </View>

        {error ? <ErrorCard message={error} /> : null}

        <Input
          label="E-posta"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="ornek@firma.com"
        />
        <Input
          label="Şifre"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
        />

        <Link href="/sifre-sifirla" style={styles.forgotLink}>
          <Text style={[text.caption, styles.forgotLinkText]}>Şifremi unuttum</Text>
        </Link>

        <Button title="Giriş yap" onPress={handleSubmit} loading={loading} />

        <View style={styles.footer}>
          <Text style={[text.caption, styles.footerText]}>Hesabın yok mu? </Text>
          <Link href="/kayit">
            <Text style={[text.caption, styles.footerLinkText]}>Kayıt ol</Text>
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
  forgotLink: { alignSelf: "flex-end" },
  forgotLinkText: { color: tokens.color.primary },
  footer: { flexDirection: "row", justifyContent: "center" },
  footerText: { color: tokens.color.inkSoft },
  footerLinkText: { color: tokens.color.primary },
});
