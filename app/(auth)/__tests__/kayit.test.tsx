import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import RegisterScreen from "../kayit";
import { ApiError } from "@/src/api/client";

const mockSignUp = jest.fn();
jest.mock("@/src/auth/AuthProvider", () => ({ useAuth: () => ({ signUp: mockSignUp, status: "anon" }) }));
jest.mock("expo-router", () => ({ Link: ({ children }: never) => children, router: { replace: jest.fn() } }));

beforeEach(() => jest.clearAllMocks());

test("submits the chosen role along with the rest of the form", async () => {
  mockSignUp.mockResolvedValue({ id: "u1", role: "accountant" });
  render(<RegisterScreen />);
  fireEvent.changeText(screen.getByLabelText("Ad Soyad"), "Ayşe Yıldırım");
  fireEvent.changeText(screen.getByLabelText("E-posta"), "ayse@test.com");
  fireEvent.changeText(screen.getByLabelText("Şifre"), "password123");
  fireEvent.press(screen.getByText("Mali müşavirim"));
  fireEvent.press(screen.getByText("Hesap oluştur"));
  await waitFor(() =>
    expect(mockSignUp).toHaveBeenCalledWith({
      email: "ayse@test.com",
      password: "password123",
      full_name: "Ayşe Yıldırım",
      role: "accountant",
    }),
  );
});

test("rejects a short password without calling the API", async () => {
  render(<RegisterScreen />);
  fireEvent.changeText(screen.getByLabelText("Ad Soyad"), "Ayşe Yıldırım");
  fireEvent.changeText(screen.getByLabelText("E-posta"), "ayse@test.com");
  fireEvent.changeText(screen.getByLabelText("Şifre"), "short");
  fireEvent.press(screen.getByText("Mükellefim"));
  fireEvent.press(screen.getByText("Hesap oluştur"));
  await waitFor(() =>
    expect(screen.getByText("Şifre en az 8 karakter olmalı")).toBeOnTheScreen(),
  );
  expect(mockSignUp).not.toHaveBeenCalled();
});

test("shows curated Turkish copy, not the raw detail, when the email is taken", async () => {
  mockSignUp.mockRejectedValue(new ApiError(409, "email already registered"));
  render(<RegisterScreen />);
  fireEvent.changeText(screen.getByLabelText("Ad Soyad"), "Ayşe Yıldırım");
  fireEvent.changeText(screen.getByLabelText("E-posta"), "ayse@test.com");
  fireEvent.changeText(screen.getByLabelText("Şifre"), "password123");
  fireEvent.press(screen.getByText("Mükellefim"));
  fireEvent.press(screen.getByText("Hesap oluştur"));
  await waitFor(() => expect(screen.getByText("Bu işlem zaten yapılmış.")).toBeOnTheScreen());
  expect(screen.queryByText(/already registered/)).toBeNull();
});
