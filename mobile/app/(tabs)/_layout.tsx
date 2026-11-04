import { Tabs, BottomTabBar } from "expo-router/js-tabs";
import { View } from "react-native";
import { useTheme } from "../../src/ui";
import { MiniPlayer } from "../../src/components";
import { Icon, IconName } from "../../src/icon";
export default function Layout() {
  const { colors } = useTheme();
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
          height: 56,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
          letterSpacing: 0.7,
        },
        tabBarItemStyle: { paddingVertical: 2 },
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
                  width: 42,
                  height: 26,
                  borderRadius: 13,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: focused ? colors.accentSoft : "transparent",
                }}
              >
                <Icon
                  name={
                    (["home", "library", "search"] as IconName[])[i] ?? "note"
                  }
                  size={18}
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
