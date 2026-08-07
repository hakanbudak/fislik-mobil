import { ApiError, NetworkError, apiFetch, setTokenProvider } from "../client";

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    json: async () => body,
  };
}

beforeEach(() => {
  mockFetch.mockReset();
  setTokenProvider(() => null);
});

test("attaches the bearer token when one is available", async () => {
  setTokenProvider(() => "jwt-123");
  mockFetch.mockResolvedValue(jsonResponse({ id: "u1" }));
  await apiFetch("/auth/me");
  const headers = mockFetch.mock.calls[0][1].headers as Headers;
  expect(headers.get("Authorization")).toBe("Bearer jwt-123");
});

test("omits the Authorization header when there is no token", async () => {
  mockFetch.mockResolvedValue(jsonResponse({}));
  await apiFetch("/auth/me");
  const headers = mockFetch.mock.calls[0][1].headers as Headers;
  expect(headers.has("Authorization")).toBe(false);
});

test("sets a JSON content type for string bodies", async () => {
  mockFetch.mockResolvedValue(jsonResponse({}));
  await apiFetch("/auth/login", { method: "POST", body: JSON.stringify({ a: 1 }) });
  const headers = mockFetch.mock.calls[0][1].headers as Headers;
  expect(headers.get("Content-Type")).toBe("application/json");
});

test("throws ApiError carrying the API's detail message", async () => {
  mockFetch.mockResolvedValue(jsonResponse({ detail: "Geçersiz e-posta veya şifre" }, 401));
  await expect(apiFetch("/auth/login")).rejects.toMatchObject({
    name: "ApiError",
    status: 401,
    detail: "Geçersiz e-posta veya şifre",
  });
});

test("returns undefined for 204 responses", async () => {
  mockFetch.mockResolvedValue({ ok: true, status: 204, json: async () => undefined });
  await expect(apiFetch("/auth/logout", { method: "POST" })).resolves.toBeUndefined();
});

test("throws NetworkError when fetch itself fails", async () => {
  mockFetch.mockRejectedValue(new TypeError("Network request failed"));
  await expect(apiFetch("/auth/me")).rejects.toBeInstanceOf(NetworkError);
});
