import { UserPlus } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import type { GrantOut } from "@/src/api/endpoints";
import { Button } from "@/src/theme/components/Button";
import { Card } from "@/src/theme/components/Card";
import { tokens } from "@/src/theme/tokens";
import { text } from "@/src/theme/typography";

/**
 * A pending grant the current user was INVITED into, awaiting their consent —
 * rendered on the client's Muhasebecim screen and the accountant's
 * Mükellefler screen alike. `invited_role` tells whose consent this is (it
 * always equals the viewer's role here), which picks the explanatory copy.
 * Ported verbatim from `fislik-web/src/components/IncomingInviteCard.tsx`.
 */
export function IncomingInviteCard({
  grant,
  onAccept,
  onDecline,
  busy,
}: {
  grant: GrantOut;
  onAccept: () => void;
  onDecline: () => void;
  busy: boolean;
}) {
  const name = grant.counterpart_name ?? grant.counterpart_email;
  const copy =
    grant.invited_role === "accountant"
      ? "fiş ve faturalarını sizinle paylaşmak için sizi muhasebecisi olarak eklemek istiyor."
      : "muhasebeciniz olarak fiş ve faturalarınızı Fişlik üzerinden toplamak istiyor.";

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <UserPlus size={20} color={tokens.color.primary} />
        </View>
        <Text style={[text.body, styles.copy]}>
          <Text style={styles.name}>{name}</Text> {copy}
        </Text>
      </View>
      <View style={styles.actions}>
        <View style={styles.button}>
          <Button title="Kabul Et" busyTitle="İşleniyor…" loading={busy} onPress={onAccept} />
        </View>
        <View style={styles.button}>
          <Button title="Reddet" variant="secondary" disabled={busy} onPress={onDecline} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: tokens.space(3.5), borderColor: tokens.color.primary },
  row: { flexDirection: "row", alignItems: "flex-start", gap: tokens.space(3) },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: tokens.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.surface,
  },
  copy: { flex: 1, color: tokens.color.inkSoft },
  name: { fontFamily: text.label.fontFamily, color: tokens.color.ink },
  actions: { flexDirection: "row", gap: tokens.space(2.5) },
  button: { flex: 1 },
});
