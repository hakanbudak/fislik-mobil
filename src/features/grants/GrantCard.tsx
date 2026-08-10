import { useState } from "react";
import { Clock, UserCheck } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import type { GrantOut } from "@/src/api/endpoints";
import { Badge } from "@/src/theme/components/Badge";
import { Button } from "@/src/theme/components/Button";
import { Card } from "@/src/theme/components/Card";
import { tokens } from "@/src/theme/tokens";
import { text } from "@/src/theme/typography";

/**
 * One non-pending-incoming grant: an active link, or a pending outgoing
 * invite still waiting on the counterpart. These two states must not look
 * the same — the icon and Badge tone differ — mirroring
 * `fislik-web/src/pages/AccountantsPage.tsx`'s `GrantCard`.
 *
 * Revoking is destructive and not obviously reversible, so it sits behind an
 * inline confirmation that names the counterpart, following the pattern
 * already used for receipt deletion (`app/(client)/fis/[id].tsx`) rather than
 * a modal component this app doesn't otherwise have.
 */
export function GrantCard({
  grant,
  onRevoke,
  busy,
}: {
  grant: GrantOut;
  onRevoke: () => void;
  busy: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const isActive = grant.status === "active";
  const displayName = grant.counterpart_name ?? grant.invited_email;

  function handleConfirm() {
    onRevoke();
    setConfirming(false);
  }

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          {isActive ? (
            <UserCheck size={20} color={tokens.color.primary} />
          ) : (
            <Clock size={20} color={tokens.color.warning} />
          )}
        </View>
        <View style={styles.info}>
          <Text style={[text.label, styles.name]}>{displayName}</Text>
          {grant.counterpart_name ? (
            <Text style={[text.caption, styles.email]}>{grant.counterpart_email}</Text>
          ) : null}
        </View>
        <Badge label={isActive ? "Aktif" : "Bekliyor"} tone={isActive ? "success" : "warning"} />
      </View>

      {confirming ? (
        <View style={styles.confirm}>
          <Text style={[text.body, styles.confirmText]}>
            {displayName} artık erişemeyecek. Bu işlem geri alınamaz.
          </Text>
          <View style={styles.confirmActions}>
            <View style={styles.confirmButton}>
              <Button title="Vazgeç" variant="secondary" onPress={() => setConfirming(false)} />
            </View>
            <View style={styles.confirmButton}>
              <Button
                title="Erişimi kaldır"
                variant="danger"
                busyTitle="Kaldırılıyor…"
                loading={busy}
                onPress={handleConfirm}
              />
            </View>
          </View>
        </View>
      ) : (
        <Button title="Erişimi kaldır" variant="secondary" onPress={() => setConfirming(true)} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: tokens.space(3.5) },
  row: { flexDirection: "row", alignItems: "center", gap: tokens.space(3) },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: tokens.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.surface,
  },
  info: { flex: 1, gap: tokens.space(0.5) },
  name: { color: tokens.color.ink },
  email: { color: tokens.color.inkSoft },
  confirm: { gap: tokens.space(3) },
  confirmText: { color: tokens.color.ink },
  confirmActions: { flexDirection: "row", gap: tokens.space(2.5) },
  confirmButton: { flex: 1 },
});
