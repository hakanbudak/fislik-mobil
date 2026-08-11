import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import ProfilScreen from "../profil";
import * as endpoints from "@/src/api/endpoints";
import { ApiError } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthProvider";
import * as biometrics from "@/src/auth/biometrics";
import { createTestQueryClient } from "@/src/test/queryClient";

jest.mock("@/src/api/endpoints");
jest.mock("@/src/auth/AuthProvider", () => ({ useAuth: jest.fn() }));
jest.mock("@/src/auth/biometrics", () => ({
  isBiometricAvailable: jest.fn(),
  isBiometricEnabled: jest.fn(),
  setBiometricEnabled: jest.fn(),
}));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));

const mocked = endpoints as jest.Mocked<typeof endpoints>;
const mockedUseAuth = useAuth as jest.Mock;
const mockedBiometrics = biometrics as jest.Mocked<typeof biometrics>;
const mockedRouter = router as unknown as { push: jest.Mock };

const client = { id: "u1", email: "ayse@example.com", full_name: "Ayşe Yıldırım", role: "client", impersonated: false };
const signOut = jest.fn().mockResolvedValue(undefined);

function renderScreen() {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ProfilScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseAuth.mockReturnValue({ user: client, status: "authed", signOut });
  mockedBiometrics.isBiometricAvailable.mockResolvedValue(false);
  mockedBiometrics.isBiometricEnabled.mockResolvedValue(false);
});

test("shows the user's name and role label", async () => {
  renderScreen();
  await waitFor(() => expect(screen.getByText("Ayşe Yıldırım")).toBeOnTheScreen());
  expect(screen.getByText("Mükellef")).toBeOnTheScreen();
});

test("shows the accountant role label for an accountant", async () => {
  mockedUseAuth.mockReturnValue({
    user: { ...client, role: "accountant" },
    status: "authed",
    signOut,
  });
  renderScreen();
  await waitFor(() => expect(screen.getByText("Muhasebeci")).toBeOnTheScreen());
});

test("links to firma bilgileri for a client, not for an accountant", async () => {
  renderScreen();
  await waitFor(() => expect(screen.getByText("Firma bilgileri")).toBeOnTheScreen());

  mockedUseAuth.mockReturnValue({ user: { ...client, role: "accountant" }, status: "authed", signOut });
  renderScreen();
  await waitFor(() => expect(screen.getByText("Muhasebeci")).toBeOnTheScreen());
  expect(screen.queryByText("Firma bilgileri")).toBeNull();
});

test("pressing the firma bilgileri card navigates there", async () => {
  renderScreen();
  await waitFor(() => expect(screen.getByText("Firma bilgileri")).toBeOnTheScreen());
  fireEvent.press(screen.getByText("Firma bilgileri"));
  expect(mockedRouter.push).toHaveBeenCalledWith("/(client)/firma-bilgileri");
});

test("links to the help page for a client", async () => {
  renderScreen();
  await waitFor(() => expect(screen.getByText("Nasıl kullanılır")).toBeOnTheScreen());
});

test("links to the help page for an accountant too", async () => {
  mockedUseAuth.mockReturnValue({ user: { ...client, role: "accountant" }, status: "authed", signOut });
  renderScreen();
  await waitFor(() => expect(screen.getByText("Muhasebeci")).toBeOnTheScreen());
  expect(screen.getByText("Nasıl kullanılır")).toBeOnTheScreen();
});

test("pressing the help card routes a client to the client group", async () => {
  renderScreen();
  await waitFor(() => expect(screen.getByText("Nasıl kullanılır")).toBeOnTheScreen());
  fireEvent.press(screen.getByText("Nasıl kullanılır"));
  expect(mockedRouter.push).toHaveBeenCalledWith("/(client)/yardim");
});

test("pressing the help card routes an accountant to the accountant group", async () => {
  mockedUseAuth.mockReturnValue({ user: { ...client, role: "accountant" }, status: "authed", signOut });
  renderScreen();
  await waitFor(() => expect(screen.getByText("Muhasebeci")).toBeOnTheScreen());
  fireEvent.press(screen.getByText("Nasıl kullanılır"));
  expect(mockedRouter.push).toHaveBeenCalledWith("/(accountant)/yardim");
});

test("hides the biometric switch entirely when unavailable on the device", async () => {
  mockedBiometrics.isBiometricAvailable.mockResolvedValue(false);
  renderScreen();
  await waitFor(() => expect(screen.getByText("Ayşe Yıldırım")).toBeOnTheScreen());
  expect(screen.queryByRole("switch")).toBeNull();
});

test("shows the biometric switch, reflecting the stored preference, when available", async () => {
  mockedBiometrics.isBiometricAvailable.mockResolvedValue(true);
  mockedBiometrics.isBiometricEnabled.mockResolvedValue(true);
  renderScreen();
  await waitFor(() => expect(screen.getByRole("switch")).toBeOnTheScreen());
  expect(screen.getByRole("switch").props.value).toBe(true);
});

test("toggling the biometric switch persists the new preference", async () => {
  mockedBiometrics.isBiometricAvailable.mockResolvedValue(true);
  mockedBiometrics.isBiometricEnabled.mockResolvedValue(false);
  renderScreen();
  await waitFor(() => expect(screen.getByRole("switch")).toBeOnTheScreen());
  fireEvent(screen.getByRole("switch"), "valueChange", true);
  await waitFor(() => expect(mockedBiometrics.setBiometricEnabled).toHaveBeenCalledWith(true));
});

test("rejects a new password shorter than 8 characters without calling the API", async () => {
  renderScreen();
  await waitFor(() => expect(screen.getByLabelText("Mevcut şifre")).toBeOnTheScreen());
  fireEvent.changeText(screen.getByLabelText("Mevcut şifre"), "eskisifre");
  fireEvent.changeText(screen.getByLabelText("Yeni şifre"), "1234567");
  fireEvent.changeText(screen.getByLabelText("Yeni şifre (tekrar)"), "1234567");
  fireEvent.press(screen.getByText("Şifreyi Güncelle"));

  await waitFor(() => expect(screen.getByText("Şifre en az 8 karakter olmalı")).toBeOnTheScreen());
  expect(mocked.changePassword).not.toHaveBeenCalled();
});

test("rejects a confirmation that doesn't match the new password", async () => {
  renderScreen();
  await waitFor(() => expect(screen.getByLabelText("Mevcut şifre")).toBeOnTheScreen());
  fireEvent.changeText(screen.getByLabelText("Mevcut şifre"), "eskisifre");
  fireEvent.changeText(screen.getByLabelText("Yeni şifre"), "yenisifre1");
  fireEvent.changeText(screen.getByLabelText("Yeni şifre (tekrar)"), "yenisifre2");
  fireEvent.press(screen.getByText("Şifreyi Güncelle"));

  await waitFor(() => expect(screen.getByText("Yeni şifreler birbiriyle eşleşmiyor")).toBeOnTheScreen());
  expect(mocked.changePassword).not.toHaveBeenCalled();
});

test("submits a valid password change and shows a success message", async () => {
  mocked.changePassword.mockResolvedValue(undefined);
  renderScreen();
  await waitFor(() => expect(screen.getByLabelText("Mevcut şifre")).toBeOnTheScreen());
  fireEvent.changeText(screen.getByLabelText("Mevcut şifre"), "eskisifre");
  fireEvent.changeText(screen.getByLabelText("Yeni şifre"), "yenisifre1");
  fireEvent.changeText(screen.getByLabelText("Yeni şifre (tekrar)"), "yenisifre1");
  fireEvent.press(screen.getByText("Şifreyi Güncelle"));

  await waitFor(() =>
    expect(mocked.changePassword).toHaveBeenCalledWith({
      current_password: "eskisifre",
      new_password: "yenisifre1",
    }),
  );
  await waitFor(() => expect(screen.getByText("Şifreniz güncellendi")).toBeOnTheScreen());
});

test("says the current password is wrong, not a generic error, on a 400", async () => {
  mocked.changePassword.mockRejectedValue(new ApiError(400, "Current password is incorrect"));
  renderScreen();
  await waitFor(() => expect(screen.getByLabelText("Mevcut şifre")).toBeOnTheScreen());
  fireEvent.changeText(screen.getByLabelText("Mevcut şifre"), "yanlis");
  fireEvent.changeText(screen.getByLabelText("Yeni şifre"), "yenisifre1");
  fireEvent.changeText(screen.getByLabelText("Yeni şifre (tekrar)"), "yenisifre1");
  fireEvent.press(screen.getByText("Şifreyi Güncelle"));

  await waitFor(() => expect(screen.getByText("Mevcut şifreniz hatalı")).toBeOnTheScreen());
  expect(screen.queryByText("Current password is incorrect")).toBeNull();
});

test("signs out when Çıkış yap is pressed", async () => {
  renderScreen();
  await waitFor(() => expect(screen.getByText("Çıkış yap")).toBeOnTheScreen());
  fireEvent.press(screen.getByText("Çıkış yap"));
  await waitFor(() => expect(signOut).toHaveBeenCalled());
});
