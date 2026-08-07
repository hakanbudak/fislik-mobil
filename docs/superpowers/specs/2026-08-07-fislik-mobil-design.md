# Fişlik Mobile — Design

**Date:** 2026-08-07 (revised 2026-08-08)
**Status:** Approved; revised after discovering the original was derived from stale checkouts

> **Revision note.** The first version of this spec was written against local
> working copies that were 17 commits (fislik-api) and 22 commits (fislik-web)
> behind `origin/main`. The route inventory survived that mistake unchanged, but
> most screens had gained substantial behaviour. See
> `2026-08-08-scope-delta.md` for the full list of what was missed. This document
> is the corrected spec; where the two disagree, this one governs.

## Context

Fişlik lets a small business (mükellef, role `client`) share receipt photos with
its accountant (mali müşavir, role `accountant`). Two projects exist today:

- **fislik-api** — FastAPI + PostgreSQL + Cloudflare R2 + Gemini extraction,
  deployed on Coolify at `https://fislik-api.selamet.dev`.
- **fislik-web** — Vite + React 19 + TypeScript + Tailwind 4 PWA, deployed on
  Vercel at `https://fislik.selamet.dev`.

This spec covers **fislik-mobil**, a native iOS + Android app reaching feature
parity with the web app for both roles, plus the capabilities only a native app
provides: in-app burst camera capture, an offline upload queue, and biometric
unlock.

## Goals

- Parity with fislik-web for both roles, measured against the live app.
- A capture flow faster than the web PWA: shoot several receipts in a row and
  walk away while uploads finish in the background.
- Receipts captured without connectivity are never lost.
- Ship to the App Store and Play Store.

## Non-goals

Push notifications, localisation beyond Turkish, dark theme, tablet layouts, and
the admin panel. The in-app `notifications` module is surfaced as a list only.

## Decisions

| Topic | Decision |
| --- | --- |
| Roles | Both client and accountant, at parity with web |
| Stack | Expo (React Native) + expo-router, TypeScript |
| Auth | `Authorization: Bearer` against the API; token in `expo-secure-store` |
| Native features | Burst camera capture, offline upload queue, biometric unlock |
| Design language | Port the web visual language; native navigation patterns |
| ZIP export | Download to device, then open the system share sheet |
| Distribution | iOS + Android, EAS Build + Submit |
| Code organisation | Standalone repo; API types generated from the OpenAPI schema |
| Analysis credits | Surface deferred state only; no credit meter |
| Impersonation | Banner when `/auth/me` reports `impersonated`; no admin surface |

**Why Expo:** matches the user's other mobile projects and ships camera, image
picking, secure storage, biometrics, file system and sharing without native
module wiring.

**Why Bearer over cookies:** cookie jars behave inconsistently across platforms
in React Native and are hard to debug. A header-based token is explicit. A
refresh-token scheme was considered and deferred — see Known gaps.

**Why a standalone repo with generated types:** a monorepo would require
migrating fislik-web and rebuilding its Vercel setup, a separate project.
Hand-copying types would leave the same shapes maintained in three places.
Generating from `/openapi.json` keeps the API as the single source of truth —
and would have caught the stale-checkout mistake sooner.

## API changes (fislik-api)

Implemented on branch `feat/bearer-token-auth`, PR #135, rebased onto current
main. All changes are backward compatible; fislik-web is unaffected.

1. `get_current_user` reads `Authorization: Bearer <jwt>` before falling back to
   the `access_token` cookie. **When the header is present it is the sole
   credential — the cookie is never consulted**, so a malformed or expired
   header fails closed rather than silently authenticating an ambient session.
2. `set_auth_cookie` returns the JWT it set, and `POST /auth/login` /
   `POST /auth/register` respond with `AuthOut` (every `UserOut` field plus
   `access_token`). `Set-Cookie` is unchanged, so the web client ignores it.
3. `/admin/impersonate/{user_id}` is sqladmin-only, `include_in_schema=False`,
   and returns a redirect — out of reach of the native client, deliberately
   untouched.

## Mobile architecture

```
app/                                 expo-router file-based routes
  (auth)/giris | kayit               login, register
  (auth)/sifre-sifirla[/token]       password reset request + confirm
  (auth)/davet/[token]               invite accept (deep link, both roles)
  (client)/_layout                   tabs: Fişler, Muhasebecim, Bildirimler, Profil
  (accountant)/_layout               tabs: Mükellefler, Bildirimler, Profil
src/
  api/          client.ts, endpoints.ts, generated/schema.d.ts, queryKeys.ts
  auth/         session.ts, AuthProvider.tsx, biometrics.ts
  upload/       queue.ts, uploader.ts, worker.ts, capture.ts, useUploadQueue.ts
  theme/        tokens.ts, typography.ts, components/
  lib/          dates, money, period, receipts, receiptReview, user
  features/     receipts/, grants/, clients/, notifications/
```

### Design tokens

Ported verbatim from `fislik-web/src/index.css`'s `@theme` block: `primary
#0f766e`, `primaryDark #0b5c55`, `surface #f5f8f7`, `page #e9eeed`, `card
#ffffff`, `ink #0c1a18`, `inkSoft #52605e`, `success #12a18a`, `warning
#e08a2b`, `danger #c0392b`, plus `onPrimary #ffffff` for foreground-on-fill.
Font: Plus Jakarta Sans via `@expo-google-fonts/plus-jakarta-sans`. Icons from
`lucide-react-native`.

**Formatting must match the web exactly**, because users see both clients:
`formatMoney` renders `₺1.234,50` (symbol prefix), dates render as
`12 Ağustos` / `12 Ağustos 2026`. Implemented manually rather than through
`Intl`, because Hermes may lack full ICU and would silently degrade to
`1,234.50` in a way no test on a Node runner can detect.

## Session flow

1. Read the token from SecureStore.
2. No token → `(auth)/giris`.
3. Token present and biometric unlock enabled → prompt; on cancel, offer sign-out.
4. Validate with `GET /auth/me`; route by `user.role`. If `impersonated` is true,
   render a persistent banner.
5. Any `401` clears the stored token and returns to `(auth)/giris`.

Storage writes go to SecureStore **before** the in-memory mirror is updated, so a
failed write can never leave the app believing it is signed in — or, worse, leave
a token on disk after a sign-out that appeared to succeed.

## Upload flow (client role)

1. **Capture.** The camera stays open across shots. Each shutter compresses with
   `expo-image-manipulator`, writes to a persistent app directory, and appends a
   queue record. Gallery and PDF picking enter the same queue.
2. **Enqueue.** `{ id, localUri, contentType, period, status, attempts,
   receiptId?, uploadUrl? }` in AsyncStorage; the file lives in FileSystem. The
   queue survives restarts.
3. **Process.** One worker drains in order: `POST /receipts/uploads` → presigned
   `PUT` to R2 → `POST /receipts/{id}/complete` → delete the local file →
   invalidate the period's queries. Each step persists before acting, so a crash
   resumes rather than duplicating a receipt.
4. **Retry.** Failures back off exponentially; connectivity restoration triggers
   an immediate drain; after five attempts the record is `failed` and the user
   retries or discards it.
5. **Period locks.** A queued capture whose period has since been locked must not
   upload. The worker checks lock state before draining a record and parks it
   with a clear message rather than burning retries against a guaranteed 4xx.
6. **Display.** Queued records render above server receipts with an "uploading"
   badge.

## Screens

### Client (mükellef)

| Screen | Content | API |
| --- | --- | --- |
| Fişler (home) | Month picker, summary card (count, total, VAT, payment-method breakdown), receipt list, camera FAB, **"Muhasebecime gönder"** action reflecting submission state, locked-month notice | `GET /receipts`, `/receipts/summary`, `/receipts/submission`, `POST /receipts/submit`, `GET /receipts/period-lock` |
| Kamera | Burst capture, thumbnail strip, gallery/PDF picker | upload queue |
| Fiş detayı | Zoomable image or inline PDF, extraction fields, edit, retry failed extraction, change period, delete — all disabled when the period is locked | `PATCH /receipts/{id}/extraction`, `POST /receipts/{id}/extraction/retry`, `PATCH`/`DELETE /receipts/{id}` |
| Muhasebecim | Outgoing and **incoming** invitations, accept/decline, revoke, invite by e-mail | `GET/POST/DELETE /grants`, `POST /grants/{id}/accept`, `/decline` |
| Firma bilgileri | Tax office, VKN/TCKN, address, activity code | `GET/PUT /company` |
| Bildirimler | List, mark read | `GET /notifications`, `POST /notifications/read` |
| Profil | Name, role, **change password**, biometric toggle, sign out | `GET /auth/me`, `POST /auth/change-password` |

### Accountant (mali müşavir)

| Screen | Content | API |
| --- | --- | --- |
| Mükellefler | Month picker, client cards (counts, unprocessed badge, last upload), **incoming invitations** | `GET /clients`, `/grants` |
| Mükellef ayı | Receipt grid, mark/unmark processed (single and bulk), company info, **upload on the client's behalf**, **lock/unlock the month**, ZIP export | `GET /clients/{id}/receipts`, `POST|DELETE .../processed`, `PUT|DELETE /clients/{id}/periods/{period}/lock`, `/receipts.zip` |
| Fiş detayı | Same as the client's, plus report/resolve issue | `POST /clients/{id}/receipts/{rid}/issues`, `POST /issues/{id}/resolve` |
| Bildirimler, Profil | Shared with the client role | — |

### Extraction editor

Now covers: merchant name, receipt date, total, VAT total, VAT breakdown, doc
type, **merchant tax id + type (VKN/TCKN), merchant tax office, receipt number,
payment method (nakit / kredi_karti / bilinmiyor), and expense category** (ten
Turkish categories). Port `fislik-web/src/lib/receiptReview.ts` so the mobile app
flags questionable fields the same way the web does.

**Extraction states, which are not the same thing:**
- `extraction.status === "pending"` — analysis is running.
- `extraction === null` — **deferred**: the month's analysis credit is exhausted
  and the receipt is queued for next month. Say so plainly rather than showing an
  empty form.
- `extraction.status === "failed"` — offer retry.

### ZIP export

Fetched with the Bearer header via `expo-file-system`, then handed to
`expo-sharing`. A 404 means the month has no receipts and renders as an empty
state, not an error.

### Deep links

`fislik.selamet.dev` registered as an iOS associated domain and Android app
link, so `/davet/:token` and `/sifre-sifirla/:token` open in the app when
installed and fall back to the web app otherwise. Invite acceptance must handle
both directions: a client inviting an accountant and an accountant inviting a
client.

## Error handling

`ApiError(status, detail)` carries the API's Turkish `detail`; `NetworkError`
is worded distinctly ("İnternet bağlantısı yok") so the user knows whether to
retry. Screen-level errors render `ErrorCard` with a retry. `401` clears the
session. Upload failures stay visible in the queue rather than interrupting the
UI. A root error boundary replaces a blank screen with a recovery view.

## Testing

- **Unit:** Jest + `@testing-library/react-native`, prioritising the upload queue
  (ordering, persistence across restart, retry/backoff, resumability, lock
  handling), session storage, the `lib/` formatters, and the API client.
- **Contract:** MSW-mocked endpoints.
- **CI:** `tsc --noEmit`, lint, tests, `expo-doctor`, `expo export` (which is
  also the only guard that the `@/` alias still resolves at bundler level), and a
  check that the generated OpenAPI types are current.
- **Manual, both platforms:** camera burst, offline queue with force-quit,
  biometric unlock, ZIP share, deep links, locked-month behaviour.

## Known gaps, deliberately deferred

- **No server-side token revocation.** `/auth/logout` only clears the cookie and
  `jwt_expires_days` is 7, so a token handed to a native client stays valid for
  up to a week after sign-out. The token lives in Keychain/Keystore, which
  limits but does not remove the exposure. Revisit after launch — shorter
  expiry, a denylist, or refresh tokens.
- **Admin panel** is web-only by decision.
