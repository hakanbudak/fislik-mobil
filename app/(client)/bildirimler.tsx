import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react-native";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { listNotifications, markNotificationsRead, type NotificationOut } from "@/src/api/endpoints";
import { queryKeys } from "@/src/api/queryKeys";
import { formatDateTime } from "@/src/lib/dates";
import { apiErrorMessage } from "@/src/lib/errors";
import { notificationText } from "@/src/features/notifications/notificationText";
import { EmptyState } from "@/src/theme/components/EmptyState";
import { ErrorCard } from "@/src/theme/components/ErrorCard";
import { Spinner } from "@/src/theme/components/Spinner";
import { tokens } from "@/src/theme/tokens";
import { text } from "@/src/theme/typography";

function NotificationRow({ notification }: { notification: NotificationOut }) {
  return (
    <View style={[styles.row, !notification.read && styles.rowUnread]}>
      <View style={styles.iconChip}>
        <Bell size={16} color={tokens.color.primary} strokeWidth={2} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[text.label, styles.rowText]}>{notificationText(notification)}</Text>
        <Text style={[text.caption, styles.rowDate]}>{formatDateTime(notification.created_at)}</Text>
      </View>
      {!notification.read ? <View style={styles.dot} /> : null}
    </View>
  );
}

/**
 * "Bildirimler" tab — role-agnostic (both `(client)` and the future
 * `(accountant)` shell re-export this same screen, see Task 21). Mirrors
 * `fislik-web/src/pages/NotificationsPage.tsx`: same query, same 60s poll,
 * same "mark everything read once per mount, only if something was unread
 * when data first loaded" behavior so the tab badge (`NotificationsBadge`,
 * read by both role shells) clears without hiding items the user hasn't
 * actually seen yet.
 *
 * Unlike the web, rows here are not tappable deep links — none of the
 * notification-target routes (e.g. an accountant's client month view) exist
 * on mobile yet, so a row is a plain read/unread line, matching what the web
 * itself falls back to for a notification whose payload can't support a
 * target.
 */
export default function BildirimlerScreen() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.notifications(),
    queryFn: listNotifications,
    refetchInterval: 60_000,
  });

  const hasMarkedRef = useRef(false);
  useEffect(() => {
    if (hasMarkedRef.current || !query.data) return;
    hasMarkedRef.current = true;
    if (query.data.unread_count === 0) return;
    markNotificationsRead(null).then(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
    });
  }, [query.data, queryClient]);

  const items = query.data?.items ?? [];

  return (
    <View style={styles.page}>
      <Text style={[text.title, styles.title]}>Bildirimler</Text>

      {query.isLoading ? (
        <View style={styles.center}>
          <Spinner />
        </View>
      ) : null}

      {query.isError ? (
        <View style={styles.center}>
          <ErrorCard message={apiErrorMessage(query.error)} onRetry={() => query.refetch()} />
        </View>
      ) : null}

      {query.isSuccess && items.length === 0 ? (
        <EmptyState title="Henüz bildirim yok" description="Yeni bir şey olduğunda burada göreceksin." />
      ) : null}

      {query.isSuccess && items.length > 0 ? (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <NotificationRow notification={item} />}
          contentContainerStyle={styles.list}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.color.page, padding: tokens.space(3), gap: tokens.space(3) },
  title: { color: tokens.color.ink },
  center: { alignItems: "center", justifyContent: "center", padding: tokens.space(6) },
  list: { gap: tokens.space(2), paddingBottom: tokens.space(6) },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space(3),
    padding: tokens.space(3),
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.card,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  rowUnread: { backgroundColor: tokens.color.surface },
  iconChip: {
    width: 34,
    height: 34,
    borderRadius: tokens.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.card,
  },
  rowBody: { flex: 1, gap: tokens.space(0.5) },
  rowText: { color: tokens.color.ink },
  rowDate: { color: tokens.color.inkSoft },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.color.primary },
});
