import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import InviteScreen from "../davet/[token]";
import * as endpoints from "@/src/api/endpoints";
import { createTestQueryClient } from "@/src/test/queryClient";

jest.mock("@/src/api/endpoints");
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ token: "inv-123" }),
  router: { replace: jest.fn() },
  Link: ({ children }: never) => children,
}));

const mockSignUp = jest.fn();
jest.mock("@/src/auth/AuthProvider", () => ({
  useAuth: () => ({ signUp: mockSignUp, status: "anon" }),
}));

const mocked = endpoints as jest.Mocked<typeof endpoints>;

function renderScreen() {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <InviteScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => jest.clearAllMocks());

test("shows who invited the accountant, and registers with the accountant role", async () => {
  mocked.getInviteInfo.mockResolvedValue({
    invited_email: "muhasebeci@test.com",
    client_name: "Selin Ticaret",
    inviter_name: "Selin Ticaret",
    inviter_role: "client",
    invited_role: "accountant",
  });
  mockSignUp.mockResolvedValue({ id: "u1", role: "accountant" });
  renderScreen();

  await waitFor(() =>
    expect(screen.getByText("Selin Ticaret sizi mali müşaviri olarak davet etti.")).toBeOnTheScreen(),
  );
  expect(screen.getByDisplayValue("muhasebeci@test.com")).toBeOnTheScreen();

  fireEvent.changeText(screen.getByLabelText("Ad Soyad"), "Ayşe Yıldırım");
  fireEvent.changeText(screen.getByLabelText("Şifre"), "password123");
  fireEvent.press(screen.getByText("Daveti kabul et"));

  await waitFor(() =>
    expect(mockSignUp).toHaveBeenCalledWith({
      email: "muhasebeci@test.com",
      password: "password123",
      full_name: "Ayşe Yıldırım",
      role: "accountant",
      invite_token: "inv-123",
    }),
  );
});

test("shows who invited the client, and registers with the client role", async () => {
  mocked.getInviteInfo.mockResolvedValue({
    invited_email: "mukellef@test.com",
    client_name: "Deniz Mali Müşavirlik",
    inviter_name: "Deniz Mali Müşavirlik",
    inviter_role: "accountant",
    invited_role: "client",
  });
  mockSignUp.mockResolvedValue({ id: "u2", role: "client" });
  renderScreen();

  await waitFor(() =>
    expect(
      screen.getByText("Deniz Mali Müşavirlik sizi mükellefi olarak davet etti."),
    ).toBeOnTheScreen(),
  );
  expect(screen.getByDisplayValue("mukellef@test.com")).toBeOnTheScreen();

  fireEvent.changeText(screen.getByLabelText("Ad Soyad"), "Can Yıldız");
  fireEvent.changeText(screen.getByLabelText("Şifre"), "password123");
  fireEvent.press(screen.getByText("Daveti kabul et"));

  await waitFor(() =>
    expect(mockSignUp).toHaveBeenCalledWith({
      email: "mukellef@test.com",
      password: "password123",
      full_name: "Can Yıldız",
      role: "client",
      invite_token: "inv-123",
    }),
  );
});

test("rejects a short password without calling signUp", async () => {
  mocked.getInviteInfo.mockResolvedValue({
    invited_email: "muhasebeci@test.com",
    client_name: "Selin Ticaret",
    inviter_name: "Selin Ticaret",
    inviter_role: "client",
    invited_role: "accountant",
  });
  renderScreen();

  await waitFor(() => expect(screen.getByLabelText("Ad Soyad")).toBeOnTheScreen());
  fireEvent.changeText(screen.getByLabelText("Ad Soyad"), "Ayşe Yıldırım");
  fireEvent.changeText(screen.getByLabelText("Şifre"), "short");
  fireEvent.press(screen.getByText("Daveti kabul et"));

  await waitFor(() =>
    expect(screen.getByText("Şifre en az 8 karakter olmalı")).toBeOnTheScreen(),
  );
  expect(mockSignUp).not.toHaveBeenCalled();
});

test("surfaces an expired invite", async () => {
  mocked.getInviteInfo.mockRejectedValue(new Error("gone"));
  renderScreen();
  await waitFor(() =>
    expect(screen.getByText("Bu davet geçersiz veya süresi dolmuş.")).toBeOnTheScreen(),
  );
});
