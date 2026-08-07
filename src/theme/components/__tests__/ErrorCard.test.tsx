import { fireEvent, render, screen } from "@testing-library/react-native";
import { ErrorCard } from "../ErrorCard";

test("shows the message and retries", () => {
  const onRetry = jest.fn();
  render(<ErrorCard message="Bir şeyler ters gitti" onRetry={onRetry} />);
  expect(screen.getByText("Bir şeyler ters gitti")).toBeOnTheScreen();
  fireEvent.press(screen.getByText("Tekrar dene"));
  expect(onRetry).toHaveBeenCalledTimes(1);
});

test("omits the retry button when no handler is given", () => {
  render(<ErrorCard message="Bir şeyler ters gitti" />);
  expect(screen.queryByText("Tekrar dene")).toBeNull();
});
