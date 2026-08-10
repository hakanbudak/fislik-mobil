/**
 * Contract tests for `src/api/endpoints.ts`, run against a real `apiFetch`
 * with MSW intercepting the network — `@/src/api/endpoints` is NOT mocked
 * here, unlike every screen test in this repo. Screen tests prove a screen
 * reacts correctly to a given response; these prove an endpoint function
 * sends the HTTP request it claims to send (method, path, query string,
 * body, auth header).
 *
 * A prior gap: moving `bulkUnmarkProcessed`'s `period` from the query
 * string into the JSON body left all 19 accountant screen tests green,
 * because those tests mock the endpoint layer away entirely. The API would
 * have silently accepted the malformed call and marked nothing processed.
 * These tests pin the exact wire shape so a regression like that fails here
 * instead of in production.
 */
import { setTokenProvider } from "../client";
import * as endpoints from "../endpoints";
import { captureRequest } from "../testHelpers/mswServer";

describe("processed-marking calls (deliberately non-uniform shapes)", () => {
  test("markProcessed: POST, both ids in the path, no body", async () => {
    const getRequest = captureRequest("post", "/clients/c1/receipts/r1/processed");
    await endpoints.markProcessed("c1", "r1");
    const req = getRequest();
    expect(req.method).toBe("POST");
    expect(req.pathname).toBe("/clients/c1/receipts/r1/processed");
    expect(req.search.toString()).toBe("");
    expect(req.body).toBeUndefined();
  });

  test("unmarkProcessed: DELETE, both ids in the path, no body", async () => {
    const getRequest = captureRequest("delete", "/clients/c1/receipts/r1/processed");
    await endpoints.unmarkProcessed("c1", "r1");
    const req = getRequest();
    expect(req.method).toBe("DELETE");
    expect(req.pathname).toBe("/clients/c1/receipts/r1/processed");
    expect(req.search.toString()).toBe("");
    expect(req.body).toBeUndefined();
  });

  test("bulkMarkProcessed: POST, period in the JSON body, not the query string", async () => {
    const getRequest = captureRequest("post", "/clients/c1/receipts/processed", { marked: 3 });
    await endpoints.bulkMarkProcessed("c1", "2026-08");
    const req = getRequest();
    expect(req.method).toBe("POST");
    expect(req.pathname).toBe("/clients/c1/receipts/processed");
    expect(req.search.has("period")).toBe(false);
    expect(req.body).toEqual({ period: "2026-08" });
  });

  test("bulkUnmarkProcessed: DELETE, period in the query string, not the body", async () => {
    const getRequest = captureRequest("delete", "/clients/c1/receipts/processed", { unmarked: 5 });
    await endpoints.bulkUnmarkProcessed("c1", "2026-08");
    const req = getRequest();
    expect(req.method).toBe("DELETE");
    expect(req.pathname).toBe("/clients/c1/receipts/processed");
    expect(req.search.get("period")).toBe("2026-08");
    expect(req.body).toBeUndefined();
  });
});

describe("optional clientId query parameter", () => {
  test("receiptsSummary: includes client_id only when provided", async () => {
    const withClient = captureRequest("get", "/receipts/summary");
    await endpoints.receiptsSummary("2026-08", "cl-1");
    const req1 = withClient();
    expect(req1.pathname).toBe("/receipts/summary");
    expect(req1.search.get("period")).toBe("2026-08");
    expect(req1.search.get("client_id")).toBe("cl-1");

    const withoutClient = captureRequest("get", "/receipts/summary");
    await endpoints.receiptsSummary("2026-08");
    const req2 = withoutClient();
    expect(req2.search.get("period")).toBe("2026-08");
    expect(req2.search.has("client_id")).toBe(false);
  });

  test("periodLockStatus: includes client_id only when provided", async () => {
    const withClient = captureRequest("get", "/receipts/period-lock");
    await endpoints.periodLockStatus("2026-08", "cl-1");
    const req1 = withClient();
    expect(req1.pathname).toBe("/receipts/period-lock");
    expect(req1.search.get("period")).toBe("2026-08");
    expect(req1.search.get("client_id")).toBe("cl-1");

    const withoutClient = captureRequest("get", "/receipts/period-lock");
    await endpoints.periodLockStatus("2026-08");
    const req2 = withoutClient();
    expect(req2.search.get("period")).toBe("2026-08");
    expect(req2.search.has("client_id")).toBe(false);
  });
});

describe("month locking", () => {
  test("lockPeriod: POST /clients/:id/periods/:period/lock, no body", async () => {
    const getRequest = captureRequest("post", "/clients/c1/periods/2026-08/lock", { locked: true, locked_at: "2026-08-10T00:00:00Z" });
    await endpoints.lockPeriod("c1", "2026-08");
    const req = getRequest();
    expect(req.method).toBe("POST");
    expect(req.pathname).toBe("/clients/c1/periods/2026-08/lock");
    expect(req.search.toString()).toBe("");
    expect(req.body).toBeUndefined();
  });

  test("unlockPeriod: DELETE /clients/:id/periods/:period/lock, no body", async () => {
    const getRequest = captureRequest("delete", "/clients/c1/periods/2026-08/lock", null, 204);
    await endpoints.unlockPeriod("c1", "2026-08");
    const req = getRequest();
    expect(req.method).toBe("DELETE");
    expect(req.pathname).toBe("/clients/c1/periods/2026-08/lock");
    expect(req.search.toString()).toBe("");
    expect(req.body).toBeUndefined();
  });
});

describe("period-scoped listings (a wrong period silently returns the wrong month)", () => {
  test("listReceipts: GET /receipts?period=", async () => {
    const getRequest = captureRequest("get", "/receipts", []);
    await endpoints.listReceipts("2026-08");
    const req = getRequest();
    expect(req.method).toBe("GET");
    expect(req.pathname).toBe("/receipts");
    expect(req.search.get("period")).toBe("2026-08");
  });

  test("clientReceipts: GET /clients/:id/receipts?period=", async () => {
    const getRequest = captureRequest("get", "/clients/c1/receipts", []);
    await endpoints.clientReceipts("c1", "2026-08");
    const req = getRequest();
    expect(req.method).toBe("GET");
    expect(req.pathname).toBe("/clients/c1/receipts");
    expect(req.search.get("period")).toBe("2026-08");
  });

  test("listClients: GET /clients?period=", async () => {
    const getRequest = captureRequest("get", "/clients", []);
    await endpoints.listClients("2026-08");
    const req = getRequest();
    expect(req.method).toBe("GET");
    expect(req.pathname).toBe("/clients");
    expect(req.search.get("period")).toBe("2026-08");
  });

  test("period values with characters needing encoding still round-trip", async () => {
    // Not a realistic period, but proves listReceipts encodes rather than
    // string-concatenates the query value.
    const getRequest = captureRequest("get", "/receipts", []);
    await endpoints.listReceipts("2026 08");
    const req = getRequest();
    expect(req.search.get("period")).toBe("2026 08");
  });
});

describe("upload handshake", () => {
  test("createUpload: POST /receipts/uploads with the full payload", async () => {
    const getRequest = captureRequest("post", "/receipts/uploads", { id: "u1" });
    await endpoints.createUpload({ content_type: "image/jpeg", period: "2026-08", client_id: "cl-1" });
    const req = getRequest();
    expect(req.method).toBe("POST");
    expect(req.pathname).toBe("/receipts/uploads");
    expect(req.body).toEqual({ content_type: "image/jpeg", period: "2026-08", client_id: "cl-1" });
  });

  test("completeUpload: POST /receipts/:id/complete with size_bytes", async () => {
    const getRequest = captureRequest("post", "/receipts/r1/complete", { id: "r1" });
    await endpoints.completeUpload("r1", { size_bytes: 1024 });
    const req = getRequest();
    expect(req.method).toBe("POST");
    expect(req.pathname).toBe("/receipts/r1/complete");
    expect(req.body).toEqual({ size_bytes: 1024 });
  });
});

describe("receipt lifecycle", () => {
  test("getSubmissionState: GET /receipts/submission?period=", async () => {
    const getRequest = captureRequest("get", "/receipts/submission", { state: "none" });
    await endpoints.getSubmissionState("2026-08");
    const req = getRequest();
    expect(req.method).toBe("GET");
    expect(req.pathname).toBe("/receipts/submission");
    expect(req.search.get("period")).toBe("2026-08");
  });

  test("submitReceipts: POST /receipts/submit with period in the body", async () => {
    const getRequest = captureRequest("post", "/receipts/submit", { state: "submitted" });
    await endpoints.submitReceipts("2026-08");
    const req = getRequest();
    expect(req.method).toBe("POST");
    expect(req.pathname).toBe("/receipts/submit");
    expect(req.body).toEqual({ period: "2026-08" });
  });

  test("patchExtraction: PATCH /receipts/:id/extraction with only the changed fields", async () => {
    const getRequest = captureRequest("patch", "/receipts/r1/extraction", { id: "r1" });
    await endpoints.patchExtraction("r1", { merchant_name: "Migros" });
    const req = getRequest();
    expect(req.method).toBe("PATCH");
    expect(req.pathname).toBe("/receipts/r1/extraction");
    expect(req.body).toEqual({ merchant_name: "Migros" });
  });

  test("retryExtraction: POST /receipts/:id/extraction/retry, no body", async () => {
    const getRequest = captureRequest("post", "/receipts/r1/extraction/retry", { id: "r1" });
    await endpoints.retryExtraction("r1");
    const req = getRequest();
    expect(req.method).toBe("POST");
    expect(req.pathname).toBe("/receipts/r1/extraction/retry");
    expect(req.body).toBeUndefined();
  });

  test("changePeriod: PATCH /receipts/:id with the new period in the body", async () => {
    const getRequest = captureRequest("patch", "/receipts/r1", { id: "r1" });
    await endpoints.changePeriod("r1", "2026-09");
    const req = getRequest();
    expect(req.method).toBe("PATCH");
    expect(req.pathname).toBe("/receipts/r1");
    expect(req.body).toEqual({ period: "2026-09" });
  });

  test("deleteReceipt: DELETE /receipts/:id, no body", async () => {
    const getRequest = captureRequest("delete", "/receipts/r1", null, 204);
    await endpoints.deleteReceipt("r1");
    const req = getRequest();
    expect(req.method).toBe("DELETE");
    expect(req.pathname).toBe("/receipts/r1");
    expect(req.body).toBeUndefined();
  });
});

describe("auth", () => {
  test("login: POST /auth/login with credentials in the body", async () => {
    const getRequest = captureRequest("post", "/auth/login", { access_token: "t" });
    await endpoints.login({ email: "a@b.com", password: "secret" });
    const req = getRequest();
    expect(req.method).toBe("POST");
    expect(req.pathname).toBe("/auth/login");
    expect(req.body).toEqual({ email: "a@b.com", password: "secret" });
  });

  test("register: POST /auth/register with the full payload", async () => {
    const getRequest = captureRequest("post", "/auth/register", { access_token: "t" });
    await endpoints.register({
      email: "a@b.com",
      password: "secret",
      full_name: "Ada",
      role: "client",
      invite_token: "inv-1",
    });
    const req = getRequest();
    expect(req.method).toBe("POST");
    expect(req.pathname).toBe("/auth/register");
    expect(req.body).toEqual({
      email: "a@b.com",
      password: "secret",
      full_name: "Ada",
      role: "client",
      invite_token: "inv-1",
    });
  });

  test("logout: POST /auth/logout, no body", async () => {
    const getRequest = captureRequest("post", "/auth/logout", null, 204);
    await endpoints.logout();
    const req = getRequest();
    expect(req.method).toBe("POST");
    expect(req.pathname).toBe("/auth/logout");
    expect(req.body).toBeUndefined();
  });

  test("getMe: GET /auth/me", async () => {
    const getRequest = captureRequest("get", "/auth/me", { id: "u1" });
    await endpoints.getMe();
    const req = getRequest();
    expect(req.method).toBe("GET");
    expect(req.pathname).toBe("/auth/me");
  });

  test("changePassword: POST /auth/change-password with both passwords in the body", async () => {
    const getRequest = captureRequest("post", "/auth/change-password", null, 204);
    await endpoints.changePassword({ current_password: "old", new_password: "new" });
    const req = getRequest();
    expect(req.method).toBe("POST");
    expect(req.pathname).toBe("/auth/change-password");
    expect(req.body).toEqual({ current_password: "old", new_password: "new" });
  });

  test("requestPasswordReset: POST /auth/password-reset/request with email in the body", async () => {
    const getRequest = captureRequest("post", "/auth/password-reset/request", null, 204);
    await endpoints.requestPasswordReset("a@b.com");
    const req = getRequest();
    expect(req.method).toBe("POST");
    expect(req.pathname).toBe("/auth/password-reset/request");
    expect(req.body).toEqual({ email: "a@b.com" });
  });

  test("confirmPasswordReset: POST /auth/password-reset/confirm with token + new_password in the body", async () => {
    const getRequest = captureRequest("post", "/auth/password-reset/confirm", null, 204);
    await endpoints.confirmPasswordReset("tok-1", "new-pass");
    const req = getRequest();
    expect(req.method).toBe("POST");
    expect(req.pathname).toBe("/auth/password-reset/confirm");
    expect(req.body).toEqual({ token: "tok-1", new_password: "new-pass" });
  });
});

describe("invites and grants", () => {
  test("getInviteInfo: GET /grants/invite/:token", async () => {
    const getRequest = captureRequest("get", "/grants/invite/tok-1", { inviter_role: "client" });
    await endpoints.getInviteInfo("tok-1");
    const req = getRequest();
    expect(req.method).toBe("GET");
    expect(req.pathname).toBe("/grants/invite/tok-1");
  });

  test("acceptInviteByToken: POST /grants/invite/:token/accept, no body", async () => {
    const getRequest = captureRequest("post", "/grants/invite/tok-1/accept", { id: "g1" });
    await endpoints.acceptInviteByToken("tok-1");
    const req = getRequest();
    expect(req.method).toBe("POST");
    expect(req.pathname).toBe("/grants/invite/tok-1/accept");
    expect(req.body).toBeUndefined();
  });

  test("listGrants: GET /grants", async () => {
    const getRequest = captureRequest("get", "/grants", []);
    await endpoints.listGrants();
    const req = getRequest();
    expect(req.method).toBe("GET");
    expect(req.pathname).toBe("/grants");
  });

  test("inviteCounterpart: POST /grants with email in the body", async () => {
    const getRequest = captureRequest("post", "/grants", { id: "g1" });
    await endpoints.inviteCounterpart("a@b.com");
    const req = getRequest();
    expect(req.method).toBe("POST");
    expect(req.pathname).toBe("/grants");
    expect(req.body).toEqual({ email: "a@b.com" });
  });

  test("acceptGrant: POST /grants/:id/accept, no body", async () => {
    const getRequest = captureRequest("post", "/grants/g1/accept", { id: "g1" });
    await endpoints.acceptGrant("g1");
    const req = getRequest();
    expect(req.method).toBe("POST");
    expect(req.pathname).toBe("/grants/g1/accept");
    expect(req.body).toBeUndefined();
  });

  test("declineGrant: POST /grants/:id/decline, no body", async () => {
    const getRequest = captureRequest("post", "/grants/g1/decline", null, 204);
    await endpoints.declineGrant("g1");
    const req = getRequest();
    expect(req.method).toBe("POST");
    expect(req.pathname).toBe("/grants/g1/decline");
    expect(req.body).toBeUndefined();
  });

  test("revokeGrant: DELETE /grants/:id, no body", async () => {
    const getRequest = captureRequest("delete", "/grants/g1", null, 204);
    await endpoints.revokeGrant("g1");
    const req = getRequest();
    expect(req.method).toBe("DELETE");
    expect(req.pathname).toBe("/grants/g1");
    expect(req.body).toBeUndefined();
  });
});

describe("company profile", () => {
  test("getCompany: GET /company", async () => {
    const getRequest = captureRequest("get", "/company", { full_name: "Ada" });
    await endpoints.getCompany();
    const req = getRequest();
    expect(req.method).toBe("GET");
    expect(req.pathname).toBe("/company");
  });

  test("saveCompany: PUT /company with the full payload", async () => {
    const getRequest = captureRequest("put", "/company", { full_name: "Ada" });
    const data = {
      full_name: "Ada Co",
      tax_office: "Kadıköy",
      tax_number: "1234567890",
      business_address: "Istanbul",
    };
    await endpoints.saveCompany(data);
    const req = getRequest();
    expect(req.method).toBe("PUT");
    expect(req.pathname).toBe("/company");
    expect(req.body).toEqual(data);
  });

  test("getClientCompany: GET /clients/:id/company", async () => {
    const getRequest = captureRequest("get", "/clients/c1/company", { full_name: "Ada" });
    await endpoints.getClientCompany("c1");
    const req = getRequest();
    expect(req.method).toBe("GET");
    expect(req.pathname).toBe("/clients/c1/company");
  });
});

describe("notifications", () => {
  test("listNotifications: GET /notifications", async () => {
    const getRequest = captureRequest("get", "/notifications", { items: [], unread_count: 0 });
    await endpoints.listNotifications();
    const req = getRequest();
    expect(req.method).toBe("GET");
    expect(req.pathname).toBe("/notifications");
  });

  test("markNotificationsRead: POST /notifications/read with a list of ids", async () => {
    const getRequest = captureRequest("post", "/notifications/read", null, 204);
    await endpoints.markNotificationsRead(["n1", "n2"]);
    const req = getRequest();
    expect(req.method).toBe("POST");
    expect(req.pathname).toBe("/notifications/read");
    expect(req.body).toEqual({ ids: ["n1", "n2"] });
  });

  test("markNotificationsRead: sends ids: null to mean 'mark everything read'", async () => {
    const getRequest = captureRequest("post", "/notifications/read", null, 204);
    await endpoints.markNotificationsRead(null);
    const req = getRequest();
    expect(req.body).toEqual({ ids: null });
  });
});

describe("Authorization header", () => {
  test("is attached when a token is registered", async () => {
    setTokenProvider(() => "jwt-123");
    const getRequest = captureRequest("get", "/auth/me", { id: "u1" });
    await endpoints.getMe();
    expect(getRequest().authorization).toBe("Bearer jwt-123");
  });

  test("is absent when no token is registered", async () => {
    const getRequest = captureRequest("get", "/auth/me", { id: "u1" });
    await endpoints.getMe();
    expect(getRequest().authorization).toBeNull();
  });
});
