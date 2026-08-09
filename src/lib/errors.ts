import { ApiError, NetworkError } from "../api/client";

/** Shared Turkish copy per HTTP status, used when a screen has no more specific override.
 *  Ported verbatim from fislik-web/src/lib/errors.ts — keep in sync. */
const DEFAULT_MESSAGES: Record<number, string> = {
  400: "İstek geçersiz.",
  401: "Oturumun sona ermiş. Lütfen tekrar giriş yap.",
  403: "Bu işlem için yetkin yok.",
  404: "Kayıt bulunamadı.",
  409: "Bu işlem zaten yapılmış.",
  422: "Gönderilen bilgiler geçersiz.",
};

const FALLBACK_MESSAGE = "Bir şeyler ters gitti. Lütfen tekrar dene.";
const NETWORK_MESSAGE = "Bağlantı hatası. İnternetini kontrol edip tekrar dene.";

/**
 * Turkish, user-facing copy for an API failure — the single place every
 * screen should go through instead of rendering `ApiError.detail` (a
 * backend-authored string not meant for end users) or hand-rolling its own
 * status-code switch. `overrides` lets a screen supply its own copy for a
 * specific status (e.g. login's 401 "E-posta veya şifre hatalı"); anything
 * not overridden falls back to the shared default map, then to a generic
 * message. `error.detail` is never surfaced here — it's only logged via
 * `console.error` for debugging.
 *
 * Mobile also has a `NetworkError` (thrown by `apiFetch` when the request
 * never reaches the server) that the web version has no counterpart for —
 * it gets the web's own network-failure copy.
 */
export function apiErrorMessage(error: unknown, overrides?: Record<number, string>): string {
  if (error instanceof ApiError) {
    console.error(error.detail);
    return overrides?.[error.status] ?? DEFAULT_MESSAGES[error.status] ?? FALLBACK_MESSAGE;
  }
  if (error instanceof NetworkError) {
    return NETWORK_MESSAGE;
  }
  return FALLBACK_MESSAGE;
}
