import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { LockedScreen } from "../LockedScreen";
import { useAuth } from "../AuthProvider";

jest.mock("../AuthProvider", () => ({ useAuth: jest.fn() }));

const mockedUseAuth = useAuth as jest.Mock;

beforeEach(() => jest.clearAllMocks());

test("retries the biometric prompt when Kilidi ac is pressed", async () => {
  const retryUnlock = jest.fn().mockResolvedValue(undefined);
  mockedUseAuth.mockReturnValue({ retryUnlock, signOut: jest.fn() });
  render(<LockedScreen />);
  fireEvent.press(screen.getByText("Kilidi aç"));
  await waitFor(() => expect(retryUnlock).toHaveBeenCalled());
});

test("offers Cikis yap as the escape hatch for a stuck user", async () => {
  const signOut = jest.fn().mockResolvedValue(undefined);
  mockedUseAuth.mockReturnValue({ retryUnlock: jest.fn(), signOut });
  render(<LockedScreen />);
  fireEvent.press(screen.getByText("Çıkış yap"));
  await waitFor(() => expect(signOut).toHaveBeenCalled());
});
