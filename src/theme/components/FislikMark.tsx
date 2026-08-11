import Svg, { Path, Rect } from "react-native-svg";
import { tokens } from "../tokens";

/**
 * Bespoke Fişlik logotype/mark — a scalloped receipt silhouette with a white
 * "F" glyph. Ported from `fislik-web/src/components/FislikMark.tsx` to
 * `react-native-svg`; geometry (viewBox 0 0 24 34) is copied verbatim, and
 * the web version's `fill-primary` / `fill-card` Tailwind classes become
 * `tokens.color.primary` / `tokens.color.card` here. Callers control the
 * rendered size via width/height.
 *
 * `bg`/`fg` default to today's colors (receipt body `primary`, glyph/lines
 * `card`) so every existing caller renders unchanged. The splash screen
 * passes the inverse — white receipt body, teal glyph — via these props.
 */
export function FislikMark({
  width = 24,
  height = 34,
  bg = tokens.color.primary,
  fg = tokens.color.card,
}: {
  width?: number;
  height?: number;
  bg?: string;
  fg?: string;
}) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 34" fill="none">
      <Path
        d="M0 2.2l4-2.2 4 2.2 4-2.2 4 2.2 4-2.2 4 2.2V31.8l-4 2.2-4-2.2-4 2.2-4-2.2-4 2.2-4-2.2V2.2Z"
        fill={bg}
      />
      <Path d="M7 8h10v3.2h-6.4v3.4h5v3.2h-5V22H7V8Z" fill={fg} />
      <Rect x="7" y="24.4" width="10" height="1.7" rx="0.85" fill={fg} opacity="0.5" />
      <Rect x="7" y="27.4" width="6.4" height="1.7" rx="0.85" fill={fg} opacity="0.5" />
    </Svg>
  );
}
