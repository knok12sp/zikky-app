import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { useTheme, report } from "./ui";
import { Icon, IconName } from "./icon";
import { font, radius, spacing, type } from "./theme";

/** A plate: hairline edge, near-flat surface. Never a floating card. */
export function Card({
  children,
  style,
  inset = false,
  padding = spacing.lg,
}: {
  children: React.ReactNode;
  style?: object;
  inset?: boolean;
  padding?: number;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: inset ? colors.surfaceInset : colors.surface,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          padding,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => unknown;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: spacing.md,
        borderBottomWidth: 1,
        borderColor: colors.border,
        paddingBottom: spacing.sm,
      }}
    >
      <Text
        accessibilityRole="header"
        style={[
          type.micro,
          { color: colors.muted, textTransform: "uppercase" },
        ]}
      >
        {title}
      </Text>
      {action && onAction && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action}
          hitSlop={10}
          onPress={() => {
            try {
              void Promise.resolve(onAction()).catch(report);
            } catch (e) {
              report(e);
            }
          }}
        >
          <Text
            style={[
              type.micro,
              { color: colors.accent, textTransform: "uppercase" },
            ]}
          >
            {action}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export function PageHeader({
  title,
  subtitle,
  query = "",
  onQuery,
  showSearch = false,
  actions,
}: {
  title: string;
  subtitle?: string;
  query?: string;
  onQuery?: (value: string) => void;
  showSearch?: boolean;
  actions?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={{ gap: spacing.lg, paddingBottom: spacing.md }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: spacing.xl,
        }}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <Text
            accessibilityRole="header"
            style={[type.hero, { color: colors.text }]}
          >
            {title}
          </Text>
          {!!subtitle && (
            <Text style={[type.meta, { color: colors.muted }]}>{subtitle}</Text>
          )}
        </View>
        {actions}
        {showSearch && !!onQuery && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              width: 300,
              minHeight: 44,
              borderRadius: radius.sm,
              borderWidth: 1,
              borderColor: focused ? colors.focus : colors.border,
              backgroundColor: colors.surfaceInset,
              paddingHorizontal: spacing.md,
            }}
          >
            <Icon name="search" size={16} color={colors.faint} />
            <TextInput
              accessibilityLabel={`Search ${title.toLowerCase()}`}
              placeholder="Search this view"
              placeholderTextColor={colors.faint}
              value={query}
              onChangeText={onQuery}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              style={{
                flex: 1,
                color: colors.text,
                ...type.meta,
                ...(Platform.OS === "web"
                  ? {
                      outlineStyle: "solid" as const,
                      outlineWidth: 0,
                      outlineColor: "transparent",
                    }
                  : {}),
              }}
            />
            {!!query && (
              <IconButton
                name="close"
                label="Clear search"
                onPress={() => onQuery("")}
                size={24}
                iconSize={12}
              />
            )}
          </View>
        )}
      </View>
    </View>
  );
}

export function NavGroup({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 2, marginTop: title ? spacing.lg : 0 }}>
      {!!title && (
        <Text
          style={[
            type.micro,
            {
              color: colors.faint,
              textTransform: "uppercase",
              paddingHorizontal: spacing.md,
              paddingBottom: spacing.xs,
            },
          ]}
        >
          {title}
        </Text>
      )}
      {children}
    </View>
  );
}

export function SongTable({
  showAlbum = true,
  trailing = 100,
  children,
}: {
  showAlbum?: boolean;
  trailing?: number;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const heading = { ...type.micro, color: colors.faint };
  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          paddingHorizontal: 8,
          paddingBottom: spacing.sm,
          borderBottomWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text style={[heading, { width: 24 }]}>NO</Text>
        <View style={{ width: 44 }} />
        <Text style={[heading, { flex: 1, minWidth: 120 }]}>TITLE</Text>
        {showAlbum && <Text style={[heading, { flex: 0.7 }]}>ALBUM</Text>}
        <Text style={[heading, { width: 52, textAlign: "right" }]}>RATED</Text>
        <Text style={[heading, { width: 48, textAlign: "right" }]}>TIME</Text>
        <View style={{ width: Math.max(0, trailing - spacing.md) }} />
      </View>
      {children}
    </View>
  );
}

export function IconButton({
  name,
  label,
  onPress,
  disabled = false,
  active = false,
  size = 40,
  iconSize,
  variant = "plain",
  busy = false,
  rotate,
  color: tint,
}: {
  name: IconName;
  label: string;
  onPress: () => unknown;
  disabled?: boolean;
  active?: boolean;
  size?: number;
  iconSize?: number;
  variant?: "plain" | "filled" | "outline";
  busy?: boolean;
  rotate?: number;
  color?: string;
}) {
  const { colors } = useTheme();
  const color =
    tint ??
    (active
      ? colors.accent
      : variant === "filled"
        ? colors.onAccent
        : colors.text);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active, busy }}
      disabled={disabled}
      hitSlop={6}
      onPress={(event) => {
        event?.stopPropagation();
        try {
          void Promise.resolve(onPress()).catch(report);
        } catch (e) {
          report(e);
        }
      }}
      style={({ pressed }) => ({
        minWidth: size,
        minHeight: size,
        width: size,
        height: size,
        borderRadius: radius.sm,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor:
          variant === "filled"
            ? colors.accent
            : active
              ? colors.accentSoft
              : variant === "outline"
                ? colors.surfaceRaised
                : "transparent",
        borderWidth: variant === "outline" ? 1 : 0,
        borderColor: active ? colors.accent : colors.border,
        opacity: disabled ? 0.35 : pressed ? 0.55 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Icon
          name={name}
          size={iconSize ?? Math.round(size * 0.5)}
          color={color}
          rotate={rotate}
        />
      )}
    </Pressable>
  );
}

/** The one primary action: an amber plate with a dark glyph. */
export function PlayButton({
  playing,
  busy,
  onPress,
  size = 64,
  label,
}: {
  playing: boolean;
  busy?: boolean;
  onPress: () => unknown;
  size?: number;
  label?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        label ?? (busy ? "Loading playback" : playing ? "Pause" : "Play")
      }
      accessibilityState={{ busy: !!busy }}
      disabled={!!busy}
      onPress={() => {
        try {
          void Promise.resolve(onPress()).catch(report);
        } catch (e) {
          report(e);
        }
      }}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: radius.md,
        backgroundColor: colors.accent,
        alignItems: "center",
        justifyContent: "center",
        transform: [{ scale: pressed ? 0.96 : 1 }],
        opacity: busy ? 0.7 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator color={colors.onAccent} />
      ) : (
        <Icon
          name={playing ? "pause" : "play"}
          size={Math.round(size * 0.4)}
          color={colors.onAccent}
        />
      )}
    </Pressable>
  );
}

export function Chip({
  title,
  active = false,
  onPress,
  label,
  icon,
}: {
  title: string;
  active?: boolean;
  onPress: () => unknown;
  label?: string;
  icon?: IconName;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      accessibilityState={{ selected: active }}
      onPress={() => {
        try {
          void Promise.resolve(onPress()).catch(report);
        } catch (e) {
          report(e);
        }
      }}
      style={({ pressed }) => ({
        minHeight: 44,
        paddingHorizontal: 12,
        justifyContent: "center",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderRadius: radius.sm,
        backgroundColor: active ? colors.accentSoft : "transparent",
        borderWidth: 1,
        borderColor: active ? colors.accent : colors.border,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {icon && (
        <Icon
          name={icon}
          size={14}
          color={active ? colors.accent : colors.muted}
        />
      )}
      <Text
        style={[
          type.micro,
          {
            color: active ? colors.accent : colors.muted,
            textTransform: "uppercase",
          },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; title: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        padding: 2,
        borderRadius: radius.sm,
        backgroundColor: colors.surfaceInset,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      {options.map((option) => {
        const active = option.key === value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            accessibilityLabel={option.title}
            accessibilityState={{ selected: active }}
            onPress={() => {
              try {
                void Promise.resolve(onChange(option.key)).catch(report);
              } catch (e) {
                report(e);
              }
            }}
            style={{
              flex: 1,
              minHeight: 38,
              borderRadius: radius.sm,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: active ? colors.surfaceRaised : "transparent",
              borderWidth: 1,
              borderColor: active ? colors.borderStrong : "transparent",
            }}
          >
            <Text
              style={[
                type.micro,
                {
                  color: active ? colors.text : colors.muted,
                  textTransform: "uppercase",
                },
              ]}
            >
              {option.title}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ProgressBar({
  value,
  tone,
  height = 3,
}: {
  value: number;
  tone?: string;
  height?: number;
}) {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <View
      style={{
        height,
        backgroundColor: colors.border,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: `${clamped * 100}%`,
          height: "100%",
          backgroundColor: tone ?? colors.accent,
        }}
      />
    </View>
  );
}

export function Banner({
  title,
  message,
  tone = "info",
  action,
  onAction,
}: {
  title: string;
  message?: string;
  tone?: "info" | "danger" | "accent";
  action?: string;
  onAction?: () => unknown;
}) {
  const { colors } = useTheme();
  const tint = tone === "danger" ? colors.danger : colors.accent;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.md,
        backgroundColor:
          tone === "danger" ? colors.dangerSoft : colors.accentSoft,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: tone === "danger" ? colors.danger : colors.border,
        padding: spacing.md,
      }}
    >
      <View style={{ paddingTop: 3 }}>
        <Icon
          name={tone === "danger" ? "close" : "check"}
          size={13}
          color={tint}
        />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[type.micro, { color: tint, textTransform: "uppercase" }]}>
          {title}
        </Text>
        {!!message && (
          <Text style={[type.meta, { color: colors.muted }]}>{message}</Text>
        )}
        {!!action && !!onAction && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={action}
            hitSlop={8}
            onPress={onAction}
            style={{ paddingTop: 6 }}
          >
            <Text
              style={[
                type.micro,
                { color: tint, textTransform: "uppercase" },
              ]}
            >
              {action}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function EmptyState({
  icon = "note",
  title,
  message,
  action,
  onAction,
}: {
  icon?: IconName;
  title: string;
  message?: string;
  action?: string;
  onAction?: () => unknown;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        alignItems: "center",
        gap: spacing.sm,
        paddingVertical: 56,
        paddingHorizontal: spacing.lg,
      }}
    >
      <Icon name={icon} size={20} color={colors.faint} />
      <Text
        style={[
          type.body,
          {
            color: colors.text,
            textAlign: "center",
            fontFamily: font.uiMedium,
          },
        ]}
      >
        {title}
      </Text>
      {!!message && (
        <Text
          style={[
            type.meta,
            { color: colors.muted, textAlign: "center", maxWidth: 300 },
          ]}
        >
          {message}
        </Text>
      )}
      {!!action && !!onAction && (
        <View style={{ marginTop: spacing.sm }}>
          <Chip title={action} onPress={onAction} />
        </View>
      )}
    </View>
  );
}

export function BackButton({ onPress }: { onPress?: () => unknown }) {
  return (
    <IconButton
      name="chevronLeft"
      label="Back"
      iconSize={22}
      onPress={onPress ?? (() => router.back())}
    />
  );
}

/** Hairline separator, the only divider in the system. */
export function Rule({ style }: { style?: object }) {
  const { colors } = useTheme();
  return (
    <View style={[{ height: 1, backgroundColor: colors.border }, style]} />
  );
}

/** Mono readout: elapsed / remaining / counters. */
export function Readout({
  children,
  color,
  size = "readout",
}: {
  children: React.ReactNode;
  color?: string;
  size?: "numeric" | "readout" | "micro";
}) {
  const { colors } = useTheme();
  return (
    <Text
      style={[
        type[size],
        {
          fontFamily: size === "micro" ? font.monoMedium : font.mono,
          color: color ?? colors.text,
        },
      ]}
    >
      {children}
    </Text>
  );
}
