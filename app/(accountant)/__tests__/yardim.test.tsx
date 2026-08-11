import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import AccountantYardimScreen from "../yardim";
import { resetIntro } from "@/src/onboarding/introSeen";

jest.mock("expo-router", () => ({ router: { replace: jest.fn() } }));
jest.mock("@/src/onboarding/introSeen", () => ({ resetIntro: jest.fn() }));

const mockedRouter = router as unknown as { replace: jest.Mock };
const mockedResetIntro = resetIntro as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockedResetIntro.mockResolvedValue(undefined);
});

test("shows the accountant's own workflow", () => {
  render(<AccountantYardimScreen />);
  expect(screen.getByText(/mükellef davet/i)).toBeOnTheScreen();
});

test("replaying the intro resets the seen flag and navigates to the tour", async () => {
  render(<AccountantYardimScreen />);
  fireEvent.press(screen.getByText(/tanıtım turunu tekrar izle/i));
  await waitFor(() => expect(mockedRouter.replace).toHaveBeenCalledWith("/(auth)/tanitim"));
  expect(mockedResetIntro).toHaveBeenCalledTimes(1);
});

test("still navigates to the tour even when resetting the flag fails", async () => {
  mockedResetIntro.mockRejectedValue(new Error("storage unavailable"));
  render(<AccountantYardimScreen />);
  fireEvent.press(screen.getByText(/tanıtım turunu tekrar izle/i));
  await waitFor(() => expect(mockedRouter.replace).toHaveBeenCalledWith("/(auth)/tanitim"));
});
