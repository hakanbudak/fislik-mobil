import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { changePassword, type Role } from "@/src/api/endpoints";
import { useAuth } from "@/src/auth/AuthProvider";
import { isBiometricAvailable, isBiometricEnabled, setBiometricEnabled } from "@/src/auth/biometrics";
import { apiErrorMessage } from "@/src/lib/errors";
import { Button } from "@/src/theme/components/Button";
import { Input } from "@/src/theme/components/Input";
import { Spinner } from "@/src/theme/components/Spinner";
import { tokens } from "@/src/theme/tokens";
import { text } from "@/src/theme/typography";

const ROLE_LABEL_TR: Record<Role, string> = {
  client: "Mükellef",
  accountant: "Muhasebeci",
};

const MIN_PASSWORD_LENGTH = 8;

/**
 * "Profil" tab — role-agnostic (both `(client)` and the future
 * `(accountant)` shell re-export this same screen, see Task 21). Mirrors
 * `fislik-web/src/pages/ProfilePage.tsx`'s identity card, password-change
 * card and "Çıkış yap" button; the "Firma bilgileri" entry is client-only,
 * same as the web (an accountant has no tax profile of their own). The
 * biometric-unlock switch has no web counterpart — mobile-only — and is
 * hidden entirely when `isBiometricAvailable()` resolves false, since a
 * switch that can never actually work is worse than no switch at all.
 */
export default function ProfilScreen() {
  const { user, signOut } = useAuth();
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricOn, setBiometricOn] = useState(false);

  useEffect(() => {
    isBiometricAvailable().then(setBiometricAvailable);
    isBiometricEnabled().then(setBiometricOn);
  }, []);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const passwordMutation = useMutation({
    mutationFn: () => changePassword({ current_password: current, new_password: next }),
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setConfirm("");
    },
  });

  function handleToggleBiometric(value: boolean) {
    setBiometricOn(value);
    void setBiometricEnabled(value);
  }

  function handleChangePassword() {
    passwordMutation.reset();
    if (next.length < MIN_PASSWORD_LENGTH) {
      setValidationError("Şifre en az 8 karakter olmalı");
      return;
    }
    if (next !== confirm) {
      setValidationError("Yeni şifreler birbiriyle eşleşmiyor");
      return;
    }
    setValidationError(null);
    passwordMutation.mutate();
  }

  if (!user) {
    return (
      <View style={styles.center}>
        <Spinner />
      </View>
    );
  }

  const role = user.role as Role;

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.card}>
          <Text style={[text.title, styles.name]}>{user.full_name}</Text>
          <Text style={[text.caption, styles.role]}>{ROLE_LABEL_TR[role] ?? role}</Text>
          <Text style={[text.body, styles.email]}>{user.email}</Text>
        </View>

        {role === "client" ? (
          <Pressable
            accessibilityRole="button"
            style={styles.linkCard}
            onPress={() => router.push("/(client)/firma-bilgileri")}
          >
            <Text style={[text.label, styles.linkText]}>Firma bilgileri</Text>
            <ChevronRight color={tokens.color.primary} size={18} />
          </Pressable>
        ) : null}

        {biometricAvailable ? (
          <View style={styles.card}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabels}>
                <Text style={[text.label, styles.switchTitle]}>Biyometrik kilit</Text>
                <Text style={[text.caption, styles.switchDescription]}>
                  Uygulamayı parmak izi veya yüz tanımayla aç
                </Text>
              </View>
              <Switch
                value={biometricOn}
                onValueChange={handleToggleBiometric}
                trackColor={{ false: tokens.color.border, true: tokens.color.primary }}
              />
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={[text.label, styles.sectionTitle]}>Şifre değiştir</Text>
          <Input
            label="Mevcut şifre"
            value={current}
            onChangeText={(v) => {
              setCurrent(v);
              if (passwordMutation.isSuccess || passwordMutation.isError) passwordMutation.reset();
            }}
            secureTextEntry
            autoComplete="current-password"
            placeholder="••••••••"
          />
          <Input
            label="Yeni şifre"
            value={next}
            onChangeText={(v) => {
              setNext(v);
              setValidationError(null);
              if (passwordMutation.isSuccess || passwordMutation.isError) passwordMutation.reset();
            }}
            secureTextEntry
            autoComplete="new-password"
            placeholder="En az 8 karakter"
          />
          <Input
            label="Yeni şifre (tekrar)"
            value={confirm}
            onChangeText={(v) => {
              setConfirm(v);
              setValidationError(null);
              if (passwordMutation.isSuccess || passwordMutation.isError) passwordMutation.reset();
            }}
            secureTextEntry
            autoComplete="new-password"
            placeholder="••••••••"
          />

          {validationError || passwordMutation.isError ? (
            <Text style={[text.caption, styles.error]}>
              {validationError ??
                apiErrorMessage(passwordMutation.error, {
                  400: "Mevcut şifreniz hatalı",
                  429: "Çok fazla deneme yaptınız — biraz sonra tekrar deneyin",
                })}
            </Text>
          ) : null}
          {passwordMutation.isSuccess ? (
            <Text style={[text.caption, styles.success]}>Şifreniz güncellendi</Text>
          ) : null}

          <Button
            title="Şifreyi Güncelle"
            busyTitle="Güncelleniyor…"
            loading={passwordMutation.isPending}
            onPress={handleChangePassword}
          />
        </View>

        <Button title="Çıkış yap" variant="danger" onPress={() => void signOut()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.color.page },
  content: { gap: tokens.space(3), padding: tokens.space(3), paddingBottom: tokens.space(8) },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: tokens.color.page },
  card: {
    gap: tokens.space(1),
    padding: tokens.space(4),
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.card,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  name: { color: tokens.color.ink },
  role: { color: tokens.color.inkSoft },
  email: { color: tokens.color.inkSoft, marginTop: tokens.space(1) },
  linkCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: tokens.space(4),
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.card,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  linkText: { color: tokens.color.ink },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: tokens.space(3) },
  switchLabels: { flex: 1, gap: tokens.space(0.5) },
  switchTitle: { color: tokens.color.ink },
  switchDescription: { color: tokens.color.inkSoft },
  sectionTitle: { color: tokens.color.ink, marginBottom: tokens.space(1) },
  error: { color: tokens.color.danger },
  success: { color: tokens.color.success },
});
