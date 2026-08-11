import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Redirect } from "expo-router";
import { Text } from "react-native";
import { AuthGate } from "../AuthGate";
import { AuthProvider, useAuth } from "../AuthProvider";
import * as endpoints from "@/src/api/endpoints";
import * as session from "../session";
import * as biometrics from "../biometrics";
import { ApiError } from "@/src/api/client";
import { createTestQueryClient } from "@/src/test/queryClient";

/**
 * End-to-end check for the bug this whole guard exists to fix: the real
 * `AuthProvider` wired through the real `AuthGate` to a real "Çıkış yap"
 * press, and to a real 401 from `/me`. The unit tests in AuthGate.test.tsx
 * prove the guard's own branching is correct in isolation; these prove the
 * two pieces actually compose — that a signed-out session is not just
 * *reported* (`status === "anon"`) but *acted on* (a Redirect to `/giris`
 * comes out the other end). Existing coverage before this fix only ever
 * asserted that pressing "Çıkış yap" called `signOut` — never that it
 * results in navigation — which is exactly how the app shipped broken with
 * a fully green suite.
 */
jest.mock("expo-router", () => ({ Redirect: jest.fn(() => null) }));
jest.mock("@/src/api/endpoints");
jest.mock("../session");
jest.mock("../biometrics", () => ({ requestUnlock: jest.fn() }));

const mockedRedirect = Redirect as jest.Mock;
const mockedEndpoints = endpoints as jest.Mocked<typeof endpoints>;
const mockedSession = session as jest.Mocked<typeof session>;
const mockedBiometrics = biometrics as jest.Mocked<typeof biometrics>;

function SignOutButton() {
  const { signOut } = useAuth();
  return <Text onPress={() => signOut()}>Çıkış yap</Text>;
}

function renderGuardedScreen() {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGate>
          <SignOutButton />
        </AuthGate>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedSession.clearSession.mockResolvedValue(undefined);
  mockedSession.saveSession.mockResolvedValue(undefined);
  mockedBiometrics.requestUnlock.mockResolvedValue(true);
  mockedEndpoints.logout.mockResolvedValue(undefined as never);
});

test("signing out from a screen inside a protected group lands the user at /giris", async () => {
  mockedSession.loadSession.mockResolvedValue("jwt-1");
  mockedEndpoints.getMe.mockResolvedValue({
    id: "u1",
    email: "a@b.com",
    full_name: "Selin",
    role: "client",
    impersonated: false,
  });
  renderGuardedScreen();

  await waitFor(() => expect(screen.getByText("Çıkış yap")).toBeOnTheScreen());
  expect(mockedRedirect).not.toHaveBeenCalled();

  fireEvent.press(screen.getByText("Çıkış yap"));

  await waitFor(() => expect(mockedRedirect).toHaveBeenCalledWith({ href: "/giris" }, undefined));
});

test("a 401 from /me strands the user the same way a deliberate sign-out does — landed at /giris, not left on the screen", async () => {
  mockedSession.loadSession.mockResolvedValue("stale-jwt");
  mockedEndpoints.getMe.mockRejectedValue(new ApiError(401, "Invalid or expired token"));
  renderGuardedScreen();

  await waitFor(() => expect(mockedRedirect).toHaveBeenCalledWith({ href: "/giris" }, undefined));
});

test("a signed-in user on a cold start is not redirected while the session is still restoring", async () => {
  // loadSession() never resolves within the test — the whole window this
  // guard must sit through as "loading", not "anon".
  mockedSession.loadSession.mockReturnValue(new Promise(() => {}));
  renderGuardedScreen();

  expect(mockedRedirect).not.toHaveBeenCalled();
  expect(screen.queryByText("Çıkış yap")).toBeNull();
});
