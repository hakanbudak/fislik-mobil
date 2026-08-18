export const tokens = {
  color: {
    primary: "#0f766e",
    primaryDark: "#0b5c55",
    surface: "#f5f8f7",
    page: "#e9eeed",
    card: "#ffffff",
    ink: "#0c1a18",
    inkSoft: "#52605e",
    success: "#12a18a",
    warning: "#e08a2b",
    danger: "#c0392b",
    border: "rgba(12, 26, 24, 0.10)",
    // Text/icon color placed on top of a solid `primary` or `danger` fill
    // (e.g. Button's primary/danger variants). Distinct from `card` — that
    // token means "card/panel background" and merely happens to share this
    // value today; this one tracks a foreground role instead.
    onPrimary: "#ffffff",
    // A translucent dark scrim for controls placed over a live camera
    // preview (kamera.tsx) — needs to stay legible over any color the feed
    // shows, which a flat token can't guarantee.
    scrim: "rgba(12, 26, 24, 0.45)",
    // A translucent ring around the shutter button, on top of the solid
    // `onPrimary` fill.
    onPrimaryMuted: "rgba(255, 255, 255, 0.5)",
    // A faint translucent white used for the splash screen's "print slot"
    // bar sitting on top of `primary` — distinct opacity from
    // `onPrimaryMuted`, which is a different design's ring treatment.
    onPrimaryFaint: "rgba(255, 255, 255, 0.28)",
    // Slightly warm receipt paper used by the intro tour's cards
    // (`app/tanitim.tsx`) — deliberately not `card` (#ffffff): the design
    // calls out this exact off-white for the "paper" surface.
    paper: "#fffdf7",
    // The intro tour's dashed rules (receipt card header/footer dividers) —
    // distinct opacity from the existing `border` token (rgba(12,26,24,0.10));
    // the design specifies this exact value and reusing `border` would
    // visibly not match.
    divider: "rgba(12, 26, 24, 0.15)",
    // An inactive progress-dot fill, also intro-tour-only. A third, slightly
    // different `ink` opacity from both `border` and `divider` above — the
    // design pins all three separately rather than sharing one.
    dotInactive: "rgba(12, 26, 24, 0.16)",
    // The framing-guide rails drawn over the live camera preview
    // (kamera.tsx) — two vertical lines the user aligns a receipt's left
    // and right edges to. Purely a visual aid; distinct from
    // `onPrimaryMuted` (a solid `onPrimary` fill's ring treatment) because
    // this sits directly on top of the unpredictable camera feed and needs
    // its own contrast. Deliberately `primary`-based rather than white:
    // the subject is till-receipt paper, which is white or near-white, so
    // a translucent white line (the previous value) all but disappears
    // against it; a saturated brand color reads clearly against both white
    // paper and a dark background.
    viewfinderGuide: "rgba(15, 118, 110, 0.85)",
  },
  radius: { sm: 8, md: 11, lg: 14, pill: 999 },
  space: (n: number) => n * 4,
} as const;
