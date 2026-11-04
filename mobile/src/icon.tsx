import React from "react";
import { Text, View, Platform } from "react-native";

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
  | "plus"
  | "check"
  | "note"
  | "sort"
  | "clock"
  | "trash"
  | "sparkle"
  | "wifi"
  | "retry";

const glyph: Partial<Record<IconName, string>> = {
  shuffle: "⇄",
  repeat: "↻",
  repeatOne: "↻",
  heart: "♡",
  heartFilled: "♥",
  chevronLeft: "‹",
  chevronRight: "›",
  chevronDown: "⌄",
  note: "♪",
  sparkle: "✦",
  retry: "⟳",
};

/**
 * Dependency-free icons. Simple geometry is drawn with views so the playback
 * controls stay crisp at any size; richer symbols use a text glyph.
 */
export function Icon({
  name,
  size = 20,
  color = "#EDF2E9",
  strokeWidth,
  rotate,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  rotate?: number;
}) {
  const width = strokeWidth ?? Math.max(1.6, size / 12);
  const wrap = (children: React.ReactNode) => (
    <View
      accessible={false}
      importantForAccessibility="no"
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        transform: rotate ? [{ rotate: `${rotate}deg` }] : undefined,
      }}
    >
      {children}
    </View>
  );
  const triangle = (
    <View
      style={{
        width: 0,
        height: 0,
        borderTopWidth: size * 0.32,
        borderBottomWidth: size * 0.32,
        borderLeftWidth: size * 0.5,
        borderTopColor: "transparent",
        borderBottomColor: "transparent",
        borderLeftColor: color,
        marginLeft: size * 0.08,
      }}
    />
  );
  switch (name) {
    case "play":
      return wrap(triangle);
    case "pause":
      return wrap(
        <View style={{ flexDirection: "row", gap: size * 0.16 }}>
          {[0, 1].map((i) => (
            <View
              key={i}
              style={{
                width: size * 0.17,
                height: size * 0.62,
                borderRadius: 2,
                backgroundColor: color,
              }}
            />
          ))}
        </View>,
      );
    case "next":
    case "previous": {
      const bar = (
        <View
          style={{
            width: size * 0.14,
            height: size * 0.66,
            borderRadius: 2,
            backgroundColor: color,
          }}
        />
      );
      return wrap(
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            transform: name === "previous" ? [{ rotate: "180deg" }] : undefined,
          }}
        >
          {triangle}
          {bar}
        </View>,
      );
    }
    case "close":
      return wrap(
        <View style={{ width: size * 0.62, height: size * 0.62 }}>
          {[45, -45].map((deg) => (
            <View
              key={deg}
              style={{
                position: "absolute",
                top: size * 0.29,
                left: 0,
                width: size * 0.62,
                height: width,
                borderRadius: width,
                backgroundColor: color,
                transform: [{ rotate: `${deg}deg` }],
              }}
            />
          ))}
        </View>,
      );
    case "plus":
      return wrap(
        <View style={{ width: size * 0.6, height: size * 0.6 }}>
          <View
            style={{
              position: "absolute",
              top: size * 0.28,
              left: 0,
              width: size * 0.6,
              height: width,
              borderRadius: width,
              backgroundColor: color,
            }}
          />
          <View
            style={{
              position: "absolute",
              left: size * 0.28,
              top: 0,
              height: size * 0.6,
              width,
              borderRadius: width,
              backgroundColor: color,
            }}
          />
        </View>,
      );
    case "check":
      return wrap(
        <View style={{ width: size * 0.6, height: size * 0.6 }}>
          <View
            style={{
              position: "absolute",
              left: size * 0.04,
              top: size * 0.16,
              width: size * 0.26,
              height: width,
              borderRadius: width,
              backgroundColor: color,
              transform: [{ rotate: "45deg" }],
            }}
          />
          <View
            style={{
              position: "absolute",
              left: size * 0.16,
              top: size * 0.27,
              width: size * 0.44,
              height: width,
              borderRadius: width,
              backgroundColor: color,
              transform: [{ rotate: "-48deg" }],
            }}
          />
        </View>,
      );
    case "search":
      return wrap(
        <View style={{ width: size * 0.72, height: size * 0.72 }}>
          <View
            style={{
              width: size * 0.5,
              height: size * 0.5,
              borderRadius: size,
              borderWidth: width,
              borderColor: color,
            }}
          />
          <View
            style={{
              position: "absolute",
              right: size * 0.02,
              bottom: size * 0.02,
              width: size * 0.24,
              height: width,
              borderRadius: width,
              backgroundColor: color,
              transform: [{ rotate: "45deg" }],
            }}
          />
        </View>,
      );
    case "home":
      return wrap(
        <View style={{ width: size * 0.7, height: size * 0.66 }}>
          <View
            style={{
              position: "absolute",
              top: 0,
              left: size * 0.08,
              width: 0,
              height: 0,
              borderLeftWidth: size * 0.27,
              borderRightWidth: size * 0.27,
              borderBottomWidth: size * 0.3,
              borderLeftColor: "transparent",
              borderRightColor: "transparent",
              borderBottomColor: color,
            }}
          />
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: size * 0.04,
              width: size * 0.52,
              height: size * 0.38,
              borderWidth: width,
              borderTopWidth: 0,
              borderColor: color,
              borderBottomLeftRadius: 3,
              borderBottomRightRadius: 3,
            }}
          />
        </View>,
      );
    case "library":
    case "queue":
      return wrap(
        <View style={{ gap: size * 0.14, width: size * 0.66 }}>
          {[1, 0.72, 0.86].map((f, i) => (
            <View
              key={i}
              style={{
                width: size * 0.66 * f,
                height: width,
                borderRadius: width,
                backgroundColor: color,
              }}
            />
          ))}
        </View>,
      );
    case "settings":
      return wrap(
        <View style={{ gap: size * 0.16, width: size * 0.7 }}>
          {[0.3, 0.65, 0.45].map((pos, i) => (
            <View
              key={i}
              style={{
                width: size * 0.7,
                height: width,
                borderRadius: width,
                backgroundColor: color,
              }}
            >
              <View
                style={{
                  position: "absolute",
                  left: size * 0.7 * pos,
                  top: -size * 0.07,
                  width: size * 0.2,
                  height: size * 0.2,
                  borderRadius: size,
                  backgroundColor: color,
                }}
              />
            </View>
          ))}
        </View>,
      );
    case "more":
      return wrap(
        <View style={{ flexDirection: "row", gap: size * 0.12 }}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                width: size * 0.12,
                height: size * 0.12,
                borderRadius: size,
                backgroundColor: color,
              }}
            />
          ))}
        </View>,
      );
    case "download":
      return wrap(
        <View style={{ width: size * 0.7, height: size * 0.72 }}>
          <View
            style={{
              position: "absolute",
              left: size * 0.33,
              top: 0,
              width,
              height: size * 0.34,
              borderRadius: width,
              backgroundColor: color,
            }}
          />
          <View
            style={{
              position: "absolute",
              left: size * 0.19,
              top: size * 0.24,
              width: 0,
              height: 0,
              borderLeftWidth: size * 0.16,
              borderRightWidth: size * 0.16,
              borderTopWidth: size * 0.2,
              borderLeftColor: "transparent",
              borderRightColor: "transparent",
              borderTopColor: color,
            }}
          />
          <View
            style={{
              position: "absolute",
              bottom: 0,
              width: size * 0.7,
              height: width,
              borderRadius: width,
              backgroundColor: color,
            }}
          />
        </View>,
      );
    case "downloaded":
      return wrap(
        <View style={{ width: size * 0.7, height: size * 0.7 }}>
          <View
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: size * 0.7,
              height: size * 0.7,
              borderRadius: size,
              borderWidth: width,
              borderColor: color,
            }}
          />
          <View
            style={{
              position: "absolute",
              left: size * 0.19,
              top: size * 0.22,
              width: size * 0.2,
              height: width,
              backgroundColor: color,
              transform: [{ rotate: "45deg" }],
            }}
          />
          <View
            style={{
              position: "absolute",
              left: size * 0.29,
              top: size * 0.34,
              width: size * 0.34,
              height: width,
              backgroundColor: color,
              transform: [{ rotate: "-48deg" }],
            }}
          />
        </View>,
      );
    case "server":
      return wrap(
        <View style={{ gap: size * 0.12, width: size * 0.66 }}>
          {[0, 1].map((i) => (
            <View
              key={i}
              style={{
                width: size * 0.66,
                height: size * 0.28,
                borderRadius: 3,
                borderWidth: width,
                borderColor: color,
                flexDirection: "row",
                alignItems: "center",
                paddingLeft: size * 0.1,
              }}
            >
              <View
                style={{
                  width: size * 0.06,
                  height: size * 0.06,
                  borderRadius: size,
                  backgroundColor: color,
                }}
              />
            </View>
          ))}
        </View>,
      );
    case "phone":
      return wrap(
        <View
          style={{
            width: size * 0.46,
            height: size * 0.72,
            borderRadius: size * 0.12,
            borderWidth: width,
            borderColor: color,
            alignItems: "center",
            justifyContent: "flex-end",
            paddingBottom: size * 0.06,
          }}
        >
          <View
            style={{
              width: size * 0.14,
              height: width,
              borderRadius: width,
              backgroundColor: color,
            }}
          />
        </View>,
      );
    case "clock":
      return wrap(
        <View
          style={{
            width: size * 0.68,
            height: size * 0.68,
            borderRadius: size,
            borderWidth: width,
            borderColor: color,
          }}
        >
          <View
            style={{
              position: "absolute",
              left: size * 0.32,
              top: size * 0.14,
              width,
              height: size * 0.2,
              backgroundColor: color,
            }}
          />
          <View
            style={{
              position: "absolute",
              left: size * 0.32,
              top: size * 0.32,
              width: size * 0.18,
              height: width,
              backgroundColor: color,
            }}
          />
        </View>,
      );
    case "trash":
      return wrap(
        <View style={{ width: size * 0.6, height: size * 0.7 }}>
          <View
            style={{
              position: "absolute",
              top: size * 0.12,
              left: 0,
              width: size * 0.6,
              height: width,
              backgroundColor: color,
            }}
          />
          <View
            style={{
              position: "absolute",
              top: 0,
              left: size * 0.2,
              width: size * 0.2,
              height: width,
              backgroundColor: color,
            }}
          />
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: size * 0.06,
              width: size * 0.48,
              height: size * 0.5,
              borderWidth: width,
              borderTopWidth: 0,
              borderColor: color,
              borderBottomLeftRadius: 3,
              borderBottomRightRadius: 3,
            }}
          />
        </View>,
      );
    case "sort":
      return wrap(
        <View style={{ width: size * 0.68, gap: size * 0.13 }}>
          {[0.68, 0.46, 0.24].map((f, i) => (
            <View
              key={i}
              style={{
                width: size * f,
                height: width,
                borderRadius: width,
                backgroundColor: color,
              }}
            />
          ))}
        </View>,
      );
    case "wifi":
      return wrap(
        <View style={{ width: size * 0.72, height: size * 0.56 }}>
          {[0.72, 0.48].map((f, i) => (
            <View
              key={i}
              style={{
                position: "absolute",
                top: i * size * 0.16,
                left: (size * (0.72 - f)) / 2,
                width: size * f,
                height: size * f * 0.5,
                borderTopLeftRadius: size,
                borderTopRightRadius: size,
                borderWidth: width,
                borderBottomWidth: 0,
                borderColor: color,
              }}
            />
          ))}
          <View
            style={{
              position: "absolute",
              bottom: 0,
              width: size * 0.1,
              height: size * 0.1,
              borderRadius: size,
              backgroundColor: color,
            }}
          />
        </View>,
      );
    default: {
      const symbol = glyph[name] ?? "♪";
      return wrap(
        <Text
          accessible={false}
          allowFontScaling={false}
          style={{
            color,
            fontSize:
              name === "heart" || name === "heartFilled" ? size * 0.9 : size,
            lineHeight: size * 1.1,
            fontFamily:
              name === "shuffle" || name === "repeat" || name === "repeatOne"
                ? Platform.OS === "ios"
                  ? "Helvetica Neue"
                  : undefined
                : undefined,
          }}
        >
          {name === "repeatOne" ? "↻¹" : symbol}
        </Text>,
      );
    }
  }
}
