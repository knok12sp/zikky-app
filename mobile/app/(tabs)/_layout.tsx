import { Tabs, BottomTabBar } from "expo-router/js-tabs";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../src/ui";
import { MiniPlayer } from "../../src/components";
import { Icon, IconName } from "../../src/icon";
import { type } from "../../src/theme";
export default function Layout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      tabBar={(props) => (
        <View
          style={{
            backgroundColor: colors.panel,
            borderTopWidth: 1,
            borderColor: colors.borderStrong,
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
          backgroundColor: colors.panel,
          borderTopWidth: 0,
          elevation: 0,
          height: 58 + insets.bottom,
          paddingTop: 5,
          paddingBottom: 6,
        },
        tabBarLabelStyle: {
          fontFamily: type.micro.fontFamily,
          fontSize: 9,
          letterSpacing: 1.2,
          textTransform: "uppercase",
        },
        tabBarItemStyle: { paddingVertical: 0 },
      }}
    >
      {["index", "library", "search", "books"].map((name, i) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: ["Home", "Library", "Search", "Books"][i],
            tabBarIcon: ({ color, focused }) => (
              <View style={{ alignItems: "center", gap: 5, height: 21 }}>
                <View
                  style={{
                    width: 18,
                    height: 2,
                    backgroundColor: focused ? colors.accent : "transparent",
                  }}
                />
                <Icon
                  name={
                    (["home", "library", "search", "note"] as IconName[])[i] ??
                    "note"
                  }
                  size={19}
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
