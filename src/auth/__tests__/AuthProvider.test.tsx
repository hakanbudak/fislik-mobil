import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { AuthProvider, useAuth, type Status } from "../AuthProvider";
import * as endpoints from "@/src/api/endpoints";
import * as session from "../session";
import * as biometrics from "../biometrics";
import { ApiError } from "@/src/api/client";
import { createTestQueryClient } from "@/src/test/queryClient";

jest.mock("@/src/api/endpoints");
jest.mock("../session");
jest.mock("../biometrics", () => ({ requestUnlock: jest.fn() }));

const mockedEndpoints = endpoints as jest.Mocked<typeof endpoints>;
const mockedSession = session as jest.Mocked<typeof session>;
const mockedBiometrics = biometrics as jest.Mocked<typeof biometrics>;

let latestRetryUnlock: (() => Promise<void>) | null = null;

function Probe() {
  const { status, user, retryUnlock } = useAuth();
  latestRetryUnlock = retryUnlock;
  return <Text>{`${status}:${user?.full_name ?? "-"}`}</Text>;
}

function renderProbe() {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  latestRetryUnlock = null;
  // Jest's automock returns `undefined` from every mocked function, but the
  // real clearSession() returns a Promise<void> — honour that contract so
  // production code that awaits it isn't tested against a shape it will
  // never see for real.
  mockedSession.clearSession.mockResolvedValue(undefined);
  // Default: feature untouched by these pre-existing tests, so the launch
  // gate never engages unless a test opts in below.
  mockedBiometrics.requestUnlock.mockResolvedValue(true);
});

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
    impersonated: false,
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

test("reports locked when a stored token's biometric prompt is cancelled", async () => {
  mockedSession.loadSession.mockResolvedValue("jwt-1");
  mockedEndpoints.getMe.mockResolvedValue({
    id: "u1",
    email: "a@b.com",
    full_name: "Selin",
    role: "client",
    impersonated: false,
  });
  mockedBiometrics.requestUnlock.mockResolvedValue(false);
  renderProbe();
  await waitFor(() => expect(screen.getByText(/^locked:/)).toBeOnTheScreen());
});

test("unlocks into authed once retryUnlock succeeds", async () => {
  mockedSession.loadSession.mockResolvedValue("jwt-1");
  mockedEndpoints.getMe.mockResolvedValue({
    id: "u1",
    email: "a@b.com",
    full_name: "Selin",
    role: "client",
    impersonated: false,
  });
  mockedBiometrics.requestUnlock.mockResolvedValue(false);
  renderProbe();
  await waitFor(() => expect(screen.getByText(/^locked:/)).toBeOnTheScreen());

  mockedBiometrics.requestUnlock.mockResolvedValue(true);
  await act(async () => {
    await latestRetryUnlock?.();
  });

  await waitFor(() => expect(screen.getByText("authed:Selin")).toBeOnTheScreen());
});
