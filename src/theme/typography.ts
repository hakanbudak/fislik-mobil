export const font = {
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  bold: "PlusJakartaSans_700Bold",
  extraBold: "PlusJakartaSans_800ExtraBold",
} as const;

export const text = {
  title: { fontFamily: font.bold, fontSize: 19, letterSpacing: -0.5 },
  body: { fontFamily: font.regular, fontSize: 15 },
  label: { fontFamily: font.bold, fontSize: 13.5 },
  caption: { fontFamily: font.medium, fontSize: 11.5 },
} as const;
