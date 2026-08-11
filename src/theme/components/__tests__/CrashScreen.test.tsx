import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import { ApiError } from "@/src/api/client";
import { CrashScreen } from "../CrashScreen";

jest.mock("expo-router", () => ({ router: { replace: jest.fn() } }));

const mockedRouter = router as unknown as { replace: jest.Mock };

beforeEach(() => jest.clearAllMocks());

test("renders the crash copy and calls retry", () => {
  const retry = jest.fn();
  render(<CrashScreen error={new Error("boom")} retry={retry} />);

  expect(screen.getByText("Bir şeyler ters gitti")).toBeOnTheScreen();
  fireEvent.press(screen.getByText("Tekrar dene"));
  expect(retry).toHaveBeenCalledTimes(1);
});

test("shows the raw message for an ordinary JS crash", () => {
  render(<CrashScreen error={new Error("Cannot read property x")} retry={jest.fn()} />);
  expect(screen.getByText("Teknik detay: Cannot read property x")).toBeOnTheScreen();
});

test("never shows an ApiError's detail", () => {
  render(<CrashScreen error={new ApiError(500, "internal secret backend detail")} retry={jest.fn()} />);
  expect(screen.queryByText(/internal secret backend detail/)).toBeNull();
});

test("the secondary action navigates home", () => {
  render(<CrashScreen error={new Error("boom")} retry={jest.fn()} />);
  fireEvent.press(screen.getByText("Ana sayfaya dön"));
  expect(mockedRouter.replace).toHaveBeenCalledWith("/");
});
