import AsyncStorage from "@react-native-async-storage/async-storage";
import { render, screen, waitFor } from "@testing-library/react-native";
import { Redirect } from "expo-router";
import Index from "../index";

const mockUseAuth = jest.fn();
jest.mock("@/src/auth/AuthProvider", () => ({ useAuth: () => mockUseAuth() }));
jest.mock("expo-router", () => ({
  Redirect: jest.fn(() => null),
  Slot: ({ children }: never) => children,
}));
jest.mock("@/src/auth/LockedScreen", () => ({ LockedScreen: () => null }));
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const mockedRedirect = Redirect as jest.Mock;
const mockedStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

beforeEach(() => jest.clearAllMocks());

test("an anon visitor goes straight to the login screen, without consulting the intro flag", () => {
  mockUseAuth.mockReturnValue({ status: "anon", user: null });
  render(<Index />);
  expect(mockedRedirect).toHaveBeenCalledWith({ href: "/giris" }, undefined);
  expect(mockedStorage.getItem).not.toHaveBeenCalled();
});

test("an authed user who hasn't seen the intro (first launch, or an unset flag after the key changed) is routed to the tour", async () => {
  mockedStorage.getItem.mockResolvedValue(null);
  mockUseAuth.mockReturnValue({ status: "authed", user: { id: "u1", role: "client" } });
  render(<Index />);
  await waitFor(() => expect(mockedRedirect).toHaveBeenCalledWith({ href: "/tanitim" }, undefined));
});

test("an authed user who has seen the intro goes straight to their role shell", async () => {
  mockedStorage.getItem.mockResolvedValue("1");
  mockUseAuth.mockReturnValue({ status: "authed", user: { id: "u1", role: "client" } });
  render(<Index />);
  await waitFor(() => expect(mockedRedirect).toHaveBeenCalledWith({ href: "/(client)" }, undefined));
});

test("a failed flag read fails open, landing on the role shell rather than spinning forever", async () => {
  mockedStorage.getItem.mockRejectedValue(new Error("storage unavailable"));
  mockUseAuth.mockReturnValue({ status: "authed", user: { id: "u1", role: "accountant" } });
  render(<Index />);
  await waitFor(() => expect(mockedRedirect).toHaveBeenCalledWith({ href: "/(accountant)" }, undefined));
});

test("holds the redirect, showing no Redirect call, while the flag is being read for an authed user", () => {
  mockedStorage.getItem.mockReturnValue(new Promise(() => {})); // never resolves within the test
  mockUseAuth.mockReturnValue({ status: "authed", user: { id: "u1", role: "client" } });
  render(<Index />);
  expect(mockedRedirect).not.toHaveBeenCalled();
});

test("redirects an authed accountant with a seen flag to the accountant tab group", async () => {
  mockedStorage.getItem.mockResolvedValue("1");
  mockUseAuth.mockReturnValue({ status: "authed", user: { id: "u1", role: "accountant" } });
  render(<Index />);
  await waitFor(() => expect(mockedRedirect).toHaveBeenCalledWith({ href: "/(accountant)" }, undefined));
});

test("shows a spinner while the session restores", () => {
  mockUseAuth.mockReturnValue({ status: "loading", user: null });
  render(<Index />);
  expect(mockedRedirect).not.toHaveBeenCalled();
});

test("shows the locked screen instead of redirecting when biometric unlock is pending", () => {
  mockUseAuth.mockReturnValue({ status: "locked", user: { id: "u1", role: "client" } });
  render(<Index />);
  expect(mockedRedirect).not.toHaveBeenCalled();
});
