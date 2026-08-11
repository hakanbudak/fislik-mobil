import { fireEvent, render, screen } from "@testing-library/react-native";
import { SubmissionRow } from "../SubmissionRow";

const base = {
  last_sent_at: null,
  can_send: true,
  active_receipt_count: 3,
  has_accountant: true,
};

test("renders nothing when the client has no accountant", () => {
  render(<SubmissionRow state={{ ...base, has_accountant: false }} onSubmit={jest.fn()} busy={false} />);
  expect(screen.queryByText("Muhasebeciye gönder")).toBeNull();
});

test("submits the month", () => {
  const onSubmit = jest.fn();
  render(<SubmissionRow state={base} onSubmit={onSubmit} busy={false} />);
  fireEvent.press(screen.getByText("Muhasebeciye gönder"));
  expect(onSubmit).toHaveBeenCalledTimes(1);
});

test("shows when the month was last sent and disables re-sending", () => {
  render(
    <SubmissionRow
      state={{ ...base, can_send: false, last_sent_at: "2026-08-12T14:30:00Z" }}
      onSubmit={jest.fn()}
      busy={false}
    />,
  );
  expect(screen.getByText(/Gönderildi/)).toBeOnTheScreen();
  expect(screen.getByLabelText("Muhasebeciye gönder")).toBeDisabled();
});

test("shows a busy label while submitting", () => {
  render(<SubmissionRow state={base} onSubmit={jest.fn()} busy />);
  expect(screen.getByText("Gönderiliyor…")).toBeOnTheScreen();
});
