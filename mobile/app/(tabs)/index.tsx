import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Page, useTheme } from "../../src/ui";
import { useSongs } from "../../src/data";
import { useLater } from "../../src/use-later";
import { Art } from "../../src/components";
import { Icon, IconName } from "../../src/icon";
import { Banner, IconButton, SectionTitle } from "../../src/kit";
import { font, radius, spacing, type } from "../../src/theme";
import { usePlayback } from "../../src/playback";
import { useSession } from "../../src/session";
import { watchDownloads } from "../../src/offline";

function shortCollection(id: string, name: string) {
  router.push({
    pathname: "/collection",
    params: { kind: "playlist", id, name },
  });
}

function Row({
  title,
  subtitle,
  icon,
  onPress,
  trailing,
  label,
  accent = false,
}: {
  title: string;
  label?: string;
  subtitle?: string;
  icon?: IconName;
  onPress: () => unknown;
  trailing?: React.ReactNode;
  accent?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        minHeight: 56,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderColor: colors.border,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {icon && (
        <View style={{ width: 22, alignItems: "center" }}>
          <Icon
            name={icon}
            size={16}
            color={accent ? colors.accent : colors.muted}
          />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Text
          numberOfLines={1}
          style={[
            type.meta,
            {
              color: accent ? colors.accent : colors.text,
              fontFamily: font.uiMedium,
            },
          ]}
        >
          {title}
        </Text>
        {!!subtitle && (
          <Text numberOfLines={2} style={[type.meta, { color: colors.faint }]}>
            {subtitle}
          </Text>
        )}
      </View>
      {trailing}
      <Icon name="chevronRight" size={16} color={colors.faint} />
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
  const [tick, setTick] = useState(0);
  useEffect(() => watchDownloads(() => setTick((v) => v + 1)), []);
  const onPhone = useMemo(
    () =>
      session
        ? session.offline.list().filter((d) => d.state === "complete").length
        : 0,
    [session, tick],
  );
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
              width: 30,
              height: 30,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              borderRadius: radius.sm,
              backgroundColor: colors.surfaceInset,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="note" size={15} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                ...type.body,
                fontFamily: font.uiBold,
                color: colors.text,
                letterSpacing: 4,
              }}
            >
              ZIKKY
            </Text>
            <Text style={[type.micro, { color: colors.faint }]}>
              PERSONAL MUSIC PLAYER
            </Text>
          </View>
          <IconButton
            name="settings"
            label="Settings & connection"
            onPress={() => router.push("/settings")}
            size={38}
            iconSize={17}
          />
        </View>
      }
    >
      {!!now ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open now playing"
          onPress={() => router.push("/player")}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.lg,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Art song={now} size={84} radius={2} />
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <View
                style={{
                  width: 5,
                  height: 5,
                  backgroundColor: player.status.playing
                    ? colors.accent
                    : colors.faint,
                }}
              />
              <Text style={[type.micro, { color: colors.accent }]}>
                {player.status.playing ? "NOW PLAYING" : "PAUSED"}
              </Text>
            </View>
            <Text
              numberOfLines={2}
              style={[type.heading, { color: colors.text }]}
            >
              {now.title}
            </Text>
            <Text numberOfLines={1} style={[type.meta, { color: colors.muted }]}>
              {now.artist}
            </Text>
          </View>
          <Icon name="chevronRight" size={18} color={colors.faint} />
        </Pressable>
      ) : (
        <View style={{ gap: spacing.xs }}>
          <Text style={[type.micro, { color: colors.faint }]}>
            STANDBY · PICK A TRACK
          </Text>
          <Text style={[type.heading, { color: colors.text }]}>
            Your library, in one quiet place.
          </Text>
        </View>
      )}

      <View>
        <SectionTitle title="Jump back in" />
        <Row
          title="Recently added"
          subtitle="FRESH ON YOUR SERVER"
          icon="sparkle"
          accent
          onPress={() => shortCollection("bridge_recent", "Recently added")}
        />
        <Row
          title="Recently played"
          icon="clock"
          onPress={() => shortCollection("bridge_played", "Recently played")}
        />
        <Row
          title="Favorites"
          icon="heart"
          onPress={() => shortCollection("bridge_favorites", "Favorites")}
        />
        <Row
          title="Listen later"
          label={`Listen later · ${later.length}`}
          icon="clock"
          subtitle={
            later.length === 0
              ? "Saved tracks will wait here"
              : `${later.length} ${later.length === 1 ? "track" : "tracks"} saved for later`
          }
          trailing={
            <Text style={[type.numeric, { color: colors.text }]}>
              {later.length}
            </Text>
          }
          onPress={() => router.push("/later")}
        />
      </View>

      <View>
        <SectionTitle
          title="Discover"
          action="Open"
          onAction={() => shortCollection("bridge_discover", "Discovery")}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Discover something new"
          onPress={() => shortCollection("bridge_discover", "Discovery")}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            paddingVertical: spacing.md,
            borderBottomWidth: 1,
            borderColor: colors.border,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Icon name="sparkle" size={16} color={colors.accent} />
          <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
            <Text
              style={[
                type.meta,
                { color: colors.text, fontFamily: font.uiMedium },
              ]}
            >
              New corners of your library
            </Text>
            <Text style={[type.meta, { color: colors.faint }]}>
              Suggestions stay on the server. Nothing plays until you choose it.
            </Text>
          </View>
          <Icon name="chevronRight" size={16} color={colors.faint} />
        </Pressable>
      </View>

      <View>
        <SectionTitle title="Library status" />
        <View
          style={{
            flexDirection: "row",
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.sm,
            backgroundColor: colors.surfaceInset,
            paddingVertical: spacing.lg,
            paddingHorizontal: spacing.lg,
          }}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[type.count, { color: colors.text }]}>
              {songs.isPending ? "—" : (songs.data?.length ?? 0)}
            </Text>
            <Text style={[type.micro, { color: colors.faint }]}>
              TRACKS ON SERVER
            </Text>
          </View>
          <View
            style={{ width: 1, backgroundColor: colors.border, marginRight: 18 }}
          />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[type.count, { color: colors.text }]}>{onPhone}</Text>
            <Text style={[type.micro, { color: colors.faint }]}>
              ON THIS PHONE
            </Text>
          </View>
        </View>
      </View>

      <View>
        <SectionTitle title="Storage" />
        <Row
          title="Downloads on this phone"
          subtitle="Offline copies stored on this device"
          icon="phone"
          onPress={() => router.push("/downloads")}
        />
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
      <Text
        style={[
          type.micro,
          { color: colors.faint, textAlign: "center", paddingTop: spacing.sm },
        ]}
      >
        {session ? session.api.activeServer.replace(/^https?:\/\//, "") : ""}
      </Text>
    </Page>
  );
}
