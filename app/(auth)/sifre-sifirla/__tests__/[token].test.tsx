import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import ResetConfirmScreen from "../[token]";
import * as endpoints from "@/src/api/endpoints";

jest.mock("@/src/api/endpoints");
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ token: "reset-token-123" }),
  router: { replace: jest.fn() },
  Link: ({ children }: never) => children,
}));

const mocked = endpoints as jest.Mocked<typeof endpoints>;
const mockReplace = router.replace as jest.Mock;

beforeEach(() => jest.clearAllMocks());

test("rejects a short password without calling the API", async () => {
  render(<ResetConfirmScreen />);
  fireEvent.changeText(screen.getByLabelText("Yeni şifre"), "short");
  fireEvent.press(screen.getByText("Şifreyi güncelle"));
  await waitFor(() =>
    expect(screen.getByText("Şifre en az 8 karakter olmalı")).toBeOnTheScreen(),
  );
  expect(mocked.confirmPasswordReset).not.toHaveBeenCalled();
});

test("confirms the reset and returns to login", async () => {
  mocked.confirmPasswordReset.mockResolvedValue(undefined);
  render(<ResetConfirmScreen />);
  fireEvent.changeText(screen.getByLabelText("Yeni şifre"), "newpassword1");
  fireEvent.press(screen.getByText("Şifreyi güncelle"));
  await waitFor(() =>
    expect(mocked.confirmPasswordReset).toHaveBeenCalledWith("reset-token-123", "newpassword1"),
  );
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/giris"));
});
