import { FileText } from "lucide-react-native";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { ReceiptOut } from "@/src/api/endpoints";
import { formatReceiptDay } from "@/src/lib/dates";
import { formatMoney } from "@/src/lib/money";
import { analysisState, mismatchedPeriod } from "@/src/lib/receiptReview";
import { isPdf } from "@/src/lib/receipts";
import { Badge } from "@/src/theme/components/Badge";
import { tokens } from "@/src/theme/tokens";
import { text } from "@/src/theme/typography";

/**
 * Derives the card's analysis badge, mirroring the copy and behaviour of the
 * web's `ReceiptCard` (`fislik-web/src/components/ReceiptCard.tsx`) exactly
 * — NOT the canonical `ANALYSIS_LABELS` from `src/lib/receiptReview.ts`.
 *
 * The web has two separate analysis-state vocabularies: `ANALYSIS_LABELS`
 * drives the accountant's review table, while the receipt card hand-writes
 * its own copy below. That inconsistency exists in the web today and is
 * deliberately propagated here rather than "fixed" — the project's rule is
 * that the web wins screen-by-screen, so this card matches the web's card,
 * and `ANALYSIS_LABELS` is reserved for wherever the web's review-table
 * equivalent lands (Task 22).
 *
 * `extraction === undefined` (never analyzed — an upload from before the AI
 * pipeline existed) deliberately renders NO badge, matching the web exactly.
 * This is not an oversight: putting a warning marker on every legacy
 * receipt would be a scary, unearned signal for something that predates
 * analysis entirely. Do not add one back without re-checking the web card.
 */
function receiptBadge(receipt: ReceiptOut): { label: string; tone: "neutral" | "warning" } | null {
  const state = analysisState(receipt);
  if (state === "pending") return { label: "Analiz ediliyor…", tone: "neutral" };
  if (state === "deferred") return { label: "Sıraya alındı", tone: "neutral" };
  if (state === "failed" || receipt.extraction?.total_amount === null) {
    return { label: "Okunamadı", tone: "warning" };
  }
  // state === "none" (extraction undefined) or "done" with an amount: no badge.
  return null;
}

export function ReceiptCard({ receipt, onPress }: { receipt: ReceiptOut; onPress: () => void }) {
  const analysis = receiptBadge(receipt);
  const wrongMonth = mismatchedPeriod(receipt.extraction?.receipt_date ?? null, receipt.period);
  // Mirrors the web card: the KDV line only appears alongside a successfully
  // read total, and only when vat_total is actually known — a receipt with
  // a total but no VAT figure shows no KDV line at all, not "KDV —".
  const vatTotal =
    receipt.extraction?.status === "done" && receipt.extraction.total_amount !== null
      ? receipt.extraction.vat_total
      : null;

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
        {wrongMonth ? <Badge label="Farklı ay" tone="warning" /> : null}
        {analysis ? <Badge label={analysis.label} tone={analysis.tone} /> : null}
      </View>
      <View style={styles.footer}>
        <Text style={[text.label, styles.merchant]} numberOfLines={1}>
          {receipt.extraction?.merchant_name ?? formatReceiptDay(receipt.created_at)}
        </Text>
        <Text style={[text.body, styles.amount]}>{formatMoney(receipt.extraction?.total_amount ?? null)}</Text>
        {vatTotal !== null ? <Text style={[text.caption, styles.vat]}>{`KDV ${formatMoney(vatTotal)}`}</Text> : null}
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
  vat: { color: tokens.color.inkSoft },
});
