import { apiFetch } from "./client";
import type { components } from "./generated/schema";

export type UserOut = components["schemas"]["UserOut"];
export type AuthOut = components["schemas"]["AuthOut"];
// Hand-declared, not generated: the OpenAPI schema types UserOut.role (and
// RegisterIn.role) as a bare `string`, so there's nothing to pull this union
// from. This is a deliberate, temporary exception to "API payload types are
// never hand-written" — replace it with a generated type if the backend
// ever tightens that schema to a Literal/enum.
export type Role = "client" | "accountant";

export type UploadOut = components["schemas"]["UploadOut"];
export type ReceiptOut = components["schemas"]["ReceiptOut"];
export type SummaryOut = components["schemas"]["SummaryOut"];
export type PeriodLockOut = components["schemas"]["PeriodLockOut"];
export type SubmissionStateOut = components["schemas"]["SubmissionStateOut"];
export type ExtractionOut = components["schemas"]["ExtractionOut"];
export type ExtractionPatchIn = components["schemas"]["ExtractionPatchIn"];
export type CreditsOut = components["schemas"]["CreditsOut"];

/**
 * Step 1 of the upload handshake: reserves a receipt row and a presigned R2
 * PUT url. `client_id` is set only when an accountant uploads on a client's
 * behalf — matches `fislik-web/src/lib/upload.ts`'s `prepareUpload`.
 */
export function createUpload(data: {
  content_type: string;
  period?: string;
  client_id?: string;
}): Promise<UploadOut> {
  return apiFetch<UploadOut>("/receipts/uploads", { method: "POST", body: JSON.stringify(data) });
}

/**
 * Step 3 of the upload handshake: confirms the bytes landed in R2. The
 * returned receipt's `period` may differ from the one requested at
 * `createUpload` time — the API re-files uploads aimed at a locked month
 * into the next open one.
 */
export function completeUpload(receiptId: string, data: { size_bytes?: number }): Promise<ReceiptOut> {
  return apiFetch<ReceiptOut>(`/receipts/${receiptId}/complete`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * The caller's own monthly analysis-credit balance. An accountant's uploads
 * on a client's behalf (`client_id` in `createUpload`) are paid out of THIS
 * balance, not the client's — mirrors `fislik-web/src/api/endpoints.ts`'s
 * `getCredits`, queried from `ClientHomePage`/`AccountantMonthPage` there.
 */
export function getCredits(): Promise<CreditsOut> {
  return apiFetch<CreditsOut>("/credits/me");
}

export function listReceipts(period: string): Promise<ReceiptOut[]> {
  return apiFetch<ReceiptOut[]>(`/receipts?period=${encodeURIComponent(period)}`);
}

export function receiptsSummary(period: string, clientId?: string): Promise<SummaryOut> {
  const params = new URLSearchParams({ period });
  if (clientId) params.set("client_id", clientId);
  return apiFetch<SummaryOut>(`/receipts/summary?${params.toString()}`);
}

/**
 * The API does not block uploads into a locked month — it re-files them into
 * the next open one. Callers must reflect that (a notice, not a guard), see
 * `app/(client)/(fisler)/index.tsx`. This query itself must also fail soft: an API
 * that predates the endpoint 404s, and that must read as "not locked" rather
 * than break the screen — see the 404 handling in the home screen's query.
 */
export function periodLockStatus(period: string, clientId?: string): Promise<PeriodLockOut> {
  const params = new URLSearchParams({ period });
  if (clientId) params.set("client_id", clientId);
  return apiFetch<PeriodLockOut>(`/receipts/period-lock?${params.toString()}`);
}

/**
 * Closes a month for a specific client — the API stops the client from
 * deleting, editing or re-filing receipts already in this period, and any
 * new upload aimed at it gets re-filed into the next open month instead
 * (see `completeUpload`'s note); it does NOT block the upload itself. The
 * accountant may keep editing throughout. Mirrors
 * `fislik-web/src/api/endpoints.ts`'s `lockPeriod`.
 */
export function lockPeriod(clientId: string, period: string): Promise<PeriodLockOut> {
  return apiFetch<PeriodLockOut>(`/clients/${clientId}/periods/${period}/lock`, { method: "POST" });
}

/** Reopens a previously-closed month. Mirrors `fislik-web/src/api/endpoints.ts`'s `unlockPeriod`. */
export function unlockPeriod(clientId: string, period: string): Promise<void> {
  return apiFetch<void>(`/clients/${clientId}/periods/${period}/lock`, { method: "DELETE" });
}

/**
 * Submission-to-accountant endpoints, added ahead of Task 13's UI so the
 * home screen's test mocks (which reference `getSubmissionState`) resolve
 * against a real module. Task 13 builds the submit button and status row on
 * top of these; this task only wires the plumbing.
 */
export function getSubmissionState(period: string): Promise<SubmissionStateOut> {
  return apiFetch<SubmissionStateOut>(`/receipts/submission?period=${encodeURIComponent(period)}`);
}

export function submitReceipts(period: string): Promise<SubmissionStateOut> {
  return apiFetch<SubmissionStateOut>("/receipts/submit", {
    method: "POST",
    body: JSON.stringify({ period }),
  });
}

/**
 * Sends only the fields the caller changed — the API records an `edited`
 * flag on the receipt, so PATCHing untouched fields back would wrongly mark
 * an unedited receipt as hand-verified. `ExtractionEditor` owns the diffing.
 */
export function patchExtraction(receiptId: string, data: ExtractionPatchIn): Promise<ExtractionOut> {
  return apiFetch<ExtractionOut>(`/receipts/${receiptId}/extraction`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/** Re-queues a failed extraction; the API returns it in its `pending` state. */
export function retryExtraction(receiptId: string): Promise<ExtractionOut> {
  return apiFetch<ExtractionOut>(`/receipts/${receiptId}/extraction/retry`, { method: "POST" });
}

/**
 * Re-files a receipt into a different month. The caller owns invalidating
 * BOTH the old and new period's `queryKeys.receipts`/`summary`/`submission`
 * — this endpoint only ever touches one receipt row.
 */
export function changePeriod(receiptId: string, period: string): Promise<ReceiptOut> {
  return apiFetch<ReceiptOut>(`/receipts/${receiptId}`, {
    method: "PATCH",
    body: JSON.stringify({ period }),
  });
}

export function deleteReceipt(receiptId: string): Promise<void> {
  return apiFetch<void>(`/receipts/${receiptId}`, { method: "DELETE" });
}

/**
 * Auth endpoints. `login`/`register` return `AuthOut` — the full user plus a
 * raw `access_token` — because native has no usable cookie jar; the server
 * also sets a cookie alongside the token, but mobile ignores it and persists
 * `access_token` itself via `AuthProvider`'s `saveSession` call.
 */
export function login(data: { email: string; password: string }): Promise<AuthOut> {
  return apiFetch<AuthOut>("/auth/login", { method: "POST", body: JSON.stringify(data) });
}

export function register(data: {
  email: string;
  password: string;
  full_name: string;
  role: Role;
  invite_token?: string;
}): Promise<AuthOut> {
  return apiFetch<AuthOut>("/auth/register", { method: "POST", body: JSON.stringify(data) });
}

/**
 * Clears the server-side cookie only — there is no token revocation, so the
 * caller (`AuthProvider.signOut`) must clear local storage regardless of
 * whether this call succeeds.
 */
export function logout(): Promise<void> {
  return apiFetch<void>("/auth/logout", { method: "POST" });
}

export function getMe(): Promise<UserOut> {
  return apiFetch<UserOut>("/auth/me");
}

export type ChangePasswordIn = components["schemas"]["ChangePasswordIn"];

/** Profile-page password change. A wrong `current_password` 400s — see
 *  `apiErrorMessage`'s override in `app/(client)/profil.tsx`. */
export function changePassword(data: ChangePasswordIn): Promise<void> {
  return apiFetch<void>("/auth/change-password", { method: "POST", body: JSON.stringify(data) });
}

export function requestPasswordReset(email: string): Promise<void> {
  return apiFetch<void>("/auth/password-reset/request", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
  return apiFetch<void>("/auth/password-reset/confirm", {
    method: "POST",
    body: JSON.stringify({ token, new_password: newPassword }),
  });
}

export type InviteInfoOut = components["schemas"]["InviteInfoOut"];
export type GrantOut = components["schemas"]["GrantOut"];

/**
 * Invitations run in both directions — a client can invite an accountant and
 * an accountant can invite a client — so `invited_role`/`inviter_role` drive
 * the screen, never an assumption baked in here. `client_name` is a legacy
 * alias of `inviter_name`; callers should use `inviter_name`.
 */
export function getInviteInfo(token: string): Promise<InviteInfoOut> {
  return apiFetch<InviteInfoOut>(`/grants/invite/${token}`);
}

/**
 * Accepts a pending invite for a visitor who is ALREADY signed in with the
 * matching role — no registration needed, just consent. Mirrors
 * `fislik-web/src/pages/InviteAcceptPage.tsx`'s `acceptInviteByToken`.
 */
export function acceptInviteByToken(token: string): Promise<GrantOut> {
  return apiFetch<GrantOut>(`/grants/invite/${token}/accept`, { method: "POST" });
}

/** Lists every grant the caller is party to, either direction, any status. */
export function listGrants(): Promise<GrantOut[]> {
  return apiFetch<GrantOut[]>("/grants");
}

/**
 * Sends a fresh invite to `email`. The invited role is inferred server-side
 * from the caller's own role (a client inviting an accountant, or vice
 * versa) — there is nothing else for the caller to specify.
 */
export function inviteCounterpart(email: string): Promise<GrantOut> {
  return apiFetch<GrantOut>("/grants", { method: "POST", body: JSON.stringify({ email }) });
}

/** Consents to a pending grant the caller was invited into. */
export function acceptGrant(grantId: string): Promise<GrantOut> {
  return apiFetch<GrantOut>(`/grants/${grantId}/accept`, { method: "POST" });
}

/** Declines a pending grant the caller was invited into. */
export function declineGrant(grantId: string): Promise<void> {
  return apiFetch<void>(`/grants/${grantId}/decline`, { method: "POST" });
}

/** Revokes an active grant, either direction — the caller owns ending it. */
export function revokeGrant(grantId: string): Promise<void> {
  return apiFetch<void>(`/grants/${grantId}`, { method: "DELETE" });
}

export type CompanyOut = components["schemas"]["CompanyOut"];
export type CompanyIn = components["schemas"]["CompanyIn"];

/**
 * The caller's own tax-certificate (vergi levhası) profile — read by their
 * accountant when filing. A 404 means the profile was never filled in, not
 * an error; callers should treat it the same way `app/(client)/firma-bilgileri.tsx`
 * treats `useMe`'s 401 handling, i.e. resolve to `null` rather than surface
 * a query error. Mirrors `fislik-web/src/pages/CompanyPage.tsx`.
 */
export function getCompany(): Promise<CompanyOut> {
  return apiFetch<CompanyOut>("/company");
}

/** Upserts the caller's company profile — there is no separate create/update
 *  endpoint, `PUT /company` does both. */
export function saveCompany(data: CompanyIn): Promise<CompanyOut> {
  return apiFetch<CompanyOut>("/company", { method: "PUT", body: JSON.stringify(data) });
}

/** An accountant's read of a specific client's company profile. */
export function getClientCompany(clientId: string): Promise<CompanyOut> {
  return apiFetch<CompanyOut>(`/clients/${clientId}/company`);
}

export type ClientSummaryOut = components["schemas"]["ClientSummaryOut"];

/** An accountant's own client roster for the given month — `receipt_count`,
 *  `unprocessed_count` and `last_upload_at` all vary by `period`, so callers
 *  must key their query on it too (see `queryKeys.clients`). */
export function listClients(period: string): Promise<ClientSummaryOut[]> {
  return apiFetch<ClientSummaryOut[]>(`/clients?period=${encodeURIComponent(period)}`);
}

/**
 * An accountant's view of one client's receipts for a month — same shape as
 * `listReceipts` but scoped to a specific client rather than the caller's
 * own uploads. Mirrors `fislik-web/src/api/endpoints.ts:164-171`.
 */
export function clientReceipts(clientId: string, period: string): Promise<ReceiptOut[]> {
  return apiFetch<ReceiptOut[]>(`/clients/${clientId}/receipts?period=${encodeURIComponent(period)}`);
}

/** Marks a single receipt processed. No body — both ids travel in the path.
 *  Mirrors `fislik-web/src/api/endpoints.ts:173-181`. */
export function markProcessed(clientId: string, receiptId: string): Promise<void> {
  return apiFetch<void>(`/clients/${clientId}/receipts/${receiptId}/processed`, { method: "POST" });
}

/** Clears a single receipt's processed mark.
 *  Mirrors `fislik-web/src/api/endpoints.ts:196-204`. */
export function unmarkProcessed(clientId: string, receiptId: string): Promise<void> {
  return apiFetch<void>(`/clients/${clientId}/receipts/${receiptId}/processed`, { method: "DELETE" });
}

/**
 * Marks every receipt in `period` processed in one call. `period` travels in
 * the JSON body here — NOT the query string, unlike the unmark call below.
 * Mirrors `fislik-web/src/api/endpoints.ts:183-194`.
 */
export function bulkMarkProcessed(clientId: string, period: string): Promise<{ marked: number }> {
  return apiFetch<{ marked: number }>(`/clients/${clientId}/receipts/processed`, {
    method: "POST",
    body: JSON.stringify({ period }),
  });
}

/**
 * Clears every receipt's processed mark in `period` in one call. `period`
 * travels in the query string here — NOT the body, unlike the mark call
 * above. Mirrors `fislik-web/src/api/endpoints.ts:206-214`.
 */
export function bulkUnmarkProcessed(clientId: string, period: string): Promise<{ unmarked: number }> {
  return apiFetch<{ unmarked: number }>(
    `/clients/${clientId}/receipts/processed?period=${encodeURIComponent(period)}`,
    { method: "DELETE" },
  );
}

export type IssueOut = components["schemas"]["IssueOut"];

/**
 * Raises an issue against a specific client's receipt — the accountant's
 * "this one is unreadable" / "this belongs to another month" channel.
 * Mirrors `fislik-web/src/api/endpoints.ts`'s `openIssue`. The API 409s
 * when the receipt already has an open issue; see `IssueSection`'s override.
 */
export function openIssue(clientId: string, receiptId: string, message: string): Promise<IssueOut> {
  return apiFetch<IssueOut>(`/clients/${clientId}/receipts/${receiptId}/issues`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

/** Marks an issue resolved. Mirrors `fislik-web/src/api/endpoints.ts`'s `resolveIssue`. */
export function resolveIssue(issueId: string): Promise<void> {
  return apiFetch<void>(`/issues/${issueId}/resolve`, { method: "POST" });
}

export type NotificationOut = components["schemas"]["NotificationOut"];
export type NotificationsPage = components["schemas"]["NotificationsPage"];

/** Both roles' own notifications, newest first, plus the unread count the
 *  tab badge reads. Shared across roles — mirrors `fislik-web/src/api/endpoints.ts`. */
export function listNotifications(): Promise<NotificationsPage> {
  return apiFetch<NotificationsPage>("/notifications");
}

/** `ids: null` marks every notification read; a list marks only those. */
export function markNotificationsRead(ids: string[] | null): Promise<void> {
  return apiFetch<void>("/notifications/read", { method: "POST", body: JSON.stringify({ ids }) });
}
