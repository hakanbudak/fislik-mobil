import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { Card } from "../Card";

test("renders its children", () => {
  render(
    <Card>
      <Text>İçerik</Text>
    </Card>,
  );
  expect(screen.getByText("İçerik")).toBeOnTheScreen();
});
