import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { API_URL, ApiError } from "@/src/api/client";
import { currentToken } from "@/src/auth/session";

/**
 * Thrown when the OS reports no share target is available (e.g. a simulator
 * with no Mail/Files/Drive app configured). Deliberately not an `ApiError` —
 * nothing about this failure is an HTTP status, and `apiErrorMessage`'s
 * status-keyed lookup has no sensible bucket for it.
 */
export class SharingUnavailableError extends Error {
  constructor() {
    super("Bu cihazda dosya paylaşımı kullanılamıyor");
    this.name = "SharingUnavailableError";
  }
}

/**
 * Downloads a client's monthly receipt archive and hands it to the system
 * share sheet — the native equivalent of the web's `<a href={zipUrl}
 * download>` (`fislik-web/src/components/ExportModal.tsx`), which rides on
 * the browser's session cookie. Native has no cookie jar shared with
 * `fetch`, so the URL alone can't carry the token; the request has to go
 * out as an explicit authenticated download instead of a plain link.
 *
 * ## The legacy-API trap
 * `expo-file-system` 57 removed the legacy free functions
 * (`downloadAsync`, `cacheDirectory`, ...) from the main entry point; they
 * are throwing stubs there now (see `legacyWarnings.d.ts`). The current
 * replacement is `File.downloadFileAsync(url, destination, options)`
 * (`node_modules/expo-file-system/build/File.d.ts`), which this module
 * uses, matching `src/upload/capture.ts` (`Directory`/`File`/`Paths`) and
 * `src/upload/uploader.ts` (`File#upload`).
 *
 * One real gap versus the legacy API: `downloadAsync` used to resolve with
 * a `{ status }` result object, so a non-2xx response was just a field to
 * check. `File.downloadFileAsync` instead *rejects* on a non-2xx response
 * with an `UnableToDownload` error "whose message includes the status
 * code" (per its own doc comment) — there is no structured status on the
 * rejection. The 404-vs-other-failure distinction below therefore has to
 * pattern-match the status code out of `error.message`, which is uglier
 * than a status field but is what the current API actually exposes; no
 * `expo-file-system/legacy` fallback was needed.
 *
 * This *was* re-checked for a structured alternative: `expo-file-system`
 * does have one network primitive that resolves (rather than rejects) on a
 * non-2xx response with a real numeric `status` field —
 * `UploadTask#uploadAsync` (`node_modules/expo-file-system/src/NetworkTasks.ts`,
 * used by `src/upload/uploader.ts`/`File#upload`). But that's the upload
 * direction; nothing about it applies to a `GET`. The equivalent download
 * primitive, `DownloadTask` (`File.createDownloadTask(...).downloadAsync()`,
 * same file), was read end to end, including its native implementations
 * (`ios/FileSystemDownloadTask.swift` line ~371:
 * `promise.reject(UnableToDownloadException("server returned HTTP \(httpResponse.statusCode)"))`;
 * `android/.../FileSystemDownloadTask.kt` line ~201:
 * `throw UnableToDownloadException("HTTP ${resp.code}")`) — and it rejects
 * with exactly the same message-only exception shape as
 * `File.downloadFileAsync` (whose own native backends,
 * `ios/FileSystemDownload.swift` and `android/.../FileSystemDownload.kt`,
 * do the identical `UnableToDownloadException("response has status ...")`).
 * Both platforms always fold the status into a free-text message, never a
 * structured field, for every download-shaped primitive in this package.
 * `DownloadTask` would also not change anything: it's the same
 * message-in-an-exception contract, just reached via a task object instead
 * of a static method.
 *
 * `destination` is `Paths.cache` (a directory, not a fixed filename) so the
 * downloaded file is named from the response's `Content-Disposition`
 * header — the API already sets that to
 * `fislik-{client-name-slug}-{period}.zip` (`fislik-api/app/modules/accountant/router.py`),
 * so this picks up the same human-readable name the web download gets
 * rather than inventing its own.
 */
export async function downloadMonthZip(clientId: string, period: string): Promise<void> {
  const url = `${API_URL}/clients/${clientId}/receipts.zip?period=${encodeURIComponent(period)}`;

  let file: File;
  try {
    file = await File.downloadFileAsync(url, Paths.cache, {
      headers: { Authorization: `Bearer ${currentToken() ?? ""}` },
      idempotent: true,
    });
  } catch (error) {
    // No structured status is available here (see the module docstring) —
    // this matches the SDK's own documented contract ("the message includes
    // the status code"), confirmed against both native implementations:
    // iOS's `"server returned HTTP 404"` / `"response has status 404"` and
    // Android's `"HTTP 404"` / `"response has status: 404"`. All of those
    // phrasings contain the status as a plain decimal token, which is what
    // `\b404\b` pins down without over-matching (e.g. a URL substring).
    // A future SDK release that changes this wording — or a platform that
    // phrases it differently — would make an empty month silently look like
    // a generic download failure instead of the correct empty-state message;
    // there is no more precise signal to fall back on with today's API.
    if (error instanceof Error && /\b404\b/.test(error.message)) {
      throw new ApiError(404, "Bu ay için indirilecek fiş yok");
    }
    throw new ApiError(0, "Arşiv indirilemedi");
  }

  if (!(await Sharing.isAvailableAsync())) {
    throw new SharingUnavailableError();
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: "application/zip",
    dialogTitle: `Fişlik ${period}`,
  });
}
