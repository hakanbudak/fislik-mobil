# Fişlik Mobile — Design

**Date:** 2026-08-07
**Status:** Approved

## Context

Fişlik lets a small business (mükellef, role `client`) share receipt photos with
its accountant (mali müşavir, role `accountant`). Two projects exist today:

- **fislik-api** — FastAPI + PostgreSQL + Cloudflare R2 + Gemini extraction.
  Modules: `auth`, `receipts`, `grants`, `accountant`, `company`, `issues`,
  `extraction`, `notifications`. Deployed on Coolify at
  `https://fislik-api.selamet.dev`.
- **fislik-web** — Vite + React 19 + TypeScript + Tailwind 4 PWA, deployed on
  Vercel at `https://fislik.selamet.dev`.

This spec covers **fislik-mobil**, a native iOS + Android app that reaches
feature parity with the web app for both roles, and adds the capabilities only a
native app can provide: in-app burst camera capture, an offline upload queue,
and biometric unlock.

## Goals

- Feature parity with fislik-web for both the client and the accountant role.
- A capture flow that is genuinely faster than the web PWA: open the app, shoot
  several receipts in a row, walk away — uploads finish in the background.
- Receipts captured without connectivity are never lost.
- Ship to the App Store and Play Store.

## Non-goals (deliberately out of scope)

Push notifications, localisation beyond Turkish, dark theme, tablet layouts.
The existing in-app `notifications` module is surfaced as a list only; no push
delivery channel is added.

## Decisions

| Topic | Decision |
| --- | --- |
| Roles | Both client and accountant, at parity with web |
| Stack | Expo (React Native) + expo-router, TypeScript |
| Auth | Add `Authorization: Bearer` support to the API; token stored in `expo-secure-store` |
| Native features | Burst camera capture, offline upload queue, biometric unlock |
| Design language | Port the web visual language; native navigation patterns |
| ZIP export | Download to device, then open the system share sheet |
| Distribution | iOS + Android, EAS Build + Submit to both stores |
| Code organisation | Standalone repo; API types generated from the OpenAPI schema |

### Why these, briefly

**Expo** matches the user's two other mobile projects (`letsraffle-mobile`,
`eczanebul-mobile`) and ships camera, image picking, secure storage, biometrics,
file system, and sharing without native module wiring.

**Bearer over cookies.** The API currently authenticates solely via the
HttpOnly `access_token` cookie (`request.cookies.get` in
`app/core/dependencies.py`). Cookie jars in React Native behave inconsistently
across platforms and are hard to debug. A header-based token is explicit and
costs roughly thirty lines in the API. A refresh-token scheme was considered and
rejected for now: it needs a new table, new endpoints, and web-side changes,
for a security gain that does not yet justify the work.

**Standalone repo with generated types.** A monorepo would share code properly
but requires migrating fislik-web and rebuilding its Vercel setup — a separate
project. Hand-copying `types.ts` would leave the same types maintained in three
places. Generating from `/openapi.json` keeps the API schema as the single
source of truth at near-zero ongoing cost.

## API changes (fislik-api)

All changes are backward compatible; fislik-web is unaffected.

1. **`app/core/dependencies.py`** — `get_current_user` reads
   `Authorization: Bearer <jwt>` first and falls back to the `access_token`
   cookie. The same token format and `decode_token(..., purpose="auth")`
   validation applies to both paths.
2. **`app/modules/auth/router.py`** — `POST /auth/login` and
   `POST /auth/register` include `access_token: str | None` in the response
   body. The `Set-Cookie` response header is still sent, so the web client is
   unchanged and simply ignores the new field.
3. **`POST /auth/logout`** stays as-is (clears the cookie). The mobile client
   additionally deletes its stored token locally.
4. **`GET /clients/{id}/receipts.zip`** needs no change beyond (1) — it
   authenticates through the same dependency, so Bearer works automatically.
5. **CORS and R2** need no change: native requests send no `Origin`, so neither
   the API's `FRONTEND_ORIGIN` policy nor the R2 bucket CORS policy applies to
   presigned `PUT` uploads from the app.
6. **Tests** — extend `tests/test_auth.py` with: Bearer-authenticated request
   succeeds; malformed/expired Bearer is rejected with 401; cookie auth still
   works; Bearer takes precedence when both are present.

## Mobile architecture

```
app/                                 expo-router file-based routes
  (auth)/giris                       login
  (auth)/kayit                       register
  (auth)/sifre-sifirla               password reset request
  (auth)/sifre-sifirla/[token]       password reset confirm
  (auth)/davet/[token]               invite accept (deep link)
  (client)/_layout                   tabs: Fişler, Muhasebecim, Bildirimler, Profil
  (accountant)/_layout               tabs: Mükellefler, Bildirimler, Profil
src/
  api/
    client.ts                        fetch wrapper, Bearer header, ApiError
    endpoints.ts                     typed endpoint functions (ported from web)
    generated/schema.d.ts            openapi-typescript output (do not edit)
  auth/
    session.ts                       token read/write/clear via expo-secure-store
    AuthProvider.tsx                 useMe(), login/logout, role routing
    biometrics.ts                    expo-local-authentication gate
  upload/
    queue.ts                         persistent queue (AsyncStorage + FileSystem)
    uploader.ts                      create → presigned PUT → complete
    useUploadQueue.ts                React binding, optimistic list entries
  theme/
    tokens.ts                        colors/spacing/radii ported from web @theme
    typography.ts                    Plus Jakarta Sans scale
    components/                      Button, Card, Badge, Input, EmptyState, ErrorCard, Spinner
  lib/                               dates, money, period, receipts (ported from web)
```

### Design tokens

Ported verbatim from `fislik-web/src/index.css`'s `@theme` block so the two apps
stay visually identical:

| Token | Value |
| --- | --- |
| `primary` | `#0f766e` |
| `primaryDark` | `#0b5c55` |
| `surface` | `#f5f8f7` |
| `page` | `#e9eeed` |
| `card` | `#ffffff` |
| `ink` | `#0c1a18` |
| `inkSoft` | `#52605e` |
| `success` | `#12a18a` |
| `warning` | `#e08a2b` |
| `danger` | `#c0392b` |
| font | Plus Jakarta Sans (bundled, weights 400–800) |

Icons come from `lucide-react-native`, matching the web app's `lucide-react`.

### Type generation

`npm run gen:api` runs `openapi-typescript` against the API's `/openapi.json`
and writes `src/api/generated/schema.d.ts`. Hand-written types are never used
for API payloads. CI regenerates and fails if the checked-in file differs.

## Session flow

1. App launch: read token from SecureStore.
2. No token → `(auth)/giris`.
3. Token present and biometric unlock enabled → prompt with
   `expo-local-authentication`; on cancel, show a "use password instead" path
   that clears the session and returns to login.
4. Validate with `GET /auth/me`; route to `(client)` or `(accountant)` by
   `user.role`.
5. Any `401` from any request clears the stored token and returns to
   `(auth)/giris`.

Biometric unlock is opt-in, toggled on the profile screen, and stores only a
boolean preference — the token itself is always in SecureStore.

## Upload flow (client role)

This is the app's core mechanism.

1. **Capture.** The camera screen stays open across shots. Each shutter press
   compresses the image with `expo-image-manipulator` (the counterpart to the
   web app's `browser-image-compression`, respecting the API's
   `MAX_UPLOAD_BYTES`, 15 MB), writes it to a persistent app directory, and
   appends a queue record. A thumbnail strip and counter show progress. Gallery
   and PDF selection via `expo-image-picker` / `expo-document-picker` enter the
   same queue.
2. **Enqueue.** A record is `{ id, localUri, contentType, period, status,
   attempts, receiptId?, uploadUrl? }` persisted in AsyncStorage; the file
   itself lives in FileSystem. The queue survives app restarts.
3. **Process.** A single worker drains the queue in order:
   `POST /receipts/uploads` → presigned `PUT` to R2 → `POST /receipts/{id}/complete`
   → delete the local file → invalidate the TanStack Query cache for that period.
   Each step is resumable: a record that already has a `receiptId` skips step
   one.
4. **Retry.** Failures leave the record `pending` with an incremented attempt
   count and retry with exponential backoff. `expo-network` connectivity
   restoration triggers an immediate drain. After five attempts the record
   becomes `failed` and the user retries or discards it manually.
5. **Display.** Queued records render at the top of the receipt list with an
   "uploading" badge, above server-returned receipts, so the user always sees
   what is still in flight.

## Screens

### Client (mükellef)

| Screen | Content | API |
| --- | --- | --- |
| Fişler (home) | Month picker, monthly summary card (count, total, VAT), receipt list, camera FAB | `GET /receipts?period`, `GET /receipts/summary?period` |
| Kamera | Burst capture, thumbnail strip, gallery/PDF picker | upload queue |
| Fiş detayı | Pinch-zoom image, extraction fields (merchant, date, total, VAT breakdown, doc type), edit, change period, delete, open issue card | `PATCH /receipts/{id}/extraction`, `PATCH /receipts/{id}`, `DELETE /receipts/{id}` |
| Muhasebecim | Active/pending grants, invite by e-mail, revoke access | `GET/POST/DELETE /grants` |
| Firma bilgileri | Tax office, VKN/TCKN, address, activity code, etc. | `GET/PUT /company` |
| Bildirimler | Notification list, mark read | `GET /notifications`, `POST /notifications/read` |
| Profil | Name, role, biometric toggle, sign out | `GET /auth/me` |

### Accountant (mali müşavir)

| Screen | Content | API |
| --- | --- | --- |
| Mükellefler | Month picker, client cards (receipt count, unprocessed badge, last upload) | `GET /clients?period` |
| Mükellef ayı | Receipt grid, mark/unmark processed (single and bulk), client company info, ZIP export | `GET /clients/{id}/receipts`, `POST|DELETE /clients/{id}/receipts/processed`, `POST|DELETE /clients/{id}/receipts/{receiptId}/processed`, `GET /clients/{id}/company` |
| Fiş detayı | Same detail screen, plus report issue / resolve issue | `POST /clients/{id}/receipts/{receiptId}/issues`, `POST /issues/{id}/resolve` |
| Bildirimler, Profil | Shared with the client role | — |

### ZIP export

`GET /clients/{id}/receipts.zip?period=` is fetched with the Bearer header via
`expo-file-system`'s download API into the app cache, then handed to
`expo-sharing`. The user saves it to Files, mails it, or sends it to Drive. A
404 (no receipts that month) surfaces as an empty-state message rather than an
error.

### Deep links

The app registers `fislik.selamet.dev` as an associated domain (iOS universal
links) and an Android app link, so `/davet/:token` and `/sifre-sifirla/:token`
open in the app when installed and fall back to the web app otherwise.

## Error handling

- `ApiError(status, detail)` is preserved from the web client; the API's Turkish
  `detail` string is shown to the user.
- Network failures and server errors are worded differently ("İnternet bağlantısı
  yok" vs. the API's message) so the user knows whether to retry.
- Screen-level query errors render `ErrorCard` with a retry action.
- `401` clears the session (see Session flow).
- Upload failures never interrupt the UI — they stay visible in the queue.
- A root `ErrorBoundary` renders a recovery screen instead of a blank view.

## Testing

- **Unit:** Jest + `@testing-library/react-native`. Priority order: `upload/queue.ts`
  (ordering, persistence across restart, retry/backoff, resumability),
  `auth/session.ts`, `lib/` (dates, money, period, receipts), `api/client.ts`
  (Bearer header, `ApiError` mapping, 204 handling).
- **Contract:** MSW-mocked endpoints, mirroring fislik-web's existing setup.
- **CI:** GitHub Actions running `tsc --noEmit`, lint, tests, `expo-doctor`, and
  a check that the generated OpenAPI types are up to date.
- **Manual, both platforms:** camera burst, offline queue (airplane mode, force
  quit and relaunch), biometric unlock, ZIP share, deep links.

## Release preparation

App icon and splash derived from `fislik-web/public/icons` and `FislikMark`;
Turkish camera/photo-library permission strings; privacy policy URL; EAS build
profiles for development, preview (internal distribution), and production;
EAS Submit configured for both stores.
