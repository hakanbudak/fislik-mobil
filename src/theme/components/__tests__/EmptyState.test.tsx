import { render, screen } from "@testing-library/react-native";
import { EmptyState } from "../EmptyState";

test("renders the title and description", () => {
  render(<EmptyState title="Fiş yok" description="Henüz fiş yüklenmedi." />);
  expect(screen.getByText("Fiş yok")).toBeOnTheScreen();
  expect(screen.getByText("Henüz fiş yüklenmedi.")).toBeOnTheScreen();
});
