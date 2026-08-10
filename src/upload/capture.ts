import * as DocumentPicker from "expo-document-picker";
import { Directory, File, Paths } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { enqueue, type QueueRecord } from "./queue";
import { drainOnce, type UploadedHandler } from "./worker";

// The cache directory can be evicted by the OS at any time; a queued
// capture has to outlive that, so every capture is persisted here (the
// document directory) rather than left in the cache the camera/picker/
// manipulator APIs hand back their results in.
const CAPTURE_DIR = new Directory(Paths.document, "captures");

function ensureCaptureDir(): void {
  if (!CAPTURE_DIR.exists) CAPTURE_DIR.create({ intermediates: true });
}

function randomFileName(extension: string): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
}

/**
 * Resize + JPEG compression keeps a phone photo well under the API's 15 MB
 * upload limit while staying legible enough for Gemini extraction — the
 * counterpart to what fislik-web does with browser-image-compression
 * (see fislik-web/src/lib/upload.ts).
 *
 * `clientId` is threaded through for Task 24, where an accountant captures
 * on behalf of a client; nothing sets it yet for the client's own capture
 * flow.
 *
 * `onUploaded` is forwarded to the drain this triggers below — without it,
 * `worker.ts`'s `draining` guard means whichever caller's drain wins the
 * race performs the upload with no invalidation handler at all, and since
 * a successful upload removes the queue record, no later drain gets a
 * second chance to invalidate. Same handler `useUploadQueue.ts`'s `retry`
 * threads through; `CaptureScreen` supplies it the same way, binding
 * `invalidateAfterUpload` to its `queryClient`.
 */
export async function captureToQueue(
  uri: string,
  period: string,
  clientId?: string,
  onUploaded?: UploadedHandler,
): Promise<QueueRecord> {
  const compressed = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1600 } }], {
    compress: 0.7,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  ensureCaptureDir();
  const destination = new File(CAPTURE_DIR, randomFileName("jpg"));
  await new File(compressed.uri).copy(destination);

  const record = await enqueue({
    localUri: destination.uri,
    contentType: "image/jpeg",
    period,
    ...(clientId ? { clientId } : {}),
  });
  void drainOnce(onUploaded);
  return record;
}

/** Lets the user pick one or more photos from the library; each goes through the same compress-and-persist pipeline as a camera shot. */
export async function pickFromLibrary(
  period: string,
  clientId?: string,
  onUploaded?: UploadedHandler,
): Promise<QueueRecord[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    quality: 1,
  });
  if (result.canceled) return [];

  const records: QueueRecord[] = [];
  for (const asset of result.assets) {
    records.push(await captureToQueue(asset.uri, period, clientId, onUploaded));
  }
  return records;
}

/**
 * Lets the user pick a PDF receipt. Unlike photos, a PDF is copied into the
 * persistent capture directory unchanged — there is nothing to compress —
 * and enqueued with `contentType: "application/pdf"`.
 */
export async function pickDocument(
  period: string,
  clientId?: string,
  onUploaded?: UploadedHandler,
): Promise<QueueRecord | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "application/pdf",
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;

  const asset = result.assets[0];
  ensureCaptureDir();
  const destination = new File(CAPTURE_DIR, randomFileName("pdf"));
  await new File(asset.uri).copy(destination);

  const record = await enqueue({
    localUri: destination.uri,
    contentType: "application/pdf",
    period,
    ...(clientId ? { clientId } : {}),
  });
  void drainOnce(onUploaded);
  return record;
}
