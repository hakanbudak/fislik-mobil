import { ChevronRight } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ClientSummaryOut } from "@/src/api/endpoints";
import { formatLongDate } from "@/src/lib/dates";
import { initials } from "@/src/lib/user";
import { Badge } from "@/src/theme/components/Badge";
import { Card } from "@/src/theme/components/Card";
import { tokens } from "@/src/theme/tokens";
import { text } from "@/src/theme/typography";

/**
 * One row in the accountant's client roster — initials avatar, name, fiş
 * count, an `unprocessed_count` warning badge (only when non-zero — a badge
 * reading "0 işlenmemiş" is noise, not signal) and the last-upload date
 * (omitted entirely when the client has never uploaded, rather than showing
 * a placeholder dash). Mirrors `fislik-web/src/pages/AccountantClientsPage.tsx`'s
 * `ClientRow`.
 */
export function ClientCard({ client, onPress }: { client: ClientSummaryOut; onPress: () => void }) {
  const hasUnprocessed = client.unprocessed_count > 0;

  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card style={styles.card}>
        <View style={styles.avatar}>
          <Text style={[text.label, styles.avatarText]}>{initials(client.full_name)}</Text>
        </View>

        <View style={styles.info}>
          <Text style={[text.label, styles.name]} numberOfLines={1}>
            {client.full_name}
          </Text>
          <View style={styles.metaRow}>
            <Text style={[text.caption, styles.meta]}>{client.receipt_count} fiş</Text>
            {client.last_upload_at ? (
              <Text style={[text.caption, styles.meta]}>
                Son yükleme: {formatLongDate(client.last_upload_at)}
              </Text>
            ) : null}
          </View>
          {hasUnprocessed ? (
            <Badge label={`${client.unprocessed_count} işlenmemiş`} tone="warning" />
          ) : null}
        </View>

        <ChevronRight size={16} color={tokens.color.inkSoft} />
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: tokens.space(3) },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: tokens.radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${tokens.color.primary}1A`,
  },
  avatarText: { color: tokens.color.primary },
  info: { flex: 1, gap: tokens.space(1) },
  name: { color: tokens.color.ink },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space(2) },
  meta: { color: tokens.color.inkSoft },
});
