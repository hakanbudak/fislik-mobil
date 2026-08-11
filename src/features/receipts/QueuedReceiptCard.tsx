import { Image, StyleSheet, View } from "react-native";
import type { QueueRecord } from "@/src/upload/queue";
import { Badge } from "@/src/theme/components/Badge";
import { Button } from "@/src/theme/components/Button";
import { tokens } from "@/src/theme/tokens";

/**
 * In-flight (not-yet-uploaded) receipt tile, shown inline with server
 * receipts so a capture never seems to vanish while it waits on the queue.
 */
export function QueuedReceiptCard({
  record,
  onRetry,
  onDiscard,
}: {
  record: QueueRecord;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  const failed = record.status === "failed";

  return (
    <View style={styles.card}>
      <Image source={{ uri: record.localUri }} style={styles.thumb} />
      <View style={styles.body}>
        {failed ? (
          <>
            <Badge label="Yüklenemedi" tone="warning" />
            <View style={styles.actions}>
              <Button title="Tekrar dene" variant="secondary" onPress={onRetry} />
              <Button title="Sil" variant="danger" onPress={onDiscard} />
            </View>
          </>
        ) : (
          <Badge label="Yükleniyor" tone="neutral" />
        )}
      </View>
    </View>
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
    opacity: 0.85,
  },
  thumb: { width: "100%", aspectRatio: 3 / 4, backgroundColor: tokens.color.surface },
  body: { padding: tokens.space(2), gap: tokens.space(1.5) },
  actions: { flexDirection: "row", gap: tokens.space(1.5) },
});
