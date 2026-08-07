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
  },
  radius: { sm: 8, md: 11, lg: 14, pill: 999 },
  space: (n: number) => n * 4,
} as const;
