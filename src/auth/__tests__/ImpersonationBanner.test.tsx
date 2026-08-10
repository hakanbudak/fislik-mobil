import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { ImpersonationBanner } from "../ImpersonationBanner";
import { useAuth } from "../AuthProvider";

jest.mock("../AuthProvider", () => ({ useAuth: jest.fn() }));

const mockedUseAuth = useAuth as jest.Mock;

beforeEach(() => jest.clearAllMocks());

test("renders nothing when the session is not impersonated", () => {
  mockedUseAuth.mockReturnValue({ user: { full_name: "Ayşe Yıldırım", impersonated: false }, signOut: jest.fn() });
  render(<ImpersonationBanner />);
  expect(screen.queryByText(/Yönetici olarak/)).toBeNull();
});

test("renders nothing when there is no user", () => {
  mockedUseAuth.mockReturnValue({ user: null, signOut: jest.fn() });
  render(<ImpersonationBanner />);
  expect(screen.queryByText(/Yönetici olarak/)).toBeNull();
});

test("shows an unmistakable notice naming the impersonated account when impersonated", () => {
  mockedUseAuth.mockReturnValue({ user: { full_name: "Ayşe Yıldırım", impersonated: true }, signOut: jest.fn() });
  render(<ImpersonationBanner />);
  expect(screen.getByText(/Yönetici olarak/)).toBeOnTheScreen();
  expect(screen.getByText(/Ayşe Yıldırım/)).toBeOnTheScreen();
});

test("ends the impersonated session on press", async () => {
  const signOut = jest.fn().mockResolvedValue(undefined);
  mockedUseAuth.mockReturnValue({ user: { full_name: "Ayşe Yıldırım", impersonated: true }, signOut });
  render(<ImpersonationBanner />);
  fireEvent.press(screen.getByText("Oturumu bitir"));
  await waitFor(() => expect(signOut).toHaveBeenCalled());
});
