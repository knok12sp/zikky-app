import { Tabs, BottomTabBar } from "expo-router/js-tabs";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../src/ui";
import { MiniPlayer } from "../../src/components";
import { Icon, IconName } from "../../src/icon";
export default function Layout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      tabBar={(props) => (
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderColor: colors.border,
          }}
        >
          <MiniPlayer bottomInset={false} />
          <BottomTabBar {...props} />
        </View>
      )}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.faint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          elevation: 0,
          height: 60 + insets.bottom,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
          letterSpacing: 0.5,
        },
      }}
    >
      {["index", "library", "search"].map((name, i) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: ["Home", "Library", "Search"][i],
            tabBarIcon: ({ color, focused }) => (
              <View
                style={{
                  width: 46,
                  height: 28,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: focused ? colors.accentSoft : "transparent",
                }}
              >
                <Icon
                  name={
                    (["home", "library", "search"] as IconName[])[i] ?? "note"
                  }
                  size={21}
                  color={typeof color === "string" ? color : colors.muted}
                />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
