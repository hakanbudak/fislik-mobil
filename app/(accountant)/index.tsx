import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { listClients } from "@/src/api/endpoints";
import { queryKeys } from "@/src/api/queryKeys";
import { ClientCard } from "@/src/features/clients/ClientCard";
import { GrantsSection } from "@/src/features/grants/GrantsSection";
import { apiErrorMessage } from "@/src/lib/errors";
import { currentPeriod } from "@/src/lib/period";
import { EmptyState } from "@/src/theme/components/EmptyState";
import { ErrorCard } from "@/src/theme/components/ErrorCard";
import { MonthPicker } from "@/src/theme/components/MonthPicker";
import { Spinner } from "@/src/theme/components/Spinner";
import { tokens } from "@/src/theme/tokens";
import { text } from "@/src/theme/typography";

/**
 * "Mükellefler" screen — the accountant's landing page. Mirrors
 * `fislik-web/src/pages/AccountantClientsPage.tsx`: a month picker driving
 * `listClients(period)`, the mutual-consent invitations surface above the
 * list (here the whole `<GrantsSection role="accountant" />` — Task 18
 * built it role-aware precisely so it slots in here without a second
 * invitations UI, unlike the web page which hand-rolls its own incoming/
 * outgoing invite blocks), then the client roster itself.
 *
 * Tapping a client pushes to `/(accountant)/mukellef/${client_id}` with the
 * currently viewed `period` as a query param — that route is Task 22's
 * per-client month view and does not exist yet, so this push 404s inside
 * expo-router until that task lands. That is expected and intentionally
 * left unstubbed per this task's scope; no placeholder screen is created
 * here.
 */
export default function AccountantClientsScreen() {
  const [period, setPeriod] = useState(currentPeriod());

  const clientsQuery = useQuery({
    queryKey: queryKeys.clients(period),
    queryFn: () => listClients(period),
    retry: false,
  });

  const clients = clientsQuery.data ?? [];

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={[text.title, styles.title]}>Mükellefler</Text>
        <MonthPicker value={period} onChange={setPeriod} />
      </View>

      <GrantsSection role="accountant" />

      {clientsQuery.isLoading ? (
        <View style={styles.center}>
          <Spinner />
        </View>
      ) : null}

      {clientsQuery.isError ? (
        <ErrorCard message={apiErrorMessage(clientsQuery.error)} onRetry={() => clientsQuery.refetch()} />
      ) : null}

      {clientsQuery.isSuccess && clients.length === 0 ? (
        <EmptyState
          title="Henüz mükellefiniz yok"
          description="Yukarıdan mükellefinizi e-postayla davet edin ya da mükellefinizin kendi hesabından göndereceği daveti kabul edin."
        />
      ) : null}

      {clients.map((client) => (
        <ClientCard
          key={client.client_id}
          client={client}
          onPress={() => router.push(`/(accountant)/mukellef/${client.client_id}?period=${period}`)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.color.page },
  content: { gap: tokens.space(3), padding: tokens.space(3), paddingBottom: tokens.space(8) },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: tokens.color.ink },
  center: { alignItems: "center", justifyContent: "center", padding: tokens.space(6) },
});
