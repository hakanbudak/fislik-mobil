import { StyleSheet, View } from "react-native";
import type { SubmissionStateOut } from "@/src/api/endpoints";
import { formatDateTime } from "@/src/lib/dates";
import { Badge } from "@/src/theme/components/Badge";
import { Button } from "@/src/theme/components/Button";
import { tokens } from "@/src/theme/tokens";

const LABEL = "Muhasebeciye gönder";

/**
 * The month's send-to-accountant action, shown between the month picker and
 * the locked-month notice on the client home screen. Mirrors
 * `fislik-web/src/pages/ClientHomePage.tsx`'s `submissionQuery.data?.has_accountant`
 * block: nothing renders for a client with no linked accountant, a success
 * badge appears once the month has been sent and can't be re-sent.
 */
export function SubmissionRow({
  state,
  onSubmit,
  busy,
}: {
  state: SubmissionStateOut;
  onSubmit: () => void;
  busy: boolean;
}) {
  if (!state.has_accountant) return null;

  const sent = state.last_sent_at !== null && !state.can_send;

  return (
    <View style={styles.row}>
      {sent && state.last_sent_at ? (
        <Badge tone="success" label={`✓ Gönderildi: ${formatDateTime(state.last_sent_at)}`} />
      ) : (
        <View />
      )}
      <View style={styles.buttonWrap}>
        <Button
          title={LABEL}
          busyTitle="Gönderiliyor…"
          onPress={onSubmit}
          loading={busy}
          disabled={!state.can_send}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: tokens.space(2) },
  buttonWrap: { alignSelf: "flex-start" },
});
