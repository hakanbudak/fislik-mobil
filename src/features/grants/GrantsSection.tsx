import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acceptGrant,
  declineGrant,
  inviteCounterpart,
  listGrants,
  revokeGrant,
  type Role,
} from "@/src/api/endpoints";
import { queryKeys } from "@/src/api/queryKeys";
import { apiErrorMessage } from "@/src/lib/errors";
import { EmptyState } from "@/src/theme/components/EmptyState";
import { ErrorCard } from "@/src/theme/components/ErrorCard";
import { Spinner } from "@/src/theme/components/Spinner";
import { tokens } from "@/src/theme/tokens";
import { GrantCard } from "./GrantCard";
import { IncomingInviteCard } from "./IncomingInviteCard";
import { InviteForm } from "./InviteForm";

// Ported verbatim from the web: client copy from
// `fislik-web/src/pages/AccountantsPage.tsx`, accountant copy from
// `fislik-web/src/pages/AccountantClientsPage.tsx`.
const EMPTY_STATE_COPY: Record<Role, { title: string; description: string }> = {
  client: {
    title: "Henüz muhasebeci eklemedin",
    description: "Muhasebecinizi yukarıdan davet ederek fişlerinizi paylaşmaya başlayın.",
  },
  accountant: {
    title: "Henüz mükellefiniz yok",
    description:
      "Yukarıdan mükellefinizi e-postayla davet edin ya da mükellefinizin kendi hesabından göndereceği daveti kabul edin.",
  },
};

// Invite errors, ported verbatim from both web screens' `apiErrorMessage`
// overrides. 409 is shared; 422 names the role the invited e-mail is
// missing, which differs by who is inviting whom.
const INVITE_ERROR_OVERRIDES: Record<Role, Record<number, string>> = {
  client: {
    409: "Bu e-postaya zaten davet gönderilmiş",
    422: "Bu e-posta bir muhasebeci hesabına ait değil",
  },
  accountant: {
    409: "Bu e-postaya zaten davet gönderilmiş",
    422: "Bu e-posta bir mükellef hesabına ait değil",
  },
};

/**
 * The whole mutual-consent invitations surface — mounted on the client's
 * Muhasebecim screen (`app/(client)/muhasebecim.tsx`) and, from Task 21, on
 * the accountant's Mükellefler screen. `role` only ever changes copy
 * (`InviteForm`'s field label, the empty-state text); the split logic and
 * every mutation are identical for both.
 *
 * The split mirrors `fislik-web/src/pages/AccountantsPage.tsx` exactly: a
 * pending grant the viewer was invited into needs their consent and renders
 * as `IncomingInviteCard`; everything else — active links and the viewer's
 * own outgoing invites still pending — renders as an ordinary `GrantCard`.
 *
 * `showEmptyState` defaults to true (the client screen's only empty state is
 * this one, matching `AccountantsPage.tsx`). The accountant screen passes
 * `false`: `AccountantClientsPage.tsx` has exactly one empty state for the
 * whole page — the client list's — and incoming invitations there render
 * only when non-empty, with no empty state of their own. This is a prop, not
 * a `role`-branch, because it is the mounting screen's layout that decides
 * whether a second empty state belongs here, not the viewer's role.
 *
 * `showActiveGrants` defaults to true, matching the client's Muhasebecim
 * screen: `AccountantsPage.tsx` (the client's view of their accountants)
 * shows active links inline with revoke, so the client mounting is
 * unaffected by this prop's existence. The accountant's Mükellefler screen
 * passes `false`: `AccountantClientsPage.tsx` never lists active grants with
 * revoke on that screen — only incoming pending invites and the viewer's own
 * outgoing pending invites — because active-grant management moved to the
 * dedicated "Mükellefleri yönet" page. Pending outgoing grants still belong
 * to the `own` bucket either way; only the `status === "active"` ones are
 * withheld, again as a prop rather than a `role`-branch, since it's the
 * mounting screen's layout deciding this, not the viewer's role.
 */
export function GrantsSection({
  role,
  showEmptyState = true,
  showActiveGrants = true,
}: {
  role: Role;
  showEmptyState?: boolean;
  showActiveGrants?: boolean;
}) {
  const queryClient = useQueryClient();
  const grantsQuery = useQuery({ queryKey: queryKeys.grants(), queryFn: listGrants, retry: false });

  const [email, setEmail] = useState("");
  const inviteMutation = useMutation({
    mutationFn: (email: string) => inviteCounterpart(email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.grants() });
      setEmail("");
    },
  });

  // An accountant accepting or revoking a grant gains or loses access to
  // that client's receipts, so the accountant's client list must also go
  // stale. A client's own grants never feed that list, so this is a no-op
  // for the client role.
  function invalidateAfterConsentChange() {
    queryClient.invalidateQueries({ queryKey: queryKeys.grants() });
    if (role === "accountant") {
      queryClient.invalidateQueries({ queryKey: queryKeys.clientsAll() });
    }
  }

  const acceptMutation = useMutation({
    mutationFn: (grantId: string) => acceptGrant(grantId),
    onSuccess: invalidateAfterConsentChange,
  });
  const declineMutation = useMutation({
    mutationFn: (grantId: string) => declineGrant(grantId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.grants() }),
  });
  const revokeMutation = useMutation({
    mutationFn: (grantId: string) => revokeGrant(grantId),
    onSuccess: invalidateAfterConsentChange,
  });

  const grants = grantsQuery.data ?? [];
  const incoming = grants.filter((g) => g.direction === "incoming" && g.status === "pending");
  const own = grants.filter((g) => !(g.direction === "incoming" && g.status === "pending"));
  const visibleOwn = showActiveGrants ? own : own.filter((g) => g.status !== "active");
  const consentBusy = acceptMutation.isPending || declineMutation.isPending;
  const emptyCopy = EMPTY_STATE_COPY[role];

  return (
    <View style={styles.container}>
      {incoming.map((grant) => (
        <IncomingInviteCard
          key={grant.id}
          grant={grant}
          onAccept={() => acceptMutation.mutate(grant.id)}
          onDecline={() => declineMutation.mutate(grant.id)}
          busy={consentBusy}
        />
      ))}

      <InviteForm
        role={role}
        email={email}
        onEmailChange={setEmail}
        onSubmit={() => inviteMutation.mutate(email.trim())}
        pending={inviteMutation.isPending}
        error={
          inviteMutation.isError
            ? apiErrorMessage(inviteMutation.error, INVITE_ERROR_OVERRIDES[role])
            : null
        }
      />

      {grantsQuery.isLoading ? (
        <View style={styles.center}>
          <Spinner />
        </View>
      ) : null}

      {grantsQuery.isError ? (
        <ErrorCard message={apiErrorMessage(grantsQuery.error)} onRetry={() => grantsQuery.refetch()} />
      ) : null}

      {showEmptyState && grantsQuery.isSuccess && grants.length === 0 ? (
        <EmptyState title={emptyCopy.title} description={emptyCopy.description} />
      ) : null}

      {visibleOwn.map((grant) => (
        <GrantCard
          key={grant.id}
          grant={grant}
          onRevoke={() => revokeMutation.mutate(grant.id)}
          busy={revokeMutation.isPending}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: tokens.space(3.5) },
  center: { alignItems: "center", justifyContent: "center", padding: tokens.space(6) },
});
