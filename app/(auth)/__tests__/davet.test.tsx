import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import InviteScreen from "../davet/[token]";
import * as endpoints from "@/src/api/endpoints";
import { ApiError } from "@/src/api/client";
import { createTestQueryClient } from "@/src/test/queryClient";

jest.mock("@/src/api/endpoints");
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ token: "inv-123" }),
  router: { replace: jest.fn() },
  Link: ({ children }: never) => children,
}));

const mockSignUp = jest.fn();
const mockUseAuth = jest.fn();
jest.mock("@/src/auth/AuthProvider", () => ({ useAuth: () => mockUseAuth() }));

const mocked = endpoints as jest.Mocked<typeof endpoints>;

function renderScreen() {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <InviteScreen />
    </QueryClientProvider>,
  );
}

const clientInvitesAccountant: endpoints.InviteInfoOut = {
  invited_email: "muhasebeci@test.com",
  client_name: "Selin Ticaret",
  inviter_name: "Selin Ticaret",
  inviter_role: "client",
  invited_role: "accountant",
};

const accountantInvitesClient: endpoints.InviteInfoOut = {
  invited_email: "mukellef@test.com",
  client_name: "Deniz Mali Müşavirlik",
  inviter_name: "Deniz Mali Müşavirlik",
  inviter_role: "accountant",
  invited_role: "client",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({ signUp: mockSignUp, status: "anon", user: null });
});

test("not signed in: shows the generic invite headline and registers with invited_role", async () => {
  mocked.getInviteInfo.mockResolvedValue(clientInvitesAccountant);
  mockSignUp.mockResolvedValue({ id: "u1", role: "accountant" });
  renderScreen();

  await waitFor(() =>
    expect(screen.getByText("Selin Ticaret sizi Fişlik'e davet etti")).toBeOnTheScreen(),
  );
  expect(screen.getByText("Hesabınızı oluşturarak daveti kabul edin.")).toBeOnTheScreen();
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

test("not signed in: registers a client invited by an accountant", async () => {
  mocked.getInviteInfo.mockResolvedValue(accountantInvitesClient);
  mockSignUp.mockResolvedValue({ id: "u2", role: "client" });
  renderScreen();

  await waitFor(() =>
    expect(screen.getByText("Deniz Mali Müşavirlik sizi Fişlik'e davet etti")).toBeOnTheScreen(),
  );

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

test("not signed in: shows a busy label while registering", async () => {
  mocked.getInviteInfo.mockResolvedValue(clientInvitesAccountant);
  let resolveSignUp: (user: { id: string; role: string }) => void;
  mockSignUp.mockReturnValue(
    new Promise((resolve) => {
      resolveSignUp = resolve;
    }),
  );
  renderScreen();

  await waitFor(() => expect(screen.getByLabelText("Ad Soyad")).toBeOnTheScreen());
  fireEvent.changeText(screen.getByLabelText("Ad Soyad"), "Ayşe Yıldırım");
  fireEvent.changeText(screen.getByLabelText("Şifre"), "password123");
  fireEvent.press(screen.getByText("Daveti kabul et"));

  await waitFor(() => expect(screen.getByText("Hesap oluşturuluyor…")).toBeOnTheScreen());
  expect(screen.getByLabelText("Daveti kabul et")).toBeDisabled();

  resolveSignUp!({ id: "u1", role: "accountant" });
  await waitFor(() => expect(mockSignUp).toHaveBeenCalled());
});

test("not signed in: rejects a short password without calling signUp", async () => {
  mocked.getInviteInfo.mockResolvedValue(clientInvitesAccountant);
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

test("signed in with the matching role: accepts with one tap via acceptInviteByToken, never signUp", async () => {
  mockUseAuth.mockReturnValue({
    signUp: mockSignUp,
    status: "authed",
    user: { id: "u3", role: "accountant", full_name: "Ayşe Yıldırım" },
  });
  mocked.getInviteInfo.mockResolvedValue(clientInvitesAccountant);
  mocked.acceptInviteByToken.mockResolvedValue({} as endpoints.GrantOut);
  renderScreen();

  await waitFor(() =>
    expect(
      screen.getByText(
        "Ayşe Yıldırım olarak giriş yapmış durumdasınız — daveti tek tıkla kabul edebilirsiniz.",
      ),
    ).toBeOnTheScreen(),
  );

  fireEvent.press(screen.getByText("Daveti Kabul Et"));

  await waitFor(() => expect(mocked.acceptInviteByToken).toHaveBeenCalledWith("inv-123"));
  expect(mockSignUp).not.toHaveBeenCalled();
});

test("signed in with the wrong role: explains the mismatch and offers no accept button", async () => {
  mockUseAuth.mockReturnValue({
    signUp: mockSignUp,
    status: "authed",
    user: { id: "u4", role: "client", full_name: "Can Yıldız" },
  });
  mocked.getInviteInfo.mockResolvedValue(clientInvitesAccountant);
  renderScreen();

  await waitFor(() =>
    expect(
      screen.getByText(
        "Bu davet bir muhasebeci hesabı için; şu an mükellef hesabıyla giriş yapmış durumdasınız.",
      ),
    ).toBeOnTheScreen(),
  );
  expect(screen.queryByText("Daveti Kabul Et")).toBeNull();
  expect(mocked.acceptInviteByToken).not.toHaveBeenCalled();
});

test("shows a not-found state for a missing invite", async () => {
  mocked.getInviteInfo.mockRejectedValue(new ApiError(404, "not found"));
  renderScreen();
  await waitFor(() => expect(screen.getByText("Davet bulunamadı")).toBeOnTheScreen());
  expect(
    screen.getByText("Bu davet bağlantısı geçersiz veya süresi dolmuş olabilir."),
  ).toBeOnTheScreen();
});

test("shows a load-failed state for a transient error", async () => {
  mocked.getInviteInfo.mockRejectedValue(new Error("network blip"));
  renderScreen();
  await waitFor(() => expect(screen.getByText("Davet yüklenemedi")).toBeOnTheScreen());
});
