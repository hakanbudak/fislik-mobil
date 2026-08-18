import { useQueryClient } from "@tanstack/react-query";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Images, Paperclip, X } from "lucide-react-native";
import { useRef, useState } from "react";
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { captureToQueue, pickDocument, pickFromLibrary } from "@/src/upload/capture";
import { invalidateAfterUpload } from "@/src/upload/invalidateAfterUpload";
import { discardIfSafe, type QueueRecord } from "@/src/upload/queue";
import type { UploadedHandler } from "@/src/upload/worker";
import { Button } from "@/src/theme/components/Button";
import { EmptyState } from "@/src/theme/components/EmptyState";
import { formatPeriodLabel } from "@/src/lib/period";
import { tokens } from "@/src/theme/tokens";
import { text } from "@/src/theme/typography";

/**
 * A capture is confirmed with the receipt itself, not a counter: taking a
 * photo shows it full-screen with "Bir tane daha çek" / "Sil" / "Bitti", so
 * the user sees the shot succeeded instead of guessing from a digit in the
 * corner. "Bir tane daha çek" switches into burst mode — the old
 * behaviour, shutter stays live for rapid consecutive shots, each one
 * enqueued without stopping for confirmation — because someone who has
 * explicitly asked for speed doesn't want to stop at every frame. In burst
 * mode (and for gallery/PDF picks, which the OS picker already confirms on
 * its own) the corner pill is replaced by a strip of thumbnails.
 *
 * `captureToQueue` enqueues a shot the instant it's taken (see
 * src/upload/capture.ts) — the confirmation screen is shown *after* that,
 * so "Sil" has to actively undo the enqueue, not just remove the shot from
 * local state. It uses `discardIfSafe` from `src/upload/queue.ts` rather
 * than the queued-receipt cards' plain `removeRecord` (`useUploadQueue.ts`'s
 * `discard`): offered here, at the instant of capture, "Sil" is far more
 * likely to land while the record is still mid-upload than it is on a
 * card encountered later, and `removeRecord` doesn't check status before
 * deleting — see `discardIfSafe`'s docstring for what that would silently
 * get wrong.
 *
 * Shared by two routes: `app/(client)/kamera.tsx` (a client's own capture,
 * always the current month, no `clientId`) and
 * `app/(accountant)/(mukellefler)/mukellef/[clientId]/kamera.tsx` (an accountant capturing
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
  // The shot awaiting confirmation ("Bir tane daha çek" / "Sil" / "Bitti").
  // Only ever set by a single-shot camera capture — burst-mode shots and
  // gallery/PDF picks go straight into `shots` without pausing here.
  const [pendingShot, setPendingShot] = useState<QueueRecord | null>(null);
  // Set when "Sil" couldn't do what it looked like it did — the record was
  // already uploaded, is mid-upload, or the discard call itself failed.
  // Shown on the confirmation screen instead of silently doing nothing.
  const [discardNotice, setDiscardNotice] = useState<string | null>(null);
  // Once true (via "Bir tane daha çek"), the shutter stays live for
  // consecutive shots and never shows the confirmation screen again this
  // session.
  const [burst, setBurst] = useState(false);
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
        if (!burst) {
          setDiscardNotice(null);
          setPendingShot(record);
        }
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

  function handleAnotherShot() {
    setBurst(true);
    setPendingShot(null);
    setDiscardNotice(null);
  }

  async function handleDiscard() {
    if (!pendingShot || busy) return;
    setBusy(true);
    setDiscardNotice(null);
    try {
      const outcome = await discardIfSafe(pendingShot.id);
      if (outcome === "removed") {
        const discardedId = pendingShot.id;
        setShots((prev) => prev.filter((s) => s.id !== discardedId));
        setPendingShot(null);
      } else if (outcome === "already-uploaded") {
        setDiscardNotice("Bu fiş zaten gönderildi.");
      } else {
        setDiscardNotice("Fiş şu anda yükleniyor, işlem bitmeden silinemez.");
      }
    } catch {
      setDiscardNotice("Fiş silinemedi, tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  }

  if (pendingShot) {
    return (
      <View style={styles.container}>
        <Image
          source={{ uri: pendingShot.localUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kapat"
          style={styles.close}
          hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
          onPress={onClose}
        >
          <X color={tokens.color.onPrimary} size={24} />
        </Pressable>

        <View style={styles.confirmActions}>
          {discardNotice ? (
            <Text style={[text.caption, styles.discardNoticeText]}>{discardNotice}</Text>
          ) : null}
          <Button title="Bir tane daha çek" variant="secondary" onPress={handleAnotherShot} disabled={busy} />
          <Button title="Sil" variant="danger" onPress={() => void handleDiscard()} disabled={busy} />
          <Button title="Bitti" onPress={onClose} disabled={busy} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      {/*
        Purely visual guidance for aligning the receipt — constrains and
        triggers nothing. Till-receipt rolls are standardised in width
        (80mm most commonly, 57/58mm also in use) but not in length, which
        depends on how many line items printed. Two open vertical rails
        mark where the paper's left/right edges should sit; deliberately
        NOT a closed box, so a three-item receipt and a thirty-item one
        both read as "correctly placed" instead of one being asked to
        stretch into a fixed-height frame it doesn't fill.
      */}
      <View pointerEvents="none" style={styles.frameGuide} testID="frame-guide">
        <View style={styles.frameGuideRailLeft} />
        <View style={styles.frameGuideRailRight} />
      </View>

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
        {shots.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbStrip}>
            {shots.map((shot) => (
              <Image key={shot.id} source={{ uri: shot.localUri }} style={styles.thumb} />
            ))}
          </ScrollView>
        ) : null}

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
  // Positioning box for the two rails below — an unstyled container so the
  // rails themselves are the only thing drawn. `top` clears the close
  // button/on-behalf banner (both end well within the top 14% of any
  // real device height); `bottom` leaves room for the bottom bar,
  // including its thumbnail strip once shots exist.
  frameGuide: {
    position: "absolute",
    top: "14%",
    bottom: "30%",
    left: tokens.space(8),
    right: tokens.space(8),
  },
  // Two vertical rails, not a closed box: the receipt's width is
  // standardised (80mm most commonly) but its length depends on line-item
  // count, so only the left/right edges get a guide. Open top and bottom
  // so both a short and a long receipt read as correctly aligned.
  frameGuideRailLeft: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 2,
    backgroundColor: tokens.color.viewfinderGuide,
  },
  frameGuideRailRight: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: 2,
    backgroundColor: tokens.color.viewfinderGuide,
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
  thumbStrip: { maxHeight: 56 },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: tokens.radius.md,
    marginRight: tokens.space(2),
    backgroundColor: tokens.color.surface,
  },
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
  confirmActions: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: tokens.space(5),
    paddingBottom: tokens.space(8),
    paddingTop: tokens.space(4),
    gap: tokens.space(2.5),
    backgroundColor: tokens.color.scrim,
  },
  discardNoticeText: { color: tokens.color.onPrimary, textAlign: "center" },
});
