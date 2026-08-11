export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(detail);
    this.name = "ApiError";
  }
}

/** Thrown when the request never reached the server, so the UI can say
 *  "İnternet bağlantısı yok" instead of showing a server message. */
export class NetworkError extends Error {
  constructor() {
    super("İnternet bağlantısı yok");
    this.name = "NetworkError";
  }
}

let getToken: () => string | null = () => null;

/** Lets the auth layer supply the current token without this module importing
 *  it — session.ts imports client.ts, so the dependency only runs one way. */
export function setTokenProvider(fn: () => string | null): void {
  getToken = fn;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new NetworkError();
  }

  if (!res.ok) {
    let detail = res.statusText || "Beklenmeyen bir hata oluştu";
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
