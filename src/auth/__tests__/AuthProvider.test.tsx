import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { AuthProvider, useAuth } from "../AuthProvider";
import * as endpoints from "@/src/api/endpoints";
import * as session from "../session";
import { ApiError } from "@/src/api/client";
import { createTestQueryClient } from "@/src/test/queryClient";

jest.mock("@/src/api/endpoints");
jest.mock("../session");

const mockedEndpoints = endpoints as jest.Mocked<typeof endpoints>;
const mockedSession = session as jest.Mocked<typeof session>;

function Probe() {
  const { status, user } = useAuth();
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
  // Jest's automock returns `undefined` from every mocked function, but the
  // real clearSession() returns a Promise<void> — honour that contract so
  // production code that awaits it isn't tested against a shape it will
  // never see for real.
  mockedSession.clearSession.mockResolvedValue(undefined);
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
