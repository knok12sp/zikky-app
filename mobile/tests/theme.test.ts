import { describe, it, expect, vi } from "vitest";
import {
  dark,
  light,
  breakpoints,
  spacing,
  radius,
  weight,
  type,
} from "../src/theme";

vi.mock("react-native", () => ({ Platform: { OS: "web" } }));

const linear = (hex: string, offset: number) => {
  const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string) =>
  0.2126 * linear(hex, 1) + 0.7152 * linear(hex, 3) + 0.0722 * linear(hex, 5);

const contrast = (a: string, b: string) => {
  const high = Math.max(luminance(a), luminance(b));
  const low = Math.min(luminance(a), luminance(b));
  return (high + 0.05) / (low + 0.05);
};

describe("design tokens", () => {
  it("keeps faint text readable on every surface", () => {
    for (const palette of [dark, light]) {
      for (const surface of [
        palette.bg,
        palette.surface,
        palette.panel,
        palette.surfaceRaised,
        palette.surfaceInset,
      ]) {
        expect(contrast(palette.faint, surface)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("keeps one spacing, radius, weight and breakpoint scale", () => {
    expect(Object.values(spacing)).toEqual([4, 8, 12, 16, 24, 32, 48, 40]);
    expect(Object.values(radius)).toEqual([2, 4, 6, 999]);
    expect(breakpoints.compact).toBe(1120);
    expect(new Set(Object.values(weight))).toEqual(
      new Set(["400", "500", "700"]),
    );
  });

  it("sets every type style from the loaded faces, not a synthetic weight", () => {
    const families = Object.values(type).map(
      (style) => (style as { fontFamily: string }).fontFamily,
    );
    expect(new Set(families)).toEqual(
      new Set([
        "Archivo",
        "ArchivoMedium",
        "ArchivoBold",
        "IBMPlexMono",
        "IBMPlexMonoMedium",
      ]),
    );
    expect(
      Object.values(type).some(
        (style) => "fontWeight" in (style as Record<string, unknown>),
      ),
    ).toBe(false);
    expect(new Set(Object.values(type).map((style) => style.fontSize))).toEqual(
      new Set([44, 32, 24, 18, 15, 13, 12, 10]),
    );
  });
});
