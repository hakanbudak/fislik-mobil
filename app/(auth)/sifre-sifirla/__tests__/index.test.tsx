import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import ResetRequestScreen from "../index";
import * as endpoints from "@/src/api/endpoints";

jest.mock("@/src/api/endpoints");
jest.mock("expo-router", () => ({ Link: ({ children }: never) => children, router: { replace: jest.fn() } }));

const mocked = endpoints as jest.Mocked<typeof endpoints>;

beforeEach(() => jest.clearAllMocks());

test("shows the same confirmation whether or not the address is registered", async () => {
  mocked.requestPasswordReset.mockResolvedValue(undefined);
  render(<ResetRequestScreen />);
  fireEvent.changeText(screen.getByLabelText("E-posta"), "bilinmeyen@test.com");
  fireEvent.press(screen.getByText("Sıfırlama bağlantısı gönder"));
  await waitFor(() =>
    expect(
      screen.getByText("E-posta adresine sıfırlama bağlantısı gönderdik."),
    ).toBeOnTheScreen(),
  );
  expect(mocked.requestPasswordReset).toHaveBeenCalledWith("bilinmeyen@test.com");
});
