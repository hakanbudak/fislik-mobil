import { useState } from "react";
import { Link, router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Role } from "@/src/api/endpoints";
import { useAuth } from "@/src/auth/AuthProvider";
import { AuthShell } from "@/src/auth/AuthShell";
import { apiErrorMessage } from "@/src/lib/errors";
import { Button } from "@/src/theme/components/Button";
import { ErrorCard } from "@/src/theme/components/ErrorCard";
import { Input } from "@/src/theme/components/Input";
import { tokens } from "@/src/theme/tokens";
import { text } from "@/src/theme/typography";

const MIN_PASSWORD_LENGTH = 8;

/**
 * Role options mirror `fislik-web/src/pages/RegisterPage.tsx`'s two cards.
 * The choice decides which app the account lands in and is not meant to be
 * easily reversible afterwards, so both options get a full sentence of
 * context rather than just a role name.
 */
const ROLE_OPTIONS: { role: Role; title: string; description: string }[] = [
  {
    role: "client",
    title: "Mükellefim",
    description: "İşletme sahibiyim, fişlerimi fotoğraflayacağım",
  },
  {
    role: "accountant",
    title: "Mali müşavirim",
    description: "Mükelleflerimin fişlerini görüntüleyeceğim",
  },
];

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = role !== null && fullName.trim() !== "" && email.trim() !== "" && password !== "";

  async function handleSubmit() {
    if (!role) return;
    setError(null);
    setLoading(true);
    try {
      const user = await signUp({ email, password, full_name: fullName, role });
      router.replace(user.role === "accountant" ? "/(accountant)" : "/(client)");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell active="kayit">
      <View style={styles.card}>
        <View>
          <Text style={[text.title, styles.title]}>Fişlik&apos;e hoş geldiniz</Text>
          <Text style={[text.caption, styles.subtitle]}>
            Fişlerinizi telefonla çekin, muhasebeciniz aynı anda görsün.
          </Text>
        </View>

        {error ? <ErrorCard message={error} /> : null}

        <View style={styles.roleGroup}>
          <Text style={[text.caption, styles.roleGroupLabel]}>
            FİŞLİK&apos;İ NASIL KULLANACAKSINIZ?
          </Text>
          {ROLE_OPTIONS.map((option) => {
            const selected = role === option.role;
            return (
              <Pressable
                key={option.role}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setRole(option.role)}
                style={[styles.roleCard, selected && styles.roleCardSelected]}
              >
                <Text style={[text.label, styles.roleTitle]}>{option.title}</Text>
                <Text style={[text.caption, styles.roleDescription]}>{option.description}</Text>
              </Pressable>
            );
          })}
        </View>

        <Input label="Ad Soyad" value={fullName} onChangeText={setFullName} placeholder="Ayşe Yıldırım" />
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

        <Button title="Hesap oluştur" onPress={handleSubmit} loading={loading} disabled={!canSubmit} />

        <View style={styles.footer}>
          <Text style={[text.caption, styles.footerText]}>Zaten hesabın var mı? </Text>
          <Link href="/giris">
            <Text style={[text.caption, styles.footerLinkText]}>Giriş yap</Text>
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
  roleGroup: { gap: tokens.space(2) },
  roleGroupLabel: { color: tokens.color.inkSoft },
  roleCard: {
    gap: tokens.space(0.5),
    padding: tokens.space(3.5),
    borderRadius: tokens.radius.lg,
    borderWidth: 2,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.card,
  },
  roleCardSelected: { borderColor: tokens.color.primary },
  roleTitle: { color: tokens.color.ink },
  roleDescription: { color: tokens.color.inkSoft },
  footer: { flexDirection: "row", justifyContent: "center" },
  footerText: { color: tokens.color.inkSoft },
  footerLinkText: { color: tokens.color.primary },
});
