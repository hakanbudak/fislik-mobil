import { render } from "@testing-library/react-native";
import Svg, { Path } from "react-native-svg";
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
//
// `findAllByType(Path)` (rather than the looser "any node with a fill prop"
// scan) returns exactly the two authored `<Path>` elements in JSX order —
// [0] the scalloped body, [1] the "F" glyph — so this also pins *which*
// shape gets which color, not just that both colors appear somewhere.
test("the body Path fills with tokens.color.primary and the glyph Path with tokens.color.card by default", () => {
  const { UNSAFE_root } = render(<FislikMark />);
  const [body, glyph] = UNSAFE_root.findAllByType(Path);
  expect(body.props.fill).toBe(tokens.color.primary);
  expect(glyph.props.fill).toBe(tokens.color.card);
});

// The splash screen (2a) needs the inverse mark — white receipt body, teal
// glyph — via the optional `bg`/`fg` props. The test above pins that the
// defaults are unchanged; this one pins that `bg` drives the body and `fg`
// drives the glyph specifically (not just that both colors appear
// somewhere in the tree).
test("bg drives the body Path and fg drives the glyph Path", () => {
  const { UNSAFE_root } = render(<FislikMark bg="#123456" fg="#abcdef" />);
  const [body, glyph] = UNSAFE_root.findAllByType(Path);
  expect(body.props.fill).toBe("#123456");
  expect(glyph.props.fill).toBe("#abcdef");
});
