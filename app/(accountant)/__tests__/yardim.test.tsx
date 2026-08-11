import { render, screen } from "@testing-library/react-native";
import AccountantYardimScreen from "../yardim";

jest.mock("expo-router", () => ({ router: { replace: jest.fn() } }));
jest.mock("@/src/onboarding/introSeen", () => ({ resetIntro: jest.fn() }));

test("shows the accountant's own workflow", () => {
  render(<AccountantYardimScreen />);
  expect(screen.getByText(/mükellef davet/i)).toBeOnTheScreen();
});

// The tour is written entirely in the taxpayer's voice ("Fişinizi çekin",
// "Muhasebecinize gönderin"), so the replay action is client-only — see
// `src/features/help/HelpContent.tsx` and its tests for the role gate
// itself. This just confirms the accountant route doesn't route around it.
test("does not offer to replay the taxpayer-framed tour", () => {
  render(<AccountantYardimScreen />);
  expect(screen.queryByText(/tanıtım turunu tekrar izle/i)).toBeNull();
});
