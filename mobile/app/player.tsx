import { useEffect, useMemo, useState } from "react";
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
import { font, radius, spacing, type } from "../src/theme";

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
        minHeight: 52,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderColor: colors.border,
        opacity: disabled ? 0.4 : pressed ? 0.55 : 1,
      })}
    >
      <View style={{ width: 20, alignItems: "center" }}>
        <Icon
          name={icon}
          size={16}
          color={danger ? colors.danger : colors.muted}
        />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={[
            type.meta,
            {
              color: danger ? colors.danger : colors.text,
              fontFamily: font.uiMedium,
            },
          ]}
        >
          {title}
        </Text>
        {!!subtitle && (
          <Text style={[type.micro, { color: colors.faint }]}>{subtitle}</Text>
        )}
      </View>
    </Pressable>
  );
}

function Meta({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <Text
      style={[
        type.micro,
        {
          color: colors.faint,
          marginTop: spacing.lg,
          marginBottom: spacing.xs,
        },
      ]}
    >
      {children}
    </Text>
  );
}

export default function Player() {
  const p = usePlayback();
  const { colors } = useTheme();
  const { session } = useSession();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [menu, setMenu] = useState(false);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [, tick] = useState(0);
  useEffect(() => watchDownloads(() => tick((x) => x + 1)), []);

  const song = p.queue.entries[p.queue.index]?.song;
  const upcoming = p.queue.entries.slice(p.queue.index + 1, p.queue.index + 3);
  const { download, onPhone } = useMemo(() => {
    const items = song ? session?.offline.list() : undefined;
    return {
      download: items?.find((item) => item.id === song?.id),
      onPhone: song ? !!session?.offline.local(song.id) : false,
    };
  }, [session, song, tick]);
  const saving = !!download && !onPhone && download.state !== "failed";
  const downloadFailed = download?.state === "failed";
  const starred = song ? (favorites[song.id] ?? !!song.starred) : false;
  const compact = height < 730;
  const duration = Math.max(0, p.status.duration || song?.duration || 0);
  const current = Math.min(Math.max(0, p.status.currentTime), duration);
  const plate = Math.min(width - spacing.xl * 2, compact ? 260 : 320);

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
      <SafeAreaView
        edges={["top", "bottom", "left", "right"]}
        style={{ flex: 1 }}
      >
        <View
          style={{
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
            size={40}
            iconSize={20}
          />
          <Text style={[type.micro, { color: colors.faint }]}>
            NOW PLAYING · ON SERVER
          </Text>
          <IconButton
            name="more"
            label="More player options"
            onPress={() => setMenu(true)}
            disabled={!song}
            size={40}
            iconSize={18}
          />
        </View>

        {song ? (
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              paddingHorizontal: spacing.xl,
              paddingTop: spacing.md,
              paddingBottom: Math.max(insets.bottom, spacing.lg),
            }}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={{
                width: "100%",
                maxWidth: 460,
                alignSelf: "center",
                gap: spacing.lg,
                flexGrow: 1,
                justifyContent: "center",
              }}
            >
              {!!(p.busy || p.error) && (
                <View
                  style={{
                    backgroundColor: p.error
                      ? colors.dangerSoft
                      : colors.accentSoft,
                    borderRadius: radius.sm,
                    borderWidth: 1,
                    borderColor: p.error ? colors.danger : colors.border,
                    padding: spacing.sm,
                  }}
                >
                  <Text
                    style={[
                      type.micro,
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
                  width: plate,
                  height: plate,
                  alignSelf: "center",
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                  backgroundColor: colors.surfaceInset,
                  overflow: "hidden",
                }}
              >
                <Art song={song} fill artworkSize={1200} />
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-end",
                  gap: spacing.md,
                }}
              >
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <View
                      style={{
                        width: 5,
                        height: 5,
                        backgroundColor: p.status.playing
                          ? colors.accent
                          : colors.faint,
                      }}
                    />
                    <Text
                      style={[
                        type.micro,
                        {
                          color: p.status.playing
                            ? colors.accent
                            : colors.faint,
                        },
                      ]}
                    >
                      {p.status.playing ? "PLAYING" : "PAUSED"}
                    </Text>
                  </View>
                  <Text
                    numberOfLines={2}
                    style={[type.title, { color: colors.text }]}
                  >
                    {song.title}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      type.body,
                      { color: colors.muted, fontFamily: font.ui },
                    ]}
                  >
                    {song.artist}
                    {song.album ? ` · ${song.album}` : ""}
                  </Text>
                </View>
                <IconButton
                  name={starred ? "heartFilled" : "heart"}
                  label={starred ? "Remove favorite" : "Add favorite"}
                  active={starred}
                  onPress={favorite}
                  size={40}
                  iconSize={18}
                />
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <Icon
                  name={onPhone ? "downloaded" : saving ? "download" : "server"}
                  size={11}
                  color={onPhone ? colors.accent : colors.faint}
                />
                <Text
                  style={[
                    type.micro,
                    { color: onPhone ? colors.accent : colors.faint },
                  ]}
                >
                  {onPhone
                    ? "OFFLINE ON THIS PHONE"
                    : saving
                      ? "SAVING TO THIS PHONE"
                      : downloadFailed
                        ? "PHONE DOWNLOAD FAILED"
                        : "STREAMING FROM YOUR SERVER"}
                </Text>
              </View>

              <View
                style={{
                  backgroundColor: colors.surfaceInset,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.sm,
                  paddingHorizontal: spacing.md,
                  paddingTop: spacing.xs,
                  paddingBottom: spacing.sm,
                  gap: 2,
                }}
              >
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
                  maximumTrackTintColor={colors.borderStrong}
                  thumbTintColor={colors.accent}
                  disabled={!p.status.isLoaded || duration <= 0}
                  onSlidingComplete={(value) => void p.seek(value)}
                  style={{ width: "100%", height: 32 }}
                />
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={[type.readout, { color: colors.accent }]}>
                    {clock(current)}
                  </Text>
                  <Text style={[type.readout, { color: colors.muted }]}>
                    −{clock(duration - current)}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <IconButton
                  name="shuffle"
                  label={p.queue.shuffle ? "Shuffle on" : "Shuffle off"}
                  active={p.queue.shuffle}
                  onPress={() => p.shuffle()}
                  size={40}
                  iconSize={18}
                />
                <IconButton
                  name="previous"
                  label="Previous"
                  onPress={p.previous}
                  size={44}
                  iconSize={20}
                />
                <PlayButton
                  playing={p.status.playing}
                  busy={!!p.busy}
                  onPress={p.toggle}
                  size={compact ? 58 : 64}
                />
                <IconButton
                  name="next"
                  label="Next"
                  onPress={p.next}
                  size={44}
                  iconSize={20}
                />
                <IconButton
                  name={p.queue.repeat === "single" ? "repeatOne" : "repeat"}
                  label={
                    "Repeat " +
                    { none: "off", all: "all", single: "one" }[p.queue.repeat]
                  }
                  active={p.queue.repeat !== "none"}
                  onPress={p.repeat}
                  size={40}
                  iconSize={18}
                />
              </View>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-around",
                  borderTopWidth: 1,
                  borderColor: colors.border,
                  paddingTop: spacing.md,
                }}
              >
                {[
                  {
                    icon: (onPhone
                      ? "downloaded"
                      : "download") as IconName,
                    label: onPhone
                      ? "Downloaded to this phone"
                      : saving
                        ? "Saving to this phone"
                        : "Download to this phone",
                    caption: onPhone ? "SAVED" : saving ? "SAVING" : "PHONE",
                    onPress: saveToPhone,
                    disabled: onPhone || saving,
                    active: onPhone || saving,
                  },
                  {
                    icon: "clock" as IconName,
                    label: "Sleep timer",
                    caption: "SLEEP",
                    onPress: () => setMenu(true),
                    disabled: false,
                    active: !!p.sleep || p.sleepAfterTrack,
                  },
                  {
                    icon: "queue" as IconName,
                    label: "Open queue",
                    caption: "QUEUE",
                    onPress: () => router.push("/queue"),
                    disabled: false,
                    active: false,
                  },
                ].map((item) => (
                  <View
                    key={item.caption}
                    style={{ alignItems: "center", gap: 3 }}
                  >
                    <IconButton
                      name={item.icon}
                      label={item.label}
                      active={item.active}
                      disabled={item.disabled}
                      onPress={item.onPress}
                      size={40}
                      iconSize={17}
                    />
                    <Text style={[type.micro, { color: colors.faint }]}>
                      {item.caption}
                    </Text>
                  </View>
                ))}
              </View>

              {!!(p.sleep || p.sleepAfterTrack) && (
                <Text
                  style={[
                    type.micro,
                    { color: colors.muted, textAlign: "center" },
                  ]}
                >
                  {p.sleepAfterTrack
                    ? "SLEEPING AFTER THIS TRACK"
                    : `SLEEP TIMER ${new Date(p.sleep!).toLocaleTimeString()}`}
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
                <View>
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
                        paddingVertical: spacing.sm,
                        borderBottomWidth: 1,
                        borderColor: colors.border,
                        opacity: pressed ? 0.6 : 1,
                      })}
                    >
                      <Art song={entry.song} size={32} radius={2} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          numberOfLines={1}
                          style={[
                            type.meta,
                            {
                              color: colors.text,
                              fontFamily: font.uiMedium,
                            },
                          ]}
                        >
                          {entry.song.title}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={[type.micro, { color: colors.faint }]}
                        >
                          {entry.song.artist}
                        </Text>
                      </View>
                      <Text style={[type.numeric, { color: colors.faint }]}>
                        {clock(entry.song.duration)}
                      </Text>
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
              paddingHorizontal: spacing.xl,
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
                size={44}
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
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
        >
          <Pressable
            accessible={false}
            onPress={() => setMenu(false)}
            style={{ flex: 1 }}
          />
          <View
            style={{
              backgroundColor: colors.panel,
              borderTopLeftRadius: radius.sm,
              borderTopRightRadius: radius.sm,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              paddingHorizontal: spacing.xl,
              paddingTop: spacing.sm,
              paddingBottom: Math.max(insets.bottom, spacing.xl),
              maxHeight: "86%",
            }}
          >
            <View
              style={{
                alignSelf: "center",
                width: 32,
                height: 2,
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
                  <Art song={song} size={44} radius={2} artworkSize={480} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      numberOfLines={1}
                      style={[
                        type.meta,
                        { color: colors.text, fontFamily: font.uiMedium },
                      ]}
                    >
                      {song.title}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[type.micro, { color: colors.faint }]}
                    >
                      {song.artist}
                    </Text>
                  </View>
                  <IconButton
                    name="close"
                    label="Close options"
                    onPress={() => setMenu(false)}
                    size={36}
                    iconSize={16}
                  />
                </View>
              )}

              <Meta>Track</Meta>
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

              <Meta>Sleep timer</Meta>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
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
                      Math.abs(p.sleep - Date.now() - minutes * 60000) < 60000
                    }
                    onPress={() => p.sleepFor(minutes)}
                  />
                ))}
                <Chip title="Cancel timer" onPress={() => p.sleepFor(0)} />
              </View>
              {!!(p.sleep || p.sleepAfterTrack) && (
                <Text
                  style={[type.meta, { color: colors.muted, marginTop: spacing.sm }]}
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
