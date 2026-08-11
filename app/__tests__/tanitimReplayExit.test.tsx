import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Redirect } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import TanitimScreen from "../tanitim";
import Index from "../index";

// TanitimScreen has no ancestor layout to inherit safe-area insets from and
// reads useSafeAreaInsets() itself (see app/tanitim.tsx) — that throws
// outside a SafeAreaProvider.
const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

/**
 * C1 regression pin (Task 6 review): the help page lets an authed user
 * replay the tour from Profil, which the tour was never built for — it
 * used to hardcode its exit to `/giris`, stranding a signed-in user on the
 * login form. A test that only asserts `router.replace` was called with
 * *some* string would not have caught that; this one captures the exact
 * href `finish()` navigates to, then mounts the real (unmocked-logic)
 * `app/index.tsx` — the entry route that href points at — with an authed
 * session, and asserts it lands in that user's own shell rather than on
 * `/giris`.
 */
jest.mock("@/src/onboarding/introSeen", () => ({
  markIntroSeen: jest.fn().mockResolvedValue(undefined),
  // `finish()` marks the flag seen before navigating to "/", so the
  // real `app/index.tsx` this test then mounts must read it back as
  // seen — otherwise it would (correctly) send the user back to the
  // tour instead of their shell, which is not what this regression pin
  // is checking.
  hasSeenIntro: jest.fn().mockResolvedValue(true),
}));

let lastReplacedHref: string | undefined;
jest.mock("expo-router", () => ({
  router: {
    replace: (href: string) => {
      lastReplacedHref = href;
    },
  },
  Redirect: jest.fn(() => null),
}));

const mockUseAuth = jest.fn();
jest.mock("@/src/auth/AuthProvider", () => ({ useAuth: () => mockUseAuth() }));
jest.mock("@/src/auth/LockedScreen", () => ({ LockedScreen: () => null }));

const mockedRedirect = Redirect as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  lastReplacedHref = undefined;
});

test("a signed-in client finishing a replayed tour lands back in their own shell, not the login screen", async () => {
  mockUseAuth.mockReturnValue({ status: "authed", user: { id: "u1", role: "client" } });

  render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <TanitimScreen />
    </SafeAreaProvider>,
  );
  fireEvent.press(screen.getByText("Geç"));
  await waitFor(() => expect(lastReplacedHref).toBe("/"));

  // Mount the real entry route with the exact href `finish()` navigated
  // to, and confirm it dispatches an authed client to their tab group —
  // not to `/giris`, which is what the pre-fix hardcoded exit produced
  // regardless of session state.
  render(<Index />);
  await waitFor(() => expect(mockedRedirect).toHaveBeenCalledWith({ href: "/(client)" }, undefined));
  expect(mockedRedirect).not.toHaveBeenCalledWith({ href: "/giris" }, expect.anything());
});

test("a signed-in accountant finishing a replayed tour lands in the accountant shell", async () => {
  mockUseAuth.mockReturnValue({ status: "authed", user: { id: "u2", role: "accountant" } });

  render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <TanitimScreen />
    </SafeAreaProvider>,
  );
  fireEvent.press(screen.getByText("Geç"));
  await waitFor(() => expect(lastReplacedHref).toBe("/"));

  render(<Index />);
  await waitFor(() => expect(mockedRedirect).toHaveBeenCalledWith({ href: "/(accountant)" }, undefined));
  expect(mockedRedirect).not.toHaveBeenCalledWith({ href: "/giris" }, expect.anything());
});
