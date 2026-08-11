import { fireEvent, render, screen } from "@testing-library/react-native";
import { ClientCard } from "../ClientCard";
import type { ClientSummaryOut } from "@/src/api/endpoints";

const baseClient: ClientSummaryOut = {
  client_id: "c1",
  full_name: "Ayşe Yıldırım",
  receipt_count: 12,
  unprocessed_count: 0,
  last_upload_at: null,
};

test("shows the client's name, initials and receipt count", () => {
  render(<ClientCard client={baseClient} onPress={jest.fn()} />);
  expect(screen.getByText("Ayşe Yıldırım")).toBeOnTheScreen();
  expect(screen.getByText("AY")).toBeOnTheScreen();
  expect(screen.getByText("12 fiş")).toBeOnTheScreen();
});

test("shows the unprocessed badge when there are unprocessed receipts", () => {
  render(<ClientCard client={{ ...baseClient, unprocessed_count: 3 }} onPress={jest.fn()} />);
  expect(screen.getByText("3 işlenmemiş")).toBeOnTheScreen();
});

test("omits the unprocessed badge at zero", () => {
  render(<ClientCard client={baseClient} onPress={jest.fn()} />);
  expect(screen.queryByText(/işlenmemiş/)).toBeNull();
});

test("shows the last upload date when set", () => {
  render(
    <ClientCard client={{ ...baseClient, last_upload_at: "2026-08-05T10:00:00Z" }} onPress={jest.fn()} />,
  );
  expect(screen.getByText(/Son yükleme: 5 Ağustos 2026/)).toBeOnTheScreen();
});

test("omits the last upload line when unset", () => {
  render(<ClientCard client={baseClient} onPress={jest.fn()} />);
  expect(screen.queryByText(/Son yükleme/)).toBeNull();
});

test("calls onPress when tapped", () => {
  const onPress = jest.fn();
  render(<ClientCard client={baseClient} onPress={onPress} />);
  fireEvent.press(screen.getByText("Ayşe Yıldırım"));
  expect(onPress).toHaveBeenCalled();
});
