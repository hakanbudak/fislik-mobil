import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import LoginScreen from "../giris";
import { ApiError } from "@/src/api/client";

const mockSignIn = jest.fn();
jest.mock("@/src/auth/AuthProvider", () => ({ useAuth: () => ({ signIn: mockSignIn, status: "anon" }) }));
jest.mock("expo-router", () => ({ Link: ({ children }: never) => children, router: { replace: jest.fn() } }));

const mockedRouter = router as unknown as { replace: jest.Mock };

beforeEach(() => jest.clearAllMocks());

test("submits the entered credentials", async () => {
  mockSignIn.mockResolvedValue({ id: "u1", role: "client" });
  render(<LoginScreen />);
  fireEvent.changeText(screen.getByLabelText("E-posta"), "selin@test.com");
  fireEvent.changeText(screen.getByLabelText("Şifre"), "password123");
  fireEvent.press(screen.getByText("Giriş yap"));
  await waitFor(() =>
    expect(mockSignIn).toHaveBeenCalledWith("selin@test.com", "password123"),
  );
});

test("routes through the entry route rather than straight to a role shell, so the intro tour gets a chance to show", async () => {
  mockSignIn.mockResolvedValue({ id: "u1", role: "client" });
  render(<LoginScreen />);
  fireEvent.changeText(screen.getByLabelText("E-posta"), "selin@test.com");
  fireEvent.changeText(screen.getByLabelText("Şifre"), "password123");
  fireEvent.press(screen.getByText("Giriş yap"));
  await waitFor(() => expect(mockedRouter.replace).toHaveBeenCalledWith("/"));
});

test("shows the API's message when the credentials are wrong", async () => {
  mockSignIn.mockRejectedValue(new ApiError(401, "Invalid email or password"));
  render(<LoginScreen />);
  fireEvent.changeText(screen.getByLabelText("E-posta"), "selin@test.com");
  fireEvent.changeText(screen.getByLabelText("Şifre"), "wrong");
  fireEvent.press(screen.getByText("Giriş yap"));
  await waitFor(() =>
    expect(screen.getByText("E-posta veya şifre hatalı")).toBeOnTheScreen(),
  );
});
