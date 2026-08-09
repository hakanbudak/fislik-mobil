import { FileText } from "lucide-react-native";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { ReceiptOut } from "@/src/api/endpoints";
import { formatReceiptDay } from "@/src/lib/dates";
import { formatMoney } from "@/src/lib/money";
import { isPdf } from "@/src/lib/receipts";
import { Badge } from "@/src/theme/components/Badge";
import { tokens } from "@/src/theme/tokens";
import { text } from "@/src/theme/typography";

/**
 * Derives a short analysis-state label from `receipt.extraction`. Ported
 * inline from fislik-web/src/components/ReceiptCard.tsx — Task 15 promotes
 * this to a shared `analysisState` helper in `src/lib/receipts.ts`.
 *
 * `extraction === null` means the month's analysis-credit balance was
 * exhausted at upload time, so the receipt is DEFERRED to next month's
 * analysis run — distinct from `status === "pending"` (analysis actively
 * running) and from a missing/legacy `extraction` (`undefined`, no badge).
 */
function analysisLabel(receipt: ReceiptOut): { label: string; tone: "neutral" | "warning" } | null {
  const extraction = receipt.extraction;
  if (extraction === null) return { label: "Sıraya alındı", tone: "neutral" };
  if (extraction === undefined) return null;
  if (extraction.status === "pending") return { label: "Analiz ediliyor", tone: "neutral" };
  if (extraction.status === "failed" || (extraction.status === "done" && extraction.total_amount === null)) {
    return { label: "Okunamadı", tone: "warning" };
  }
  return null;
}

export function ReceiptCard({ receipt, onPress }: { receipt: ReceiptOut; onPress: () => void }) {
  const analysis = analysisLabel(receipt);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Fiş"
      onPress={onPress}
      style={styles.card}
    >
      <View style={styles.thumbWrap}>
        {isPdf(receipt) ? (
          <View style={styles.pdfGlyph}>
            <FileText size={28} color={tokens.color.inkSoft} />
            <Text style={[text.caption, styles.pdfLabel]}>PDF</Text>
          </View>
        ) : (
          <Image source={{ uri: receipt.image_url }} style={styles.thumb} />
        )}
      </View>
      <View style={styles.badges}>
        {receipt.uploaded_by ? <Badge label="Muhasebeci yükledi" tone="neutral" /> : null}
        {receipt.processed ? <Badge label="İşlendi" tone="success" /> : null}
        {receipt.open_issue ? <Badge label="Sorun var" tone="warning" /> : null}
        {analysis ? <Badge label={analysis.label} tone={analysis.tone} /> : null}
      </View>
      <View style={styles.footer}>
        <Text style={[text.label, styles.merchant]} numberOfLines={1}>
          {receipt.extraction?.merchant_name ?? formatReceiptDay(receipt.created_at)}
        </Text>
        <Text style={[text.body, styles.amount]}>{formatMoney(receipt.extraction?.total_amount ?? null)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: tokens.color.card,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.lg,
    overflow: "hidden",
    margin: tokens.space(1),
  },
  thumbWrap: { aspectRatio: 3 / 4, backgroundColor: tokens.color.surface },
  thumb: { width: "100%", height: "100%" },
  pdfGlyph: { flex: 1, alignItems: "center", justifyContent: "center", gap: tokens.space(1) },
  pdfLabel: { color: tokens.color.inkSoft, letterSpacing: 0.5 },
  badges: {
    position: "absolute",
    top: tokens.space(1.5),
    right: tokens.space(1.5),
    gap: tokens.space(1),
    alignItems: "flex-end",
  },
  footer: { padding: tokens.space(2), gap: tokens.space(0.5) },
  merchant: { color: tokens.color.ink },
  amount: { color: tokens.color.inkSoft },
});
