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

test("does not restart the timer when the parent re-renders with a new onHide reference", () => {
  const first = jest.fn();
  const second = jest.fn();
  const { rerender } = render(
    <Toast message="Muhasebeciye gönderildi" onHide={first} duration={1000} />,
  );

  act(() => {
    jest.advanceTimersByTime(500);
  });
  // Simulates an unrelated parent re-render (e.g. a query settling) passing
  // a fresh inline callback — the visible message is unchanged.
  rerender(<Toast message="Muhasebeciye gönderildi" onHide={second} duration={1000} />);
  act(() => {
    jest.advanceTimersByTime(500);
  });

  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);
});
