import { useQueryClient } from "@tanstack/react-query";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Images, Paperclip, X } from "lucide-react-native";
import { useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { captureToQueue, pickDocument, pickFromLibrary } from "@/src/upload/capture";
import { invalidateAfterUpload } from "@/src/upload/invalidateAfterUpload";
import type { QueueRecord } from "@/src/upload/queue";
import type { UploadedHandler } from "@/src/upload/worker";
import { Button } from "@/src/theme/components/Button";
import { EmptyState } from "@/src/theme/components/EmptyState";
import { formatPeriodLabel } from "@/src/lib/period";
import { tokens } from "@/src/theme/tokens";
import { text } from "@/src/theme/typography";

/**
 * Burst capture: the shutter stays live between shots so the user can shoot
 * several receipts in a row and walk away — captureToQueue persists and
 * enqueues each shot in the background (see src/upload/capture.ts), the
 * screen never blocks on an upload finishing.
 *
 * Shared by two routes: `app/(client)/kamera.tsx` (a client's own capture,
 * always the current month, no `clientId`) and
 * `app/(accountant)/mukellef/[clientId]/kamera.tsx` (an accountant capturing
 * on a client's behalf, Task 24 — `period` is whatever month that client's
 * screen currently has open, not necessarily the current one, since the
 * whole point is filing a shoebox of possibly-old receipts). One
 * implementation on purpose: this is the app's most-used screen, and two
 * copies of a burst camera would only drift apart.
 */
export function CaptureScreen({
  period,
  clientId,
  clientLabel,
  onClose,
}: {
  period: string;
  /** Set only when capturing on a client's behalf (Task 24). */
  clientId?: string;
  /** The client's display name, shown as a reminder banner when `clientId` is set. Ignored otherwise. */
  clientLabel?: string;
  onClose: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [shots, setShots] = useState<QueueRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const queryClient = useQueryClient();

  // Every capture triggers its own drain (below), and `worker.ts`'s
  // `draining` guard means that drain — not the interval's — is often the
  // one that actually performs the upload. Without threading this through,
  // that upload's invalidation never runs (see `src/upload/capture.ts`).
  // Same handler `app/_layout.tsx` wires into `startWorker`.
  const onUploaded: UploadedHandler = (receipt, requestedPeriod, uploadedClientId) =>
    invalidateAfterUpload(queryClient, receipt, requestedPeriod, uploadedClientId);

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <View style={styles.permissionWrapper}>
        <EmptyState
          title="Fiş çekebilmek için kamera izni gerekiyor"
          description="Kamera erişimine izin vermeden fiş fotoğrafı çekemeyiz."
          action={
            permission.canAskAgain ? (
              <Button title="İzin ver" onPress={() => void requestPermission()} />
            ) : (
              <Button title="Ayarları aç" onPress={() => void Linking.openSettings()} />
            )
          }
        />
      </View>
    );
  }

  async function handleShutter() {
    if (busy || !cameraRef.current) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (photo) {
        const record = await captureToQueue(photo.uri, period, clientId, onUploaded);
        setShots((prev) => [...prev, record]);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleLibrary() {
    if (busy) return;
    setBusy(true);
    try {
      const records = await pickFromLibrary(period, clientId, onUploaded);
      if (records.length) setShots((prev) => [...prev, ...records]);
    } finally {
      setBusy(false);
    }
  }

  async function handleDocument() {
    if (busy) return;
    setBusy(true);
    try {
      const record = await pickDocument(period, clientId, onUploaded);
      if (record) setShots((prev) => [...prev, record]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Kapat"
        style={styles.close}
        hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
        onPress={onClose}
      >
        <X color={tokens.color.onPrimary} size={24} />
      </Pressable>

      {clientId && clientLabel ? (
        <View style={styles.onBehalfBanner}>
          <Text style={[text.caption, styles.onBehalfText]} numberOfLines={1}>
            {`${clientLabel} için — ${formatPeriodLabel(period)}`}
          </Text>
        </View>
      ) : null}

      <View style={styles.bottomBar}>
        <View style={styles.thumbStrip}>
          {shots.length > 0 ? (
            <View style={styles.thumbCount}>
              <Text style={[text.label, styles.thumbCountText]}>{shots.length}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.shutterRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Galeriden seç"
            style={[styles.sideAction, busy && styles.sideActionBusy]}
            disabled={busy}
            onPress={() => void handleLibrary()}
          >
            <Images color={tokens.color.onPrimary} size={22} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fotoğraf çek"
            style={[styles.shutter, busy && styles.shutterBusy]}
            disabled={busy}
            onPress={() => void handleShutter()}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="PDF ekle"
            style={[styles.sideAction, busy && styles.sideActionBusy]}
            disabled={busy}
            onPress={() => void handleDocument()}
          >
            <Paperclip color={tokens.color.onPrimary} size={22} />
          </Pressable>
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="Bitir" style={styles.finish} onPress={onClose}>
          <Text style={[text.label, styles.finishText]}>Bitir</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.color.ink },
  permissionWrapper: { flex: 1, justifyContent: "center", backgroundColor: tokens.color.page },
  close: {
    position: "absolute",
    top: tokens.space(4),
    left: tokens.space(4),
    width: 40,
    height: 40,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.scrim,
    alignItems: "center",
    justifyContent: "center",
  },
  onBehalfBanner: {
    position: "absolute",
    top: tokens.space(4),
    left: tokens.space(4) + 40 + tokens.space(2),
    right: tokens.space(4),
    height: 40,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.scrim,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: tokens.space(3),
  },
  onBehalfText: { color: tokens.color.onPrimary },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: tokens.space(5),
    paddingBottom: tokens.space(8),
    paddingTop: tokens.space(4),
    gap: tokens.space(3),
  },
  thumbStrip: { minHeight: 32, flexDirection: "row", alignItems: "center" },
  thumbCount: {
    width: 32,
    height: 32,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbCountText: { color: tokens.color.onPrimary },
  shutterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sideAction: {
    width: 44,
    height: 44,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.scrim,
    alignItems: "center",
    justifyContent: "center",
  },
  sideActionBusy: { opacity: 0.6 },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.onPrimary,
    borderWidth: 4,
    borderColor: tokens.color.onPrimaryMuted,
  },
  shutterBusy: { opacity: 0.6 },
  finish: {
    alignSelf: "flex-end",
    paddingHorizontal: tokens.space(5),
    paddingVertical: tokens.space(2.5),
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.primary,
  },
  finishText: { color: tokens.color.onPrimary },
});
