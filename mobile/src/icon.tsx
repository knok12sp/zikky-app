import React from "react";
import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

export type IconName =
  | "play"
  | "pause"
  | "next"
  | "previous"
  | "shuffle"
  | "repeat"
  | "repeatOne"
  | "heart"
  | "heartFilled"
  | "star"
  | "starFilled"
  | "download"
  | "downloaded"
  | "more"
  | "queue"
  | "close"
  | "chevronLeft"
  | "chevronRight"
  | "chevronDown"
  | "search"
  | "home"
  | "library"
  | "settings"
  | "server"
  | "phone"
  | "artist"
  | "plus"
  | "check"
  | "note"
  | "sort"
  | "clock"
  | "volume"
  | "volumeOff"
  | "trash"
  | "sparkle"
  | "wifi"
  | "retry";

type Shape = {
  d?: string;
  cx?: number;
  cy?: number;
  r?: number;
  filled?: boolean;
};

const HEART =
  "M12 20.3 4.9 13.2A4.9 4.9 0 0 1 12 6.6a4.9 4.9 0 0 1 7.1 6.6Z";

const STAR =
  "M12 3.1l2.6 5.4 5.9.8-4.3 4.2 1 5.9L12 16.6l-5.2 2.8 1-5.9L3.5 9.3l5.9-.8Z";

/** 24×24 geometry. Filled shapes are solid; the rest are 1.5px strokes. */
export const ICON: Record<IconName, Shape[]> = {
  play: [{ d: "M8 4.8 19.2 12 8 19.2Z", filled: true }],
  pause: [
    { d: "M7 5h3.3v14H7zM13.7 5H17v14h-3.3z", filled: true },
  ],
  next: [
    { d: "M6 4.8 16.4 12 6 19.2Z", filled: true },
    { d: "M17.6 5H19v14h-1.4z", filled: true },
  ],
  previous: [
    { d: "M18 4.8 7.6 12 18 19.2Z", filled: true },
    { d: "M5 5h1.4v14H5z", filled: true },
  ],
  shuffle: [
    { d: "M3 7h3.4c4.4 0 6.2 10 10.4 10H21" },
    { d: "M3 17h3.2c1.5 0 2.7-.9 3.8-2.4" },
    { d: "M14.4 8c1-1 2-1.4 3.4-1.4H21" },
    { d: "m18 14 3 3-3 3" },
    { d: "m18 4 3 3-3 3" },
  ],
  repeat: [
    { d: "M17 2.5 20 5.5l-3 3" },
    { d: "M3.5 12V9.5a4 4 0 0 1 4-4H20" },
    { d: "M7 21.5 4 18.5l3-3" },
    { d: "M20.5 12v2.5a4 4 0 0 1-4 4H4" },
  ],
  repeatOne: [
    { d: "M17 2.5 20 5.5l-3 3" },
    { d: "M3.5 12V9.5a4 4 0 0 1 4-4H20" },
    { d: "M7 21.5 4 18.5l3-3" },
    { d: "M20.5 12v2.5a4 4 0 0 1-4 4H4" },
    { d: "M10.9 10.6 12 9.8v4.4" },
    { d: "M10.9 14.2h2.2" },
  ],
  heart: [{ d: HEART }],
  heartFilled: [{ d: HEART, filled: true }],
  star: [{ d: STAR }],
  starFilled: [{ d: STAR, filled: true }],
  download: [
    { d: "M12 3.5v11" },
    { d: "m7.8 10.4 4.2 4.2 4.2-4.2" },
    { d: "M4.5 20h15" },
  ],
  downloaded: [
    { d: "M20.5 12a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z" },
    { d: "m8.4 12 2.5 2.6 4.7-5.2" },
  ],
  more: [
    { cx: 4.6, cy: 12, r: 1.35, filled: true },
    { cx: 12, cy: 12, r: 1.35, filled: true },
    { cx: 19.4, cy: 12, r: 1.35, filled: true },
  ],
  queue: [
    { d: "M3.5 6.5h10M3.5 12h7M3.5 17.5h7" },
    { d: "M14.5 13.5 21 17l-6.5 3.5Z", filled: true },
  ],
  close: [{ d: "M6 6l12 12M18 6 6 18" }],
  chevronLeft: [{ d: "m14.5 5.5-6.5 6.5 6.5 6.5" }],
  chevronRight: [{ d: "m9.5 5.5 6.5 6.5-6.5 6.5" }],
  chevronDown: [{ d: "m5.5 9.5 6.5 6.5 6.5-6.5" }],
  search: [
    { d: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z" },
    { d: "m16.2 16.2 4.3 4.3" },
  ],
  home: [
    { d: "M3.5 10.4 12 3.5l8.5 6.9" },
    { d: "M5.6 9.2V20.5h12.8V9.2" },
  ],
  library: [
    { d: "M4 4.5v15M9.2 4.5v15M14.4 4.5v15" },
    { d: "m18.1 5.4 2.6 13.2" },
  ],
  settings: [
    { d: "M12 8.9a3.1 3.1 0 1 0 0 6.2 3.1 3.1 0 0 0 0-6.2Z" },
    { d: "M12 2.6v2.4M12 19v2.4M4.4 12H2M22 12h-2.4" },
    { d: "M6.7 6.7 5 5M19 19l-1.7-1.7M17.3 6.7 19 5M5 19l1.7-1.7" },
  ],
  server: [
    { d: "M3.5 5.5h17v5.2h-17zM3.5 13.3h17v5.2h-17z" },
    { cx: 7, cy: 8.1, r: 0.95, filled: true },
    { cx: 7, cy: 15.9, r: 0.95, filled: true },
  ],
  phone: [
    {
      d: "M7.6 2.8h8.8a2 2 0 0 1 2 2v14.4a2 2 0 0 1-2 2H7.6a2 2 0 0 1-2-2V4.8a2 2 0 0 1 2-2Z",
    },
    { d: "M10.6 18.4h2.8" },
  ],
  artist: [
    { d: "M12 11.4a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" },
    { d: "M4.8 20.4c.5-3.4 3.4-5.6 7.2-5.6s6.7 2.2 7.2 5.6" },
  ],
  plus: [{ d: "M12 4.5v15M4.5 12h15" }],
  check: [{ d: "m4.5 12.6 4.8 4.8L19.5 7" }],
  note: [
    { d: "M11.6 15V5l8-1.6v9.4" },
    { d: "M11.6 16.9a2.7 2.7 0 1 1-5.4 0 2.7 2.7 0 0 1 5.4 0Z" },
    { d: "M19.6 12.9a2.7 2.7 0 1 1-5.4 0 2.7 2.7 0 0 1 5.4 0Z" },
  ],
  sort: [
    { d: "M4 6.5h9.5M4 12h6.5M4 17.5h4" },
    { d: "M16.8 5.5v13" },
    { d: "m13.8 15.5 3 3 3-3" },
  ],
  clock: [
    { d: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" },
    { d: "M12 6.8V12l3.4 2.2" },
  ],
  volume: [
    { d: "M4 9.4h3.4L12 5.2v13.6L7.4 14.6H4Z" },
    { d: "M15.4 8.9a4.4 4.4 0 0 1 0 6.2" },
    { d: "M18.2 6.2a8.2 8.2 0 0 1 0 11.6" },
  ],
  volumeOff: [
    { d: "M4 9.4h3.4L12 5.2v13.6L7.4 14.6H4Z" },
    { d: "m15.4 9.4 4.4 5.2M19.8 9.4l-4.4 5.2" },
  ],
  trash: [
    { d: "M3.8 6.8h16.4" },
    { d: "M9.2 6.8V4.2h5.6v2.6" },
    { d: "m6.4 6.8 1 13.4h9.2l1-13.4" },
    { d: "M10.4 10.8v5.6M13.6 10.8v5.6" },
  ],
  sparkle: [
    { d: "M11 3.4 12.7 8l4.6 1.7-4.6 1.7L11 16l-1.7-4.6L4.7 9.7 9.3 8Z" },
    { d: "m18 15.4.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8Z" },
  ],
  wifi: [
    { d: "M3.4 8.9a13 13 0 0 1 17.2 0" },
    { d: "M6.6 12.4a8.5 8.5 0 0 1 10.8 0" },
    { d: "M9.8 15.9a4 4 0 0 1 4.4 0" },
    { cx: 12, cy: 19.3, r: 1.2, filled: true },
  ],
  retry: [
    { d: "M20.4 12a8.4 8.4 0 1 1-2.6-6.1" },
    { d: "M20.4 3.9v4.7h-4.7" },
  ],
};

/**
 * Dependency-free at the call site: one Svg, shared geometry. Stroke width is
 * solved from the rendered size so every icon lands at ~1.5px on screen.
 */
export function Icon({
  name,
  size = 20,
  color = "#F3EEE4",
  strokeWidth,
  rotate,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  rotate?: number;
}) {
  const stroke = strokeWidth ?? Math.max(1.4, (1.55 * 24) / size);
  return (
    <View
      accessible={false}
      importantForAccessibility="no"
      style={{
        width: size,
        height: size,
        transform: rotate ? [{ rotate: `${rotate}deg` }] : undefined,
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {ICON[name].map((shape, i) =>
          shape.d ? (
            <Path
              key={i}
              d={shape.d}
              fill={shape.filled ? color : "none"}
              stroke={shape.filled ? "none" : color}
              strokeWidth={shape.filled ? 0 : stroke}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <Circle
              key={i}
              cx={shape.cx}
              cy={shape.cy}
              r={shape.r}
              fill={color}
            />
          ),
        )}
      </Svg>
    </View>
  );
}
