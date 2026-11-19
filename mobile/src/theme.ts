import { Platform } from "react-native";

/**
 * Zikky's design tokens. Studio hardware: warm graphite, amber readouts,
 * hairline rules, and one bright object — the artwork.
 *
 * Keys are stable. Every colour stays a 6-digit hex string so the contrast
 * test can parse it.
 */
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
  focus: string;
  danger: string;
  dangerSoft: string;
  display: string;
  metal: string;
  shadow: string;
};

export const dark: Palette = {
  bg: "#0C0B09",
  surface: "#131210",
  panel: "#171512",
  surfaceRaised: "#1E1B17",
  surfaceInset: "#070605",
  text: "#F3EEE4",
  muted: "#A69E91",
  faint: "#918A7E",
  accent: "#E9A13B",
  accentStrong: "#F6BE6B",
  onAccent: "#191207",
  accentSoft: "#2B2113",
  border: "#2A2621",
  borderStrong: "#403A32",
  focus: "#F6BE6B",
  danger: "#E8837A",
  dangerSoft: "#2C1916",
  display: "#F6BE6B",
  metal: "#242019",
  shadow: "#000000",
};

export const light: Palette = {
  bg: "#F2EDE3",
  surface: "#FBF8F2",
  panel: "#FBF8F2",
  surfaceRaised: "#FFFDF8",
  surfaceInset: "#E7E0D3",
  text: "#16140F",
  muted: "#514C44",
  faint: "#655F55",
  accent: "#9C570B",
  accentStrong: "#7A4307",
  onAccent: "#FFF9EF",
  accentSoft: "#F1E3CB",
  border: "#DAD3C6",
  borderStrong: "#BEB5A4",
  focus: "#9C570B",
  danger: "#94241D",
  dangerSoft: "#F6E3E0",
  display: "#6E3D05",
  metal: "#E5DED1",
  shadow: "#2A2419",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  /** Distance between major regions. */
  gutter: 40,
} as const;

/** Instruments have corners, not bubbles. */
export const radius = { sm: 2, md: 4, lg: 6, pill: 999 } as const;

export const breakpoints = {
  compact: 1120,
} as const;

export const weight = {
  regular: "400",
  medium: "500",
  bold: "700",
} as const;

/** Family names registered in app/_layout.tsx. Static faces, one per weight. */
export const font = {
  ui: "Archivo",
  uiMedium: "ArchivoMedium",
  uiBold: "ArchivoBold",
  mono: "IBMPlexMono",
  monoMedium: "IBMPlexMonoMedium",
} as const;

export const mono = font.mono;

export const motion = { fast: 120, base: 180, slow: 260 } as const;

const tabular = ["tabular-nums"] as ("tabular-nums" | "small-caps")[];

export const type = {
  hero: {
    fontFamily: font.uiBold,
    fontSize: 44,
    lineHeight: 46,
    letterSpacing: -1.8,
  },
  display: {
    fontFamily: font.uiBold,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -1.1,
  },
  title: {
    fontFamily: font.uiBold,
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.6,
  },
  heading: {
    fontFamily: font.uiMedium,
    fontSize: 18,
    lineHeight: 23,
    letterSpacing: -0.2,
  },
  body: {
    fontFamily: font.ui,
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.05,
  },
  meta: {
    fontFamily: font.ui,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0,
  },
  /** Small caps labels are mono. This is the instrument voice. */
  micro: {
    fontFamily: font.monoMedium,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.5,
  },
  numeric: {
    fontFamily: font.mono,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.3,
    fontVariant: tabular,
  },
  readout: {
    fontFamily: font.monoMedium,
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: 1,
    fontVariant: tabular,
  },
  count: {
    fontFamily: font.uiBold,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.3,
    fontVariant: tabular,
  },
} as const;

/** Web only: installs focus ring and font smoothing, once. */
export const webBase = Platform.OS === "web";
