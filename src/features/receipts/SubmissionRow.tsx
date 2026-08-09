import { Pressable, StyleSheet, Text, View } from "react-native";
import type { SubmissionStateOut } from "@/src/api/endpoints";
import { formatDateTime } from "@/src/lib/dates";
import { Badge } from "@/src/theme/components/Badge";
import { tokens } from "@/src/theme/tokens";
import { text } from "@/src/theme/typography";

const LABEL = "Muhasebeciye gönder";

/**
 * The month's send-to-accountant action, shown between the month picker and
 * the locked-month notice on the client home screen. Mirrors
 * `fislik-web/src/pages/ClientHomePage.tsx`'s `submissionQuery.data?.has_accountant`
 * block: nothing renders for a client with no linked accountant, a success
 * badge appears once the month has been sent and can't be re-sent, and the
 * button's accessible label stays `LABEL` even while its visible text
 * switches to "Gönderiliyor…" — that's why this isn't built on the shared
 * `Button`, which ties `accessibilityLabel` to the visible title.
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
  const disabled = !state.can_send || busy;

  return (
    <View style={styles.row}>
      {sent && state.last_sent_at ? (
        <Badge tone="success" label={`✓ Gönderildi: ${formatDateTime(state.last_sent_at)}`} />
      ) : (
        <View />
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={LABEL}
        accessibilityState={{ disabled, busy }}
        disabled={disabled}
        onPress={onSubmit}
        style={({ pressed }) => [styles.button, { opacity: disabled ? 0.6 : pressed ? 0.85 : 1 }]}
      >
        <Text style={[text.label, styles.buttonText]}>{busy ? "Gönderiliyor…" : LABEL}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: tokens.space(2) },
  button: {
    height: 44,
    borderRadius: tokens.radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: tokens.space(4),
    backgroundColor: tokens.color.primary,
    alignSelf: "flex-start",
  },
  buttonText: { color: tokens.color.onPrimary },
});
