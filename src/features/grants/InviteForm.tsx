import { StyleSheet, Text, View } from "react-native";
import type { Role } from "@/src/api/endpoints";
import { Button } from "@/src/theme/components/Button";
import { Card } from "@/src/theme/components/Card";
import { ErrorCard } from "@/src/theme/components/ErrorCard";
import { Input } from "@/src/theme/components/Input";
import { tokens } from "@/src/theme/tokens";
import { text } from "@/src/theme/typography";

/**
 * Copy differs only by which role is doing the inviting — `GrantsSection` is
 * mounted on both the client's Muhasebecim screen and (Task 21) the
 * accountant's Mükellefler screen, and nothing else about this form should
 * need to change between them.
 */
const ROLE_COPY: Record<
  Role,
  { emailLabel: string; placeholder: string; title: string; subtitle: string }
> = {
  client: {
    emailLabel: "Mali müşavir e-postası",
    placeholder: "muhasebeci@ornek.com",
    title: "Muhasebecinizi davet edin",
    subtitle: "E-posta adresini girin; davet bağlantısıyla hesabına bağlansın ve fişlerinizi görsün.",
  },
  accountant: {
    emailLabel: "Mükellef e-postası",
    placeholder: "mukellef@ornek.com",
    title: "Mükellefinizi davet edin",
    subtitle: "E-posta adresini girin; davet bağlantısıyla hesabına bağlansın ve fişlerini paylaşsın.",
  },
};

export function InviteForm({
  role,
  email,
  onEmailChange,
  onSubmit,
  pending,
  error,
}: {
  role: Role;
  email: string;
  onEmailChange: (value: string) => void;
  onSubmit: () => void;
  pending: boolean;
  error: string | null;
}) {
  const copy = ROLE_COPY[role];

  function handleSubmit() {
    if (!email.trim()) return;
    onSubmit();
  }

  return (
    <Card style={styles.card}>
      <View>
        <Text style={[text.label, styles.title]}>{copy.title}</Text>
        <Text style={[text.caption, styles.subtitle]}>{copy.subtitle}</Text>
      </View>
      <Input
        label={copy.emailLabel}
        value={email}
        onChangeText={onEmailChange}
        placeholder={copy.placeholder}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      {error ? <ErrorCard message={error} /> : null}
      <Button title="Davet Gönder" busyTitle="Gönderiliyor…" loading={pending} onPress={handleSubmit} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: tokens.space(3.5) },
  title: { color: tokens.color.ink },
  subtitle: { marginTop: tokens.space(1), color: tokens.color.inkSoft },
});
