import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Page, useTheme } from "../../src/ui";
import { useSongs } from "../../src/data";
import { useLater } from "../../src/use-later";
import { Icon, IconName } from "../../src/icon";
import { Card, SectionTitle, IconButton, Banner } from "../../src/kit";
import { radius, spacing, type } from "../../src/theme";
import { usePlayback } from "../../src/playback";
import { useSession } from "../../src/session";

function shortCollection(id: string, name: string) {
  router.push({
    pathname: "/collection",
    params: { kind: "playlist", id, name },
  });
}

function Tile({
  title,
  subtitle,
  icon,
  onPress,
  wide = false,
  accent = false,
}: {
  title: string;
  subtitle?: string;
  icon: IconName;
  onPress: () => unknown;
  wide?: boolean;
  accent?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({
        flexGrow: 1,
        flexBasis: wide ? "100%" : "46%",
        minHeight: wide ? 96 : 104,
        padding: spacing.lg,
        borderRadius: radius.lg,
        backgroundColor: accent ? colors.accentSoft : colors.surface,
        borderWidth: 1,
        borderColor: accent ? colors.accent : colors.border,
        justifyContent: "space-between",
        gap: spacing.md,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          backgroundColor: accent ? colors.accent : colors.surfaceInset,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon
          name={icon}
          size={17}
          color={accent ? colors.onAccent : colors.accent}
        />
      </View>
      <View style={{ gap: 2 }}>
        <Text
          style={[
            type.body,
            { color: accent ? colors.accent : colors.text, fontWeight: "700" },
          ]}
        >
          {title}
        </Text>
        {!!subtitle && (
          <Text style={[type.micro, { color: colors.muted }]}>{subtitle}</Text>
        )}
      </View>
    </Pressable>
  );
}

export default function Home() {
  const songs = useSongs();
  const later = useLater();
  const player = usePlayback();
  const { colors } = useTheme();
  const { session } = useSession();
  const now = player.queue.entries[player.queue.index]?.song;
  const onPhone = session
    ? session.offline.list().filter((d) => d.state === "complete").length
    : 0;
  return (
    <Page
      title=""
      bottomSpace={28}
      header={
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            paddingTop: spacing.sm,
          }}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              backgroundColor: colors.accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="note" size={20} color={colors.onAccent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                ...type.title,
                color: colors.text,
                letterSpacing: 1.5,
                textTransform: "uppercase",
              }}
            >
              Zikky
            </Text>
            <Text
              style={[
                type.micro,
                { color: colors.faint, textTransform: "uppercase" },
              ]}
            >
              Personal music player
            </Text>
          </View>
          <IconButton
            name="settings"
            label="Settings & connection"
            onPress={() => router.push("/settings")}
            variant="outline"
            size={42}
          />
        </View>
      }
    >
      {!!now && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open now playing"
          onPress={() => router.push("/player")}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            padding: spacing.md,
            borderRadius: radius.lg,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: colors.accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon
              name={player.status.playing ? "pause" : "play"}
              size={18}
              color={colors.onAccent}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={1}
              style={[
                type.micro,
                { color: colors.accent, textTransform: "uppercase" },
              ]}
            >
              {player.status.playing ? "Now playing" : "Paused"}
            </Text>
            <Text
              numberOfLines={1}
              style={[type.body, { color: colors.text, fontWeight: "600" }]}
            >
              {now.title}
            </Text>
            <Text
              numberOfLines={1}
              style={[type.meta, { color: colors.muted }]}
            >
              {now.artist}
            </Text>
          </View>
          <Icon name="chevronRight" size={22} color={colors.faint} />
        </Pressable>
      )}

      <View style={{ gap: spacing.md }}>
        <SectionTitle title="Jump back in" />
        <Tile
          title="Recently added"
          subtitle="FRESH ON YOUR SERVER"
          icon="sparkle"
          onPress={() => shortCollection("smart_recent", "Recently added")}
          wide
          accent
        />
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <Tile
            title="Recently played"
            icon="clock"
            onPress={() => shortCollection("smart_played", "Recently played")}
          />
          <Tile
            title="Favorites"
            icon="heart"
            onPress={() => shortCollection("smart_favorites", "Favorites")}
          />
        </View>
      </View>

      <Card inset padding={spacing.md}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Listen later · ${later.length}`}
          onPress={() => router.push("/later")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
          }}
        >
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="clock" size={19} color={colors.accent} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              style={[type.body, { color: colors.text, fontWeight: "600" }]}
            >
              Listen later
            </Text>
            <Text style={[type.meta, { color: colors.muted }]}>
              {later.length === 0
                ? "Saved tracks will wait here"
                : `${later.length} ${later.length === 1 ? "track" : "tracks"} saved for later`}
            </Text>
          </View>
          <Text style={[type.numeric, { color: colors.text, fontSize: 16 }]}>
            {later.length}
          </Text>
          <Icon name="chevronRight" size={20} color={colors.faint} />
        </Pressable>
      </Card>

      <View style={{ gap: spacing.md }}>
        <SectionTitle
          title="Discover"
          action="Open"
          onAction={() => shortCollection("smart_discover", "Discovery")}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Discover something new"
          onPress={() => shortCollection("smart_discover", "Discovery")}
          style={{ borderRadius: radius.lg }}
        >
          <Card>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
              }}
            >
              <Icon name="sparkle" size={22} color={colors.accent} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text
                  style={[type.body, { color: colors.text, fontWeight: "700" }]}
                >
                  New corners of your library
                </Text>
                <Text style={[type.meta, { color: colors.muted }]}>
                  A random selection from your library. Nothing plays until you
                  choose it.
                </Text>
              </View>
              <Icon name="chevronRight" size={20} color={colors.faint} />
            </View>
          </Card>
        </Pressable>
      </View>

      <View style={{ gap: spacing.sm }}>
        <SectionTitle title="Library status" />
        <Card inset padding={spacing.lg}>
          <View style={{ flexDirection: "row", gap: spacing.xl }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={[type.numeric, { color: colors.text, fontSize: 20 }]}
              >
                {songs.isPending ? "—" : (songs.data?.length ?? 0)}
              </Text>
              <Text
                style={[
                  type.micro,
                  { color: colors.faint, textTransform: "uppercase" },
                ]}
              >
                Tracks on server
              </Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={[type.numeric, { color: colors.text, fontSize: 20 }]}
              >
                {onPhone}
              </Text>
              <Text
                style={[
                  type.micro,
                  { color: colors.faint, textTransform: "uppercase" },
                ]}
              >
                On this phone
              </Text>
            </View>
          </View>
        </Card>
      </View>

      <View style={{ gap: spacing.sm }}>
        <SectionTitle title="Storage" />
        <Card padding={spacing.xs} style={{ paddingHorizontal: spacing.md }}>
          {[
            {
              title: "Downloads on this phone",
              detail: "Offline copies stored on this device",
              icon: "phone" as IconName,
              go: "/downloads" as const,
            },
          ].map((item, i) => (
            <Pressable
              key={item.go}
              accessibilityRole="button"
              accessibilityLabel={item.title}
              onPress={() => router.push(item.go)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                paddingVertical: 13,
                borderTopWidth: i === 0 ? 0 : 1,
                borderColor: colors.border,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Icon name={item.icon} size={18} color={colors.muted} />
              <View style={{ flex: 1 }}>
                <Text
                  style={[type.body, { color: colors.text, fontWeight: "600" }]}
                >
                  {item.title}
                </Text>
                <Text style={[type.meta, { color: colors.faint }]}>
                  {item.detail}
                </Text>
              </View>
              <Icon name="chevronRight" size={20} color={colors.faint} />
            </Pressable>
          ))}
        </Card>
      </View>

      {songs.isPending && (
        <Text style={[type.meta, { color: colors.muted }]}>
          Reading your library…
        </Text>
      )}
      {songs.isError && (
        <Banner
          tone="danger"
          title="Server unavailable"
          message="Cached metadata and completed phone downloads remain available."
        />
      )}
      <Text style={[type.meta, { color: colors.faint, textAlign: "center" }]}>
        {session ? session.api.activeServer.replace(/^https?:\/\//, "") : ""}
      </Text>
    </Page>
  );
}
