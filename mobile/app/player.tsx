import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Slider from "@react-native-community/slider";
import { LinearGradient } from "expo-linear-gradient";
import { usePlayback } from "../src/playback";
import { Art } from "../src/components";
import { useTheme, report } from "../src/ui";
import { useSession, queryClient } from "../src/session";
import { watchDownloads } from "../src/offline";
import { Icon, IconName } from "../src/icon";
import {
  IconButton,
  PlayButton,
  Chip,
  SectionTitle,
  EmptyState,
} from "../src/kit";
import { light, radius, spacing, type } from "../src/theme";

const clock = (s: number) =>
  `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, "0")}`;

function MenuRow({
  title,
  subtitle,
  icon,
  onPress,
  disabled,
  danger,
}: {
  title: string;
  subtitle?: string;
  icon: IconName;
  onPress: () => unknown;
  disabled?: boolean;
  danger?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        try {
          void Promise.resolve(onPress()).catch(report);
        } catch (e) {
          report(e);
        }
      }}
      style={({ pressed }) => ({
        minHeight: 54,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.xs,
        opacity: disabled ? 0.4 : pressed ? 0.55 : 1,
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          backgroundColor: colors.surfaceInset,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon
          name={icon}
          size={17}
          color={danger ? colors.danger : colors.muted}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            type.body,
            { color: danger ? colors.danger : colors.text, fontWeight: "600" },
          ]}
        >
          {title}
        </Text>
        {!!subtitle && (
          <Text style={[type.meta, { color: colors.faint }]}>{subtitle}</Text>
        )}
      </View>
    </Pressable>
  );
}

export default function Player() {
  const p = usePlayback();
  const { colors } = useTheme();
  const { session } = useSession();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [menu, setMenu] = useState(false);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [, tick] = useState(0);
  useEffect(() => watchDownloads(() => tick((x) => x + 1)), []);

  const song = p.queue.entries[p.queue.index]?.song;
  const upcoming = p.queue.entries.slice(p.queue.index + 1, p.queue.index + 3);
  const download = song
    ? session?.offline.list().find((item) => item.id === song.id)
    : undefined;
  const onPhone = song ? !!session?.offline.local(song.id) : false;
  const saving = !!download && !onPhone && download.state !== "failed";
  const downloadFailed = download?.state === "failed";
  const starred = song
    ? (favorites[song.id] ?? !!song.starred)
    : false;
  const isLight = colors.bg === light.bg;
  const compact = height < 730;
  const duration = Math.max(
    0,
    p.status.duration || song?.duration || 0,
  );
  const current = Math.min(Math.max(0, p.status.currentTime), duration);

  async function favorite() {
    if (!song) return;
    const next = !starred;
    try {
      await session!.api.rest(next ? "star" : "unstar", { id: song.id });
      setFavorites((value) => ({ ...value, [song.id]: next }));
      await queryClient.invalidateQueries({ queryKey: [session!.scope] });
    } catch (e) {
      report(e);
    }
  }

  function saveToPhone() {
    if (!song || onPhone) return;
    session!.offline.enqueue([song]);
    setMenu(false);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {song && (
        <View style={{ ...StyleSheetAbsolute, overflow: "hidden" }}>
          <Art song={song} fill artworkSize={1200} />
        </View>
      )}
      <LinearGradient
        pointerEvents="none"
        colors={
          isLight
            ? ["rgba(242,245,238,0.62)", "rgba(242,245,238,0)"]
            : ["rgba(10,14,11,0.72)", "rgba(10,14,11,0)"]
        }
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 190,
        }}
      />
      <LinearGradient
        pointerEvents="none"
        colors={
          isLight
            ? [
                "rgba(242,245,238,0)",
                "rgba(242,245,238,0.42)",
                "rgba(242,245,238,0.86)",
                "rgba(242,245,238,0.99)",
                "#F2F5EE",
              ]
            : [
                "rgba(10,14,11,0)",
                "rgba(10,14,11,0.34)",
                "rgba(10,14,11,0.78)",
                "rgba(10,14,11,0.97)",
                "#0A0E0B",
              ]
        }
        locations={[0, 0.3, 0.58, 0.8, 1]}
        style={StyleSheetAbsolute}
      />

      <SafeAreaView
        edges={["top", "bottom", "left", "right"]}
        style={{ flex: 1 }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 760,
            alignSelf: "center",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: spacing.md,
            paddingTop: spacing.xs,
          }}
        >
          <IconButton
            name="chevronDown"
            label="Close player"
            onPress={() => router.back()}
            size={44}
            iconSize={24}
          />
          <Text
            style={[
              type.micro,
              {
                color: isLight ? colors.muted : "rgba(237,242,233,0.72)",
                textTransform: "uppercase",
                letterSpacing: 2.2,
              },
            ]}
          >
            Now playing
          </Text>
          <IconButton
            name="more"
            label="More player options"
            onPress={() => setMenu(true)}
            disabled={!song}
            size={44}
            iconSize={22}
            color={isLight ? colors.text : "#EDF2E9"}
          />
        </View>

        {song ? (
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: "flex-end",
              paddingHorizontal: spacing.xxl,
              paddingBottom: Math.max(insets.bottom, spacing.lg),
            }}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={{
                width: "100%",
                maxWidth: 600,
                alignSelf: "center",
                gap: compact ? 13 : 18,
                paddingTop: compact ? 20 : 44,
              }}
            >
              {!!(p.busy || p.error) && (
                <View
                  style={{
                    backgroundColor: p.error
                      ? colors.dangerSoft
                      : colors.accentSoft,
                    borderRadius: radius.md,
                    padding: spacing.sm,
                  }}
                >
                  <Text
                    style={[
                      type.meta,
                      {
                        color: p.error ? colors.danger : colors.accent,
                        textAlign: "center",
                      },
                    ]}
                  >
                    {p.busy || p.error}
                  </Text>
                </View>
              )}

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: spacing.md,
                }}
              >
                <View style={{ flex: 1, gap: 3 }}>
                  <Text
                    numberOfLines={2}
                    style={[
                      type.title,
                      {
                        color: colors.text,
                        fontSize: compact ? 25 : 30,
                        lineHeight: compact ? 30 : 35,
                        letterSpacing: -0.8,
                      },
                    ]}
                  >
                    {song.title}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      type.body,
                      {
                        color: colors.text,
                        fontWeight: "600",
                        fontSize: compact ? 15 : 16,
                      },
                    ]}
                  >
                    {song.artist}
                  </Text>
                  {!!song.album && (
                    <Text
                      numberOfLines={1}
                      style={[type.meta, { color: colors.muted }]}
                    >
                      {song.album}
                    </Text>
                  )}
                </View>
                <IconButton
                  name={starred ? "heartFilled" : "heart"}
                  label={starred ? "Remove favorite" : "Add favorite"}
                  active={starred}
                  onPress={favorite}
                  size={46}
                  iconSize={22}
                  variant={starred ? "plain" : "outline"}
                />
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 7,
                }}
              >
                <Icon
                  name={onPhone ? "downloaded" : saving ? "download" : "server"}
                  size={12}
                  color={onPhone ? colors.accent : colors.faint}
                />
                <Text
                  style={[
                    type.micro,
                    {
                      color: onPhone ? colors.accent : colors.faint,
                      textTransform: "uppercase",
                    },
                  ]}
                >
                  {onPhone
                    ? "Offline on this phone"
                    : saving
                      ? "Saving to this phone"
                      : downloadFailed
                        ? "Phone download failed"
                        : "Streaming from your server"}
                </Text>
              </View>

              <View style={{ gap: 2 }}>
                <Slider
                  accessibilityLabel="Playback position"
                  accessibilityValue={{
                    min: 0,
                    max: Math.round(duration),
                    now: Math.round(current),
                  }}
                  minimumValue={0}
                  maximumValue={Math.max(1, duration)}
                  value={current}
                  minimumTrackTintColor={colors.accent}
                  maximumTrackTintColor={isLight ? colors.borderStrong : "#465248"}
                  thumbTintColor={colors.accent}
                  disabled={!p.status.isLoaded || duration <= 0}
                  onSlidingComplete={(value) => void p.seek(value)}
                  style={{ width: "100%", height: 34 }}
                />
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={[type.numeric, { color: colors.text }]}>
                    {clock(current)}
                  </Text>
                  <Text style={[type.numeric, { color: colors.muted }]}>
                    −{clock(duration - current)}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: spacing.xs,
                }}
              >
                <IconButton
                  name="shuffle"
                  label={p.queue.shuffle ? "Shuffle on" : "Shuffle off"}
                  active={p.queue.shuffle}
                  onPress={() => p.shuffle()}
                  size={46}
                  iconSize={22}
                />
                <IconButton
                  name="previous"
                  label="Previous"
                  onPress={p.previous}
                  size={52}
                  iconSize={23}
                  variant="outline"
                />
                <PlayButton
                  playing={p.status.playing}
                  busy={!!p.busy}
                  onPress={p.toggle}
                  size={compact ? 66 : 76}
                />
                <IconButton
                  name="next"
                  label="Next"
                  onPress={p.next}
                  size={52}
                  iconSize={23}
                  variant="outline"
                />
                <IconButton
                  name={p.queue.repeat === "single" ? "repeatOne" : "repeat"}
                  label={
                    "Repeat " +
                    { none: "off", all: "all", single: "one" }[
                      p.queue.repeat
                    ]
                  }
                  active={p.queue.repeat !== "none"}
                  onPress={p.repeat}
                  size={46}
                  iconSize={22}
                />
              </View>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-around",
                  paddingTop: 2,
                }}
              >
                <View style={{ alignItems: "center", gap: 4 }}>
                  <IconButton
                    name={
                      onPhone ? "downloaded" : saving ? "download" : "download"
                    }
                    label={
                      onPhone
                        ? "Downloaded to this phone"
                        : saving
                          ? "Saving to this phone"
                          : "Download to this phone"
                    }
                    disabled={onPhone || saving}
                    active={onPhone || saving}
                    onPress={saveToPhone}
                    size={46}
                  />
                  <Text style={[type.micro, { color: colors.faint }]}>
                    {onPhone ? "SAVED" : saving ? "SAVING" : "PHONE"}
                  </Text>
                </View>
                <View style={{ alignItems: "center", gap: 4 }}>
                  <IconButton
                    name="clock"
                    label="Sleep timer"
                    active={!!p.sleep || p.sleepAfterTrack}
                    onPress={() => setMenu(true)}
                    size={46}
                  />
                  <Text style={[type.micro, { color: colors.faint }]}>
                    SLEEP
                  </Text>
                </View>
                <View style={{ alignItems: "center", gap: 4 }}>
                  <IconButton
                    name="queue"
                    label="Open queue"
                    onPress={() => router.push("/queue")}
                    size={46}
                  />
                  <Text style={[type.micro, { color: colors.faint }]}>
                    QUEUE
                  </Text>
                </View>
              </View>

              {!!(p.sleep || p.sleepAfterTrack) && (
                <Text
                  style={[
                    type.meta,
                    { color: colors.muted, textAlign: "center" },
                  ]}
                >
                  {p.sleepAfterTrack
                    ? "Sleeping after this track"
                    : `Sleep timer ${new Date(p.sleep!).toLocaleTimeString()}`}
                </Text>
              )}

              {p.status.isBuffering && (
                <Text
                  style={[
                    type.micro,
                    { color: colors.accent, textAlign: "center" },
                  ]}
                >
                  BUFFERING…
                </Text>
              )}

              {upcoming.length > 0 && (
                <View style={{ gap: compact ? 6 : spacing.sm }}>
                  <SectionTitle
                    title="Up next"
                    action="Queue"
                    onAction={() => router.push("/queue")}
                  />
                  {upcoming.slice(0, compact ? 1 : 2).map((entry) => (
                    <Pressable
                      key={entry.key}
                      accessibilityRole="button"
                      accessibilityLabel={`Play ${entry.song.title}, ${entry.song.artist}`}
                      onPress={() =>
                        p.skip(
                          p.queue.entries.findIndex(
                            (item) => item.key === entry.key,
                          ),
                        )
                      }
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.md,
                        paddingVertical: 4,
                        opacity: pressed ? 0.6 : 1,
                      })}
                    >
                      <Art song={entry.song} size={36} radius={8} />
                      <View style={{ flex: 1 }}>
                        <Text
                          numberOfLines={1}
                          style={[
                            type.meta,
                            { color: colors.text, fontWeight: "600" },
                          ]}
                        >
                          {entry.song.title}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={[type.micro, { color: colors.muted }]}
                        >
                          {entry.song.artist}
                        </Text>
                      </View>
                      <Icon name="queue" size={14} color={colors.faint} />
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        ) : (
          <View
            style={{
              flex: 1,
              paddingHorizontal: spacing.xxl,
              paddingBottom: Math.max(insets.bottom, spacing.xl),
              justifyContent: "center",
              gap: spacing.lg,
            }}
          >
            <EmptyState
              icon="note"
              title="Nothing playing"
              message="Choose a song from your library to start listening."
            />
            {!!p.busy && (
              <IconButton
                name="close"
                label="Cancel playback request"
                onPress={p.pause}
                variant="outline"
                size={48}
              />
            )}
            {!!p.error && (
              <Chip title="Retry playback" onPress={() => void p.retry()} />
            )}
          </View>
        )}
      </SafeAreaView>

      <Modal
        visible={menu}
        animationType="slide"
        transparent
        onRequestClose={() => setMenu(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,0.46)",
          }}
        >
          <Pressable
            accessible={false}
            onPress={() => setMenu(false)}
            style={{ flex: 1 }}
          />
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 26,
              borderTopRightRadius: 26,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: spacing.xl,
              paddingTop: spacing.sm,
              paddingBottom: Math.max(insets.bottom, spacing.xl),
              maxHeight: "86%",
            }}
          >
            <View
              style={{
                alignSelf: "center",
                width: 38,
                height: 4,
                borderRadius: 4,
                backgroundColor: colors.borderStrong,
                marginBottom: spacing.md,
              }}
            />
            <ScrollView showsVerticalScrollIndicator={false}>
              {song && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                    paddingBottom: spacing.sm,
                  }}
                >
                  <Art song={song} size={52} artworkSize={480} />
                  <View style={{ flex: 1 }}>
                    <Text
                      numberOfLines={1}
                      style={[
                        type.body,
                        { color: colors.text, fontWeight: "700" },
                      ]}
                    >
                      {song.title}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[type.meta, { color: colors.muted }]}
                    >
                      {song.artist}
                    </Text>
                  </View>
                  <IconButton
                    name="close"
                    label="Close options"
                    onPress={() => setMenu(false)}
                    size={38}
                  />
                </View>
              )}

              <Text
                style={[
                  type.micro,
                  {
                    color: colors.faint,
                    textTransform: "uppercase",
                    marginTop: spacing.md,
                    marginBottom: spacing.xs,
                  },
                ]}
              >
                Track
              </Text>
              <MenuRow
                title={
                  onPhone
                    ? "Downloaded to this phone"
                    : saving
                      ? "Saving to this phone"
                      : "Download to this phone"
                }
                subtitle={
                  onPhone
                    ? "Keeps playing without the server"
                    : "Keeps an offline copy on this device"
                }
                icon="download"
                disabled={!song || onPhone || saving}
                onPress={saveToPhone}
              />
              <MenuRow
                title="Open queue"
                subtitle={`${p.queue.entries.length} ${p.queue.entries.length === 1 ? "track" : "tracks"} lined up`}
                icon="queue"
                onPress={() => {
                  setMenu(false);
                  router.push("/queue");
                }}
              />
              <MenuRow
                title="Retry playback"
                subtitle="Reload the current stream and server route"
                icon="retry"
                onPress={() => {
                  setMenu(false);
                  void p.retry();
                }}
              />

              <Text
                style={[
                  type.micro,
                  {
                    color: colors.faint,
                    textTransform: "uppercase",
                    marginTop: spacing.md,
                    marginBottom: spacing.xs,
                  },
                ]}
              >
                Sleep timer
              </Text>
              <View
                style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
              >
                <Chip
                  title="Finish track"
                  active={p.sleepAfterTrack}
                  onPress={p.sleepAfterCurrent}
                />
                {[15, 30, 60].map((minutes) => (
                  <Chip
                    key={minutes}
                    title={`${minutes} min`}
                    active={
                      !!p.sleep &&
                      Math.abs(
                        p.sleep -
                          Date.now() -
                          minutes * 60000,
                      ) < 60000
                    }
                    onPress={() => p.sleepFor(minutes)}
                  />
                ))}
                <Chip title="Cancel timer" onPress={() => p.sleepFor(0)} />
              </View>
              {!!(p.sleep || p.sleepAfterTrack) && (
                <Text
                  style={[
                    type.meta,
                    { color: colors.muted, marginTop: spacing.sm },
                  ]}
                >
                  {p.sleepAfterTrack
                    ? "Playback stops when this track finishes, even with repeat enabled."
                    : `Playback stops at ${new Date(p.sleep!).toLocaleTimeString()}.`}
                </Text>
              )}

            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const StyleSheetAbsolute = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};
