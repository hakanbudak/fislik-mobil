import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react-native";
import { StyleSheet, Text, View, type ColorValue } from "react-native";
import { listNotifications } from "@/src/api/endpoints";
import { queryKeys } from "@/src/api/queryKeys";
import { tokens } from "@/src/theme/tokens";
import { text } from "@/src/theme/typography";

/**
 * Bell glyph + unread-count badge for the "Bildirimler" tab icon, shared by
 * both role shells (`(client)/_layout.tsx` now, `(accountant)/_layout.tsx`
 * from Task 21) — mirrors `fislik-web/src/components/NotificationBell.tsx`.
 * Reads the same `queryKeys.notifications()` query `bildirimler.tsx` owns,
 * so React Query dedupes them into one shared cache entry: this icon and the
 * open notifications screen always agree, and the 60s `refetchInterval`
 * keeps the count fresh even while the screen itself isn't mounted.
 */
export function NotificationTabIcon({ color, size }: { color: ColorValue; size: number }) {
  const query = useQuery({
    queryKey: queryKeys.notifications(),
    queryFn: listNotifications,
    refetchInterval: 60_000,
  });
  const unreadCount = query.data?.unread_count ?? 0;

  return (
    <View style={styles.wrapper}>
      {/* expo-router's Tabs always supplies a plain hex string here (this
         screen's own tabBarActiveTintColor/InactiveTintColor tokens), never
         an OpaqueColorValue — the cast just matches lucide's narrower prop
         type without re-typing the whole tab-icon contract as ColorValue. */}
      <Bell color={color as string} size={size} />
      {unreadCount > 0 ? (
        <View style={styles.badge}>
          <Text style={[text.caption, styles.badgeText]}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.danger,
  },
  badgeText: { color: tokens.color.onPrimary, fontSize: 9, lineHeight: 11 },
});
