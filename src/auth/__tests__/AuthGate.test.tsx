import { render, screen } from "@testing-library/react-native";
import { Redirect } from "expo-router";
import { Text } from "react-native";
import { AuthGate } from "../AuthGate";
import { useAuth } from "../AuthProvider";

// Isolated branch tests: `useAuth` is mocked so each `status` can be driven
// directly, independent of AuthProvider's own logic (that's covered by
// AuthProvider.test.tsx and, end-to-end, by AuthGate.integration.test.tsx).
jest.mock("../AuthProvider", () => ({ useAuth: jest.fn() }));
jest.mock("expo-router", () => ({ Redirect: jest.fn(() => null) }));

const mockedUseAuth = useAuth as jest.Mock;
const mockedRedirect = Redirect as jest.Mock;

beforeEach(() => jest.clearAllMocks());

function renderGate() {
  return render(
    <AuthGate>
      <Text>protected content</Text>
    </AuthGate>,
  );
}

test("shows the spinner during the loading window, without redirecting — a cold start with a valid session must not bounce to the login screen", () => {
  mockedUseAuth.mockReturnValue({ status: "loading" });
  renderGate();
  expect(mockedRedirect).not.toHaveBeenCalled();
  expect(screen.queryByText("protected content")).toBeNull();
});

test("shows the locked screen, without redirecting, when biometric unlock is pending", () => {
  mockedUseAuth.mockReturnValue({ status: "locked", retryUnlock: jest.fn(), signOut: jest.fn() });
  renderGate();
  expect(mockedRedirect).not.toHaveBeenCalled();
  expect(screen.getByText("Devam etmek için kilidi açın.")).toBeOnTheScreen();
});

test("redirects to /giris once the session is settled as anon", () => {
  mockedUseAuth.mockReturnValue({ status: "anon" });
  renderGate();
  expect(mockedRedirect).toHaveBeenCalledWith({ href: "/giris" }, undefined);
  expect(screen.queryByText("protected content")).toBeNull();
});

test("renders the protected content when authed", () => {
  mockedUseAuth.mockReturnValue({ status: "authed" });
  renderGate();
  expect(mockedRedirect).not.toHaveBeenCalled();
  expect(screen.getByText("protected content")).toBeOnTheScreen();
});
