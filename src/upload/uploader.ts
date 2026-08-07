import { File } from "expo-file-system";
import { completeUpload, createUpload, type ReceiptOut } from "@/src/api/endpoints";
import { removeRecord, updateRecord, type QueueRecord } from "./queue";

/**
 * Puts the file's raw bytes to a presigned url. Isolated so the transport
 * can be swapped later.
 *
 * `expo-file-system` 57 removed the legacy `uploadAsync` free function
 * (it's a throwing stub on the main entry point now). `File#upload` is the
 * current replacement: with `uploadType: BINARY_CONTENT` (the default) it
 * sends the file's raw bytes as the request body rather than wrapping them
 * in multipart/form-data — required here because R2 stores the PUT body
 * verbatim and a multipart wrapper would corrupt the object. It also takes
 * a `headers` option to set `Content-Type` and resolves with the response's
 * HTTP `status` for any completed response, including non-2xx, so a failed
 * PUT can be turned into a thrown error by the caller.
 *
 * Rejected alternatives:
 * - `expo-file-system/legacy`'s `uploadAsync` also satisfies all three
 *   requirements (binary body, headers, status), but there is no reason to
 *   reach for the legacy subpath when the current API does the same job.
 * - Plain `fetch` with a body built from `new File(uri)` (which implements
 *   `Blob`) would work in principle, but it reads the whole file into
 *   memory as part of constructing the body rather than streaming it from
 *   disk, which is worse for large receipts than the native upload task.
 */
async function putBinary(uploadUrl: string, localUri: string, contentType: string): Promise<number> {
  const result = await new File(localUri).upload(uploadUrl, {
    httpMethod: "PUT",
    headers: { "Content-Type": contentType },
  });
  return result.status;
}

/**
 * Runs the API's three-step upload handshake for one queued capture: reserve
 * a receipt, PUT the bytes straight to R2 with the presigned url, then
 * confirm. Each step persists its result first, so a crash or a kill resumes
 * rather than duplicating a receipt.
 *
 * Returns the completed receipt. Its `period` is not necessarily the period
 * the capture was queued under — the API re-files uploads aimed at a locked
 * month into the next open one.
 */
export async function uploadRecord(record: QueueRecord): Promise<ReceiptOut> {
  let receiptId = record.receiptId;
  let uploadUrl = record.uploadUrl;

  if (!receiptId || !uploadUrl) {
    const reservation = await createUpload({
      content_type: record.contentType,
      period: record.period,
      ...(record.clientId ? { client_id: record.clientId } : {}),
    });
    receiptId = reservation.receipt_id;
    uploadUrl = reservation.upload_url;
    await updateRecord(record.id, { receiptId, uploadUrl });
  }

  const status = await putBinary(uploadUrl, record.localUri, record.contentType);
  if (status < 200 || status >= 300) {
    throw new Error(`Yükleme başarısız (${status})`);
  }

  const file = new File(record.localUri);
  const receipt = await completeUpload(receiptId, {
    size_bytes: file.exists ? file.size : undefined,
  });
  await removeRecord(record.id);
  return receipt;
}
