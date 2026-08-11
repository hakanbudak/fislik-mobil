import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { listGrants, revokeGrant } from "@/src/api/endpoints";
import { queryKeys } from "@/src/api/queryKeys";
import { GrantCard } from "@/src/features/grants/GrantCard";
import { apiErrorMessage } from "@/src/lib/errors";
import { EmptyState } from "@/src/theme/components/EmptyState";
import { ErrorCard } from "@/src/theme/components/ErrorCard";
import { Spinner } from "@/src/theme/components/Spinner";
import { tokens } from "@/src/theme/tokens";
import { text } from "@/src/theme/typography";

/**
 * "Mükellefleri yönet" — the accountant's active-grant management page,
 * reached from the "Mükellefleri yönet" entry on `app/(accountant)/index.tsx`.
 *
 * This is where the revoke control (`GrantCard`'s "Erişimi iptal et") now
 * lives for the accountant role. It used to sit on the Mükellefler screen
 * itself, mounted via the whole `<GrantsSection role="accountant" />`, but
 * that swept in active grants the web's `AccountantClientsPage.tsx` never
 * shows there — every client appeared twice: once as a `GrantCard` with
 * revoke, once as a `ClientCard` below with that month's upload status.
 * `GrantsSection`'s `showActiveGrants={false}` (see its docstring) now keeps
 * active grants off that screen; this page is where they moved.
 *
 * Deliberately not just `<GrantsSection role="accountant" showActiveGrants />`
 * — that would also drag along incoming pending invites, the invite form and
 * outgoing pending invites, none of which belong on a page whose only job is
 * revoking existing access. So this page owns its own grants query and
 * revoke mutation rather than reusing `GrantsSection` wholesale; the
 * duplication against `GrantsSection`'s own query/mutation is small and
 * deliberate, not an oversight.
 */
export default function ManageClientsScreen() {
  const queryClient = useQueryClient();
  const grantsQuery = useQuery({ queryKey: queryKeys.grants(), queryFn: listGrants, retry: false });

  const revokeMutation = useMutation({
    mutationFn: (grantId: string) => revokeGrant(grantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.grants() });
      queryClient.invalidateQueries({ queryKey: queryKeys.clientsAll() });
    },
  });

  const grants = grantsQuery.data ?? [];
  const active = grants.filter((g) => g.status === "active");

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Geri dön"
          onPress={() => router.back()}
          style={styles.iconButton}
        >
          <ArrowLeft size={18} color={tokens.color.inkSoft} />
        </Pressable>
        <Text style={[text.title, styles.title]} numberOfLines={1}>
          Mükellefleri yönet
        </Text>
      </View>

      <ScrollView style={styles.page} contentContainerStyle={styles.content}>
        {grantsQuery.isLoading ? (
          <View style={styles.center}>
            <Spinner />
          </View>
        ) : null}

        {grantsQuery.isError ? (
          <ErrorCard message={apiErrorMessage(grantsQuery.error)} onRetry={() => grantsQuery.refetch()} />
        ) : null}

        {grantsQuery.isSuccess && active.length === 0 ? (
          <EmptyState title="Henüz mükellefiniz yok" description="Aktif mükellefiniz olduğunda burada listelenir." />
        ) : null}

        {active.map((grant) => (
          <GrantCard
            key={grant.id}
            grant={grant}
            onRevoke={() => revokeMutation.mutate(grant.id)}
            busy={revokeMutation.isPending}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.color.page },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space(2),
    padding: tokens.space(3),
    paddingBottom: 0,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.card,
  },
  title: { flex: 1, color: tokens.color.ink },
  page: { flex: 1 },
  content: { gap: tokens.space(3), padding: tokens.space(3), paddingBottom: tokens.space(8) },
  center: { alignItems: "center", justifyContent: "center", padding: tokens.space(6) },
});
