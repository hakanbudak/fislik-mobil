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

// The gate that used to hide this button for the accountant (the tour was
// taxpayer-only) is gone now that the tour is role-aware — see
// `src/features/help/HelpContent.tsx` and its tests for the role-aware
// rendering itself. This just confirms the accountant route wires the
// replay action through, same as the client route.
test("offers to replay the (now role-aware) intro tour", async () => {
  render(<AccountantYardimScreen />);
  fireEvent.press(screen.getByText(/tanıtım turunu tekrar izle/i));
  await waitFor(() => expect(mockedRouter.replace).toHaveBeenCalledWith("/tanitim"));
  expect(mockedResetIntro).toHaveBeenCalledTimes(1);
});
