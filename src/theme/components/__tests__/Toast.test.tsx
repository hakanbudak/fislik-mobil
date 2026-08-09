import { act, render, screen } from "@testing-library/react-native";
import { Toast } from "../Toast";

jest.useFakeTimers();

test("renders the message", () => {
  render(<Toast message="Muhasebeciye gönderildi" onHide={jest.fn()} />);
  expect(screen.getByText("Muhasebeciye gönderildi")).toBeOnTheScreen();
});

test("calls onHide after the duration elapses", () => {
  const onHide = jest.fn();
  render(<Toast message="Muhasebeciye gönderildi" onHide={onHide} duration={1000} />);
  expect(onHide).not.toHaveBeenCalled();
  act(() => {
    jest.advanceTimersByTime(1000);
  });
  expect(onHide).toHaveBeenCalledTimes(1);
});
