# Fişlik Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Fişlik native iOS + Android app — full parity with fislik-web for both the client (mükellef) and accountant (mali müşavir) roles, plus burst camera capture, an offline upload queue, and biometric unlock.

**Architecture:** An Expo app using expo-router's file-based routing, with two tab groups selected by the logged-in user's role. All server state goes through TanStack Query over a thin `fetch` wrapper that attaches a Bearer token from `expo-secure-store`. Receipt capture never talks to the network directly: it writes a file to disk and appends a record to a persistent queue, which a single worker drains through the API's three-step upload handshake.

**Tech Stack:** Expo (SDK 57+), React Native, TypeScript, expo-router, TanStack Query v5, expo-secure-store, expo-camera, expo-image-manipulator, expo-image-picker, expo-document-picker, expo-file-system, expo-sharing, expo-local-authentication, expo-network, lucide-react-native, Jest + @testing-library/react-native, MSW, EAS Build/Submit.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-07-fislik-mobil-design.md`. Read it before starting; it is the source of truth for any question this plan does not answer.
- **Prerequisite:** fislik-api's `docs/superpowers/plans/2026-08-07-bearer-token-auth.md` must be implemented and deployed before Task 5. Tasks 1–4 do not depend on it.
- **API base URL:** `https://fislik-api.selamet.dev` in production, `http://localhost:8000` in development, read from `EXPO_PUBLIC_API_URL`.
- **All user-facing copy is Turkish.** Code, comments, commit messages, and file names are English.
- **Colors are never hard-coded.** Every color comes from `src/theme/tokens.ts`. Exact values:
  `primary #0f766e`, `primaryDark #0b5c55`, `surface #f5f8f7`, `page #e9eeed`, `card #ffffff`, `ink #0c1a18`, `inkSoft #52605e`, `success #12a18a`, `warning #e08a2b`, `danger #c0392b`.
- **Font:** Plus Jakarta Sans, weights 400–800, bundled from `fislik-web/public/fonts`.
- **API payload types are never hand-written.** They come from `src/api/generated/schema.d.ts`, produced by `npm run gen:api`.
- **Period format** is `"YYYY-MM"` everywhere, matching the API's `validate_period`.
- **Max upload size** is 15 MB (`MAX_UPLOAD_BYTES`); compression targets well below it.
- **Out of scope:** push notifications, non-Turkish locales, dark theme, tablet layouts. Do not add them.
- **Every task ends with a commit.** Commit messages are English and carry no AI attribution or `Co-Authored-By` trailer.
- **Test command:** `npm test`. Type check: `npx tsc --noEmit`.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `app/_layout.tsx` | Root providers (Query, Auth, fonts, ErrorBoundary), splash gating |
| `app/(auth)/*` | Unauthenticated screens: login, register, password reset, invite accept |
| `app/(client)/_layout.tsx` | Client tab bar: Fişler, Muhasebecim, Bildirimler, Profil |
| `app/(accountant)/_layout.tsx` | Accountant tab bar: Mükellefler, Bildirimler, Profil |
| `src/api/client.ts` | `fetch` wrapper: base URL, Bearer header, `ApiError`, 204 handling |
| `src/api/endpoints.ts` | One typed function per API endpoint |
| `src/api/generated/schema.d.ts` | Generated OpenAPI types (never edited by hand) |
| `src/api/queryKeys.ts` | Centralised TanStack Query key factory |
| `src/auth/session.ts` | Token persistence in SecureStore |
| `src/auth/AuthProvider.tsx` | Session state, `useMe`, login/logout, role routing |
| `src/auth/biometrics.ts` | Opt-in biometric gate |
| `src/upload/queue.ts` | Persistent capture queue: append, list, update, remove |
| `src/upload/uploader.ts` | Three-step upload handshake for one record |
| `src/upload/worker.ts` | Drains the queue, retry/backoff, connectivity trigger |
| `src/upload/useUploadQueue.ts` | React binding for queue state |
| `src/theme/tokens.ts` | Colors, spacing, radii, typography scale |
| `src/theme/components/*` | Button, Card, Badge, Input, Spinner, EmptyState, ErrorCard, MonthPicker |
| `src/lib/*` | `dates.ts`, `money.ts`, `period.ts`, `receipts.ts` — ported from fislik-web |
| `src/features/receipts/*` | Receipt list, card, detail, extraction editor |
| `src/features/grants/*` | Accountant invitations (client side) |
| `src/features/clients/*` | Client list and month view (accountant side) |

---

# Phase 0 — Foundation

### Task 1: Scaffold the Expo project and CI

**Files:**
- Create: `package.json`, `app.config.ts`, `tsconfig.json`, `babel.config.js`, `.gitignore`, `.env.example`
- Create: `app/_layout.tsx`, `app/index.tsx`
- Create: `jest.config.js`, `jest.setup.ts`
- Create: `.github/workflows/ci.yml`
- Test: `src/__tests__/smoke.test.tsx`

**Interfaces:**
- Produces: a booting Expo app with `npm test`, `npx tsc --noEmit`, and `npx expo-doctor` all green. Later tasks assume path alias `@/` maps to the repo root, so `@/src/api/client` resolves.

- [ ] **Step 1: Create the project**

```bash
npx create-expo-app@latest . --template blank-typescript
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar
npm install @tanstack/react-query lucide-react-native react-native-svg
npm install --save-dev jest jest-expo @testing-library/react-native @types/jest msw
```

- [ ] **Step 2: Configure expo-router, path alias, and app metadata**

`app.config.ts`:

```ts
import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Fişlik",
  slug: "fislik",
  scheme: "fislik",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  ios: { bundleIdentifier: "dev.selamet.fislik", supportsTablet: false },
  android: { package: "dev.selamet.fislik", edgeToEdgeEnabled: true },
  plugins: ["expo-router"],
  extra: { apiUrl: process.env.EXPO_PUBLIC_API_URL },
};

export default config;
```

In `package.json` set `"main": "expo-router/entry"`. In `tsconfig.json` add:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": { "@/*": ["./*"] }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

`.env.example`:

```
EXPO_PUBLIC_API_URL=http://localhost:8000
```

- [ ] **Step 3: Configure Jest**

`jest.config.js`:

```js
module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg))",
  ],
};
```

`jest.setup.ts`:

```ts
import "@testing-library/react-native/extend-expect";
```

- [ ] **Step 4: Write the smoke test**

`src/__tests__/smoke.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

test("the test harness renders a component", () => {
  render(<Text>Fişlik</Text>);
  expect(screen.getByText("Fişlik")).toBeOnTheScreen();
});
```

- [ ] **Step 5: Run the test**

Run: `npm test`
Expected: PASS, 1 test.

- [ ] **Step 6: Add CI**

`.github/workflows/ci.yml`:

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm test -- --ci
      - run: npx expo-doctor
```

- [ ] **Step 7: Verify and commit**

Run: `npx tsc --noEmit && npm test`
Expected: both pass.

```bash
git add -A
git commit -m "chore: scaffold Expo project with expo-router, Jest and CI"
```

---

### Task 2: Design tokens and core UI components

**Files:**
- Create: `src/theme/tokens.ts`, `src/theme/typography.ts`
- Create: `src/theme/components/{Button,Card,Badge,Input,Spinner,EmptyState,ErrorCard}.tsx`
- Create: `assets/fonts/PlusJakartaSans.ttf` (copied from `fislik-web/public/fonts`, converted to TTF)
- Modify: `app/_layout.tsx` (font loading)
- Test: `src/theme/components/__tests__/{Button,Badge,ErrorCard}.test.tsx`

**Interfaces:**
- Produces:
  - `tokens: { color: {...}, space: (n: number) => number, radius: {...} }` from `src/theme/tokens.ts`.
  - `<Button title="…" onPress={fn} variant="primary" | "secondary" | "danger" loading={bool} disabled={bool} />`
  - `<Badge label="…" tone="success" | "warning" | "neutral" />`
  - `<ErrorCard message="…" onRetry={fn} />` — renders the message and, when `onRetry` is given, a button labelled `"Tekrar dene"`.
  - `<EmptyState title="…" description="…" />`, `<Card>`, `<Input label="…" …TextInputProps />`, `<Spinner />`.

- [ ] **Step 1: Write the tokens**

`src/theme/tokens.ts` — values copied verbatim from `fislik-web/src/index.css`'s `@theme` block:

```ts
export const tokens = {
  color: {
    primary: "#0f766e",
    primaryDark: "#0b5c55",
    surface: "#f5f8f7",
    page: "#e9eeed",
    card: "#ffffff",
    ink: "#0c1a18",
    inkSoft: "#52605e",
    success: "#12a18a",
    warning: "#e08a2b",
    danger: "#c0392b",
    border: "rgba(12, 26, 24, 0.10)",
  },
  radius: { sm: 8, md: 11, lg: 14, pill: 999 },
  space: (n: number) => n * 4,
} as const;
```

`src/theme/typography.ts`:

```ts
export const font = {
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  bold: "PlusJakartaSans_700Bold",
  extraBold: "PlusJakartaSans_800ExtraBold",
} as const;

export const text = {
  title: { fontFamily: font.bold, fontSize: 19, letterSpacing: -0.5 },
  body: { fontFamily: font.regular, fontSize: 15 },
  label: { fontFamily: font.bold, fontSize: 13.5 },
  caption: { fontFamily: font.medium, fontSize: 11.5 },
} as const;
```

- [ ] **Step 2: Write the failing component tests**

`src/theme/components/__tests__/Button.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Button } from "../Button";

test("calls onPress when tapped", () => {
  const onPress = jest.fn();
  render(<Button title="Kaydet" onPress={onPress} />);
  fireEvent.press(screen.getByText("Kaydet"));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test("does not call onPress while loading", () => {
  const onPress = jest.fn();
  render(<Button title="Kaydet" onPress={onPress} loading />);
  fireEvent.press(screen.getByLabelText("Kaydet"));
  expect(onPress).not.toHaveBeenCalled();
});
```

`src/theme/components/__tests__/ErrorCard.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ErrorCard } from "../ErrorCard";

test("shows the message and retries", () => {
  const onRetry = jest.fn();
  render(<ErrorCard message="Bir şeyler ters gitti" onRetry={onRetry} />);
  expect(screen.getByText("Bir şeyler ters gitti")).toBeOnTheScreen();
  fireEvent.press(screen.getByText("Tekrar dene"));
  expect(onRetry).toHaveBeenCalledTimes(1);
});

test("omits the retry button when no handler is given", () => {
  render(<ErrorCard message="Bir şeyler ters gitti" />);
  expect(screen.queryByText("Tekrar dene")).toBeNull();
});
```

`src/theme/components/__tests__/Badge.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react-native";
import { Badge } from "../Badge";
import { tokens } from "../../tokens";

test("uses the success tone color", () => {
  render(<Badge label="İşlendi" tone="success" />);
  expect(screen.getByText("İşlendi")).toHaveStyle({ color: tokens.color.success });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -- src/theme`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement the components**

`src/theme/components/Button.tsx`:

```tsx
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { tokens } from "../tokens";
import { text } from "../typography";

type Variant = "primary" | "secondary" | "danger";

const BACKGROUND: Record<Variant, string> = {
  primary: tokens.color.primary,
  secondary: tokens.color.card,
  danger: tokens.color.danger,
};

const FOREGROUND: Record<Variant, string> = {
  primary: "#ffffff",
  secondary: tokens.color.ink,
  danger: "#ffffff",
};

export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
}) {
  const inactive = loading || disabled;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: BACKGROUND[variant], opacity: inactive ? 0.6 : pressed ? 0.85 : 1 },
        variant === "secondary" && styles.bordered,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={FOREGROUND[variant]} />
      ) : (
        <Text style={[text.label, { color: FOREGROUND[variant] }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 48,
    borderRadius: tokens.radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: tokens.space(4),
  },
  bordered: { borderWidth: 1, borderColor: tokens.color.border },
});
```

`src/theme/components/ErrorCard.tsx`:

```tsx
import { StyleSheet, Text, View } from "react-native";
import { AlertCircle } from "lucide-react-native";
import { tokens } from "../tokens";
import { text } from "../typography";
import { Button } from "./Button";

export function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.card}>
      <AlertCircle size={22} color={tokens.color.danger} />
      <Text style={[text.body, styles.message]}>{message}</Text>
      {onRetry ? <Button title="Tekrar dene" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: tokens.space(3),
    padding: tokens.space(4),
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.card,
    borderWidth: 1,
    borderColor: tokens.color.border,
    alignItems: "center",
  },
  message: { color: tokens.color.ink, textAlign: "center" },
});
```

`src/theme/components/Badge.tsx`:

```tsx
import { StyleSheet, Text, View } from "react-native";
import { tokens } from "../tokens";
import { text } from "../typography";

type Tone = "success" | "warning" | "neutral";

const COLOR: Record<Tone, string> = {
  success: tokens.color.success,
  warning: tokens.color.warning,
  neutral: tokens.color.inkSoft,
};

export function Badge({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  return (
    <View style={[styles.badge, { backgroundColor: `${COLOR[tone]}1A` }]}>
      <View style={[styles.dot, { backgroundColor: COLOR[tone] }]} />
      <Text style={[text.caption, { color: COLOR[tone] }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space(1.5),
    paddingHorizontal: tokens.space(2),
    paddingVertical: tokens.space(1),
    borderRadius: tokens.radius.pill,
    alignSelf: "flex-start",
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
```

Implement `Card`, `Input`, `Spinner`, and `EmptyState` in the same style: `Card` is a `View` with `card` background, `border`, and `radius.lg`; `Input` renders a `text.caption` label above a `TextInput` with `radius.md` and `border`, forwarding all `TextInputProps` and accepting an `error?: string` rendered below in `tokens.color.danger`; `Spinner` is a centred `ActivityIndicator` in `tokens.color.primary`; `EmptyState` centres a `title` in `text.label` and a `description` in `text.body` coloured `inkSoft`.

- [ ] **Step 5: Load the font in the root layout**

`app/_layout.tsx`:

```tsx
import { useFonts } from "expo-font";
import { Slot, SplashScreen } from "expo-router";
import { useEffect } from "react";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    PlusJakartaSans_400Regular: require("@/assets/fonts/PlusJakartaSans-Regular.ttf"),
    PlusJakartaSans_500Medium: require("@/assets/fonts/PlusJakartaSans-Medium.ttf"),
    PlusJakartaSans_700Bold: require("@/assets/fonts/PlusJakartaSans-Bold.ttf"),
    PlusJakartaSans_800ExtraBold: require("@/assets/fonts/PlusJakartaSans-ExtraBold.ttf"),
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;
  return <Slot />;
}
```

Install with `npx expo install expo-font`. Obtain the TTFs by downloading Plus Jakarta Sans from Google Fonts at the four weights (the web app's `.woff2` files are not usable by React Native) and placing them in `assets/fonts/`.

- [ ] **Step 6: Run the tests**

Run: `npm test -- src/theme`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(theme): add design tokens and core UI components

Colors, radii and typography are ported verbatim from fislik-web's @theme
block so the two clients stay visually identical."
```

---

### Task 3: API client with Bearer auth and generated types

**Files:**
- Create: `src/api/client.ts`, `src/api/queryKeys.ts`
- Create: `src/api/generated/schema.d.ts` (generated)
- Create: `scripts/gen-api.sh`
- Modify: `package.json` (add `gen:api` script)
- Modify: `.github/workflows/ci.yml` (add generated-types freshness check)
- Test: `src/api/__tests__/client.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `API_URL: string`
  - `class ApiError extends Error { status: number; detail: string }`
  - `apiFetch<T>(path: string, init?: RequestInit): Promise<T>` — prefixes `API_URL`, sets `Content-Type: application/json` for string bodies, attaches `Authorization: Bearer <token>` when `getToken()` returns one, throws `ApiError` on non-2xx, returns `undefined` for 204.
  - `setTokenProvider(fn: () => string | null): void` — how `src/auth/session.ts` (Task 4) injects the current token without creating an import cycle.
  - `NetworkError extends Error` — thrown when `fetch` itself rejects, so screens can distinguish "no connection" from a server response.
  - `queryKeys` factory: `queryKeys.me()`, `.receipts(period)`, `.summary(period)`, `.grants()`, `.company()`, `.notifications()`, `.clients(period)`, `.clientReceipts(clientId, period)`, `.clientCompany(clientId)`.

- [ ] **Step 1: Generate the API types**

```bash
npm install --save-dev openapi-typescript
```

`scripts/gen-api.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
API_URL="${EXPO_PUBLIC_API_URL:-https://fislik-api.selamet.dev}"
npx openapi-typescript "${API_URL}/openapi.json" -o src/api/generated/schema.d.ts
```

In `package.json`: `"gen:api": "bash scripts/gen-api.sh"`. Run `npm run gen:api` and commit the output. Add a header comment guard at the top of `src/api/generated/schema.d.ts` — regenerate rather than edit.

- [ ] **Step 2: Write the failing client tests**

`src/api/__tests__/client.test.ts`:

```ts
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
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -- src/api`
Expected: FAIL — `../client` not found.

- [ ] **Step 4: Implement the client**

`src/api/client.ts`:

```ts
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
```

`src/api/queryKeys.ts`:

```ts
export const queryKeys = {
  me: () => ["me"] as const,
  receipts: (period: string) => ["receipts", period] as const,
  summary: (period: string) => ["receipts", "summary", period] as const,
  grants: () => ["grants"] as const,
  company: () => ["company"] as const,
  notifications: () => ["notifications"] as const,
  clients: (period: string) => ["clients", period] as const,
  clientReceipts: (clientId: string, period: string) =>
    ["clients", clientId, "receipts", period] as const,
  clientCompany: (clientId: string) => ["clients", clientId, "company"] as const,
};
```

- [ ] **Step 5: Run the tests**

Run: `npm test -- src/api`
Expected: PASS, 6 tests.

- [ ] **Step 6: Add the CI freshness check**

Append to the `check` job in `.github/workflows/ci.yml`:

```yaml
      - name: Verify generated API types are up to date
        env:
          EXPO_PUBLIC_API_URL: https://fislik-api.selamet.dev
        run: |
          npm run gen:api
          git diff --exit-code src/api/generated/schema.d.ts
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(api): add fetch client with bearer auth and generated types

apiFetch attaches the stored session token as an Authorization header and
normalises errors into ApiError (server responded) or NetworkError (request
never left the device). Payload types are generated from the API's OpenAPI
schema and checked for freshness in CI."
```

---

# Phase 1 — Authentication

### Task 4: Token storage in SecureStore

**Files:**
- Create: `src/auth/session.ts`
- Test: `src/auth/__tests__/session.test.ts`

**Interfaces:**
- Consumes: `setTokenProvider` from `src/api/client.ts`.
- Produces:
  - `loadSession(): Promise<string | null>` — reads the token from SecureStore into memory and registers it with the API client.
  - `saveSession(token: string): Promise<void>`
  - `clearSession(): Promise<void>`
  - `currentToken(): string | null` — synchronous in-memory read, used by the API client.

- [ ] **Step 1: Write the failing tests**

`src/auth/__tests__/session.test.ts`:

```ts
import * as SecureStore from "expo-secure-store";
import { clearSession, currentToken, loadSession, saveSession } from "../session";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const store = SecureStore as jest.Mocked<typeof SecureStore>;

beforeEach(async () => {
  jest.clearAllMocks();
  store.getItemAsync.mockResolvedValue(null);
  await loadSession();
});

test("loadSession returns null when nothing is stored", async () => {
  store.getItemAsync.mockResolvedValue(null);
  await expect(loadSession()).resolves.toBeNull();
  expect(currentToken()).toBeNull();
});

test("loadSession restores a stored token into memory", async () => {
  store.getItemAsync.mockResolvedValue("jwt-abc");
  await expect(loadSession()).resolves.toBe("jwt-abc");
  expect(currentToken()).toBe("jwt-abc");
});

test("saveSession persists and caches the token", async () => {
  await saveSession("jwt-new");
  expect(store.setItemAsync).toHaveBeenCalledWith("fislik.access_token", "jwt-new");
  expect(currentToken()).toBe("jwt-new");
});

test("clearSession wipes both storage and memory", async () => {
  await saveSession("jwt-new");
  await clearSession();
  expect(store.deleteItemAsync).toHaveBeenCalledWith("fislik.access_token");
  expect(currentToken()).toBeNull();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/auth`
Expected: FAIL — `../session` not found.

- [ ] **Step 3: Implement**

```bash
npx expo install expo-secure-store
```

`src/auth/session.ts`:

```ts
import * as SecureStore from "expo-secure-store";
import { setTokenProvider } from "@/src/api/client";

const KEY = "fislik.access_token";

/** Mirrored in memory because apiFetch needs the token synchronously on every
 *  request, while SecureStore is async. */
let token: string | null = null;

setTokenProvider(() => token);

export function currentToken(): string | null {
  return token;
}

export async function loadSession(): Promise<string | null> {
  token = await SecureStore.getItemAsync(KEY);
  return token;
}

export async function saveSession(value: string): Promise<void> {
  token = value;
  await SecureStore.setItemAsync(KEY, value);
}

export async function clearSession(): Promise<void> {
  token = null;
  await SecureStore.deleteItemAsync(KEY);
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- src/auth`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(auth): persist the session token in SecureStore"
```

---

### Task 5: Auth endpoints and AuthProvider

**Prerequisite:** fislik-api Tasks 1–2 deployed. Run `npm run gen:api` first so `AuthOut.access_token` exists in the generated types.

**Files:**
- Create: `src/api/endpoints.ts` (auth section)
- Create: `src/auth/AuthProvider.tsx`
- Modify: `app/_layout.tsx`
- Test: `src/auth/__tests__/AuthProvider.test.tsx`

**Interfaces:**
- Consumes: `apiFetch`, `ApiError` (Task 3); `loadSession`/`saveSession`/`clearSession` (Task 4); `queryKeys.me()` (Task 3).
- Produces:
  - Endpoints: `login({email, password})`, `register({email, password, full_name, role, invite_token?})` — both return `AuthOut` and are responsible for calling `saveSession(res.access_token)`; `logout()`, `getMe()`, `requestPasswordReset(email)`, `confirmPasswordReset(token, newPassword)`.
  - `<AuthProvider>` and `useAuth(): { user: UserOut | null; status: "loading" | "authed" | "anon"; signIn; signUp; signOut }`.
  - `type Role = "client" | "accountant"`, `type UserOut = { id, email, full_name, role }` — re-exported from the generated schema, not hand-written.

- [ ] **Step 1: Write the endpoints**

`src/api/endpoints.ts`:

```ts
import { apiFetch } from "./client";
import type { components } from "./generated/schema";

export type UserOut = components["schemas"]["UserOut"];
export type AuthOut = components["schemas"]["AuthOut"];
export type Role = UserOut["role"];

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

export function logout(): Promise<void> {
  return apiFetch<void>("/auth/logout", { method: "POST" });
}

export function getMe(): Promise<UserOut> {
  return apiFetch<UserOut>("/auth/me");
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
```

- [ ] **Step 2: Write the failing AuthProvider tests**

`src/auth/__tests__/AuthProvider.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { AuthProvider, useAuth } from "../AuthProvider";
import * as endpoints from "@/src/api/endpoints";
import * as session from "../session";
import { ApiError } from "@/src/api/client";

jest.mock("@/src/api/endpoints");
jest.mock("../session");

const mockedEndpoints = endpoints as jest.Mocked<typeof endpoints>;
const mockedSession = session as jest.Mocked<typeof session>;

function Probe() {
  const { status, user } = useAuth();
  return <Text>{`${status}:${user?.full_name ?? "-"}`}</Text>;
}

function renderProbe() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => jest.clearAllMocks());

test("reports anon when no token is stored", async () => {
  mockedSession.loadSession.mockResolvedValue(null);
  renderProbe();
  await waitFor(() => expect(screen.getByText("anon:-")).toBeOnTheScreen());
});

test("validates a stored token and reports the user", async () => {
  mockedSession.loadSession.mockResolvedValue("jwt-1");
  mockedEndpoints.getMe.mockResolvedValue({
    id: "u1",
    email: "a@b.com",
    full_name: "Selin",
    role: "client",
  });
  renderProbe();
  await waitFor(() => expect(screen.getByText("authed:Selin")).toBeOnTheScreen());
});

test("clears the session when the stored token is rejected", async () => {
  mockedSession.loadSession.mockResolvedValue("stale");
  mockedEndpoints.getMe.mockRejectedValue(new ApiError(401, "Invalid or expired token"));
  renderProbe();
  await waitFor(() => expect(mockedSession.clearSession).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByText("anon:-")).toBeOnTheScreen());
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- src/auth/__tests__/AuthProvider.test.tsx`
Expected: FAIL — `../AuthProvider` not found.

- [ ] **Step 4: Implement AuthProvider**

`src/auth/AuthProvider.tsx`:

```tsx
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ApiError } from "@/src/api/client";
import { queryKeys } from "@/src/api/queryKeys";
import * as endpoints from "@/src/api/endpoints";
import type { Role, UserOut } from "@/src/api/endpoints";
import { clearSession, loadSession, saveSession } from "./session";

type Status = "loading" | "authed" | "anon";

interface AuthValue {
  user: UserOut | null;
  status: Status;
  signIn: (email: string, password: string) => Promise<UserOut>;
  signUp: (data: {
    email: string;
    password: string;
    full_name: string;
    role: Role;
    invite_token?: string;
  }) => Promise<UserOut>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [restored, setRestored] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    loadSession().then((token) => {
      setHasToken(Boolean(token));
      setRestored(true);
    });
  }, []);

  const me = useQuery({
    queryKey: queryKeys.me(),
    queryFn: endpoints.getMe,
    enabled: restored && hasToken,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  // A stored token the server no longer accepts is worthless — drop it so the
  // user lands on the login screen instead of a permanently failing session.
  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) {
      clearSession().then(() => setHasToken(false));
    }
  }, [me.error]);

  const status: Status = !restored || (hasToken && me.isLoading)
    ? "loading"
    : me.data
      ? "authed"
      : "anon";

  async function adopt(result: { access_token: string } & UserOut): Promise<UserOut> {
    const { access_token, ...user } = result;
    await saveSession(access_token);
    setHasToken(true);
    queryClient.setQueryData(queryKeys.me(), user);
    return user;
  }

  const value: AuthValue = {
    user: me.data ?? null,
    status,
    signIn: async (email, password) => adopt(await endpoints.login({ email, password })),
    signUp: async (data) => adopt(await endpoints.register(data)),
    signOut: async () => {
      // Best-effort: the server call only clears a cookie we never use, so a
      // failure here must not strand the user in a signed-in shell.
      await endpoints.logout().catch(() => undefined);
      await clearSession();
      setHasToken(false);
      queryClient.clear();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
```

- [ ] **Step 5: Wire providers into the root layout**

Extend `app/_layout.tsx` to wrap `<Slot />` in `<QueryClientProvider client={queryClient}><AuthProvider>…</AuthProvider></QueryClientProvider>`, with the client created once via `useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } }))`.

- [ ] **Step 6: Run the tests**

Run: `npm test -- src/auth && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(auth): add auth endpoints and session provider

AuthProvider restores the stored token on launch, validates it against
/auth/me, and drops it on 401 so a stale token cannot strand the user."
```

---

### Task 6: Login, register and password reset screens

**Files:**
- Create: `app/(auth)/_layout.tsx`, `app/(auth)/giris.tsx`, `app/(auth)/kayit.tsx`, `app/(auth)/sifre-sifirla/index.tsx`, `app/(auth)/sifre-sifirla/[token].tsx`
- Create: `src/auth/AuthShell.tsx` (shared logo + card layout)
- Modify: `app/index.tsx` (role-based redirect)
- Test: `app/(auth)/__tests__/giris.test.tsx`

**Interfaces:**
- Consumes: `useAuth` (Task 5), theme components (Task 2), `ApiError`/`NetworkError` (Task 3).
- Produces: the index route redirects `anon → /giris`, `authed && role === "client" → /(client)`, `authed && role === "accountant" → /(accountant)`.

- [ ] **Step 1: Write the failing login screen test**

`app/(auth)/__tests__/giris.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import LoginScreen from "../giris";
import { ApiError } from "@/src/api/client";

const signIn = jest.fn();
jest.mock("@/src/auth/AuthProvider", () => ({ useAuth: () => ({ signIn, status: "anon" }) }));
jest.mock("expo-router", () => ({ Link: ({ children }: never) => children, router: { replace: jest.fn() } }));

beforeEach(() => jest.clearAllMocks());

test("submits the entered credentials", async () => {
  signIn.mockResolvedValue({ id: "u1", role: "client" });
  render(<LoginScreen />);
  fireEvent.changeText(screen.getByLabelText("E-posta"), "selin@test.com");
  fireEvent.changeText(screen.getByLabelText("Şifre"), "password123");
  fireEvent.press(screen.getByText("Giriş yap"));
  await waitFor(() =>
    expect(signIn).toHaveBeenCalledWith("selin@test.com", "password123"),
  );
});

test("shows the API's message when the credentials are wrong", async () => {
  signIn.mockRejectedValue(new ApiError(401, "Invalid email or password"));
  render(<LoginScreen />);
  fireEvent.changeText(screen.getByLabelText("E-posta"), "selin@test.com");
  fireEvent.changeText(screen.getByLabelText("Şifre"), "wrong");
  fireEvent.press(screen.getByText("Giriş yap"));
  await waitFor(() =>
    expect(screen.getByText("E-posta veya şifre hatalı")).toBeOnTheScreen(),
  );
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- app/(auth)`
Expected: FAIL — screen module not found.

- [ ] **Step 3: Implement the screens**

`app/(auth)/giris.tsx` — an `AuthShell` containing the Fişlik mark, an `Input` for `E-posta` (`keyboardType="email-address"`, `autoCapitalize="none"`), an `Input` for `Şifre` (`secureTextEntry`), a primary `Button` labelled `Giriş yap` bound to `useAuth().signIn`, an `ErrorCard` for failures, and `Link`s to `/kayit` (`Hesabın yok mu? Kayıt ol`) and `/sifre-sifirla` (`Şifremi unuttum`). Map errors with a shared helper:

`src/lib/errors.ts`:

```ts
import { ApiError, NetworkError } from "@/src/api/client";

/** Turns a thrown value into Turkish copy for the user. Auth failures get a
 *  friendlier message than the API's English detail; everything else trusts
 *  the API, which already answers in Turkish. */
export function errorMessage(error: unknown): string {
  if (error instanceof NetworkError) return "İnternet bağlantısı yok";
  if (error instanceof ApiError) {
    if (error.status === 401 && error.detail === "Invalid email or password") {
      return "E-posta veya şifre hatalı";
    }
    return error.detail;
  }
  return "Beklenmeyen bir hata oluştu";
}
```

`app/(auth)/kayit.tsx` — same shell plus `Ad Soyad` and a role selector (two pill buttons: `Mükellefim` → `client`, `Mali müşavirim` → `accountant`), calling `signUp`.

`app/(auth)/sifre-sifirla/index.tsx` — single e-mail field, `Sıfırlama bağlantısı gönder`, then a success state reading `E-posta adresine sıfırlama bağlantısı gönderdik.` (shown regardless of whether the address exists, matching the API's 204-always behaviour).

`app/(auth)/sifre-sifirla/[token].tsx` — reads `token` via `useLocalSearchParams`, takes a new password (min 8 chars, validated client-side with the message `Şifre en az 8 karakter olmalı`), calls `confirmPasswordReset`, then routes to `/giris`.

`app/index.tsx`:

```tsx
import { Redirect } from "expo-router";
import { useAuth } from "@/src/auth/AuthProvider";
import { Spinner } from "@/src/theme/components/Spinner";

export default function Index() {
  const { status, user } = useAuth();
  if (status === "loading") return <Spinner />;
  if (status === "anon" || !user) return <Redirect href="/giris" />;
  return <Redirect href={user.role === "accountant" ? "/(accountant)" : "/(client)"} />;
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- app/(auth) && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Manual check**

Run `npx expo start`, register a new client against a local API, confirm you land on the client tab bar, kill and relaunch the app, and confirm the session is restored without a second login.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(auth): add login, register and password reset screens"
```

---

### Task 7: Invite accept screen and deep links

**Files:**
- Create: `app/(auth)/davet/[token].tsx`
- Modify: `src/api/endpoints.ts` (add `getInviteInfo`)
- Modify: `app.config.ts` (associated domains / intent filters)
- Test: `app/(auth)/__tests__/davet.test.tsx`

**Interfaces:**
- Consumes: `apiFetch` (Task 3), `useAuth().signUp` (Task 5).
- Produces: `getInviteInfo(token: string): Promise<InviteInfoOut>` where `InviteInfoOut = { invited_email: string; client_name: string }` from the generated schema.

- [ ] **Step 1: Add the endpoint**

```ts
export type InviteInfoOut = components["schemas"]["InviteInfoOut"];

export function getInviteInfo(token: string): Promise<InviteInfoOut> {
  return apiFetch<InviteInfoOut>(`/grants/invite/${token}`);
}
```

- [ ] **Step 2: Write the failing test**

`app/(auth)/__tests__/davet.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import InviteScreen from "../davet/[token]";
import * as endpoints from "@/src/api/endpoints";

jest.mock("@/src/api/endpoints");
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ token: "inv-123" }),
  router: { replace: jest.fn() },
  Link: ({ children }: never) => children,
}));
jest.mock("@/src/auth/AuthProvider", () => ({
  useAuth: () => ({ signUp: jest.fn(), status: "anon" }),
}));

const mocked = endpoints as jest.Mocked<typeof endpoints>;

test("shows who invited the accountant", async () => {
  mocked.getInviteInfo.mockResolvedValue({
    invited_email: "muhasebeci@test.com",
    client_name: "Selin Ticaret",
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <InviteScreen />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getByText(/Selin Ticaret/)).toBeOnTheScreen());
  expect(screen.getByDisplayValue("muhasebeci@test.com")).toBeOnTheScreen();
});

test("surfaces an expired invite", async () => {
  mocked.getInviteInfo.mockRejectedValue(new Error("gone"));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <InviteScreen />
    </QueryClientProvider>,
  );
  await waitFor(() =>
    expect(screen.getByText("Bu davet geçersiz veya süresi dolmuş.")).toBeOnTheScreen(),
  );
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- app/(auth)/__tests__/davet.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the screen**

`app/(auth)/davet/[token].tsx` fetches `getInviteInfo(token)` and renders `"<client_name> sizi mali müşaviri olarak davet etti."`, a read-only e-mail field pre-filled with `invited_email`, plus `Ad Soyad` and `Şifre` inputs. Submitting calls `signUp({ email: invited_email, password, full_name, role: "accountant", invite_token: token })`, which activates the pending grant server-side. A failed fetch renders `ErrorCard` with `Bu davet geçersiz veya süresi dolmuş.`

- [ ] **Step 5: Configure deep links**

In `app.config.ts`:

```ts
  ios: {
    bundleIdentifier: "dev.selamet.fislik",
    supportsTablet: false,
    associatedDomains: ["applinks:fislik.selamet.dev"],
  },
  android: {
    package: "dev.selamet.fislik",
    edgeToEdgeEnabled: true,
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: "https", host: "fislik.selamet.dev", pathPrefix: "/davet" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: "https", host: "fislik.selamet.dev", pathPrefix: "/sifre-sifirla" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
```

Deep-link verification also requires files served by fislik-web: `public/.well-known/apple-app-site-association` and `public/.well-known/assetlinks.json`. Note this as a follow-up in the fislik-web repo — until they are deployed, links open the web app, which is the intended fallback.

- [ ] **Step 6: Run the tests and commit**

Run: `npm test && npx tsc --noEmit`

```bash
git add -A
git commit -m "feat(auth): add invite accept screen and deep link configuration"
```

---

### Task 8: Biometric unlock

**Files:**
- Create: `src/auth/biometrics.ts`
- Modify: `src/auth/AuthProvider.tsx` (gate on launch)
- Test: `src/auth/__tests__/biometrics.test.ts`

**Interfaces:**
- Consumes: `clearSession` (Task 4).
- Produces:
  - `isBiometricAvailable(): Promise<boolean>`
  - `isBiometricEnabled(): Promise<boolean>` / `setBiometricEnabled(on: boolean): Promise<void>` — persisted in AsyncStorage under `fislik.biometric_enabled`.
  - `requestUnlock(): Promise<boolean>` — returns true when unlocked or when the feature is off/unavailable.

- [ ] **Step 1: Write the failing tests**

`src/auth/__tests__/biometrics.test.ts`:

```ts
import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { requestUnlock, setBiometricEnabled } from "../biometrics";

jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const auth = LocalAuthentication as jest.Mocked<typeof LocalAuthentication>;
const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

beforeEach(() => jest.clearAllMocks());

test("unlocks without prompting when the feature is disabled", async () => {
  storage.getItem.mockResolvedValue(null);
  await expect(requestUnlock()).resolves.toBe(true);
  expect(auth.authenticateAsync).not.toHaveBeenCalled();
});

test("prompts and unlocks on success", async () => {
  storage.getItem.mockResolvedValue("1");
  auth.hasHardwareAsync.mockResolvedValue(true);
  auth.isEnrolledAsync.mockResolvedValue(true);
  auth.authenticateAsync.mockResolvedValue({ success: true } as never);
  await expect(requestUnlock()).resolves.toBe(true);
});

test("stays locked when the prompt is cancelled", async () => {
  storage.getItem.mockResolvedValue("1");
  auth.hasHardwareAsync.mockResolvedValue(true);
  auth.isEnrolledAsync.mockResolvedValue(true);
  auth.authenticateAsync.mockResolvedValue({ success: false } as never);
  await expect(requestUnlock()).resolves.toBe(false);
});

test("unlocks when the feature is on but the device has no enrolled biometrics", async () => {
  storage.getItem.mockResolvedValue("1");
  auth.hasHardwareAsync.mockResolvedValue(true);
  auth.isEnrolledAsync.mockResolvedValue(false);
  await expect(requestUnlock()).resolves.toBe(true);
});

test("setBiometricEnabled persists the preference", async () => {
  await setBiometricEnabled(true);
  expect(storage.setItem).toHaveBeenCalledWith("fislik.biometric_enabled", "1");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/auth/__tests__/biometrics.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```bash
npx expo install expo-local-authentication @react-native-async-storage/async-storage
```

`src/auth/biometrics.ts`:

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";

const KEY = "fislik.biometric_enabled";

export async function isBiometricAvailable(): Promise<boolean> {
  return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
}

export async function isBiometricEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEY)) === "1";
}

export async function setBiometricEnabled(on: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY, on ? "1" : "0");
}

/** Gates app launch when the user opted in. Returns true whenever there is
 *  nothing to check — the feature is a convenience lock on an already-valid
 *  session, never the thing that authorises access to the API. */
export async function requestUnlock(): Promise<boolean> {
  if (!(await isBiometricEnabled())) return true;
  if (!(await isBiometricAvailable())) return true;
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Fişlik'i aç",
    cancelLabel: "İptal",
    fallbackLabel: "Şifreyle gir",
  });
  return result.success;
}
```

- [ ] **Step 4: Gate the provider**

In `AuthProvider`, after `loadSession()` resolves with a token, `await requestUnlock()`. On `false`, expose `status: "locked"` and render a screen with the Fişlik mark, a `Kilidi aç` button that retries `requestUnlock`, and a `Çıkış yap` button calling `signOut`. Add `"locked"` to the `Status` union and handle it in `app/index.tsx` by rendering that screen instead of redirecting.

- [ ] **Step 5: Add the iOS usage string**

In `app.config.ts` under `ios.infoPlist`:

```ts
    infoPlist: {
      NSFaceIDUsageDescription:
        "Fişlik'i Face ID ile hızlıca açabilmeniz için kullanılır.",
    },
```

- [ ] **Step 6: Run tests and commit**

Run: `npm test && npx tsc --noEmit`

```bash
git add -A
git commit -m "feat(auth): add opt-in biometric unlock"
```

---

# Phase 2 — Client role

### Task 9: Port the shared library helpers

**Files:**
- Create: `src/lib/dates.ts`, `src/lib/money.ts`, `src/lib/period.ts`, `src/lib/receipts.ts`
- Test: `src/lib/__tests__/{dates,money,period,receipts}.test.ts`

**Interfaces:**
- Produces (mirroring `fislik-web/src/lib/*` — read those files and port them, keeping behaviour identical):
  - `formatPeriodLabel(period: string): string` — `"2026-08"` → `"Ağustos 2026"`.
  - `currentPeriod(): string`, `shiftPeriod(period: string, months: number): string`.
  - `formatMoney(value: string | null): string` — `"1234.5"` → `"1.234,50 ₺"`, `null` → `"—"`.
  - `formatDateTime(iso: string): string` — `"7 Ağu 2026, 14:30"`.
  - `isPdf(receipt: { content_type?: string }): boolean` — true only when `content_type === "application/pdf"`; a missing value means image, matching the web app.

- [ ] **Step 1: Read the web originals**

Open `fislik-web/src/lib/dates.ts`, `money.ts`, `period.ts`, `receipts.ts`. Port them verbatim except for browser-only APIs. Do not invent different formatting.

- [ ] **Step 2: Write the failing tests**

`src/lib/__tests__/period.test.ts`:

```ts
import { currentPeriod, formatPeriodLabel, shiftPeriod } from "../period";

test("formats a period as a Turkish month and year", () => {
  expect(formatPeriodLabel("2026-08")).toBe("Ağustos 2026");
  expect(formatPeriodLabel("2026-01")).toBe("Ocak 2026");
});

test("shifts across year boundaries", () => {
  expect(shiftPeriod("2026-01", -1)).toBe("2025-12");
  expect(shiftPeriod("2025-12", 1)).toBe("2026-01");
});

test("current period matches the YYYY-MM shape the API validates", () => {
  expect(currentPeriod()).toMatch(/^\d{4}-\d{2}$/);
});
```

`src/lib/__tests__/money.test.ts`:

```ts
import { formatMoney } from "../money";

test("formats decimal strings in Turkish notation", () => {
  expect(formatMoney("1234.5")).toBe("1.234,50 ₺");
  expect(formatMoney("0")).toBe("0,00 ₺");
});

test("renders a dash for missing amounts", () => {
  expect(formatMoney(null)).toBe("—");
});
```

`src/lib/__tests__/receipts.test.ts`:

```ts
import { isPdf } from "../receipts";

test("treats a missing content type as an image", () => {
  expect(isPdf({})).toBe(false);
  expect(isPdf({ content_type: "image/jpeg" })).toBe(false);
  expect(isPdf({ content_type: "application/pdf" })).toBe(true);
});
```

Write an equivalent test for `formatDateTime` in `dates.test.ts`, asserting on a fixed ISO input.

- [ ] **Step 3: Run to verify failure, then implement, then re-run**

Run: `npm test -- src/lib`
Expected: FAIL, then PASS after porting.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(lib): port date, money, period and receipt helpers from the web app"
```

---

### Task 10: The upload queue

This is the app's most important unit. It owns persistence and ordering only — it performs no network calls, which is what makes it testable.

**Files:**
- Create: `src/upload/queue.ts`
- Test: `src/upload/__tests__/queue.test.ts`

**Interfaces:**
- Produces:

```ts
export type QueueStatus = "pending" | "uploading" | "failed";

export interface QueueRecord {
  id: string;              // local uuid, not the server receipt id
  localUri: string;        // file:// path in the app's document directory
  contentType: string;     // "image/jpeg" | "application/pdf"
  period: string;          // "YYYY-MM"
  status: QueueStatus;
  attempts: number;
  createdAt: number;       // epoch ms, defines processing order
  receiptId?: string;      // set once POST /receipts/uploads succeeds
  uploadUrl?: string;      // presigned PUT url, set with receiptId
  error?: string;          // last failure message, shown after MAX_ATTEMPTS
}

export const MAX_ATTEMPTS = 5;

export function enqueue(input: { localUri: string; contentType: string; period: string }): Promise<QueueRecord>;
export function listQueue(): Promise<QueueRecord[]>;          // oldest first
export function updateRecord(id: string, patch: Partial<QueueRecord>): Promise<void>;
export function removeRecord(id: string): Promise<void>;      // also deletes the local file
export function nextPending(): Promise<QueueRecord | null>;   // oldest pending, null if none
export function subscribe(listener: () => void): () => void;  // notified after every mutation
```

- [ ] **Step 1: Write the failing tests**

`src/upload/__tests__/queue.test.ts`:

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import {
  MAX_ATTEMPTS,
  enqueue,
  listQueue,
  nextPending,
  removeRecord,
  subscribe,
  updateRecord,
} from "../queue";

jest.mock("@react-native-async-storage/async-storage", () => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn(async (k: string) => store[k] ?? null),
    setItem: jest.fn(async (k: string, v: string) => {
      store[k] = v;
    }),
    __reset: () => {
      store = {};
    },
  };
});
jest.mock("expo-file-system", () => ({
  documentDirectory: "file:///docs/",
  deleteAsync: jest.fn(async () => undefined),
}));

beforeEach(() => {
  (AsyncStorage as unknown as { __reset: () => void }).__reset();
  jest.clearAllMocks();
});

test("enqueued records start pending with no attempts", async () => {
  const record = await enqueue({
    localUri: "file:///docs/a.jpg",
    contentType: "image/jpeg",
    period: "2026-08",
  });
  expect(record.status).toBe("pending");
  expect(record.attempts).toBe(0);
  expect(record.receiptId).toBeUndefined();
});

test("the queue survives a reload from storage", async () => {
  await enqueue({ localUri: "file:///docs/a.jpg", contentType: "image/jpeg", period: "2026-08" });
  jest.resetModules();
  const reloaded = await import("../queue");
  await expect(reloaded.listQueue()).resolves.toHaveLength(1);
});

test("records are processed oldest first", async () => {
  const first = await enqueue({ localUri: "file:///docs/1.jpg", contentType: "image/jpeg", period: "2026-08" });
  await enqueue({ localUri: "file:///docs/2.jpg", contentType: "image/jpeg", period: "2026-08" });
  await expect(nextPending()).resolves.toMatchObject({ id: first.id });
});

test("nextPending skips records already in flight", async () => {
  const record = await enqueue({ localUri: "file:///docs/1.jpg", contentType: "image/jpeg", period: "2026-08" });
  await updateRecord(record.id, { status: "uploading" });
  await expect(nextPending()).resolves.toBeNull();
});

test("nextPending skips records that exhausted their attempts", async () => {
  const record = await enqueue({ localUri: "file:///docs/1.jpg", contentType: "image/jpeg", period: "2026-08" });
  await updateRecord(record.id, { status: "failed", attempts: MAX_ATTEMPTS });
  await expect(nextPending()).resolves.toBeNull();
});

test("updateRecord patches without dropping other fields", async () => {
  const record = await enqueue({ localUri: "file:///docs/1.jpg", contentType: "image/jpeg", period: "2026-08" });
  await updateRecord(record.id, { receiptId: "r1", uploadUrl: "https://r2/put" });
  const [stored] = await listQueue();
  expect(stored).toMatchObject({
    receiptId: "r1",
    uploadUrl: "https://r2/put",
    localUri: "file:///docs/1.jpg",
    period: "2026-08",
  });
});

test("removeRecord deletes the local file", async () => {
  const record = await enqueue({ localUri: "file:///docs/1.jpg", contentType: "image/jpeg", period: "2026-08" });
  await removeRecord(record.id);
  expect(FileSystem.deleteAsync).toHaveBeenCalledWith("file:///docs/1.jpg", { idempotent: true });
  await expect(listQueue()).resolves.toHaveLength(0);
});

test("subscribers are notified on every mutation", async () => {
  const listener = jest.fn();
  const unsubscribe = subscribe(listener);
  const record = await enqueue({ localUri: "file:///docs/1.jpg", contentType: "image/jpeg", period: "2026-08" });
  await updateRecord(record.id, { status: "uploading" });
  expect(listener).toHaveBeenCalledTimes(2);
  unsubscribe();
  await removeRecord(record.id);
  expect(listener).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/upload`
Expected: FAIL — `../queue` not found.

- [ ] **Step 3: Implement**

`src/upload/queue.ts`:

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";

const KEY = "fislik.upload_queue";

export const MAX_ATTEMPTS = 5;

export type QueueStatus = "pending" | "uploading" | "failed";

export interface QueueRecord {
  id: string;
  localUri: string;
  contentType: string;
  period: string;
  status: QueueStatus;
  attempts: number;
  createdAt: number;
  receiptId?: string;
  uploadUrl?: string;
  error?: string;
}

const listeners = new Set<() => void>();

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  for (const listener of listeners) listener();
}

async function read(): Promise<QueueRecord[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as QueueRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // A corrupt queue must not brick the app; the worst case is losing
    // pending captures, which is strictly better than never launching.
    return [];
  }
}

async function write(records: QueueRecord[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(records));
  notify();
}

export async function listQueue(): Promise<QueueRecord[]> {
  return (await read()).sort((a, b) => a.createdAt - b.createdAt);
}

export async function enqueue(input: {
  localUri: string;
  contentType: string;
  period: string;
}): Promise<QueueRecord> {
  const record: QueueRecord = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    ...input,
    status: "pending",
    attempts: 0,
    createdAt: Date.now(),
  };
  await write([...(await read()), record]);
  return record;
}

export async function updateRecord(id: string, patch: Partial<QueueRecord>): Promise<void> {
  const records = await read();
  await write(records.map((r) => (r.id === id ? { ...r, ...patch } : r)));
}

export async function removeRecord(id: string): Promise<void> {
  const records = await read();
  const record = records.find((r) => r.id === id);
  if (record) {
    await FileSystem.deleteAsync(record.localUri, { idempotent: true }).catch(() => undefined);
  }
  await write(records.filter((r) => r.id !== id));
}

export async function nextPending(): Promise<QueueRecord | null> {
  const records = await listQueue();
  return records.find((r) => r.status === "pending" && r.attempts < MAX_ATTEMPTS) ?? null;
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- src/upload`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(upload): add the persistent capture queue

The queue owns persistence and ordering only and performs no network calls,
so its retry and resumability behaviour is testable in isolation."
```

---

### Task 11: The uploader and the queue worker

**Files:**
- Create: `src/upload/uploader.ts`, `src/upload/worker.ts`
- Modify: `src/api/endpoints.ts` (add `createUpload`, `completeUpload`)
- Test: `src/upload/__tests__/uploader.test.ts`, `src/upload/__tests__/worker.test.ts`

**Interfaces:**
- Consumes: queue functions (Task 10), `apiFetch` (Task 3).
- Produces:
  - Endpoints: `createUpload({ content_type, period })` → `UploadOut = { receipt_id, object_key, upload_url }`; `completeUpload(receiptId, { size_bytes })` → `ReceiptOut`.
  - `uploadRecord(record: QueueRecord): Promise<void>` — runs the three-step handshake, resuming from `receiptId`/`uploadUrl` when they are already set, and removes the record on success.
  - `startWorker(): () => void` — drains the queue continuously, retries with backoff, re-drains on connectivity restoration; returns a stop function.
  - `drainOnce(): Promise<void>` — one pass, exported for tests and for pull-to-refresh.

- [ ] **Step 1: Add the endpoints**

```ts
export type UploadOut = components["schemas"]["UploadOut"];
export type ReceiptOut = components["schemas"]["ReceiptOut"];

export function createUpload(data: { content_type: string; period?: string }): Promise<UploadOut> {
  return apiFetch<UploadOut>("/receipts/uploads", { method: "POST", body: JSON.stringify(data) });
}

export function completeUpload(receiptId: string, data: { size_bytes?: number }): Promise<ReceiptOut> {
  return apiFetch<ReceiptOut>(`/receipts/${receiptId}/complete`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
```

- [ ] **Step 2: Write the failing uploader tests**

`src/upload/__tests__/uploader.test.ts`:

```ts
import * as FileSystem from "expo-file-system";
import * as endpoints from "@/src/api/endpoints";
import { uploadRecord } from "../uploader";
import * as queue from "../queue";
import type { QueueRecord } from "../queue";

jest.mock("@/src/api/endpoints");
jest.mock("../queue");
jest.mock("expo-file-system", () => ({
  uploadAsync: jest.fn(),
  getInfoAsync: jest.fn(async () => ({ exists: true, size: 2048 })),
  FileSystemUploadType: { BINARY_CONTENT: 0 },
}));

const mockedEndpoints = endpoints as jest.Mocked<typeof endpoints>;
const mockedQueue = queue as jest.Mocked<typeof queue>;
const fs = FileSystem as jest.Mocked<typeof FileSystem>;

function record(overrides: Partial<QueueRecord> = {}): QueueRecord {
  return {
    id: "q1",
    localUri: "file:///docs/a.jpg",
    contentType: "image/jpeg",
    period: "2026-08",
    status: "pending",
    attempts: 0,
    createdAt: 1,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  fs.uploadAsync.mockResolvedValue({ status: 200 } as never);
});

test("runs create, put and complete in order and clears the record", async () => {
  mockedEndpoints.createUpload.mockResolvedValue({
    receipt_id: "r1",
    object_key: "k",
    upload_url: "https://r2/put",
  });
  await uploadRecord(record());
  expect(mockedEndpoints.createUpload).toHaveBeenCalledWith({
    content_type: "image/jpeg",
    period: "2026-08",
  });
  expect(fs.uploadAsync).toHaveBeenCalledWith(
    "https://r2/put",
    "file:///docs/a.jpg",
    expect.objectContaining({ httpMethod: "PUT" }),
  );
  expect(mockedEndpoints.completeUpload).toHaveBeenCalledWith("r1", { size_bytes: 2048 });
  expect(mockedQueue.removeRecord).toHaveBeenCalledWith("q1");
});

test("resumes without re-creating a receipt that already exists", async () => {
  await uploadRecord(record({ receiptId: "r9", uploadUrl: "https://r2/put9" }));
  expect(mockedEndpoints.createUpload).not.toHaveBeenCalled();
  expect(fs.uploadAsync).toHaveBeenCalledWith(
    "https://r2/put9",
    "file:///docs/a.jpg",
    expect.anything(),
  );
});

test("persists the receipt id before uploading so a crash can resume", async () => {
  mockedEndpoints.createUpload.mockResolvedValue({
    receipt_id: "r1",
    object_key: "k",
    upload_url: "https://r2/put",
  });
  await uploadRecord(record());
  expect(mockedQueue.updateRecord).toHaveBeenCalledWith("q1", {
    receiptId: "r1",
    uploadUrl: "https://r2/put",
  });
});

test("a failed PUT rejects and leaves the record in place", async () => {
  fs.uploadAsync.mockResolvedValue({ status: 403 } as never);
  await expect(uploadRecord(record({ receiptId: "r1", uploadUrl: "https://r2/put" }))).rejects.toThrow();
  expect(mockedQueue.removeRecord).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- src/upload/__tests__/uploader.test.ts`
Expected: FAIL — `../uploader` not found.

- [ ] **Step 4: Implement the uploader**

`src/upload/uploader.ts`:

```ts
import * as FileSystem from "expo-file-system";
import { completeUpload, createUpload } from "@/src/api/endpoints";
import { removeRecord, updateRecord, type QueueRecord } from "./queue";

/**
 * Runs the API's three-step upload handshake for one queued capture:
 * reserve a receipt, PUT the bytes straight to R2 with the presigned url,
 * then confirm. Each step persists its result first, so a crash or a kill
 * resumes rather than duplicating a receipt.
 */
export async function uploadRecord(record: QueueRecord): Promise<void> {
  let receiptId = record.receiptId;
  let uploadUrl = record.uploadUrl;

  if (!receiptId || !uploadUrl) {
    const reservation = await createUpload({
      content_type: record.contentType,
      period: record.period,
    });
    receiptId = reservation.receipt_id;
    uploadUrl = reservation.upload_url;
    await updateRecord(record.id, { receiptId, uploadUrl });
  }

  const result = await FileSystem.uploadAsync(uploadUrl, record.localUri, {
    httpMethod: "PUT",
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { "Content-Type": record.contentType },
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Yükleme başarısız (${result.status})`);
  }

  const info = await FileSystem.getInfoAsync(record.localUri);
  await completeUpload(receiptId, {
    size_bytes: info.exists && "size" in info ? info.size : undefined,
  });
  await removeRecord(record.id);
}
```

- [ ] **Step 5: Write the failing worker tests**

`src/upload/__tests__/worker.test.ts`:

```ts
import { drainOnce } from "../worker";
import * as queue from "../queue";
import * as uploader from "../uploader";
import type { QueueRecord } from "../queue";

jest.mock("../queue");
jest.mock("../uploader");

const mockedQueue = queue as jest.Mocked<typeof queue>;
const mockedUploader = uploader as jest.Mocked<typeof uploader>;

function record(overrides: Partial<QueueRecord> = {}): QueueRecord {
  return {
    id: "q1",
    localUri: "file:///docs/a.jpg",
    contentType: "image/jpeg",
    period: "2026-08",
    status: "pending",
    attempts: 0,
    createdAt: 1,
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

test("marks a record uploading before handing it to the uploader", async () => {
  mockedQueue.nextPending.mockResolvedValueOnce(record()).mockResolvedValue(null);
  await drainOnce();
  expect(mockedQueue.updateRecord).toHaveBeenCalledWith("q1", { status: "uploading" });
  expect(mockedUploader.uploadRecord).toHaveBeenCalled();
});

test("returns a failed record to pending with an incremented attempt count", async () => {
  mockedQueue.nextPending.mockResolvedValueOnce(record()).mockResolvedValue(null);
  mockedUploader.uploadRecord.mockRejectedValue(new Error("boom"));
  await drainOnce();
  expect(mockedQueue.updateRecord).toHaveBeenCalledWith("q1", {
    status: "pending",
    attempts: 1,
    error: "boom",
  });
});

test("gives up after the maximum number of attempts", async () => {
  mockedQueue.nextPending
    .mockResolvedValueOnce(record({ attempts: queue.MAX_ATTEMPTS - 1 }))
    .mockResolvedValue(null);
  mockedUploader.uploadRecord.mockRejectedValue(new Error("boom"));
  await drainOnce();
  expect(mockedQueue.updateRecord).toHaveBeenCalledWith("q1", {
    status: "failed",
    attempts: queue.MAX_ATTEMPTS,
    error: "boom",
  });
});

test("drains every pending record in one pass", async () => {
  mockedQueue.nextPending
    .mockResolvedValueOnce(record({ id: "q1" }))
    .mockResolvedValueOnce(record({ id: "q2" }))
    .mockResolvedValue(null);
  await drainOnce();
  expect(mockedUploader.uploadRecord).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 6: Implement the worker**

`src/upload/worker.ts`:

```ts
import * as Network from "expo-network";
import { MAX_ATTEMPTS, nextPending, updateRecord } from "./queue";
import { uploadRecord } from "./uploader";

let draining = false;

/** One full pass over the queue. Exported for tests and pull-to-refresh. */
export async function drainOnce(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    for (;;) {
      const record = await nextPending();
      if (!record) return;
      await updateRecord(record.id, { status: "uploading" });
      try {
        await uploadRecord(record);
      } catch (error) {
        const attempts = record.attempts + 1;
        await updateRecord(record.id, {
          status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
          attempts,
          error: error instanceof Error ? error.message : "Bilinmeyen hata",
        });
        if (attempts >= MAX_ATTEMPTS) continue;
        return; // back off; the interval or a connectivity change retries
      }
    }
  } finally {
    draining = false;
  }
}

/**
 * Runs the queue for the lifetime of the app. Retries are time-based rather
 * than tight-looped so a persistent failure (server down, bad file) cannot
 * burn the battery, and a connectivity change triggers an immediate pass.
 */
export function startWorker(): () => void {
  let stopped = false;
  const interval = setInterval(() => {
    if (!stopped) void drainOnce();
  }, 15_000);

  const subscription = Network.addNetworkStateListener((state) => {
    if (!stopped && state.isConnected) void drainOnce();
  });

  void drainOnce();

  return () => {
    stopped = true;
    clearInterval(interval);
    subscription.remove();
  };
}
```

Install with `npx expo install expo-network expo-file-system`.

- [ ] **Step 7: Run the tests**

Run: `npm test -- src/upload && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(upload): add the resumable uploader and queue worker

Each handshake step persists before acting, so a crash resumes instead of
creating a duplicate receipt. Failures back off and retry, and give up after
five attempts so the user can intervene."
```

---

### Task 12: Queue binding and the receipt list

**Files:**
- Create: `src/upload/useUploadQueue.ts`
- Create: `src/features/receipts/ReceiptCard.tsx`, `src/features/receipts/QueuedReceiptCard.tsx`
- Create: `src/theme/components/MonthPicker.tsx`
- Create: `app/(client)/_layout.tsx`, `app/(client)/index.tsx`
- Modify: `src/api/endpoints.ts` (add `listReceipts`, `receiptsSummary`)
- Modify: `app/_layout.tsx` (start the worker)
- Test: `src/upload/__tests__/useUploadQueue.test.tsx`, `app/(client)/__tests__/index.test.tsx`

**Interfaces:**
- Consumes: queue + worker (Tasks 10–11), `queryKeys` (Task 3), lib helpers (Task 9), theme components (Task 2).
- Produces:
  - `useUploadQueue(period: string): { queued: QueueRecord[]; retry: (id: string) => Promise<void>; discard: (id: string) => Promise<void> }` — `queued` is filtered to the given period and re-reads on every queue mutation.
  - `listReceipts(period)`, `receiptsSummary(period)` endpoints.
  - `<MonthPicker value={period} onChange={fn} />` — previous/next chevrons around the label from `formatPeriodLabel`, with the next button disabled beyond the current month.

- [ ] **Step 1: Add the endpoints**

```ts
export type SummaryOut = components["schemas"]["SummaryOut"];

export function listReceipts(period: string): Promise<ReceiptOut[]> {
  return apiFetch<ReceiptOut[]>(`/receipts?period=${encodeURIComponent(period)}`);
}

export function receiptsSummary(period: string): Promise<SummaryOut> {
  return apiFetch<SummaryOut>(`/receipts/summary?period=${encodeURIComponent(period)}`);
}
```

Confirm the exact query parameters `receiptsSummary` takes by reading `fislik-web/src/api/endpoints.ts:242` — it builds a `URLSearchParams`; mirror whatever it sends.

- [ ] **Step 2: Write the failing hook test**

`src/upload/__tests__/useUploadQueue.test.tsx`:

```tsx
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useUploadQueue } from "../useUploadQueue";
import * as queue from "../queue";
import type { QueueRecord } from "../queue";

jest.mock("../queue");
jest.mock("../worker", () => ({ drainOnce: jest.fn() }));

const mockedQueue = queue as jest.Mocked<typeof queue>;

function record(overrides: Partial<QueueRecord> = {}): QueueRecord {
  return {
    id: "q1",
    localUri: "file:///docs/a.jpg",
    contentType: "image/jpeg",
    period: "2026-08",
    status: "pending",
    attempts: 0,
    createdAt: 1,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedQueue.subscribe.mockReturnValue(() => undefined);
});

test("exposes only the records for the selected period", async () => {
  mockedQueue.listQueue.mockResolvedValue([
    record({ id: "q1", period: "2026-08" }),
    record({ id: "q2", period: "2026-07" }),
  ]);
  const { result } = renderHook(() => useUploadQueue("2026-08"));
  await waitFor(() => expect(result.current.queued).toHaveLength(1));
  expect(result.current.queued[0].id).toBe("q1");
});

test("retry resets a failed record to pending", async () => {
  mockedQueue.listQueue.mockResolvedValue([record({ status: "failed", attempts: 5 })]);
  const { result } = renderHook(() => useUploadQueue("2026-08"));
  await waitFor(() => expect(result.current.queued).toHaveLength(1));
  await act(() => result.current.retry("q1"));
  expect(mockedQueue.updateRecord).toHaveBeenCalledWith("q1", {
    status: "pending",
    attempts: 0,
    error: undefined,
  });
});
```

- [ ] **Step 3: Implement the hook**

`src/upload/useUploadQueue.ts`:

```ts
import { useCallback, useEffect, useState } from "react";
import { listQueue, removeRecord, subscribe, updateRecord, type QueueRecord } from "./queue";
import { drainOnce } from "./worker";

export function useUploadQueue(period: string) {
  const [queued, setQueued] = useState<QueueRecord[]>([]);

  const refresh = useCallback(async () => {
    const all = await listQueue();
    setQueued(all.filter((r) => r.period === period));
  }, [period]);

  useEffect(() => {
    void refresh();
    return subscribe(() => void refresh());
  }, [refresh]);

  const retry = useCallback(async (id: string) => {
    await updateRecord(id, { status: "pending", attempts: 0, error: undefined });
    void drainOnce();
  }, []);

  return { queued, retry, discard: removeRecord };
}
```

- [ ] **Step 4: Write the failing home screen test**

`app/(client)/__tests__/index.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react-native";
import HomeScreen from "../index";
import * as endpoints from "@/src/api/endpoints";

jest.mock("@/src/api/endpoints");
jest.mock("expo-router", () => ({ router: { push: jest.fn() }, Link: ({ children }: never) => children }));
jest.mock("@/src/upload/useUploadQueue", () => ({
  useUploadQueue: () => ({ queued: [], retry: jest.fn(), discard: jest.fn() }),
}));

const mocked = endpoints as jest.Mocked<typeof endpoints>;

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <HomeScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => jest.clearAllMocks());

test("shows the monthly summary and the receipts", async () => {
  mocked.receiptsSummary.mockResolvedValue({
    receipt_count: 2,
    analyzed_count: 2,
    total_amount: "1234.50",
    vat_total: "185.18",
    vat_by_rate: { "20": "185.18" },
  });
  mocked.listReceipts.mockResolvedValue([
    {
      id: "r1",
      period: "2026-08",
      created_at: "2026-08-05T10:00:00Z",
      image_url: "https://r2/r1.jpg",
      processed: false,
      open_issue: null,
    },
  ] as never);
  renderScreen();
  await waitFor(() => expect(screen.getByText("1.234,50 ₺")).toBeOnTheScreen());
});

test("shows an empty state when the month has no receipts", async () => {
  mocked.receiptsSummary.mockResolvedValue({
    receipt_count: 0,
    analyzed_count: 0,
    total_amount: "0",
    vat_total: "0",
    vat_by_rate: {},
  });
  mocked.listReceipts.mockResolvedValue([]);
  renderScreen();
  await waitFor(() =>
    expect(screen.getByText("Bu ay için henüz fiş yok")).toBeOnTheScreen(),
  );
});
```

- [ ] **Step 5: Implement the client shell and home screen**

`app/(client)/_layout.tsx` uses expo-router `Tabs` with four screens. The `bildirimler` and `profil` screens themselves arrive in Task 15, so create both files now as one-line placeholders rendering `<EmptyState title="Yakında" description="" />` — expo-router warns about tab routes with no matching file, and the placeholders keep the tab bar honest until Task 15 fills them in.

The four screens are — `index` (`Fişler`, `Receipt` icon), `muhasebecim` (`Muhasebecim`, `Users`), `bildirimler` (`Bildirimler`, `Bell`), `profil` (`Profil`, `User`) — styled with `tokens.color.primary` active tint, `tokens.color.inkSoft` inactive, `tokens.color.card` background, and `text.caption` labels, mirroring `fislik-web`'s `ClientShell`.

`app/(client)/index.tsx` holds `period` state initialised to `currentPeriod()`, renders `<MonthPicker>`, a summary `Card` (`formatMoney(summary.total_amount)`, `KDV` total, receipt count), then a `FlatList` whose data is `[...queued, ...receipts]` — queued records first, rendered by `QueuedReceiptCard`, server receipts by `ReceiptCard`. Loading renders `Spinner`, errors render `ErrorCard` with `errorMessage(error)` and a retry that calls `refetch`, and an empty result renders `EmptyState` with title `Bu ay için henüz fiş yok` and description `Sağ alttaki kamera düğmesiyle ilk fişini ekle.` A floating `Camera` button pushes `/(client)/kamera`.

`QueuedReceiptCard` shows the local image thumbnail, a `Badge` reading `Yükleniyor` (tone `neutral`) for `pending`/`uploading`, or `Yüklenemedi` (tone `warning`) with `Tekrar dene` and `Sil` actions for `failed`.

`ReceiptCard` shows the thumbnail (or a PDF glyph when `isPdf(receipt)`), the merchant name from `receipt.extraction?.merchant_name` (falling back to `formatDateTime(receipt.created_at)`), `formatMoney(receipt.extraction?.total_amount ?? null)`, a `Badge` reading `İşlendi` (tone `success`) when `receipt.processed`, and a `Badge` reading `Sorun var` (tone `warning`) when `receipt.open_issue` is set.

- [ ] **Step 6: Start the worker at app level**

In `app/_layout.tsx`, inside the authenticated tree: `useEffect(() => startWorker(), [])`. Also invalidate `queryKeys.receipts(period)` when the queue empties, by subscribing in the home screen and calling `queryClient.invalidateQueries` whenever `queued.length` drops.

- [ ] **Step 7: Run the tests**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(receipts): add the client home screen with queued uploads inline

Queued captures render above server receipts so the user always sees what is
still in flight, including failures they can retry or discard."
```

---

### Task 13: Burst camera capture and file picking

**Files:**
- Create: `app/(client)/kamera.tsx`
- Create: `src/upload/capture.ts`
- Modify: `app.config.ts` (camera/photo permission strings)
- Test: `src/upload/__tests__/capture.test.ts`

**Interfaces:**
- Consumes: `enqueue` (Task 10), `drainOnce` (Task 11).
- Produces:
  - `captureToQueue(uri: string, period: string): Promise<QueueRecord>` — compresses the image, copies it into the document directory, enqueues it, and kicks the worker.
  - `pickFromLibrary(period: string): Promise<QueueRecord[]>` and `pickDocument(period: string): Promise<QueueRecord | null>`.

- [ ] **Step 1: Write the failing test**

`src/upload/__tests__/capture.test.ts`:

```ts
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system";
import { captureToQueue } from "../capture";
import * as queue from "../queue";

jest.mock("../queue");
jest.mock("../worker", () => ({ drainOnce: jest.fn() }));
jest.mock("expo-image-manipulator", () => ({
  manipulateAsync: jest.fn(async () => ({ uri: "file:///cache/compressed.jpg" })),
  SaveFormat: { JPEG: "jpeg" },
}));
jest.mock("expo-file-system", () => ({
  documentDirectory: "file:///docs/",
  copyAsync: jest.fn(async () => undefined),
  makeDirectoryAsync: jest.fn(async () => undefined),
}));

const manipulator = ImageManipulator as jest.Mocked<typeof ImageManipulator>;
const fs = FileSystem as jest.Mocked<typeof FileSystem>;
const mockedQueue = queue as jest.Mocked<typeof queue>;

beforeEach(() => jest.clearAllMocks());

test("compresses, persists and enqueues a capture", async () => {
  await captureToQueue("file:///cache/raw.jpg", "2026-08");
  expect(manipulator.manipulateAsync).toHaveBeenCalledWith(
    "file:///cache/raw.jpg",
    [{ resize: { width: 1600 } }],
    expect.objectContaining({ compress: 0.7 }),
  );
  expect(fs.copyAsync).toHaveBeenCalled();
  expect(mockedQueue.enqueue).toHaveBeenCalledWith(
    expect.objectContaining({ contentType: "image/jpeg", period: "2026-08" }),
  );
});

test("stores the capture outside the cache so it survives eviction", async () => {
  await captureToQueue("file:///cache/raw.jpg", "2026-08");
  const [{ to }] = fs.copyAsync.mock.calls.map(([args]) => args);
  expect(to).toContain("file:///docs/");
});
```

- [ ] **Step 2: Implement**

```bash
npx expo install expo-camera expo-image-manipulator expo-image-picker expo-document-picker
```

`src/upload/capture.ts`:

```ts
import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import { enqueue, type QueueRecord } from "./queue";
import { drainOnce } from "./worker";

const CAPTURE_DIR = `${FileSystem.documentDirectory}captures/`;

/**
 * Resize + JPEG compression keeps a phone photo well under the API's 15 MB
 * limit while staying legible enough for Gemini extraction. This mirrors what
 * fislik-web does with browser-image-compression.
 */
export async function captureToQueue(uri: string, period: string): Promise<QueueRecord> {
  const compressed = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1600 } }], {
    compress: 0.7,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  await FileSystem.makeDirectoryAsync(CAPTURE_DIR, { intermediates: true }).catch(() => undefined);
  // The cache directory can be evicted by the OS at any time; a queued capture
  // has to outlive that, so it moves into the document directory first.
  const to = `${CAPTURE_DIR}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  await FileSystem.copyAsync({ from: compressed.uri, to });
  const record = await enqueue({ localUri: to, contentType: "image/jpeg", period });
  void drainOnce();
  return record;
}
```

`pickFromLibrary` uses `ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, quality: 1 })` and runs each asset through `captureToQueue`. `pickDocument` uses `DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true })`, copies the PDF into `CAPTURE_DIR` unchanged (no compression), and enqueues it with `contentType: "application/pdf"`.

- [ ] **Step 3: Build the camera screen**

`app/(client)/kamera.tsx` renders a full-screen `CameraView` with `facing="back"`. State: `shots: QueueRecord[]`. The shutter calls `takePictureAsync({ quality: 0.9 })` then `captureToQueue(photo.uri, period)` and appends to `shots` — the camera never closes between shots. Chrome: a top-left `X` closing back to the list; a bottom-left thumbnail strip of `shots` with a count badge; a bottom-right `Bitir` button that routes back. Permission handling: `useCameraPermissions`; when denied, render an `EmptyState` reading `Fiş çekebilmek için kamera izni gerekiyor` with a `Ayarları aç` button calling `Linking.openSettings()`. Also place a gallery icon that calls `pickFromLibrary` and a paperclip icon that calls `pickDocument`.

- [ ] **Step 4: Add the permission strings**

In `app.config.ts`:

```ts
  plugins: [
    "expo-router",
    ["expo-camera", { cameraPermission: "Fişlerinizi fotoğraflamak için kamera erişimi gerekiyor." }],
    ["expo-image-picker", { photosPermission: "Galerinizden fiş seçebilmek için fotoğraf erişimi gerekiyor." }],
  ],
```

- [ ] **Step 5: Run tests and verify on a device**

Run: `npm test -- src/upload && npx tsc --noEmit`

Manual: with the API running locally, shoot three receipts in a row, confirm all three appear in the list as `Yükleniyor` and then resolve into real receipts without leaving the screen.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(capture): add burst camera capture, gallery and PDF picking

Captures are compressed and moved out of the cache directory before being
queued, so an OS cache eviction cannot lose a receipt that has not uploaded."
```

---

### Task 14: Receipt detail and extraction editing

**Files:**
- Create: `app/(client)/fis/[id].tsx`
- Create: `src/features/receipts/ExtractionEditor.tsx`
- Modify: `src/api/endpoints.ts` (add `patchExtraction`, `changePeriod`, `deleteReceipt`)
- Test: `src/features/receipts/__tests__/ExtractionEditor.test.tsx`

**Interfaces:**
- Consumes: `queryKeys.receipts` (Task 3), lib helpers (Task 9).
- Produces:
  - `patchExtraction(receiptId, data: ExtractionPatchIn): Promise<ExtractionOut>`
  - `changePeriod(receiptId, period): Promise<ReceiptOut>`
  - `deleteReceipt(receiptId): Promise<void>`
  - `<ExtractionEditor extraction={ExtractionOut} onSave={(patch: ExtractionPatchIn) => Promise<void>} />`

- [ ] **Step 1: Add the endpoints**

```ts
export type ExtractionOut = components["schemas"]["ExtractionOut"];
export type ExtractionPatchIn = components["schemas"]["ExtractionPatchIn"];

export function patchExtraction(receiptId: string, data: ExtractionPatchIn): Promise<ExtractionOut> {
  return apiFetch<ExtractionOut>(`/receipts/${receiptId}/extraction`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function changePeriod(receiptId: string, period: string): Promise<ReceiptOut> {
  return apiFetch<ReceiptOut>(`/receipts/${receiptId}`, {
    method: "PATCH",
    body: JSON.stringify({ period }),
  });
}

export function deleteReceipt(receiptId: string): Promise<void> {
  return apiFetch<void>(`/receipts/${receiptId}`, { method: "DELETE" });
}
```

- [ ] **Step 2: Write the failing editor test**

`src/features/receipts/__tests__/ExtractionEditor.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { ExtractionEditor } from "../ExtractionEditor";

const extraction = {
  status: "done" as const,
  merchant_name: "Migros",
  receipt_date: "2026-08-05",
  total_amount: "218.40",
  vat_total: "36.40",
  vat_breakdown: [{ rate: 20, amount: "36.40" }],
  doc_type: "fis" as const,
  edited: false,
};

test("shows the extracted values", () => {
  render(<ExtractionEditor extraction={extraction} onSave={jest.fn()} />);
  expect(screen.getByDisplayValue("Migros")).toBeOnTheScreen();
  expect(screen.getByDisplayValue("218.40")).toBeOnTheScreen();
});

test("saves only the fields the user changed", async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  render(<ExtractionEditor extraction={extraction} onSave={onSave} />);
  fireEvent.changeText(screen.getByLabelText("Satıcı"), "Migros Jet");
  fireEvent.press(screen.getByText("Kaydet"));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith({ merchant_name: "Migros Jet" }));
});

test("reports a pending extraction instead of empty fields", () => {
  render(
    <ExtractionEditor
      extraction={{ ...extraction, status: "pending", merchant_name: null, total_amount: null }}
      onSave={jest.fn()}
    />,
  );
  expect(screen.getByText("Fiş bilgileri çıkarılıyor…")).toBeOnTheScreen();
});
```

- [ ] **Step 3: Run to verify failure, then implement**

`ExtractionEditor` keeps a local draft initialised from the prop, renders `Input`s labelled `Satıcı`, `Tarih`, `Toplam`, `KDV`, a `fis`/`fatura` segmented control labelled `Belge türü`, and the VAT breakdown as read-only rows (`%20 · 36,40 ₺`). `Kaydet` diffs the draft against the original and calls `onSave` with only the changed keys. When `status === "pending"` it renders `Fiş bilgileri çıkarılıyor…` with a `Spinner` instead of the form; when `status === "failed"` it renders `Fiş bilgileri okunamadı, elle girebilirsiniz.` above an empty form.

- [ ] **Step 4: Build the detail screen**

`app/(client)/fis/[id].tsx` reads the receipt from the `queryKeys.receipts(period)` cache (falling back to a refetch of the list when absent, since the API has no single-receipt endpoint), renders the image in a pinch-to-zoom view (`react-native-gesture-handler`'s `PinchGestureHandler`, or `WebView` for PDFs), then `ExtractionEditor`, then an actions section: `Ayı değiştir` (opens a `MonthPicker` sheet calling `changePeriod`), `Fişi sil` (a `danger` button behind a confirmation `Alert` reading `Bu fiş silinecek. Emin misiniz?`), and an open-issue card when `receipt.open_issue` is set, showing `open_issue.message` and `open_issue.author_name`. Every mutation invalidates `queryKeys.receipts(period)` and `queryKeys.summary(period)`.

- [ ] **Step 5: Run tests and commit**

Run: `npm test && npx tsc --noEmit`

```bash
git add -A
git commit -m "feat(receipts): add receipt detail with extraction editing"
```

---

### Task 15: Accountant invitations, company profile, notifications and profile

**Files:**
- Create: `app/(client)/muhasebecim.tsx`, `app/(client)/firma-bilgileri.tsx`
- Create: `app/(client)/bildirimler.tsx`, `app/(client)/profil.tsx`
- Create: `src/features/notifications/notificationText.ts`
- Modify: `src/api/endpoints.ts` (grants, company, notifications)
- Test: `src/features/notifications/__tests__/notificationText.test.ts`, `app/(client)/__tests__/muhasebecim.test.tsx`

**Interfaces:**
- Produces:
  - Endpoints: `inviteAccountant(email)`, `listGrants()`, `revokeGrant(grantId)`, `getCompany()`, `saveCompany(data)`, `listNotifications()`, `markNotificationsRead(ids: string[] | null)`.
  - `notificationText(n: NotificationOut): string` — maps a notification `type` + `payload` to Turkish copy. Read `fislik-web/src/pages/NotificationsPage.tsx` for the exact set of types and wording and mirror it.

- [ ] **Step 1: Add the endpoints**

```ts
export type GrantOut = components["schemas"]["GrantOut"];
export type CompanyOut = components["schemas"]["CompanyOut"];
export type CompanyIn = components["schemas"]["CompanyIn"];
export type NotificationsPage = components["schemas"]["NotificationsPage"];
export type NotificationOut = components["schemas"]["NotificationOut"];

export function inviteAccountant(email: string): Promise<GrantOut> {
  return apiFetch<GrantOut>("/grants", { method: "POST", body: JSON.stringify({ email }) });
}

export function listGrants(): Promise<GrantOut[]> {
  return apiFetch<GrantOut[]>("/grants");
}

export function revokeGrant(grantId: string): Promise<void> {
  return apiFetch<void>(`/grants/${grantId}`, { method: "DELETE" });
}

export function getCompany(): Promise<CompanyOut> {
  return apiFetch<CompanyOut>("/company");
}

export function saveCompany(data: CompanyIn): Promise<CompanyOut> {
  return apiFetch<CompanyOut>("/company", { method: "PUT", body: JSON.stringify(data) });
}

export function listNotifications(): Promise<NotificationsPage> {
  return apiFetch<NotificationsPage>("/notifications");
}

export function markNotificationsRead(ids: string[] | null): Promise<void> {
  return apiFetch<void>("/notifications/read", { method: "POST", body: JSON.stringify({ ids }) });
}
```

Confirm the invite request body key against `fislik-web/src/api/endpoints.ts:105` before implementing.

- [ ] **Step 2: Write the failing tests**

`app/(client)/__tests__/muhasebecim.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import AccountantsScreen from "../muhasebecim";
import * as endpoints from "@/src/api/endpoints";

jest.mock("@/src/api/endpoints");
const mocked = endpoints as jest.Mocked<typeof endpoints>;

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AccountantsScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => jest.clearAllMocks());

test("lists an active accountant", async () => {
  mocked.listGrants.mockResolvedValue([
    { id: "g1", status: "active", invited_email: "m@test.com", accountant_name: "Ayşe Yılmaz" },
  ]);
  renderScreen();
  await waitFor(() => expect(screen.getByText("Ayşe Yılmaz")).toBeOnTheScreen());
});

test("shows the invited address while an invitation is pending", async () => {
  mocked.listGrants.mockResolvedValue([
    { id: "g1", status: "pending", invited_email: "m@test.com", accountant_name: null },
  ]);
  renderScreen();
  await waitFor(() => expect(screen.getByText("m@test.com")).toBeOnTheScreen());
  expect(screen.getByText("Davet bekleniyor")).toBeOnTheScreen();
});

test("sends an invitation", async () => {
  mocked.listGrants.mockResolvedValue([]);
  mocked.inviteAccountant.mockResolvedValue({
    id: "g2",
    status: "pending",
    invited_email: "yeni@test.com",
    accountant_name: null,
  });
  renderScreen();
  await waitFor(() => expect(screen.getByLabelText("Mali müşavir e-postası")).toBeOnTheScreen());
  fireEvent.changeText(screen.getByLabelText("Mali müşavir e-postası"), "yeni@test.com");
  fireEvent.press(screen.getByText("Davet gönder"));
  await waitFor(() => expect(mocked.inviteAccountant).toHaveBeenCalledWith("yeni@test.com"));
});
```

`src/features/notifications/__tests__/notificationText.test.ts` asserts one case per notification type produced by the API's `notifications` module — read `fislik-api/app/modules/notifications/` for the full list of `type` values and their payload shapes, and write one assertion per type.

- [ ] **Step 3: Implement the screens**

`muhasebecim.tsx` — a `Card` per grant showing `accountant_name ?? invited_email`, a `Badge` (`Aktif`/`Davet bekleniyor`), and an `Erişimi kaldır` action behind a confirmation `Alert`; below the list, an e-mail `Input` labelled `Mali müşavir e-postası` and a `Davet gönder` button. Every mutation invalidates `queryKeys.grants()`.

`firma-bilgileri.tsx` — a form over `CompanyOut`: `Adı Soyadı`, `Ticaret Ünvanı`, `Vergi Dairesi`, `Vergi Kimlik No` (10 digits, numeric keyboard, validated with `Vergi kimlik no 10 haneli olmalı`), `TC Kimlik No` (11 digits, `TC kimlik no 11 haneli olmalı`), `İş Yeri Adresi` (multiline), `Vergi Türü`, `Faaliyet Kodu`, `Faaliyet Adı`, `İşe Başlama Tarihi`. Saving calls `saveCompany` and invalidates `queryKeys.company()`. Link to it from `profil.tsx`.

`bildirimler.tsx` — a `FlatList` over `listNotifications().items` rendering `notificationText(n)` and `formatDateTime(n.created_at)`, unread rows tinted `${tokens.color.primary}0D`. On mount, call `markNotificationsRead(null)` once and invalidate `queryKeys.notifications()`. Show the unread count as a tab-bar badge via `Tabs.Screen` `options.tabBarBadge`.

`profil.tsx` — the user's name and role (`Mükellef` / `Mali müşavir`), a link to `Firma bilgileri` (client role only), a `Switch` bound to `isBiometricEnabled`/`setBiometricEnabled` labelled `Biyometrik kilit`, hidden when `isBiometricAvailable()` resolves false, and a `Çıkış yap` button calling `signOut`.

- [ ] **Step 4: Run tests and commit**

Run: `npm test && npx tsc --noEmit`

```bash
git add -A
git commit -m "feat(client): add accountant invitations, company profile, notifications and profile"
```

---
# Phase 3 — Accountant role

### Task 16: Client list

**Files:**
- Create: `app/(accountant)/_layout.tsx`, `app/(accountant)/index.tsx`
- Create: `src/features/clients/ClientCard.tsx`
- Modify: `src/api/endpoints.ts` (add `listClients`)
- Test: `app/(accountant)/__tests__/index.test.tsx`

**Interfaces:**
- Consumes: `MonthPicker` (Task 12), theme components (Task 2), lib helpers (Task 9).
- Produces:
  - `listClients(period: string): Promise<ClientSummaryOut[]>` where `ClientSummaryOut = { client_id, full_name, receipt_count, unprocessed_count, last_upload_at }`.
  - `<ClientCard client={ClientSummaryOut} onPress={fn} />`.

- [ ] **Step 1: Add the endpoint**

```ts
export type ClientSummaryOut = components["schemas"]["ClientSummaryOut"];

export function listClients(period: string): Promise<ClientSummaryOut[]> {
  return apiFetch<ClientSummaryOut[]>(`/clients?period=${encodeURIComponent(period)}`);
}
```

- [ ] **Step 2: Write the failing test**

`app/(accountant)/__tests__/index.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react-native";
import ClientsScreen from "../index";
import * as endpoints from "@/src/api/endpoints";

jest.mock("@/src/api/endpoints");
jest.mock("expo-router", () => ({ router: { push: jest.fn() }, Link: ({ children }: never) => children }));

const mocked = endpoints as jest.Mocked<typeof endpoints>;

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ClientsScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => jest.clearAllMocks());

test("lists clients with their unprocessed count", async () => {
  mocked.listClients.mockResolvedValue([
    {
      client_id: "c1",
      full_name: "Selin Ticaret",
      receipt_count: 12,
      unprocessed_count: 3,
      last_upload_at: "2026-08-06T09:00:00Z",
    },
  ]);
  renderScreen();
  await waitFor(() => expect(screen.getByText("Selin Ticaret")).toBeOnTheScreen());
  expect(screen.getByText("3 işlenmemiş")).toBeOnTheScreen();
});

test("omits the unprocessed badge when everything is done", async () => {
  mocked.listClients.mockResolvedValue([
    {
      client_id: "c1",
      full_name: "Selin Ticaret",
      receipt_count: 12,
      unprocessed_count: 0,
      last_upload_at: "2026-08-06T09:00:00Z",
    },
  ]);
  renderScreen();
  await waitFor(() => expect(screen.getByText("Selin Ticaret")).toBeOnTheScreen());
  expect(screen.queryByText(/işlenmemiş/)).toBeNull();
});

test("shows an empty state when no client has granted access", async () => {
  mocked.listClients.mockResolvedValue([]);
  renderScreen();
  await waitFor(() =>
    expect(screen.getByText("Henüz mükellefiniz yok")).toBeOnTheScreen(),
  );
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- "app/(accountant)"`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

`app/(accountant)/_layout.tsx` uses `Tabs` with three screens — `index` (`Mükellefler`, `Users`), `bildirimler` (`Bildirimler`, `Bell`), `profil` (`Profil`, `User`) — with the same styling as the client tab bar. Reuse the notification and profile screens from Task 15 by re-exporting them:

```tsx
// app/(accountant)/bildirimler.tsx
export { default } from "@/app/(client)/bildirimler";
```

`app/(accountant)/index.tsx` holds `period` state from `currentPeriod()`, renders `<MonthPicker>` and a `FlatList` of `ClientCard`s, pushing `/(accountant)/mukellef/${client_id}?period=${period}` on press. Empty state title `Henüz mükellefiniz yok`, description `Mükellefiniz sizi davet ettiğinde burada görünecek.`

`ClientCard` shows the initials avatar (reuse the `initials` helper ported from `fislik-web/src/lib/user.ts`), `full_name`, `` `${receipt_count} fiş` ``, a `Badge` reading `` `${unprocessed_count} işlenmemiş` `` with tone `warning` only when `unprocessed_count > 0`, and `Son yükleme: ${formatDateTime(last_upload_at)}` when set.

- [ ] **Step 5: Run tests and commit**

Run: `npm test && npx tsc --noEmit`

```bash
git add -A
git commit -m "feat(accountant): add the client list screen"
```

---

### Task 17: Client month view with processed marking

**Files:**
- Create: `app/(accountant)/mukellef/[clientId].tsx`
- Modify: `src/api/endpoints.ts` (client receipts, mark/unmark processed, client company)
- Test: `app/(accountant)/__tests__/mukellef.test.tsx`

**Interfaces:**
- Consumes: `queryKeys.clientReceipts` / `.clientCompany` (Task 3), `ReceiptCard` (Task 12).
- Produces:
  - `clientReceipts(clientId, period): Promise<ReceiptOut[]>`
  - `markProcessed(clientId, receiptId): Promise<void>` / `unmarkProcessed(clientId, receiptId): Promise<void>`
  - `bulkMarkProcessed(clientId, period): Promise<{ marked: number }>` / `bulkUnmarkProcessed(clientId, period): Promise<{ unmarked: number }>`
  - `getClientCompany(clientId): Promise<CompanyOut>`

- [ ] **Step 1: Add the endpoints**

Mirror `fislik-web/src/api/endpoints.ts:130-180` exactly — read it first, especially the HTTP methods and whether `period` travels in the body or the query string for each of the four processed-marking calls.

```ts
export function clientReceipts(clientId: string, period: string): Promise<ReceiptOut[]> {
  return apiFetch<ReceiptOut[]>(
    `/clients/${clientId}/receipts?period=${encodeURIComponent(period)}`,
  );
}

export function getClientCompany(clientId: string): Promise<CompanyOut> {
  return apiFetch<CompanyOut>(`/clients/${clientId}/company`);
}
```

- [ ] **Step 2: Write the failing test**

`app/(accountant)/__tests__/mukellef.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import ClientMonthScreen from "../mukellef/[clientId]";
import * as endpoints from "@/src/api/endpoints";

jest.mock("@/src/api/endpoints");
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ clientId: "c1", period: "2026-08" }),
  router: { push: jest.fn(), back: jest.fn() },
  Link: ({ children }: never) => children,
}));

const mocked = endpoints as jest.Mocked<typeof endpoints>;

const receipt = {
  id: "r1",
  period: "2026-08",
  created_at: "2026-08-05T10:00:00Z",
  image_url: "https://r2/r1.jpg",
  processed: false,
  open_issue: null,
};

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ClientMonthScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mocked.getClientCompany.mockResolvedValue({} as never);
});

test("marks every unprocessed receipt of the month", async () => {
  mocked.clientReceipts.mockResolvedValue([receipt] as never);
  mocked.bulkMarkProcessed.mockResolvedValue({ marked: 1 });
  renderScreen();
  await waitFor(() => expect(screen.getByText("Tümünü işlendi yap")).toBeOnTheScreen());
  fireEvent.press(screen.getByText("Tümünü işlendi yap"));
  await waitFor(() => expect(mocked.bulkMarkProcessed).toHaveBeenCalledWith("c1", "2026-08"));
});

test("hides the bulk action when nothing is unprocessed", async () => {
  mocked.clientReceipts.mockResolvedValue([{ ...receipt, processed: true }] as never);
  renderScreen();
  await waitFor(() => expect(screen.getByText("İşlendi")).toBeOnTheScreen());
  expect(screen.queryByText("Tümünü işlendi yap")).toBeNull();
});

test("shows an empty state for a month with no receipts", async () => {
  mocked.clientReceipts.mockResolvedValue([]);
  renderScreen();
  await waitFor(() =>
    expect(screen.getByText("Bu ay için fiş yüklenmemiş")).toBeOnTheScreen(),
  );
});
```

- [ ] **Step 3: Run to verify failure, then implement**

The screen reads `clientId` and `period` from `useLocalSearchParams`, renders a header with the client's name and a `MonthPicker` bound to `period` (updating the route params), a collapsible `Firma bilgileri` card from `getClientCompany`, a two-column `FlatList` of `ReceiptCard`s pushing `/(accountant)/mukellef/${clientId}/fis/${id}`, and an action bar. The action bar shows `Tümünü işlendi yap` when at least one receipt has `processed === false`, and `Tümünün işaretini kaldır` otherwise; both invalidate `queryKeys.clientReceipts(clientId, period)` and `queryKeys.clients(period)`. A long press on a card toggles that single receipt via `markProcessed`/`unmarkProcessed`. Empty state: `Bu ay için fiş yüklenmemiş`.

- [ ] **Step 4: Run tests and commit**

Run: `npm test && npx tsc --noEmit`

```bash
git add -A
git commit -m "feat(accountant): add the client month view with processed marking"
```

---

### Task 18: Issue reporting on the accountant's receipt detail

**Files:**
- Create: `app/(accountant)/mukellef/[clientId]/fis/[id].tsx`
- Create: `src/features/receipts/IssueSection.tsx`
- Modify: `src/api/endpoints.ts` (add `openIssue`, `resolveIssue`)
- Test: `src/features/receipts/__tests__/IssueSection.test.tsx`

**Interfaces:**
- Consumes: `ExtractionEditor` (Task 14).
- Produces:
  - `openIssue(clientId, receiptId, message): Promise<IssueOut>` — posts to `/clients/{clientId}/receipts/{receiptId}/issues`.
  - `resolveIssue(issueId): Promise<void>` — posts to `/issues/{issueId}/resolve`.
  - `<IssueSection issue={IssueOut | null} onOpen={(message: string) => Promise<void>} onResolve={() => Promise<void>} />`

- [ ] **Step 1: Add the endpoints**

```ts
export type IssueOut = components["schemas"]["IssueOut"];

export function openIssue(clientId: string, receiptId: string, message: string): Promise<IssueOut> {
  return apiFetch<IssueOut>(`/clients/${clientId}/receipts/${receiptId}/issues`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export function resolveIssue(issueId: string): Promise<void> {
  return apiFetch<void>(`/issues/${issueId}/resolve`, { method: "POST" });
}
```

- [ ] **Step 2: Write the failing test**

`src/features/receipts/__tests__/IssueSection.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { IssueSection } from "../IssueSection";

test("reports a new issue", async () => {
  const onOpen = jest.fn().mockResolvedValue(undefined);
  render(<IssueSection issue={null} onOpen={onOpen} onResolve={jest.fn()} />);
  fireEvent.press(screen.getByText("Sorun bildir"));
  fireEvent.changeText(screen.getByLabelText("Sorun açıklaması"), "Fiş okunmuyor");
  fireEvent.press(screen.getByText("Gönder"));
  await waitFor(() => expect(onOpen).toHaveBeenCalledWith("Fiş okunmuyor"));
});

test("does not submit an empty message", () => {
  const onOpen = jest.fn();
  render(<IssueSection issue={null} onOpen={onOpen} onResolve={jest.fn()} />);
  fireEvent.press(screen.getByText("Sorun bildir"));
  fireEvent.press(screen.getByText("Gönder"));
  expect(onOpen).not.toHaveBeenCalled();
  expect(screen.getByText("Lütfen sorunu açıklayın")).toBeOnTheScreen();
});

test("shows an open issue and resolves it", async () => {
  const onResolve = jest.fn().mockResolvedValue(undefined);
  render(
    <IssueSection
      issue={{
        id: "i1",
        message: "Fiş okunmuyor",
        author_name: "Ayşe Yılmaz",
        created_at: "2026-08-06T09:00:00Z",
      }}
      onOpen={jest.fn()}
      onResolve={onResolve}
    />,
  );
  expect(screen.getByText("Fiş okunmuyor")).toBeOnTheScreen();
  expect(screen.getByText("Ayşe Yılmaz")).toBeOnTheScreen();
  fireEvent.press(screen.getByText("Sorunu çöz"));
  await waitFor(() => expect(onResolve).toHaveBeenCalled());
});
```

- [ ] **Step 3: Run to verify failure, then implement**

`IssueSection` renders, when `issue` is null, a `Sorun bildir` button that opens a `Modal` with a multiline `Input` labelled `Sorun açıklaması` and a `Gönder` button; an empty message shows `Lütfen sorunu açıklayın` and does not call `onOpen`. When `issue` is set it renders a `warning`-toned card with the message, `author_name`, `formatDateTime(created_at)`, and a `Sorunu çöz` button.

The accountant's receipt detail screen reuses the layout from Task 14 — zoomable image plus `ExtractionEditor` — and adds `IssueSection`. Mutations invalidate `queryKeys.clientReceipts(clientId, period)`.

- [ ] **Step 4: Run tests and commit**

Run: `npm test && npx tsc --noEmit`

```bash
git add -A
git commit -m "feat(accountant): add issue reporting and resolution on receipt detail"
```

---

### Task 19: Monthly ZIP export via the share sheet

**Files:**
- Create: `src/features/clients/downloadMonthZip.ts`
- Modify: `app/(accountant)/mukellef/[clientId].tsx` (export action)
- Test: `src/features/clients/__tests__/downloadMonthZip.test.ts`

**Interfaces:**
- Consumes: `API_URL`, `currentToken` (Tasks 3–4).
- Produces: `downloadMonthZip(clientId: string, period: string): Promise<void>` — downloads with the Bearer header, then opens the system share sheet. Throws `ApiError(404, …)` when the month is empty so the caller can show an empty-state message instead of an error.

- [ ] **Step 1: Write the failing test**

`src/features/clients/__tests__/downloadMonthZip.test.ts`:

```ts
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { downloadMonthZip } from "../downloadMonthZip";
import { ApiError } from "@/src/api/client";

jest.mock("expo-file-system", () => ({
  cacheDirectory: "file:///cache/",
  downloadAsync: jest.fn(),
}));
jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));
jest.mock("@/src/auth/session", () => ({ currentToken: () => "jwt-1" }));

const fs = FileSystem as jest.Mocked<typeof FileSystem>;
const sharing = Sharing as jest.Mocked<typeof Sharing>;

beforeEach(() => jest.clearAllMocks());

test("downloads with the bearer header and shares the file", async () => {
  fs.downloadAsync.mockResolvedValue({ status: 200, uri: "file:///cache/f.zip" } as never);
  await downloadMonthZip("c1", "2026-08");
  expect(fs.downloadAsync).toHaveBeenCalledWith(
    expect.stringContaining("/clients/c1/receipts.zip?period=2026-08"),
    expect.stringContaining("fislik-c1-2026-08.zip"),
    { headers: { Authorization: "Bearer jwt-1" } },
  );
  expect(sharing.shareAsync).toHaveBeenCalledWith("file:///cache/f.zip", expect.anything());
});

test("reports an empty month as a 404 ApiError", async () => {
  fs.downloadAsync.mockResolvedValue({ status: 404, uri: "file:///cache/f.zip" } as never);
  await expect(downloadMonthZip("c1", "2026-08")).rejects.toMatchObject({
    name: "ApiError",
    status: 404,
  });
  expect(sharing.shareAsync).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Implement**

```bash
npx expo install expo-sharing
```

`src/features/clients/downloadMonthZip.ts`:

```ts
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { API_URL, ApiError } from "@/src/api/client";
import { currentToken } from "@/src/auth/session";

/**
 * Downloads a client's monthly receipt archive and hands it to the system
 * share sheet, which is the native equivalent of the web app's download link.
 * The url cannot carry the token, so the request goes through downloadAsync
 * with an explicit Authorization header.
 */
export async function downloadMonthZip(clientId: string, period: string): Promise<void> {
  const target = `${FileSystem.cacheDirectory}fislik-${clientId}-${period}.zip`;
  const result = await FileSystem.downloadAsync(
    `${API_URL}/clients/${clientId}/receipts.zip?period=${encodeURIComponent(period)}`,
    target,
    { headers: { Authorization: `Bearer ${currentToken() ?? ""}` } },
  );
  if (result.status === 404) {
    throw new ApiError(404, "Bu ay için indirilecek fiş yok");
  }
  if (result.status < 200 || result.status >= 300) {
    throw new ApiError(result.status, "Arşiv indirilemedi");
  }
  if (!(await Sharing.isAvailableAsync())) {
    throw new ApiError(0, "Bu cihazda dosya paylaşımı kullanılamıyor");
  }
  await Sharing.shareAsync(result.uri, {
    mimeType: "application/zip",
    dialogTitle: `Fişlik ${period}`,
  });
}
```

- [ ] **Step 3: Wire the action**

Add an `Arşivi indir` button to the client month screen's action bar. It shows a `Spinner` while downloading and surfaces failures with `errorMessage(error)` in an inline `ErrorCard`.

- [ ] **Step 4: Run tests and verify on a device**

Run: `npm test -- src/features/clients && npx tsc --noEmit`

Manual: on both platforms, export a month with receipts and confirm the share sheet opens and the saved archive contains the expected images.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(accountant): export a client's monthly archive to the share sheet"
```

---

# Phase 4 — Release

### Task 20: Error boundary and network-aware error copy

**Files:**
- Create: `app/+error.tsx` (expo-router error boundary), `app/+not-found.tsx`
- Modify: `app/_layout.tsx`
- Test: `app/__tests__/error.test.tsx`

**Interfaces:**
- Consumes: `errorMessage` (Task 6), theme components (Task 2).
- Produces: an `ErrorBoundary` export that expo-router picks up, rendering a recovery screen instead of a blank view.

- [ ] **Step 1: Write the failing test**

`app/__tests__/error.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ErrorBoundary } from "../+error";

test("renders a recovery screen and retries", () => {
  const retry = jest.fn();
  render(<ErrorBoundary error={new Error("boom")} retry={retry} />);
  expect(screen.getByText("Bir şeyler ters gitti")).toBeOnTheScreen();
  fireEvent.press(screen.getByText("Tekrar dene"));
  expect(retry).toHaveBeenCalled();
});
```

- [ ] **Step 2: Implement**

`app/+error.tsx`:

```tsx
import { StyleSheet, Text, View } from "react-native";
import { tokens } from "@/src/theme/tokens";
import { text } from "@/src/theme/typography";
import { Button } from "@/src/theme/components/Button";

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <View style={styles.root}>
      <Text style={text.title}>Bir şeyler ters gitti</Text>
      <Text style={[text.body, styles.detail]}>{error.message}</Text>
      <Button title="Tekrar dene" onPress={retry} />
    </View>
  );
}

export default ErrorBoundary;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    gap: tokens.space(4),
    alignItems: "center",
    justifyContent: "center",
    padding: tokens.space(6),
    backgroundColor: tokens.color.page,
  },
  detail: { color: tokens.color.inkSoft, textAlign: "center" },
});
```

`app/+not-found.tsx` renders `Sayfa bulunamadı` with a button back to `/`.

- [ ] **Step 3: Run tests and commit**

Run: `npm test && npx tsc --noEmit`

```bash
git add -A
git commit -m "feat: add error boundary and not-found screens"
```

---

### Task 21: Store assets, EAS build and submit configuration

**Files:**
- Create: `assets/icon.png` (1024×1024), `assets/adaptive-icon.png`, `assets/splash.png`
- Create: `eas.json`
- Modify: `app.config.ts`
- Create: `README.md`

**Interfaces:**
- Produces: `eas build --profile production` and `eas submit` runnable for both platforms.

- [ ] **Step 1: Produce the assets**

Derive the icon from `fislik-web/src/components/FislikMark.tsx` and `fislik-web/public/icons/icon-512.png`: the mark centred on a `#0f766e` field for `icon.png` and `adaptive-icon.png` (foreground on a transparent background, safe area within the inner 66%), and the mark on `#e9eeed` for `splash.png`.

- [ ] **Step 2: Reference them from the config**

```ts
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#e9eeed",
  },
  android: {
    package: "dev.selamet.fislik",
    edgeToEdgeEnabled: true,
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0f766e",
    },
  },
```

- [ ] **Step 3: Write `eas.json`**

```json
{
  "cli": { "version": ">= 12.0.0", "appVersionSource": "remote" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": { "EXPO_PUBLIC_API_URL": "http://localhost:8000" }
    },
    "preview": {
      "distribution": "internal",
      "env": { "EXPO_PUBLIC_API_URL": "https://fislik-api.selamet.dev" }
    },
    "production": {
      "autoIncrement": true,
      "env": { "EXPO_PUBLIC_API_URL": "https://fislik-api.selamet.dev" }
    }
  },
  "submit": { "production": {} }
}
```

- [ ] **Step 4: Write the README**

Cover: prerequisites, `npm install`, `cp .env.example .env`, `npm run gen:api`, `npx expo start`, running against a local API (device on the same network needs the machine's LAN IP in `EXPO_PUBLIC_API_URL`, not `localhost`), `npm test`, `npx tsc --noEmit`, and the EAS build/submit commands per profile. Note the API dependency: fislik-api must have Bearer auth deployed.

- [ ] **Step 5: Build and verify**

Run: `eas build --profile preview --platform all`
Install both artifacts on real devices and run the manual checklist in Task 22.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: add store assets, EAS build profiles and README"
```

---

### Task 22: Release verification

**Files:**
- Create: `docs/manual-test-checklist.md`

- [ ] **Step 1: Write the checklist**

Record it as a document so it can be re-run before every release. Each item, on **both** iOS and Android:

- Register a new client; register an accountant through an invite link.
- Log out, log back in, force quit, relaunch — the session survives.
- Enable biometric unlock, force quit, relaunch — the prompt appears; cancelling offers sign-out; unlocking restores the session.
- Burst-capture five receipts without leaving the camera; all five appear as `Yükleniyor` and resolve into real receipts.
- Turn on airplane mode, capture three receipts, force quit, relaunch, turn networking back on — all three upload without intervention.
- Point the app at an unreachable API and confirm the copy reads `İnternet bağlantısı yok` rather than a server message.
- Edit an extraction, change a receipt's month, delete a receipt.
- Upload a PDF from Files.
- As the accountant: open a client's month, mark one receipt processed, mark all processed, unmark, report an issue, resolve it.
- Export a month's archive and confirm the share sheet opens with a valid ZIP.
- Open a `/davet/:token` link from Mail with the app installed and with it uninstalled.
- Confirm every screen renders correctly at the smallest supported size (iPhone SE) and with the OS font size increased.

- [ ] **Step 2: Run the checklist and fix what it surfaces**

Each fix is its own commit. Do not submit to the stores with any item failing.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: add the pre-release manual test checklist"
```

---

## Notes for the implementer

**Read before starting any task in Phase 2 or 3:** the corresponding screen in
`fislik-web/src/pages/`. This plan describes behaviour and copy, but the web app
is the reference for layout, ordering, and wording. Where they disagree, the web
app wins for anything user-visible and this plan wins for architecture.

**Never hand-write an API payload type.** If a type is missing from
`src/api/generated/schema.d.ts`, the API does not expose it — check the router,
and regenerate rather than inventing a shape.

**When a test needs a real API,** run fislik-api locally with
`docker compose up` and point `EXPO_PUBLIC_API_URL` at it. Unit tests never hit
the network; they mock `@/src/api/endpoints`.
