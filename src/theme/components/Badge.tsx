import { StyleSheet, Text, View } from "react-native";
import { tokens } from "../tokens";
import { text } from "../typography";

type Tone = "success" | "warning" | "neutral";
// "solid" (default): a translucent tone-tinted pill with tone-coloured text,
// meant to sit on a solid card/panel background — e.g. the accountant's
// analysis-credit badge (app/(accountant)/(mukellefler)/mukellef/[clientId].tsx).
// "onImage": an opaque tone-filled pill with light text, for badges placed
// over a photograph (ReceiptCard's stack). Over a receipt photo — usually
// white/near-white paper — the translucent tint nearly disappears and
// mid-tone tone-coloured text has poor contrast; a solid fill with light
// text stays legible over both light paper and dark photo backgrounds.
type Surface = "solid" | "onImage";

const COLOR: Record<Tone, string> = {
  success: tokens.color.success,
  warning: tokens.color.warning,
  neutral: tokens.color.inkSoft,
};

export function Badge({
  label,
  tone = "neutral",
  surface = "solid",
}: {
  label: string;
  tone?: Tone;
  surface?: Surface;
}) {
  const onImage = surface === "onImage";
  const foreground = onImage ? tokens.color.onPrimary : COLOR[tone];
  return (
    <View
      style={[
        styles.badge,
        onImage
          ? [styles.badgeOnImage, { backgroundColor: COLOR[tone] }]
          : { backgroundColor: `${COLOR[tone]}1A` },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: foreground }]} />
      <Text style={[text.caption, { color: foreground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space(1.5),
    paddingHorizontal: tokens.space(2),
    paddingVertical: tokens.space(1),
    borderRadius: tokens.radius.pill,
    alignSelf: "flex-start",
  },
  // A solid fill has no built-in separation from a bright background the
  // way the default's tint/border-ish translucency does, so an over-image
  // badge gets a soft shadow to keep its edge readable against light paper.
  // Reuses the existing `ink` token as the shadow colour (same approach as
  // Toast/SplashOverlay) rather than adding a new one.
  badgeOnImage: {
    shadowColor: tokens.color.ink,
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
