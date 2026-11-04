import { Platform } from "react-native";

/** Zikky's design tokens. One place for every colour, size and rhythm. */
export type Palette = {
  bg: string;
  surface: string;
  panel: string;
  surfaceRaised: string;
  surfaceInset: string;
  text: string;
  muted: string;
  faint: string;
  accent: string;
  accentStrong: string;
  onAccent: string;
  accentSoft: string;
  border: string;
  borderStrong: string;
  danger: string;
  dangerSoft: string;
  display: string;
  metal: string;
  shadow: string;
};

export const dark: Palette = {
  bg: "#0A0E0B",
  surface: "#111712",
  panel: "#151C16",
  surfaceRaised: "#1B241C",
  surfaceInset: "#070A08",
  text: "#EDF2E9",
  muted: "#9BA89C",
  faint: "#6B786D",
  accent: "#65E39A",
  accentStrong: "#2EC56F",
  onAccent: "#04140A",
  accentSoft: "#16281C",
  border: "#242E26",
  borderStrong: "#37443A",
  danger: "#FF9A9A",
  dangerSoft: "#2A1414",
  display: "#9CF5BE",
  metal: "#232C25",
  shadow: "#000000",
};

export const light: Palette = {
  bg: "#F2F5EE",
  surface: "#FFFFFF",
  panel: "#FFFFFF",
  surfaceRaised: "#FFFFFF",
  surfaceInset: "#E7ECE1",
  text: "#10160F",
  muted: "#58655A",
  faint: "#7C8A7E",
  accent: "#0F6B3B",
  accentStrong: "#0A512C",
  onAccent: "#FFFFFF",
  accentSoft: "#E1F0E4",
  border: "#DCE3D7",
  borderStrong: "#C1CDBC",
  danger: "#A0202E",
  dangerSoft: "#FBE7E7",
  display: "#0A512C",
  metal: "#E2E8DC",
  shadow: "#25301F",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const mono = Platform.OS === "ios" ? "Menlo" : "monospace";

export const type = {
  display: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "800" as const,
    letterSpacing: -1,
  },
  title: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "700" as const,
    letterSpacing: -0.6,
  },
  heading: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "700" as const,
    letterSpacing: -0.2,
  },
  body: { fontSize: 16, lineHeight: 22, fontWeight: "400" as const },
  meta: { fontSize: 13, lineHeight: 18, fontWeight: "500" as const },
  micro: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "700" as const,
    letterSpacing: 1.2,
  },
  numeric: {
    fontFamily: mono,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600" as const,
    letterSpacing: 0.6,
  },
  count: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800" as const,
    fontVariant: ["tabular-nums"] as ("tabular-nums" | "small-caps")[],
    letterSpacing: -0.3,
  },
} as const;
