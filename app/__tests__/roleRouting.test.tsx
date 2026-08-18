import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { router } from "expo-router";
import { act, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { Text } from "react-native";
import * as rootLayout from "../_layout";
import Index from "../index";
import AccountantTabsLayout from "../(accountant)/_layout";
import * as accountantStack from "../(accountant)/(mukellefler)/_layout";
import ClientTabsLayout from "../(client)/_layout";
import * as clientStack from "../(client)/(fisler)/_layout";
import { createTestQueryClient } from "@/src/test/queryClient";

/**
 * The role dispatch, driven through REAL expo-router navigation rather than a
 * `jest.mock("expo-router", ...)` stub — `app/__tests__/index.test.tsx`
 * already pins which href `Index` asks for, and that assertion passed
 * throughout the outage this file exists to prevent. Asking for the right
 * href is not the same as arriving at the right screen: three routes resolve
 * to the bare path `/` (this `index` plus each role's list, both of which sit
 * inside a route group that contributes no URL segment), so where `/(client)`
 * actually lands is decided by expo-router's route tree, and only a real
 * route tree can answer it.
 *
 * What is real here: the root layout module (for its `unstable_settings`
 * anchor, which is the fix), `app/index.tsx`, both role tab layouts and both
 * nested stack layouts — every file that participates in the decision. The
 * leaf screens are stand-ins; which shell mounted is the only question being
 * asked, and the real lists pull in the upload queue, a camera and the
 * notification poller.
 *
 * Remove `unstable_settings` from `app/_layout.tsx` and every client case
 * below fails with the accountant's list on screen — the exact device report.
 */
const mockUseAuth = jest.fn();
jest.mock("@/src/auth/AuthProvider", () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}));
jest.mock("@/src/onboarding/introSeen", () => ({ hasSeenIntro: () => Promise.resolve(true) }));
jest.mock("@/src/api/endpoints");
// The real root layout is imported for its `unstable_settings` and rendered
// as-is; these are the native-backed modules it reaches on the way in.
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));
jest.mock("@/src/upload/worker", () => ({ startWorker: () => () => undefined }));
jest.mock("@/src/theme/components/SplashOverlay", () => ({
  SAFETY_TIMEOUT_MS: 2500,
  SplashOverlay: () => null,
}));

const CLIENT_SHELL = "Fişler listesi";
const ACCOUNTANT_SHELL = "Mükellefler listesi";

function renderApp(role: "client" | "accountant", initialUrl: string) {
  mockUseAuth.mockReturnValue({ status: "authed", user: { id: "u1", role } });
  const queryClient = createTestQueryClient();
  return renderRouter(
    {
      _layout: { ...rootLayout },
      index: Index,
      tanitim: () => <Text>Tanıtım</Text>,
      "(auth)/giris": () => <Text>Giriş</Text>,
      "(auth)/kayit": () => <Text>Kayıt</Text>,
      "(auth)/davet/[token]": () => <Text>Davet</Text>,
      "(auth)/sifre-sifirla/index": () => <Text>Şifre sıfırla</Text>,
      "(auth)/sifre-sifirla/[token]": () => <Text>Şifre sıfırla</Text>,
      "+not-found": () => <Text>Bulunamadı</Text>,
      "(client)/_layout": ClientTabsLayout,
      "(client)/(fisler)/_layout": { ...clientStack },
      "(client)/(fisler)/index": () => <Text>{CLIENT_SHELL}</Text>,
      "(client)/(fisler)/fis/[id]": () => <Text>Fiş detayı</Text>,
      "(client)/muhasebecim": () => <Text>Muhasebecim</Text>,
      "(client)/kamera": () => <Text>Kamera</Text>,
      "(client)/bildirimler": () => <Text>Bildirimler</Text>,
      "(client)/profil": () => <Text>Profil</Text>,
      "(client)/firma-bilgileri": () => <Text>Firma bilgileri</Text>,
      "(client)/yardim": () => <Text>Yardım</Text>,
      "(accountant)/_layout": AccountantTabsLayout,
      "(accountant)/(mukellefler)/_layout": { ...accountantStack },
      "(accountant)/(mukellefler)/index": () => <Text>{ACCOUNTANT_SHELL}</Text>,
      "(accountant)/(mukellefler)/mukellef/[clientId]": () => <Text>Mükellef</Text>,
      "(accountant)/(mukellefler)/mukellef/[clientId]/fis/[id]": () => <Text>Fiş detayı</Text>,
      "(accountant)/(mukellefler)/mukellef/[clientId]/kamera": () => <Text>Kamera</Text>,
      "(accountant)/bildirimler": () => <Text>Bildirimler</Text>,
      "(accountant)/profil": () => <Text>Profil</Text>,
      "(accountant)/mukellefleri-yonet": () => <Text>Mükellefleri yönet</Text>,
      "(accountant)/yardim": () => <Text>Yardım</Text>,
    },
    {
      initialUrl,
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    },
  );
}

/** Fails naming the shell that actually mounted, so a wrong-role landing reads as one line. */
async function expectShell(role: "client" | "accountant") {
  const wanted = role === "client" ? CLIENT_SHELL : ACCOUNTANT_SHELL;
  const other = role === "client" ? ACCOUNTANT_SHELL : CLIENT_SHELL;
  await waitFor(() => {
    if (screen.queryByText(wanted)) return;
    throw new Error(
      screen.queryByText(other)
        ? `a signed-in ${role} landed in the ${role === "client" ? "accountant" : "client"} shell ("${other}")`
        : `a signed-in ${role} reached neither role shell`,
    );
  });
}

beforeEach(() => jest.clearAllMocks());

/**
 * Must stay FIRST in this file, and is the only case here that leans on
 * `initialUrl`: `renderRouter` renders into expo-router's module-level store,
 * which keeps the previous test's navigation state, so a later render's
 * `initialUrl` is not re-resolved. Every other case below therefore drives a
 * real `router.replace`, which is also what the app itself does from each of
 * those entry points.
 */
test("a signed-in client opening the app cold lands in the client shell", async () => {
  renderApp("client", "/");
  await expectShell("client");
});

test.each(["client", "accountant"] as const)(
  "a %s signing in lands in their own shell",
  async (role) => {
    renderApp(role, "/giris");
    // What `app/(auth)/giris.tsx` does after `signIn()` resolves.
    act(() => router.replace("/"));
    await expectShell(role);
  },
);

test("a newly registered accountant lands in the accountant shell", async () => {
  renderApp("accountant", "/kayit");
  // `app/(auth)/kayit.tsx`'s accountant branch.
  act(() => router.replace("/"));
  await expectShell("accountant");
});

test("a newly registered client lands in the client shell after company onboarding", async () => {
  renderApp("client", "/kayit");
  // `app/(auth)/kayit.tsx`'s client branch: mandatory company setup first...
  act(() =>
    router.replace({ pathname: "/(client)/firma-bilgileri", params: { onboarding: "1" } }),
  );
  await waitFor(() => expect(screen.getByText("Firma bilgileri")).toBeOnTheScreen());
  // ...then that screen's own exits (skip, or a successful save) route through "/".
  act(() => router.replace("/"));
  await expectShell("client");
});

test.each(["client", "accountant"] as const)(
  "a %s leaving the intro tour lands in their own shell",
  async (role) => {
    renderApp(role, "/tanitim");
    // `app/tanitim.tsx`'s `finish()`.
    act(() => router.replace("/"));
    await expectShell(role);
  },
);

test("a signed-out visitor still reaches the login screen instead of either shell", async () => {
  renderApp("client", "/kayit");
  mockUseAuth.mockReturnValue({ status: "anon", user: null });
  act(() => router.replace("/"));
  await waitFor(() => expect(screen.getByText("Giriş")).toBeOnTheScreen());
  expect(screen.queryByText(CLIENT_SHELL)).toBeNull();
  expect(screen.queryByText(ACCOUNTANT_SHELL)).toBeNull();
});
