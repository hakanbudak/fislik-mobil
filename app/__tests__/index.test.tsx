import { render, screen } from "@testing-library/react-native";
import { Redirect } from "expo-router";
import Index from "../index";

const mockUseAuth = jest.fn();
jest.mock("@/src/auth/AuthProvider", () => ({ useAuth: () => mockUseAuth() }));
jest.mock("expo-router", () => ({
  Redirect: jest.fn(() => null),
  Slot: ({ children }: never) => children,
}));

const mockedRedirect = Redirect as jest.Mock;

beforeEach(() => jest.clearAllMocks());

test("redirects anon users to the login screen", () => {
  mockUseAuth.mockReturnValue({ status: "anon", user: null });
  render(<Index />);
  expect(mockedRedirect).toHaveBeenCalledWith({ href: "/giris" }, undefined);
});

test("redirects an authed client to the client tab group", () => {
  mockUseAuth.mockReturnValue({ status: "authed", user: { id: "u1", role: "client" } });
  render(<Index />);
  expect(mockedRedirect).toHaveBeenCalledWith({ href: "/(client)" }, undefined);
});

test("redirects an authed accountant to the accountant tab group", () => {
  mockUseAuth.mockReturnValue({ status: "authed", user: { id: "u1", role: "accountant" } });
  render(<Index />);
  expect(mockedRedirect).toHaveBeenCalledWith({ href: "/(accountant)" }, undefined);
});

test("shows a spinner while the session restores", () => {
  mockUseAuth.mockReturnValue({ status: "loading", user: null });
  render(<Index />);
  expect(mockedRedirect).not.toHaveBeenCalled();
});
