import { render, screen } from "@testing-library/react-native";
import { ActivityIndicator } from "react-native";
import { Spinner } from "../Spinner";

test("renders an activity indicator", () => {
  render(<Spinner />);
  expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
});
