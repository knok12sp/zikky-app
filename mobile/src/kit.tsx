import React from "react";
import { Pressable, Text, View, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useTheme, Label, report } from "./ui";
import { Icon, IconName } from "./icon";
import { radius, spacing, type } from "./theme";

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
          borderRadius: radius.lg,
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
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.md,
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
          hitSlop={8}
          onPress={() => {
            try {
              void Promise.resolve(onAction()).catch(report);
            } catch (e) {
              report(e);
            }
          }}
        >
          <Text
            style={{ ...type.meta, color: colors.accent, fontWeight: "700" }}
          >
            {action}
          </Text>
        </Pressable>
      )}
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
}) {
  const { colors } = useTheme();
  const color = active
    ? colors.accent
    : variant === "filled"
      ? colors.onAccent
      : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active, busy }}
      disabled={disabled}
      hitSlop={6}
      onPress={() => {
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
        borderRadius: size / 2,
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
        borderColor: colors.border,
        opacity: disabled ? 0.35 : pressed ? 0.6 : 1,
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
        borderRadius: size / 2,
        backgroundColor: colors.accent,
        alignItems: "center",
        justifyContent: "center",
        transform: [{ scale: pressed ? 0.95 : 1 }],
        opacity: busy ? 0.7 : 1,
        shadowColor: colors.accent,
        shadowOpacity: 0.28,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
      })}
    >
      {busy ? (
        <ActivityIndicator color={colors.onAccent} />
      ) : (
        <Icon
          name={playing ? "pause" : "play"}
          size={Math.round(size * 0.42)}
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
        paddingHorizontal: 14,
        justifyContent: "center",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderRadius: radius.pill,
        backgroundColor: active ? colors.accentSoft : colors.surface,
        borderWidth: 1,
        borderColor: active ? colors.accent : colors.border,
        opacity: pressed ? 0.65 : 1,
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
        style={{
          ...type.meta,
          color: active ? colors.accent : colors.muted,
          fontWeight: active ? "700" : "600",
        }}
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
        padding: 4,
        borderRadius: radius.pill,
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
              minHeight: 40,
              borderRadius: radius.pill,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: active ? colors.surfaceRaised : "transparent",
            }}
          >
            <Text
              style={{
                ...type.meta,
                color: active ? colors.text : colors.muted,
                fontWeight: active ? "700" : "500",
              }}
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
  height = 4,
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
        borderRadius: height,
        backgroundColor: colors.border,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: `${clamped * 100}%`,
          height: "100%",
          borderRadius: height,
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
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: tone === "danger" ? colors.danger : colors.border,
        padding: spacing.md,
      }}
    >
      <View style={{ paddingTop: 2 }}>
        <Icon
          name={tone === "danger" ? "close" : "check"}
          size={14}
          color={tint}
        />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ ...type.meta, color: tint, fontWeight: "700" }}>
          {title}
        </Text>
        {!!message && (
          <Text style={{ ...type.meta, color: colors.muted }}>{message}</Text>
        )}
        {!!action && !!onAction && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={action}
            hitSlop={8}
            onPress={onAction}
            style={{ paddingTop: 6 }}
          >
            <Text style={{ ...type.meta, color: tint, fontWeight: "700" }}>
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
      style={{ alignItems: "center", gap: spacing.sm, paddingVertical: 40 }}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: colors.surfaceInset,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 4,
        }}
      >
        <Icon name={icon} size={22} color={colors.faint} />
      </View>
      <Label variant="heading" style={{ textAlign: "center" }}>
        {title}
      </Label>
      {!!message && (
        <Label
          muted
          variant="meta"
          style={{ textAlign: "center", maxWidth: 300 }}
        >
          {message}
        </Label>
      )}
      {!!action && !!onAction && (
        <View style={{ marginTop: spacing.sm }}>
          <Chip title={action} onPress={onAction} />
        </View>
      )}
    </View>
  );
}

export function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 2 }}>
      <Text
        style={[
          type.numeric,
          {
            color: tone ?? colors.text,
            fontSize: 17,
            lineHeight: 22,
            letterSpacing: 0.2,
          },
        ]}
      >
        {value}
      </Text>
      <Text
        style={[
          type.micro,
          { color: colors.faint, textTransform: "uppercase" },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

export function BackButton({ onPress }: { onPress?: () => unknown }) {
  return (
    <IconButton
      name="chevronLeft"
      label="Back"
      iconSize={30}
      onPress={onPress ?? (() => router.back())}
    />
  );
}
