import { fireEvent, render, screen } from "@testing-library/react-native";
import { Redirect } from "expo-router";
import { Dimensions } from "react-native";
import TanitimScreen from "../tanitim";

const { width } = Dimensions.get("window");

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
  Redirect: jest.fn(() => null),
}));

const mockMarkIntroSeen = jest.fn();
jest.mock("@/src/onboarding/introSeen", () => ({
  markIntroSeen: (...args: unknown[]) => mockMarkIntroSeen(...args),
}));

const mockUseAuth = jest.fn();
jest.mock("@/src/auth/AuthProvider", () => ({ useAuth: () => mockUseAuth() }));
jest.mock("@/src/auth/LockedScreen", () => ({ LockedScreen: () => null }));

const mockedRedirect = Redirect as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockMarkIntroSeen.mockResolvedValue(undefined);
});

test("an anon visitor is sent to /giris, never seeing either role's slides", () => {
  mockUseAuth.mockReturnValue({ status: "anon", user: null });
  render(<TanitimScreen />);
  expect(mockedRedirect).toHaveBeenCalledWith({ href: "/giris" }, undefined);
  expect(screen.queryByTestId("tanitim-slides")).toBeNull();
});

test("shows a spinner instead of the tour while the session is still restoring", () => {
  mockUseAuth.mockReturnValue({ status: "loading", user: null });
  render(<TanitimScreen />);
  expect(mockedRedirect).not.toHaveBeenCalled();
  expect(screen.queryByTestId("tanitim-slides")).toBeNull();
});

test("shows the locked screen instead of the tour when biometric unlock is pending", () => {
  mockUseAuth.mockReturnValue({ status: "locked", user: { id: "u1", role: "client" } });
  render(<TanitimScreen />);
  expect(mockedRedirect).not.toHaveBeenCalled();
  expect(screen.queryByTestId("tanitim-slides")).toBeNull();
});

test("a client sees the client slides, not the accountant's", () => {
  mockUseAuth.mockReturnValue({ status: "authed", user: { id: "u1", role: "client" } });
  render(<TanitimScreen />);
  expect(screen.getByText("Fişinizi çekin")).toBeOnTheScreen();
  expect(screen.queryByText("Mükellef davet edin")).toBeNull();
});

test("an accountant sees the accountant slides, not the client's", () => {
  mockUseAuth.mockReturnValue({ status: "authed", user: { id: "u2", role: "accountant" } });
  render(<TanitimScreen />);
  expect(screen.getByText("Mükellef davet edin")).toBeOnTheScreen();
  expect(screen.queryByText("Fişinizi çekin")).toBeNull();
});

test("pressing Geç marks the intro seen and exits through the entry route, not a hardcoded login screen", async () => {
  mockUseAuth.mockReturnValue({ status: "authed", user: { id: "u1", role: "client" } });
  render(<TanitimScreen />);
  fireEvent.press(screen.getByText("Geç"));
  expect(mockMarkIntroSeen).toHaveBeenCalled();
  await Promise.resolve();
  // "/" — the app's own entry route (`app/index.tsx`), which dispatches an
  // anon session to `/giris` and an authed one to its own shell. Asserting
  // this instead of "/giris" is the C1 regression pin: a replay from the
  // (authed-only) help page must not be hardcoded back to the login form.
  expect(mockReplace).toHaveBeenCalledWith("/");
});

test("a failed flag write does not trap the user on this screen — finish() still navigates onward", async () => {
  mockMarkIntroSeen.mockRejectedValue(new Error("storage unavailable"));
  mockUseAuth.mockReturnValue({ status: "authed", user: { id: "u1", role: "client" } });
  render(<TanitimScreen />);
  fireEvent.press(screen.getByText("Geç"));
  await Promise.resolve();
  await Promise.resolve();
  expect(mockReplace).toHaveBeenCalledWith("/");
});

test("the last slide shows Başla instead of İleri, and still shows Geç, for either role", () => {
  mockUseAuth.mockReturnValue({ status: "authed", user: { id: "u2", role: "accountant" } });
  render(<TanitimScreen />);
  const list = screen.getByTestId("tanitim-slides");
  // Land on the fourth (last) slide by simulating the paging scroll a real
  // swipe would produce, rather than asserting against the component's own
  // index math.
  fireEvent(list, "momentumScrollEnd", {
    nativeEvent: { contentOffset: { x: 3 * width } },
  });

  expect(screen.getByText("Başla")).toBeOnTheScreen();
  expect(screen.queryByText("İleri")).not.toBeOnTheScreen();
  expect(screen.getByText("Geç")).toBeOnTheScreen();
});
