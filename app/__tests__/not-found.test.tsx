import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import NotFoundScreen from "../+not-found";

jest.mock("expo-router", () => ({ router: { replace: jest.fn() } }));

const mockedRouter = router as unknown as { replace: jest.Mock };

beforeEach(() => jest.clearAllMocks());

test("renders the not-found copy and navigates home", () => {
  render(<NotFoundScreen />);

  expect(screen.getByText("Sayfa bulunamadı")).toBeOnTheScreen();
  fireEvent.press(screen.getByText("Ana sayfaya dön"));
  expect(mockedRouter.replace).toHaveBeenCalledWith("/");
});
