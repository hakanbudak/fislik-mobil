import { render, screen } from "@testing-library/react-native";
import { Button } from "../Button";
import { tokens } from "../../tokens";

// Regression test for review finding 1: Button's primary/danger foreground
// must come from tokens.color.onPrimary, not a hard-coded "#ffffff" literal.
test("primary variant text color comes from tokens.color.onPrimary", () => {
  render(<Button title="Kaydet" onPress={() => {}} variant="primary" />);
  expect(screen.getByText("Kaydet")).toHaveStyle({ color: tokens.color.onPrimary });
});

test("danger variant text color comes from tokens.color.onPrimary", () => {
  render(<Button title="Sil" onPress={() => {}} variant="danger" />);
  expect(screen.getByText("Sil")).toHaveStyle({ color: tokens.color.onPrimary });
});
