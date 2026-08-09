import { FileText } from "lucide-react-native";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { ReceiptOut } from "@/src/api/endpoints";
import { formatReceiptDay } from "@/src/lib/dates";
import { formatMoney } from "@/src/lib/money";
import { ANALYSIS_LABELS, analysisState } from "@/src/lib/receiptReview";
import { isPdf } from "@/src/lib/receipts";
import { Badge } from "@/src/theme/components/Badge";
import { tokens } from "@/src/theme/tokens";
import { text } from "@/src/theme/typography";

/**
 * Derives the card's badge (label + tone) from the receipt's canonical
 * `AnalysisState` (`src/lib/receiptReview.ts`, ported from the web app).
 *
 * "deferred" and "pending" get the canonical `ANALYSIS_LABELS` text at a
 * neutral tone — nothing is wrong with either, they just haven't produced a
 * result yet. "none" (extraction missing entirely — an old upload predating
 * the AI pipeline) and "failed" both get a warning tone: no analysis is
 * coming on its own for either, so both need the client's attention, even
 * though "none" keeps its own label rather than claiming an analysis
 * "failed" that never ran (see `AnalysisState`'s docstring).
 *
 * "done" with no `total_amount` is a fifth, card-specific case outside
 * `AnalysisState` proper: the analysis pipeline finished but OCR couldn't
 * read an amount, which the web's `ReceiptCard` also flags with its own
 * "Okunamadı" label instead of treating it as a plain success.
 */
function receiptBadge(receipt: ReceiptOut): { label: string; tone: "neutral" | "warning" } | null {
  const state = analysisState(receipt);
  if (state === "deferred") return { label: ANALYSIS_LABELS.deferred, tone: "neutral" };
  if (state === "pending") return { label: ANALYSIS_LABELS.pending, tone: "neutral" };
  if (state === "failed") return { label: ANALYSIS_LABELS.failed, tone: "warning" };
  if (state === "none") return { label: ANALYSIS_LABELS.none, tone: "warning" };
  if (receipt.extraction?.total_amount === null) return { label: "Okunamadı", tone: "warning" };
  return null;
}

export function ReceiptCard({ receipt, onPress }: { receipt: ReceiptOut; onPress: () => void }) {
  const analysis = receiptBadge(receipt);

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
