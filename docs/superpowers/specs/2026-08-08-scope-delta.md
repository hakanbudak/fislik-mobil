# Scope delta — what the 2026-08-07 spec missed

**Date:** 2026-08-08
**Cause:** the original spec and plans were derived from local checkouts that were 17 (fislik-api) and 22 (fislik-web) commits behind `origin/main`.
**Status:** input to the spec revision; not itself a spec.

The route table is unchanged — 15 screens, same paths, same two shells. Nothing
new to navigate to. What changed is what those screens now do.

## 1. Grants became mutual-consent and bidirectional

The original spec described a one-way flow: a client invites an accountant by
e-mail, the accountant registers through the link, done.

Now:

| Endpoint | Purpose |
| --- | --- |
| `POST /grants` (`inviteCounterpart`) | Either role invites the other |
| `POST /grants/{id}/accept` | Recipient accepts an in-app invitation |
| `POST /grants/{id}/decline` | Recipient declines |
| `POST /grants/invite/{token}/accept` | Accept via e-mail link |
| `DELETE /grants/{id}` | Revoke |

`GrantOut` gained `direction: "incoming" | "outgoing"`, `counterpart_name`,
`counterpart_email`, and `invited_role`. `InviteInfoOut` gained `inviter_name`,
`inviter_role`, `invited_role` (`client_name` is now a legacy alias).

Consequences: the accountant role needs an invitations surface too (the web has
`IncomingInviteCard`), and both roles need accept/decline. The original plan's
Task 15 modelled the client side only, with the wrong endpoint name.

## 2. Monthly submission flow

`GET /receipts/submission?period=` → `SubmissionStateOut { last_sent_at,
can_send, active_receipt_count, has_accountant }`, and `POST /receipts/submit`.

The client explicitly "sends" a month's receipts to their accountant rather than
the accountant simply seeing whatever was uploaded. This is a primary action on
the client home screen and the original spec has no equivalent.

## 3. Period locks

`GET /receipts/period-lock?…` → `PeriodLockOut { locked, locked_at }`;
`PUT`/`DELETE /clients/{clientId}/periods/{period}/lock`.

An accountant locks a month once it is filed. A locked month must block upload,
edit, delete and period changes on the client side — which touches the capture
flow, the upload queue (a queued capture whose period is locked must not be
uploaded), and the receipt detail screen.

## 4. Analysis credits and deferred extraction

`GET /credits/me` → `CreditsOut { limit, used, remaining, unlimited }`.

`ReceiptOut.extraction === null` now specifically means **deferred** — the
month's credit limit is exhausted and the receipt is queued for next month —
which is different from `extraction.status === "pending"` (analysis running).
The original spec treated `null` as "no data", which would show the wrong state.

## 5. Extraction gained six accounting fields

`merchant_tax_id`, `merchant_tax_id_type` (`vkn` | `tckn`), `merchant_tax_office`,
`receipt_number`, `payment_method` (`nakit` | `kredi_karti` | `bilinmiyor`),
`expense_category` (ten Turkish categories: `yemek`, `market`, `yakit`, `ulasim`,
`konaklama`, `ofis`, `teknoloji`, `iletisim`, `saglik`, `diger`).

All are also writable through `ExtractionPatchIn`, so the mobile extraction
editor is roughly twice the form the original plan specified.
`POST /receipts/{id}/extraction/retry` re-runs a failed extraction.

## 6. Accountant-side uploads

`ReceiptOut.uploaded_by` — `null` for the client's own upload, otherwise the
accountant's user id. Accountants can upload on a client's behalf, so the
accountant month screen needs an upload path the original spec did not include.

## 7. Summary gained payment-method totals

`SummaryOut.payment_method_totals?: Record<string, string>`.

## 8. Admin impersonation

`UserOut.impersonated?: boolean`, set on `/auth/me` while an admin drives the
session. The web renders an `ImpersonationBanner`. There is also an admin panel
in both web and API, which is a separate surface.

## 9. Web-side UI work with no mobile equivalent yet

`ReceiptViewer` (inline PDF preview), `ExportModal`, `ClientReceiptDrawer` /
`ReceiptDrawer`, `UploadDropzone`, and `src/lib/receiptReview.ts` (colour-coded
review rows with a legend — worth porting, since it encodes which extraction
fields count as faulty).

## What survives unchanged

Tasks 1–4 and 9 of the mobile plan: the Expo scaffold, the design system, the
API client, session storage, and the ported formatting helpers. None depend on
API shape. `src/api/generated/schema.d.ts` was generated from the live
production API, so it already reflects everything above.

Phases 2 and 3 of the plan (Tasks 10–19) need re-derivation. Phase 1 (Tasks 5–8)
needs one change: registration and invite acceptance must handle both directions.
