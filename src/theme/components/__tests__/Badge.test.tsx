import { render, screen } from "@testing-library/react-native";
import { Badge } from "../Badge";
import { tokens } from "../../tokens";

test("uses the success tone color", () => {
  render(<Badge label="İşlendi" tone="success" />);
  expect(screen.getByText("İşlendi")).toHaveStyle({ color: tokens.color.success });
});
