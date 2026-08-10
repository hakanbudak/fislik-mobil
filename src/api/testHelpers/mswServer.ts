import { http, HttpResponse, type HttpHandler, type JsonBodyType } from "msw";
import { setupServer } from "msw/node";

import { API_URL, setTokenProvider } from "../client";

/**
 * Contract-test MSW server: intercepts `apiFetch`'s real `fetch` calls
 * against the real `API_URL`, with none of `src/api/endpoints.ts` mocked.
 * This is the layer the screen tests deliberately skip — they mock
 * `@/src/api/endpoints` at module level, which proves screen behaviour but
 * can never catch an endpoint sending the wrong HTTP request shape.
 *
 * Kept in its own file (rather than inlined in one test file) so later
 * tasks adding new endpoints can import `server`/`captureRequest` without
 * re-plumbing MSW. Importing this module attaches the listen/reset/close
 * lifecycle to whichever test file imports it — no extra boilerplate needed
 * per contract-test file.
 */
export const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

afterEach(() => {
  server.resetHandlers();
  setTokenProvider(() => null);
});

afterAll(() => server.close());

export { API_URL, http, HttpResponse };

type Method = "get" | "post" | "put" | "patch" | "delete";

/** What a captured request looked like, for assertions in contract tests. */
export interface CapturedRequest {
  method: string;
  pathname: string;
  search: URLSearchParams;
  authorization: string | null;
  /** Parsed JSON body, raw text if not JSON, or `undefined` if no body was sent. */
  body: unknown;
}

/**
 * Registers a one-off handler for `METHOD ${API_URL}${path}` (path only —
 * MSW matches the pathname, so the query string is read off the captured
 * request instead of the route pattern) and returns an accessor for what
 * the endpoint function actually sent. Call the accessor only after
 * `await`-ing the endpoint call.
 *
 * `path` may contain `:param` segments for path parameters the test wants
 * MSW to match generically; endpoint calls in this suite mostly interpolate
 * concrete ids instead, so a literal path is usually enough.
 */
export function captureRequest(
  method: Method,
  path: string,
  responseBody: JsonBodyType = {},
  status = 200,
): () => CapturedRequest {
  let captured: CapturedRequest | undefined;

  const handler: HttpHandler = http[method](`${API_URL}${path}`, async ({ request }) => {
    const text = await request.text();
    let body: unknown;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    const url = new URL(request.url);
    captured = {
      method: request.method,
      pathname: url.pathname,
      search: url.searchParams,
      authorization: request.headers.get("authorization"),
      body,
    };
    return HttpResponse.json(responseBody, { status });
  });

  server.use(handler);

  return () => {
    if (!captured) {
      throw new Error(`Expected a ${method.toUpperCase()} request to ${path}, but none arrived`);
    }
    return captured;
  };
}
