import React, { useState, useEffect } from "react";
import {
  View,
  Image,
  FlatList,
  RefreshControl,
  Modal,
  Pressable,
  Text,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Song, addressOrder } from "./api";
import { usePlaylists } from "./data";
import { useSession, queryClient } from "./session";
import { usePlayback } from "./playback";
import { watchDownloads } from "./offline";
import { useLater } from "./use-later";
import { saveLater, removeLater } from "./listen-later";
import { Label, Action, useTheme, report, Page, Field, Busy } from "./ui";
import { Icon, IconName } from "./icon";
import { IconButton, PlayButton, ProgressBar } from "./kit";
import { radius, spacing, type } from "./theme";
export const duration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

export function Art({
  song,
  size = 52,
  radius: corner = 10,
  artworkSize = 480,
  fill = false,
}: {
  song: Song;
  size?: number;
  radius?: number;
  /** Requested server artwork width. Lists use 480; Now Playing uses 1200. */
  artworkSize?: number;
  fill?: boolean;
}) {
  const { session } = useSession();
  const { colors } = useTheme();
  const local = session?.offline.local(song.id);
  const key = `${session?.scope}:${song.id}:${song.coverArt}:${session?.api.activeServer}:${!!local}:${artworkSize}`;
  const [failed, setFailed] = useState({ key, index: 0 });
  const index = failed.key === key ? failed.index : 0;
  const candidates = [
    ...(local ? [{ uri: session!.offline.artwork(song.id) }] : []),
    ...(session
      ? addressOrder(session.api.addresses, session.api.activeServer).map(
          (address) =>
            session.api.artwork(
              song.coverArt ?? song.id,
              address,
              artworkSize,
            ),
        )
      : []),
  ];
  return (
    <View
      style={{
        width: fill ? "100%" : size,
        height: fill ? "100%" : size,
        borderRadius: fill ? 0 : corner,
        backgroundColor: colors.surfaceInset,
        borderWidth: fill ? 0 : 1,
        borderColor: colors.border,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon name="note" size={Math.round(size * 0.4)} color={colors.faint} />
      {candidates[index] && (
        <Image
          accessibilityLabel={`Artwork for ${song.album ?? song.title}`}
          source={candidates[index]}
          resizeMode="cover"
          onError={() => setFailed({ key, index: index + 1 })}
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
          }}
        />
      )}
    </View>
  );
}

function SheetRow({
  title,
  subtitle,
  icon,
  onPress,
  disabled,
  danger,
  selected,
  trailing,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  onPress: () => unknown;
  disabled?: boolean;
  danger?: boolean;
  selected?: boolean;
  trailing?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={() => {
        try {
          void Promise.resolve(onPress()).catch(report);
        } catch (e) {
          report(e);
        }
      }}
      style={({ pressed }) => ({
        minHeight: 50,
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingVertical: 10,
        paddingHorizontal: 4,
        borderRadius: radius.md,
        opacity: disabled ? 0.4 : pressed ? 0.55 : 1,
      })}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          backgroundColor: colors.surfaceInset,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon && (
          <Icon
            name={icon}
            size={17}
            color={danger ? colors.danger : colors.muted}
          />
        )}
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
      {trailing}
    </Pressable>
  );
}

function SheetHeading({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
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
      {children}
    </Text>
  );
}

export function SongList({
  songs,
  onPlay,
  refreshing = false,
  refresh,
  extra,
  header,
  emptyText = "No songs here yet. Search your library or choose Online.",
}: {
  songs: Song[];
  onPlay?: (index: number) => void;
  refreshing?: boolean;
  refresh?: () => void;
  extra?: (song: Song, index: number) => React.ReactNode;
  header?: React.ReactNode;
  emptyText?: string;
}) {
  const { session } = useSession();
  const player = usePlayback();
  const { colors } = useTheme();
  const [selected, setSelected] = useState<Song | null>(null);
  const [playlistName, setPlaylistName] = useState("");
  const [working, setWorking] = useState(false);
  const actionPending = React.useRef(false);
  const [, tick] = useState(0);
  useEffect(() => watchDownloads(() => tick((x) => x + 1)), []);
  const playlists = usePlaylists(!!selected);
  const later = useLater();
  const insets = useSafeAreaInsets();
  const currentId = player.queue.entries[player.queue.index]?.song.id;
  async function run(fn: () => unknown) {
    if (actionPending.current) return;
    actionPending.current = true;
    setWorking(true);
    try {
      await fn();
    } catch (e) {
      report(e);
    } finally {
      actionPending.current = false;
      setWorking(false);
    }
  }
  async function favorite(s: Song) {
    await session!.api.rest(s.starred ? "unstar" : "star", { id: s.id });
    await queryClient.invalidateQueries({ queryKey: [session!.scope] });
    setSelected(null);
  }
  return (
    <>
      <FlatList
        data={songs}
        keyExtractor={(s, i) => s.id + ":" + i}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        ItemSeparatorComponent={() => (
          <View
            style={{
              height: 1,
              backgroundColor: colors.border,
              marginLeft: 64,
              opacity: 0.7,
            }}
          />
        )}
        ListHeaderComponent={
          header ? (
            <View style={{ gap: 18, paddingBottom: 14 }}>{header}</View>
          ) : undefined
        }
        refreshControl={
          refresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={colors.accent}
            />
          ) : undefined
        }
        ListEmptyComponent={
          <View style={{ paddingVertical: 28 }}>
            <Label muted>{emptyText}</Label>
          </View>
        }
        renderItem={({ item, index }) => {
          const now = item.id === currentId;
          const onPhone = !!session!.offline.local(item.id);
          return (
            <View
              style={{
                backgroundColor: now ? colors.accentSoft : "transparent",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  gap: 12,
                  alignItems: "center",
                  paddingVertical: 9,
                  paddingHorizontal: 4,
                  borderRadius: radius.md,
                }}
              >
                <Art song={item} size={52} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Play ${item.title}, ${item.artist}`}
                  style={{
                    flex: 1,
                    minHeight: 52,
                    justifyContent: "center",
                    gap: 1,
                  }}
                  onPress={() =>
                    onPlay ? onPlay(index) : void player.select(songs, index)
                  }
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      type.body,
                      {
                        color: now ? colors.accent : colors.text,
                        fontWeight: "600",
                      },
                    ]}
                  >
                    {item.title}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[type.meta, { color: colors.muted }]}
                  >
                    {item.artist} · {duration(item.duration)}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <Icon
                      name={
                        onPhone
                          ? "phone"
                          : item.onServer === false
                            ? "wifi"
                            : "server"
                      }
                      size={10}
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
                        ? "On this phone"
                        : item.onServer === false
                          ? "Online"
                          : "On server"}
                      {onPhone && item.onServer === false ? "" : ""}
                    </Text>
                    {item.starred && (
                      <Icon
                        name="heartFilled"
                        size={10}
                        color={colors.accent}
                      />
                    )}
                    {!!item.onServer && !onPhone && (
                      <Text
                        style={[
                          type.micro,
                          { color: colors.faint, textTransform: "uppercase" },
                        ]}
                      >
                        · Library
                      </Text>
                    )}
                  </View>
                </Pressable>
                <IconButton
                  name="more"
                  label={`Options for ${item.title}, ${item.artist}`}
                  onPress={() => setSelected(item)}
                  size={38}
                />
              </View>
              {extra?.(item, index)}
            </View>
          );
        }}
      />
      <Modal
        visible={!!selected}
        animationType="slide"
        transparent
        onRequestClose={() => setSelected(null)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,0.45)",
          }}
        >
          <Pressable
            accessible={false}
            onPress={() => setSelected(null)}
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
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {selected && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingBottom: spacing.sm,
                  }}
                >
                  <Art song={selected} size={52} />
                  <View style={{ flex: 1 }}>
                    <Label numberOfLines={1}>{selected.title}</Label>
                    <Label muted variant="meta" numberOfLines={1}>
                      {selected.artist}
                      {selected.album ? ` · ${selected.album}` : ""}
                    </Label>
                  </View>
                  <IconButton
                    name="close"
                    label="Close"
                    onPress={() => setSelected(null)}
                    disabled={working}
                    size={38}
                  />
                </View>
              )}
              {working && (
                <View style={{ paddingVertical: spacing.sm }}>
                  <Busy label="Working" />
                </View>
              )}
              {selected && (
                <View style={{ paddingBottom: spacing.sm }}>
                  <SheetHeading>Playback</SheetHeading>
                  <SheetRow
                    title="Play next"
                    subtitle="Right after the current track"
                    icon="queue"
                    disabled={working}
                    onPress={() =>
                      void player
                        .enqueue(selected, true)
                        .then(() => setSelected(null))
                        .catch(report)
                    }
                  />
                  <SheetRow
                    title="Append to queue"
                    subtitle="At the end of the queue"
                    icon="queue"
                    disabled={working}
                    onPress={() =>
                      void player
                        .enqueue(selected, false)
                        .then(() => setSelected(null))
                        .catch(report)
                    }
                  />
                  <SheetHeading>Track</SheetHeading>
                  <SheetRow
                    title={
                      selected.starred ? "Remove favorite" : "Add favorite"
                    }
                    icon={selected.starred ? "heartFilled" : "heart"}
                    disabled={working}
                    onPress={() => run(() => favorite(selected))}
                  />
                  <SheetRow
                    title={
                      later.some((song) => song.id === selected.id)
                        ? "Remove from Listen later"
                        : "Save for later"
                    }
                    icon="clock"
                    disabled={working}
                    onPress={() => {
                      if (later.some((song) => song.id === selected.id))
                        removeLater(session!.scope, selected.id);
                      else saveLater(session!.scope, selected);
                      setSelected(null);
                    }}
                  />
                  <SheetHeading>Storage</SheetHeading>
                  <SheetRow
                    title="Download to this phone"
                    subtitle="Keeps an offline copy on this device"
                    icon="download"
                    disabled={working}
                    onPress={() => {
                      session!.offline.enqueue([selected]);
                      setSelected(null);
                      router.push("/downloads");
                    }}
                  />
                  <Text
                    style={{
                      ...type.meta,
                      color: colors.faint,
                      paddingVertical: 8,
                      paddingHorizontal: 4,
                    }}
                  >
                    Server storage and phone storage are separate. Removing a
                    phone download never deletes the server copy.
                  </Text>
                  <SheetHeading>Add to playlist</SheetHeading>
                  {playlists.isPending && <Busy label="Loading playlists" />}
                  {playlists.isError && (
                    <SheetRow
                      title="Retry playlists"
                      icon="repeat"
                      onPress={() => playlists.refetch()}
                    />
                  )}
                  {playlists.data?.every((p) => p.id.startsWith("bridge_")) && (
                    <Text
                      style={{
                        ...type.meta,
                        color: colors.faint,
                        paddingHorizontal: 4,
                        paddingBottom: 6,
                      }}
                    >
                      Create your first playlist below.
                    </Text>
                  )}
                  {playlists.data
                    ?.filter((p: { id: string }) => !p.id.startsWith("bridge_"))
                    .map((p: { id: string; name: string }) => (
                      <SheetRow
                        key={p.id}
                        title={p.name}
                        icon="library"
                        disabled={working}
                        onPress={() =>
                          run(() =>
                            session!.api
                              .rest("updatePlaylist", {
                                playlistId: p.id,
                                songIdToAdd: selected.id,
                              })
                              .then(() => {
                                setSelected(null);
                                return queryClient.invalidateQueries({
                                  queryKey: [session!.scope],
                                });
                              }),
                          )
                        }
                      />
                    ))}
                  <View style={{ paddingTop: spacing.sm, gap: spacing.sm }}>
                    <Field
                      label="New playlist name"
                      value={playlistName}
                      onChange={setPlaylistName}
                      maxLength={256}
                    />
                    <Action
                      title="Create playlist with this song"
                      disabled={working || !playlistName.trim()}
                      onPress={() =>
                        run(() =>
                          session!.api
                            .rest("createPlaylist", {
                              name: playlistName.trim(),
                              songId: [selected.id],
                            })
                            .then(() => {
                              setSelected(null);
                              setPlaylistName("");
                              return queryClient.invalidateQueries({
                                queryKey: [session!.scope],
                              });
                            }),
                        )
                      }
                    />
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

export function MiniPlayer({ bottomInset = true }: { bottomInset?: boolean }) {
  const player = usePlayback();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const song = player.queue.entries[player.queue.index]?.song;
  if (!song)
    return player.busy || player.error ? (
      <View
        style={{
          padding: 12,
          paddingBottom: bottomInset ? Math.max(12, insets.bottom) : 12,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderColor: colors.border,
          gap: 8,
        }}
      >
        <Label variant="meta">{player.busy || player.error}</Label>
        {!!player.busy && (
          <Action title="Cancel playback request" onPress={player.pause} />
        )}
        {!!player.error && (
          <Action title="Retry playback" onPress={() => void player.retry()} />
        )}
      </View>
    ) : null;
  const progress = song.duration ? player.queue.position / song.duration : 0;
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderColor: colors.border,
        paddingBottom: bottomInset ? Math.max(8, insets.bottom - 4) : 8,
      }}
    >
      <View style={{ paddingHorizontal: spacing.md }}>
        <ProgressBar value={progress} height={2} />
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          paddingTop: 8,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open now playing"
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
          onPress={() => router.push("/player")}
        >
          <Art song={song} size={42} radius={9} />
          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={1}
              style={[type.body, { color: colors.text, fontWeight: "600" }]}
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
        </Pressable>
        <IconButton
          name={player.status.playing ? "pause" : "play"}
          label={player.status.playing ? "Pause" : "Play"}
          onPress={player.toggle}
          size={40}
          iconSize={20}
          active
        />
        <IconButton
          name="next"
          label="Next"
          onPress={player.next}
          size={40}
          iconSize={18}
        />
      </View>
      {(player.busy || player.error) && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: spacing.lg,
            paddingTop: 6,
          }}
        >
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={[type.micro, { color: colors.muted }]} numberOfLines={1}>
            {player.busy || player.error}
          </Text>
        </View>
      )}
    </View>
  );
}
