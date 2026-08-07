import { render, screen } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";
import { Card } from "../Card";

test("renders its children", () => {
  render(
    <Card>
      <Text>İçerik</Text>
    </Card>,
  );
  expect(screen.getByText("İçerik")).toBeOnTheScreen();
});

// Regression test for review finding 3: `style` must accept an array of
// styles (StyleProp<ViewStyle>), not a single ViewStyle object — this is a
// compile-time check, so a broken type here is caught by `tsc`, not by the
// runtime assertion below.
test("accepts an array style prop", () => {
  const a = StyleSheet.create({ x: { marginTop: 4 } });
  const b = StyleSheet.create({ y: { marginBottom: 4 } });
  render(
    <Card style={[a.x, b.y]}>
      <Text>İçerik</Text>
    </Card>,
  );
  expect(screen.getByText("İçerik")).toBeOnTheScreen();
});
