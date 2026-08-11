import { fireEvent, render, screen } from "@testing-library/react-native";
import TanitimScreen from "../tanitim";

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({ router: { replace: (...args: unknown[]) => mockReplace(...args) } }));

const mockMarkIntroSeen = jest.fn();
jest.mock("@/src/onboarding/introSeen", () => ({ markIntroSeen: (...args: unknown[]) => mockMarkIntroSeen(...args) }));

beforeEach(() => jest.clearAllMocks());

test("shows the first slide's title", () => {
  render(<TanitimScreen />);
  expect(screen.getByText("Fişini çek")).toBeOnTheScreen();
});

test("pressing Geç marks the intro seen and leaves for the login screen", async () => {
  render(<TanitimScreen />);
  fireEvent.press(screen.getByText("Geç"));
  expect(mockMarkIntroSeen).toHaveBeenCalled();
  await Promise.resolve();
  expect(mockReplace).toHaveBeenCalledWith("/giris");
});
