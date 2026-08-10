import { render } from "@testing-library/react-native";
import Svg from "react-native-svg";
import { FislikMark } from "../FislikMark";
import { tokens } from "../../tokens";

test("renders at the requested size", () => {
  const { UNSAFE_root } = render(<FislikMark width={42} height={60} />);
  const svg = UNSAFE_root.findByType(Svg);
  expect(svg.props.width).toBe(42);
  expect(svg.props.height).toBe(60);
});

test("defaults to the mark's natural 24x34 proportions", () => {
  const { UNSAFE_root } = render(<FislikMark />);
  const svg = UNSAFE_root.findByType(Svg);
  expect(svg.props.width).toBe(24);
  expect(svg.props.height).toBe(34);
});

// Regression guard mirroring Button.colors.test.tsx: fills must come from
// `tokens.color`, not hard-coded hex literals, so the mark stays in sync if
// the palette ever changes. react-native-svg resolves `fill` to a native
// color payload by render time, so the check runs against the React element
// tree (UNSAFE_root) rather than the native JSON output.
test("fills come from tokens.color.primary and tokens.color.card", () => {
  const { UNSAFE_root } = render(<FislikMark />);
  const fills = UNSAFE_root.findAll((node) => "fill" in node.props).map((node) => node.props.fill);
  expect(fills).toContain(tokens.color.primary);
  expect(fills).toContain(tokens.color.card);
});
