import { fireEvent, render, screen } from "@testing-library/react-native";
import { Button } from "../Button";

test("calls onPress when tapped", () => {
  const onPress = jest.fn();
  render(<Button title="Kaydet" onPress={onPress} />);
  fireEvent.press(screen.getByText("Kaydet"));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test("does not call onPress while loading", () => {
  const onPress = jest.fn();
  render(<Button title="Kaydet" onPress={onPress} loading />);
  fireEvent.press(screen.getByLabelText("Kaydet"));
  expect(onPress).not.toHaveBeenCalled();
});
