import React, { createContext, useContext, useState } from "react";
import {
  Pressable,
  Text,
  View,
  TextInput,
  StyleSheet,
  useColorScheme,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { read, write } from "./db";
import { dark, light, spacing, radius, type, mono, Palette } from "./theme";
import { Icon, IconName } from "./icon";

type ThemeValue = {
  colors: Palette;
  mode: string;
  setMode: (value: string) => void;
  spacing: typeof spacing;
  radius: typeof radius;
  type: typeof type;
};
const Theme = createContext<ThemeValue>({
  colors: dark,
  mode: "system",
  setMode: (_value: string) => {},
  spacing,
  radius,
  type,
});
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, set] = useState(() => read("device", "appearance", "system"));
  const setMode = (value: string) => {
    set(value);
    write("device", "appearance", value);
  };
  const colors = (mode === "system" ? system : mode) === "light" ? light : dark;
  return (
    <Theme.Provider value={{ colors, mode, setMode, spacing, radius, type }}>
      <StatusBar style={colors === light ? "dark" : "light"} />
      {children}
    </Theme.Provider>
  );
}
export const useTheme = () => useContext(Theme);

/** The current palette plus the token groups, for screens that want both. */
export const useTokens = () => {
  const t = useTheme();
  return { ...t, mono };
};

export function Label({
  children,
  muted = false,
  large = false,
  alert = false,
  variant,
  numberOfLines,
  style,
}: {
  children: React.ReactNode;
  muted?: boolean;
  large?: boolean;
  alert?: boolean;
  variant?: "display" | "title" | "heading" | "body" | "meta" | "micro";
  numberOfLines?: number;
  style?: object;
}) {
  const { colors } = useTheme();
  const v = variant ?? (large ? "display" : "body");
  const scale = type[v];
  const upper = v === "micro";
  return (
    <Text
      accessibilityRole={
        v === "display" || v === "title" ? "header" : undefined
      }
      accessibilityLiveRegion={alert ? "polite" : undefined}
      numberOfLines={numberOfLines}
      style={[
        scale,
        {
          color: alert ? colors.danger : muted ? colors.muted : colors.text,
          textTransform: upper ? "uppercase" : undefined,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Action({
  title,
  onPress,
  disabled = false,
  danger = false,
  label,
  selected,
  variant = "secondary",
  icon,
  style,
}: {
  title: string;
  onPress: () => unknown;
  disabled?: boolean;
  danger?: boolean;
  label?: string;
  selected?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "row";
  icon?: IconName;
  style?: object;
}) {
  const { colors } = useTheme();
  const filled = variant === "primary";
  const row = variant === "row";
  const dangerVariant = danger || variant === "danger";
  const textColor = filled
    ? colors.onAccent
    : dangerVariant
      ? colors.danger
      : variant === "ghost"
        ? colors.accent
        : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      accessibilityState={{ disabled, selected }}
      onPress={() => {
        try {
          void Promise.resolve(onPress()).catch(report);
        } catch (e) {
          report(e);
        }
      }}
      disabled={disabled}
      style={({ pressed }) => [
        {
          minHeight: 48,
          paddingHorizontal: row ? 16 : variant === "ghost" ? 10 : 16,
          paddingVertical: 11,
          borderRadius: row ? 0 : variant === "ghost" ? radius.md : radius.pill,
          backgroundColor: row
            ? "transparent"
            : filled
              ? colors.accent
              : selected
                ? colors.accentSoft
                : dangerVariant
                  ? colors.dangerSoft
                  : variant === "ghost"
                    ? "transparent"
                    : colors.surfaceRaised,
          opacity: disabled ? 0.38 : pressed ? 0.68 : 1,
          borderColor: row
            ? "transparent"
            : selected
              ? colors.accent
              : dangerVariant
                ? colors.danger
                : filled
                  ? colors.accent
                  : colors.border,
          borderWidth: row || filled || variant === "ghost" ? 0 : 1,
          justifyContent: row ? "flex-start" : "center",
          alignItems: "center",
          flexDirection: "row",
          gap: 8,
        },
        style,
      ]}
    >
      {icon && <Icon name={icon} size={17} color={textColor} />}
      <Text
        style={{
          color: textColor,
          fontSize: 15,
          fontWeight: filled || selected ? "700" : "600",
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChange,
  secret = false,
  multiline = false,
  placeholder,
  maxLength,
  onSubmit,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  secret?: boolean;
  multiline?: boolean;
  placeholder?: string;
  maxLength?: number;
  onSubmit?: () => void;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 7 }}>
      <Label muted variant="micro">
        {label}
      </Label>
      <TextInput
        accessibilityLabel={label}
        secureTextEntry={secret}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        selectionColor={colors.accent}
        maxLength={maxLength}
        onSubmitEditing={onSubmit}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        autoCorrect={false}
        style={{
          color: colors.text,
          fontSize: 16,
          paddingHorizontal: 14,
          paddingVertical: 13,
          minHeight: multiline ? 112 : 50,
          textAlignVertical: multiline ? "top" : "center",
          borderWidth: 1,
          borderColor: focused ? colors.accent : colors.border,
          borderRadius: radius.md,
          backgroundColor: colors.surfaceInset,
        }}
      />
    </View>
  );
}

export function Page({
  title,
  subtitle,
  children,
  scroll = true,
  bottomSpace = 32,
  header,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  scroll?: boolean;
  bottomSpace?: number;
  header?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const contents = (
    <View
      style={{
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.md,
        gap: spacing.lg,
        flex: scroll ? undefined : 1,
      }}
    >
      {header}
      {!!title && (
        <View style={{ gap: 4, paddingTop: header ? spacing.sm : spacing.md }}>
          <Label variant="display">{title}</Label>
          {subtitle && (
            <Label muted variant="meta">
              {subtitle}
            </Label>
          )}
        </View>
      )}
      {children}
    </View>
  );
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{ paddingBottom: bottomSpace }}
          >
            {contents}
          </ScrollView>
        ) : (
          contents
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Row({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
        alignItems: "center",
      }}
    >
      {children}
    </View>
  );
}

export function Busy({ label = "Loading" }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <ActivityIndicator
      color={colors.accent}
      accessibilityLabel={label}
      style={{ paddingVertical: 12 }}
    />
  );
}

export function report(error: unknown) {
  Alert.alert(
    "Could not finish",
    error instanceof Error ? error.message : "Please try again.",
  );
}

export function confirm(title: string, message: string, fn: () => void) {
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: "Confirm", style: "destructive", onPress: fn },
  ]);
}

export const styles = StyleSheet.create({
  card: { paddingVertical: 14, gap: 10, borderBottomWidth: 1 },
  art: { width: 52, height: 52, borderRadius: 10 },
});
