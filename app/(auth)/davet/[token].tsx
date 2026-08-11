import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, SearchX, Users } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { ApiError } from "@/src/api/client";
import { acceptInviteByToken, getInviteInfo, type InviteInfoOut } from "@/src/api/endpoints";
import type { UserOut } from "@/src/api/endpoints";
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
 * `inviter_name` is the field to read; `client_name` is a legacy alias kept
 * only for older API versions, used here only as a fallback in case a
 * response predates `inviter_name`.
 */
function inviterName(invite: InviteInfoOut): string {
  return invite.inviter_name ?? invite.client_name;
}

function homeFor(role: string): "/(accountant)" | "/(client)" {
  return role === "accountant" ? "/(accountant)" : "/(client)";
}

/**
 * Where a visitor lands right after *consenting* to an already-pending
 * invite (as opposed to registering through one) — the screen that shows
 * the relationship they just confirmed, not the bare home route. Mirrors
 * `fislik-web/src/pages/InviteAcceptPage.tsx:62`'s `acceptMutation.onSuccess`,
 * which sends an accountant to `/muhasebeci` (their client list — on the
 * web that IS the accountant's home, per `ROLE_HOME`) and a client to
 * `/muhasebecim` (their accountants page, distinct from `/`, the client's
 * receipt-list home). Mobile has no accountant-side screens yet, so
 * `/(accountant)` stands in as a forward reference the same way it already
 * does everywhere else in this app (see `app/index.tsx`, `kayit.tsx`,
 * `giris.tsx`) — once built it is expected to serve as both the
 * accountant's home and their client list, same as the web.
 */
function destinationAfterConsent(role: string): "/(accountant)" | "/(client)/muhasebecim" {
  return role === "accountant" ? "/(accountant)" : "/(client)/muhasebecim";
}

/**
 * Headline is deliberately generic ("X sizi Fişlik'e davet etti"), not
 * role-branched — invitations run in both directions, but
 * `fislik-web/src/pages/InviteAcceptPage.tsx` (the screen this mirrors)
 * only varies copy by role in the already-signed-in mismatch case, not in
 * this headline. `IncomingInviteCard.tsx` is a different surface (Task 18's
 * in-app card) with its own role-keyed copy — do not conflate the two.
 */
function InviteHeader({ invite, subtitle }: { invite: InviteInfoOut; subtitle: string }) {
  return (
    <View style={styles.header}>
      <View style={styles.iconWrap}>
        <Users size={20} color={tokens.color.primary} />
      </View>
      <View style={styles.headerText}>
        <Text style={[text.title, styles.title]}>{`${inviterName(invite)} sizi Fişlik'e davet etti`}</Text>
        <Text style={[text.caption, styles.subtitle]}>{subtitle}</Text>
      </View>
    </View>
  );
}

/**
 * "How this visitor accepts the invite" when they are NOT signed in: the
 * invite doubles as a registration form, with the e-mail locked to the
 * invite and the role locked to `invited_role`.
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
      router.replace(homeFor(user.role));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <InviteHeader invite={invite} subtitle="Hesabınızı oluşturarak daveti kabul edin." />

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

      <Button
        title="Daveti kabul et"
        busyTitle="Hesap oluşturuluyor…"
        onPress={handleSubmit}
        loading={loading}
        disabled={!canSubmit}
      />
    </>
  );
}

/**
 * "How this visitor accepts the invite" when they are ALREADY signed in:
 * no registration needed, just consent via `POST /grants/invite/{token}/accept`.
 * When the signed-in role doesn't match `invited_role`, there is nothing to
 * accept — explain why instead of offering a dead-end button.
 */
function AcceptInviteByConsenting({
  invite,
  token,
  user,
}: {
  invite: InviteInfoOut;
  token: string;
  user: UserOut;
}) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roleMatches = user.role === invite.invited_role;
  const mismatchMessage =
    invite.invited_role === "accountant"
      ? "Bu davet bir muhasebeci hesabı için; şu an mükellef hesabıyla giriş yapmış durumdasınız."
      : "Bu davet bir mükellef hesabı için; şu an muhasebeci hesabıyla giriş yapmış durumdasınız.";

  async function handleAccept() {
    setError(null);
    setLoading(true);
    try {
      await acceptInviteByToken(token);
      await queryClient.invalidateQueries({ queryKey: ["grants"] });
      router.replace(destinationAfterConsent(user.role));
    } catch (err) {
      setError(
        apiErrorMessage(err, { 404: "Bu davet size ait görünmüyor veya artık geçerli değil." }),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <InviteHeader
        invite={invite}
        subtitle={
          roleMatches
            ? `${user.full_name} olarak giriş yapmış durumdasınız — daveti tek tıkla kabul edebilirsiniz.`
            : mismatchMessage
        }
      />

      {error ? <ErrorCard message={error} /> : null}

      {roleMatches ? (
        <Button
          title="Daveti Kabul Et"
          busyTitle="Kabul ediliyor…"
          onPress={handleAccept}
          loading={loading}
        />
      ) : (
        <Button
          title="Ana sayfaya dön"
          variant="secondary"
          onPress={() => router.replace(homeFor(user.role))}
        />
      )}
    </>
  );
}

function NotFoundState() {
  return (
    <View style={styles.stateCard}>
      <View style={styles.iconWrapCentered}>
        <SearchX size={26} color={tokens.color.primary} />
      </View>
      <Text style={[text.title, styles.stateTitle]}>Davet bulunamadı</Text>
      <Text style={[text.caption, styles.stateSubtitle]}>
        Bu davet bağlantısı geçersiz veya süresi dolmuş olabilir.
      </Text>
      <Button title="Kayıt sayfasına git" onPress={() => router.replace("/kayit")} />
    </View>
  );
}

function LoadFailedState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.stateCard}>
      <View style={styles.iconWrapCentered}>
        <CircleAlert size={26} color={tokens.color.primary} />
      </View>
      <Text style={[text.title, styles.stateTitle]}>Davet yüklenemedi</Text>
      <Text style={[text.caption, styles.stateSubtitle]}>Lütfen tekrar deneyin.</Text>
      <Button title="Tekrar dene" variant="secondary" onPress={onRetry} />
    </View>
  );
}

/**
 * `/davet/:token`, opened from the invitation e-mail's deep link (see
 * `app.config.ts`'s associated domains / intent filters). Fetches the
 * invite once ("who is this invite for") and hands the result to whichever
 * component knows "how this visitor accepts it": `AcceptInviteByConsenting`
 * for an already-signed-in visitor, `AcceptInviteByRegistering` otherwise —
 * both branch on the shared `invite` data, not a rewrite of one another.
 */
export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { status, user } = useAuth();

  const inviteQuery = useQuery({
    queryKey: ["invite", token],
    queryFn: () => getInviteInfo(token ?? ""),
    retry: false,
  });

  function renderContent() {
    if (inviteQuery.isLoading) return null;

    if (!inviteQuery.data) {
      // A 404 means the invite genuinely doesn't exist (or was already
      // used) — a dead end. Any other failure (network blip, 5xx) is
      // transient and gets a retry affordance instead.
      const notFound = inviteQuery.error instanceof ApiError && inviteQuery.error.status === 404;
      return notFound ? <NotFoundState /> : <LoadFailedState onRetry={() => inviteQuery.refetch()} />;
    }

    if (status === "authed" && user) {
      return <AcceptInviteByConsenting invite={inviteQuery.data} token={token ?? ""} user={user} />;
    }

    return <AcceptInviteByRegistering invite={inviteQuery.data} token={token ?? ""} />;
  }

  return (
    <AuthShell>
      <View style={styles.card}>{renderContent()}</View>
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
  stateCard: { alignItems: "center", gap: tokens.space(2) },
  iconWrapCentered: {
    width: 56,
    height: 56,
    borderRadius: tokens.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.surface,
    marginBottom: tokens.space(1),
  },
  stateTitle: { color: tokens.color.ink, textAlign: "center" },
  stateSubtitle: { color: tokens.color.inkSoft, textAlign: "center" },
});
