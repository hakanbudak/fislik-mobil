import { useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { getInviteInfo, type InviteInfoOut } from "@/src/api/endpoints";
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
 * Invitations run in both directions — a client can invite an accountant, or
 * an accountant can invite a client — so the headline is worded from
 * `invited_role` (who the visitor is becoming), not hardcoded to
 * "muhasebeci". `inviter_name` is the field to read; `client_name` on
 * `InviteInfoOut` is a legacy alias kept only for older API versions and
 * must not be used. Mirrors `fislik-web/src/components/IncomingInviteCard.tsx`'s
 * role-keyed phrasing, adapted to the "not signed in yet" register form
 * (`fislik-web/src/pages/InviteAcceptPage.tsx`).
 */
function inviteHeadline(invite: InviteInfoOut): string {
  return invite.invited_role === "accountant"
    ? `${invite.inviter_name} sizi mali müşaviri olarak davet etti.`
    : `${invite.inviter_name} sizi mükellefi olarak davet etti.`;
}

/**
 * "How this visitor accepts the invite" when they are not signed in yet: the
 * invite doubles as a registration form, with the e-mail locked to the
 * invite and the role locked to `invited_role`. Kept as its own component,
 * separate from "who is this invite for" (`inviteHeadline` + the fetch in
 * `InviteScreen`), so Task 18's "already signed in, just consent" branch can
 * be added as a sibling component picked by `useAuth().status`, rather than
 * a rewrite of this one.
 */
function AcceptInviteByRegistering({ invite, token }: { invite: InviteInfoOut; token: string }) {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = fullName.trim() !== "" && password !== "";

  async function handleSubmit() {
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı`);
      return;
    }
    setLoading(true);
    try {
      const user = await signUp({
        email: invite.invited_email,
        password,
        full_name: fullName,
        role: invite.invited_role,
        invite_token: token,
      });
      router.replace(user.role === "accountant" ? "/(accountant)" : "/(client)");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Users size={20} color={tokens.color.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={[text.title, styles.title]}>{inviteHeadline(invite)}</Text>
          <Text style={[text.caption, styles.subtitle]}>Hesabınızı oluşturarak daveti kabul edin.</Text>
        </View>
      </View>

      {error ? <ErrorCard message={error} /> : null}

      <Input label="Ad Soyad" value={fullName} onChangeText={setFullName} placeholder="Ayşe Yıldırım" />
      <Input label="E-posta" value={invite.invited_email} editable={false} />
      <Input
        label="Şifre"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="••••••••"
      />

      <Button title="Daveti kabul et" onPress={handleSubmit} loading={loading} disabled={!canSubmit} />
    </>
  );
}

/**
 * `/davet/:token`, opened from the invitation e-mail's deep link (see
 * `app.config.ts`'s associated domains / intent filters). Fetches the
 * invite once ("who is this invite for") and hands the result to whichever
 * component knows "how this visitor accepts it" — today that's always
 * `AcceptInviteByRegistering`, since Task 7 predates the already-signed-in
 * consent path Task 18 adds.
 */
export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();

  const inviteQuery = useQuery({
    queryKey: ["invite", token],
    queryFn: () => getInviteInfo(token ?? ""),
    retry: false,
  });

  return (
    <AuthShell>
      <View style={styles.card}>
        {inviteQuery.isError ? (
          <ErrorCard message="Bu davet geçersiz veya süresi dolmuş." />
        ) : inviteQuery.data ? (
          <AcceptInviteByRegistering invite={inviteQuery.data} token={token ?? ""} />
        ) : null}
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
