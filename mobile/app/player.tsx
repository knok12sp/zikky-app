import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Slider from "@react-native-community/slider";
import { usePlayback } from "../src/playback";
import { Art } from "../src/components";
import { Label, useTheme, report } from "../src/ui";
import { useSession, queryClient } from "../src/session";
import { Icon } from "../src/icon";
import {
  IconButton,
  PlayButton,
  Chip,
  Card,
  SectionTitle,
  EmptyState,
} from "../src/kit";
import { radius, spacing, type } from "../src/theme";

const clock = (s: number) =>
  `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, "0")}`;

export default function Player() {
  const p = usePlayback();
  const { colors } = useTheme();
  const { session } = useSession();
  const insets = useSafeAreaInsets();
  const song = p.queue.entries[p.queue.index]?.song;
  const upcoming = p.queue.entries.slice(p.queue.index + 1, p.queue.index + 3);
  const onPhone = song ? !!session?.offline.local(song.id) : false;
  async function favorite() {
    if (!song) return;
    try {
      await session!.api.rest(song.starred ? "unstar" : "star", {
        id: song.id,
      });
      await queryClient.invalidateQueries({ queryKey: [session!.scope] });
    } catch (e) {
      report(e);
    }
  }
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing.md,
          paddingTop: spacing.xs,
          paddingBottom: spacing.xs,
        }}
      >
        <IconButton
          name="chevronDown"
          label="Back"
          onPress={() => router.back()}
          size={44}
          iconSize={24}
        />
        <Text
          style={[
            type.micro,
            {
              color: colors.faint,
              textTransform: "uppercase",
              letterSpacing: 2,
            },
          ]}
        >
          Now playing
        </Text>
        <IconButton
          name="queue"
          label="Open queue"
          onPress={() => router.push("/queue")}
          size={44}
          iconSize={20}
        />
      </View>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingBottom: Math.max(insets.bottom, 20) + 16,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {!!(p.busy || p.error) && (
          <View
            style={{
              backgroundColor: p.error ? colors.dangerSoft : colors.accentSoft,
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

        {song ? (
          <>
            <View style={{ alignItems: "center", paddingTop: spacing.sm }}>
              <View
                style={{
                  padding: 8,
                  borderRadius: 24,
                  backgroundColor: colors.surfaceRaised,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Art song={song} size={260} radius={16} />
              </View>
            </View>

            <View style={{ gap: 4 }}>
              <Text
                numberOfLines={2}
                style={[type.title, { color: colors.text }]}
              >
                {song.title}
              </Text>
              <Text style={[type.meta, { color: colors.muted, fontSize: 15 }]}>
                {song.artist}
                {song.album ? ` — ${song.album}` : ""}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingTop: 2,
                }}
              >
                <Icon
                  name={onPhone ? "downloaded" : "server"}
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
                    : "Streaming from your server"}
                </Text>
                {song.starred && (
                  <>
                    <Text style={[type.micro, { color: colors.faint }]}>·</Text>
                    <Icon name="heartFilled" size={11} color={colors.accent} />
                  </>
                )}
              </View>
            </View>

            <View
              style={{
                backgroundColor: colors.surfaceInset,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: spacing.md,
                paddingTop: spacing.sm,
                paddingBottom: spacing.xs,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "flex-end",
                }}
              >
                <View style={{ gap: 1 }}>
                  <Text
                    style={[
                      type.numeric,
                      { color: colors.display, fontSize: 26, lineHeight: 30 },
                    ]}
                  >
                    {clock(p.status.currentTime)}
                  </Text>
                  <Text style={[type.micro, { color: colors.faint }]}>
                    ELAPSED
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 1 }}>
                  <Text
                    style={[
                      type.numeric,
                      { color: colors.muted, fontSize: 26, lineHeight: 30 },
                    ]}
                  >
                    −{clock(p.status.duration - p.status.currentTime)}
                  </Text>
                  <Text style={[type.micro, { color: colors.faint }]}>
                    REMAINING
                  </Text>
                </View>
              </View>
              <Slider
                accessibilityLabel="Playback position"
                minimumValue={0}
                maximumValue={Math.max(1, p.status.duration)}
                value={p.status.currentTime}
                minimumTrackTintColor={colors.accent}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.accent}
                disabled={!p.status.isLoaded || p.status.duration <= 0}
                onSlidingComplete={(value) => void p.seek(value)}
                style={{ width: "100%", height: 38 }}
              />
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingBottom: 4,
                }}
              >
                {[0, 1, 2, 3, 4].map((i) => (
                  <View
                    key={i}
                    style={{
                      width: 1,
                      height: 3,
                      backgroundColor: colors.borderStrong,
                    }}
                  />
                ))}
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
                size={44}
                iconSize={21}
              />
              <IconButton
                name="previous"
                label="Previous"
                onPress={p.previous}
                size={50}
                iconSize={22}
                variant="outline"
              />
              <PlayButton
                playing={p.status.playing}
                busy={!!p.busy}
                onPress={p.toggle}
                size={70}
              />
              <IconButton
                name="next"
                label="Next"
                onPress={p.next}
                size={50}
                iconSize={22}
                variant="outline"
              />
              <IconButton
                name={p.queue.repeat === "single" ? "repeatOne" : "repeat"}
                label={
                  "Repeat " +
                  { none: "off", all: "all", single: "one" }[p.queue.repeat]
                }
                active={p.queue.repeat !== "none"}
                onPress={p.repeat}
                size={44}
                iconSize={21}
              />
            </View>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-around",
                paddingTop: spacing.xs,
              }}
            >
              <View style={{ alignItems: "center", gap: 4 }}>
                <IconButton
                  name={song.starred ? "heartFilled" : "heart"}
                  label={song.starred ? "Remove favorite" : "Add favorite"}
                  active={!!song.starred}
                  onPress={favorite}
                  size={44}
                />
                <Text style={[type.micro, { color: colors.faint }]}>
                  FAVORITE
                </Text>
              </View>
              <View style={{ alignItems: "center", gap: 4 }}>
                <IconButton
                  name={onPhone ? "downloaded" : "download"}
                  label={
                    onPhone
                      ? "Downloaded to this phone"
                      : "Download to this phone"
                  }
                  disabled={onPhone}
                  active={onPhone}
                  onPress={() => {
                    if (!song) return;
                    session!.offline.enqueue([song]);
                    router.push("/downloads");
                  }}
                  size={44}
                />
                <Text style={[type.micro, { color: colors.faint }]}>PHONE</Text>
              </View>
              <View style={{ alignItems: "center", gap: 4 }}>
                <IconButton
                  name="queue"
                  label="Queue"
                  onPress={() => router.push("/queue")}
                  size={44}
                />
                <Text style={[type.micro, { color: colors.faint }]}>QUEUE</Text>
              </View>
              <View style={{ alignItems: "center", gap: 4 }}>
                <IconButton
                  name="retry"
                  label="Retry playback"
                  onPress={() => void p.retry()}
                  size={44}
                />
                <Text style={[type.micro, { color: colors.faint }]}>RETRY</Text>
              </View>
            </View>

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

            <View style={{ gap: spacing.sm }}>
              <SectionTitle
                title="Up next"
                action={
                  p.queue.entries.length > p.queue.index + 1
                    ? "Open queue"
                    : undefined
                }
                onAction={() => router.push("/queue")}
              />
              {upcoming.length ? (
                upcoming.map((entry) => (
                  <Pressable
                    key={entry.key}
                    accessibilityRole="button"
                    accessibilityLabel={`Play ${entry.song.title}, ${entry.song.artist}`}
                    onPress={() =>
                      p.skip(
                        p.queue.entries.findIndex((e) => e.key === entry.key),
                      )
                    }
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                      paddingVertical: 5,
                    }}
                  >
                    <Art song={entry.song} size={38} radius={8} />
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
                ))
              ) : (
                <Text style={[type.meta, { color: colors.faint }]}>
                  The queue ends with this track.
                </Text>
              )}
            </View>

            <Card inset padding={spacing.md} style={{ gap: spacing.sm }}>
              <SectionTitle title="Sleep timer" />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Chip
                  title="Finish current song, then sleep"
                  active={p.sleepAfterTrack}
                  onPress={p.sleepAfterCurrent}
                />
                {[0, 15, 30, 60].map((m) => (
                  <Chip
                    key={m}
                    title={m ? `Sleep ${m}m` : "Cancel timer"}
                    onPress={() => p.sleepFor(m)}
                  />
                ))}
              </View>
              {!!p.sleep && (
                <Text style={[type.meta, { color: colors.muted }]}>
                  Sleep timer: {new Date(p.sleep).toLocaleTimeString()}
                </Text>
              )}
              {p.sleepAfterTrack && (
                <Text style={[type.meta, { color: colors.muted }]}>
                  Playback stops when the current song finishes, even with
                  repeat enabled.
                </Text>
              )}
            </Card>
          </>
        ) : (
          <View style={{ paddingTop: 60, gap: spacing.md }}>
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
      </ScrollView>
    </SafeAreaView>
  );
}
