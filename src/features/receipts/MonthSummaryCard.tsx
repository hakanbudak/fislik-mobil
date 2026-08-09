import { StyleSheet, Text, View } from "react-native";
import type { SummaryOut } from "@/src/api/endpoints";
import { formatMoney } from "@/src/lib/money";
import { Card } from "@/src/theme/components/Card";
import { tokens } from "@/src/theme/tokens";
import { text } from "@/src/theme/typography";

/**
 * Monthly totals strip. `summary.payment_method_totals` is intentionally not
 * rendered here — the Turkish payment-method labels (`PAYMENT_LABELS`) are
 * ported in Task 15; adding a second, duplicate label map here now would
 * only drift from that one later.
 */
export function MonthSummaryCard({ summary }: { summary: SummaryOut }) {
  return (
    <Card style={styles.card}>
      <View style={styles.stat}>
        <Text style={[text.caption, styles.label]}>FİŞ SAYISI</Text>
        <Text style={[text.title, styles.value]}>{summary.receipt_count}</Text>
      </View>
      <View style={styles.stat}>
        <Text style={[text.caption, styles.label]}>TOPLAM</Text>
        <Text style={[text.title, styles.value]}>{formatMoney(summary.total_amount)}</Text>
      </View>
      <View style={styles.stat}>
        <Text style={[text.caption, styles.label]}>KDV</Text>
        <Text style={[text.title, styles.value]}>{formatMoney(summary.vat_total)}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", gap: tokens.space(5) },
  stat: { gap: tokens.space(0.5) },
  label: { color: tokens.color.inkSoft, letterSpacing: 0.3 },
  value: { color: tokens.color.ink },
});
