import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { IssueSection } from "../IssueSection";

const issue = {
  id: "i1",
  message: "Tutar okunamıyor",
  author_name: "Muhasebeci Ayşe",
  created_at: "2026-08-06T10:00:00Z",
};

test("opening the composer and submitting sends the typed message", async () => {
  const onOpen = jest.fn().mockResolvedValue(undefined);
  render(<IssueSection issue={null} onOpen={onOpen} onResolve={jest.fn()} />);

  fireEvent.press(screen.getByText("Sorun bildir"));
  fireEvent.changeText(screen.getByLabelText("Sorun mesajı"), "Bu fiş okunamıyor");
  fireEvent.press(screen.getByText("Sorunu gönder"));

  await waitFor(() => expect(onOpen).toHaveBeenCalledWith("Bu fiş okunamıyor"));
});

test("an empty message shows the validation copy and calls nothing", () => {
  const onOpen = jest.fn();
  render(<IssueSection issue={null} onOpen={onOpen} onResolve={jest.fn()} />);

  fireEvent.press(screen.getByText("Sorun bildir"));
  fireEvent.press(screen.getByText("Sorunu gönder"));

  expect(screen.getByText("Lütfen sorunu açıklayın")).toBeOnTheScreen();
  expect(onOpen).not.toHaveBeenCalled();
});

test("a whitespace-only message also does not submit", () => {
  const onOpen = jest.fn();
  render(<IssueSection issue={null} onOpen={onOpen} onResolve={jest.fn()} />);

  fireEvent.press(screen.getByText("Sorun bildir"));
  fireEvent.changeText(screen.getByLabelText("Sorun mesajı"), "   ");
  fireEvent.press(screen.getByText("Sorunu gönder"));

  expect(screen.getByText("Lütfen sorunu açıklayın")).toBeOnTheScreen();
  expect(onOpen).not.toHaveBeenCalled();
});

test("an existing issue renders with its author, time, and resolves on press", async () => {
  const onResolve = jest.fn().mockResolvedValue(undefined);
  render(<IssueSection issue={issue} onOpen={jest.fn()} onResolve={onResolve} />);

  expect(screen.getByText("Tutar okunamıyor")).toBeOnTheScreen();
  expect(screen.getByText(/Muhasebeci Ayşe/)).toBeOnTheScreen();
  expect(screen.getByText(/6 Ağustos 2026, \d{2}:\d{2}/)).toBeOnTheScreen();

  fireEvent.press(screen.getByText("Çözüldü olarak işaretle"));
  await waitFor(() => expect(onResolve).toHaveBeenCalled());
});

test("shows the 409 override when opening an issue on a receipt that already has one", async () => {
  const { ApiError } = require("@/src/api/client");
  const onOpen = jest.fn().mockRejectedValue(new ApiError(409, "already has an open issue"));
  render(<IssueSection issue={null} onOpen={onOpen} onResolve={jest.fn()} />);

  fireEvent.press(screen.getByText("Sorun bildir"));
  fireEvent.changeText(screen.getByLabelText("Sorun mesajı"), "Bu fiş okunamıyor");
  fireEvent.press(screen.getByText("Sorunu gönder"));

  await waitFor(() =>
    expect(screen.getByText("Bu fişte zaten açık bir sorun var")).toBeOnTheScreen(),
  );
});
