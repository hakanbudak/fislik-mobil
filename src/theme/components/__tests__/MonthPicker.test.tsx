import { render, screen } from "@testing-library/react-native";
import { MonthPicker } from "../MonthPicker";

test("the month chevrons are reachable at 44pt without growing visually", () => {
  render(<MonthPicker value="2026-07" onChange={jest.fn()} />);
  const previous = screen.getByLabelText("Önceki ay");
  // 32pt control + 6pt of slop on every side = a 44pt touch target.
  expect(previous.props.hitSlop).toEqual({ top: 6, bottom: 6, left: 6, right: 6 });
});
