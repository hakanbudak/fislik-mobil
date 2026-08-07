import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

test("the test harness renders a component", () => {
  render(<Text>Fişlik</Text>);
  expect(screen.getByText("Fişlik")).toBeOnTheScreen();
});
