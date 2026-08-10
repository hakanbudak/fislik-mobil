import { fireEvent, render, screen } from "@testing-library/react-native";
import { IncomingInviteCard } from "../IncomingInviteCard";
import type { GrantOut } from "@/src/api/endpoints";

const grant: GrantOut = {
  id: "g1",
  status: "pending",
  invited_email: "m@test.com",
  accountant_name: null,
  direction: "incoming",
  counterpart_name: "Selin Ticaret",
  counterpart_email: "selin@test.com",
  invited_role: "accountant",
};

test("an incoming invite explains who is asking and for what", () => {
  render(<IncomingInviteCard grant={grant} onAccept={jest.fn()} onDecline={jest.fn()} busy={false} />);
  expect(screen.getByText(/Selin Ticaret/)).toBeOnTheScreen();
  expect(screen.getByText(/muhasebecisi olarak eklemek istiyor/)).toBeOnTheScreen();
});

test("the copy flips when the viewer is the invited client", () => {
  render(
    <IncomingInviteCard
      grant={{ ...grant, invited_role: "client" }}
      onAccept={jest.fn()}
      onDecline={jest.fn()}
      busy={false}
    />,
  );
  expect(screen.getByText(/muhasebeciniz olarak/)).toBeOnTheScreen();
});

test("accepts and declines", () => {
  const onAccept = jest.fn();
  const onDecline = jest.fn();
  render(<IncomingInviteCard grant={grant} onAccept={onAccept} onDecline={onDecline} busy={false} />);

  fireEvent.press(screen.getByText("Kabul Et"));
  expect(onAccept).toHaveBeenCalledTimes(1);

  fireEvent.press(screen.getByText("Reddet"));
  expect(onDecline).toHaveBeenCalledTimes(1);
});

test("shows a busy label on the accept button while a mutation is in flight", () => {
  render(<IncomingInviteCard grant={grant} onAccept={jest.fn()} onDecline={jest.fn()} busy />);
  expect(screen.getByText("İşleniyor…")).toBeOnTheScreen();
  expect(screen.getByLabelText("Reddet")).toBeDisabled();
});
