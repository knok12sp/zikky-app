import { useState, useRef, useEffect } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  Page,
  Action,
  Row,
  Label,
  Field,
  Busy,
  report,
  confirm,
  useTheme,
} from "../src/ui";
import { SongList, Art, duration } from "../src/components";
import { useSession, queryClient } from "../src/session";
import { usePlayback } from "../src/playback";
import { useSongs } from "../src/data";
import { Song, parseSongs } from "../src/api";
import { read, write } from "../src/db";
import { completedSongs, watchDownloads } from "../src/offline";
import { collectionSongs } from "../src/library";
import { collectionDownloads } from "../src/download-policy";
import { IconButton, Card, SectionTitle, Banner } from "../src/kit";
import { Icon } from "../src/icon";
import { spacing, type } from "../src/theme";
export default function Collection() {
  const { colors } = useTheme();
  const { session } = useSession();
  const player = usePlayback();
  const params = useLocalSearchParams<{
    kind: string;
    id: string;
    name: string;
    offline?: string;
  }>();
  const { kind, id } = params;
  const offline = params.offline === "1";
  const [name, setName] = useState(params.name ?? "Collection");
  const [working, setWorking] = useState(false);
  const [editing, setEditing] = useState(false);
  const mutation = useRef(false);
  const [, tick] = useState(0);
  useEffect(() => watchDownloads(() => tick((v) => v + 1)), []);
  const library = useSongs();
  const playlistKey = [session!.scope, "playlist", id];
  const smart = id?.startsWith("smart_");
  const playlist = useQuery<Song[]>({
    queryKey: playlistKey,
    enabled: kind === "playlist" && !offline,
    queryFn: async ({ signal }) => {
      const songs = smart
        ? await session!.api.smart(id!, signal)
        : parseSongs(
            (await session!.api.rest("getPlaylist", { id }, signal)).playlist
              ?.entry,
          );
      write(session!.scope, "playlist:" + id, songs);
      return songs;
    },
    initialData: () => {
      const cached = read<unknown>(session!.scope, "playlist:" + id, undefined);
      try {
        return cached === undefined ? undefined : parseSongs(cached);
      } catch {
        return undefined;
      }
    },
    initialDataUpdatedAt: 0,
  });
  const downloaded = completedSongs(session!.offline.list());
  const songs = collectionSongs(
    kind === "playlist"
      ? (playlist.data ?? [])
      : offline
        ? downloaded
        : (library.data ?? []),
    kind,
    id,
    offline ? new Set(downloaded.map((s) => s.id)) : undefined,
  );
  const discovery = id === "smart_discover";
  const editable = kind === "playlist" && !smart && !offline;
  const phone = collectionDownloads(songs, session!.offline.list());
  const total = songs.reduce((sum, song) => sum + song.duration, 0);
  async function run(fn: () => Promise<unknown>) {
    if (mutation.current) return;
    mutation.current = true;
    setWorking(true);
    try {
      await fn();
    } catch (e) {
      report(e);
    } finally {
      mutation.current = false;
      setWorking(false);
    }
  }
  async function updateCache(next: Song[]) {
    write(session!.scope, "playlist:" + id, next);
    queryClient.setQueryData(playlistKey, next);
    await queryClient.invalidateQueries({
      queryKey: [session!.scope, "playlists"],
    });
  }
  const current = kind === "playlist" ? playlist : library;
  const header = (
    <View style={{ gap: spacing.md }}>
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}
      >
        <IconButton
          name="chevronLeft"
          label="Back"
          iconSize={28}
          size={40}
          onPress={() => router.back()}
        />
        <Text
          style={[
            type.micro,
            {
              color: colors.faint,
              textTransform: "uppercase",
              flex: 1,
              letterSpacing: 1.4,
            },
          ]}
        >
          {smart
            ? "Collection"
            : discovery
              ? "Discovery"
              : kind === "playlist"
                ? "Playlist"
                : kind === "album"
                  ? "Album"
                  : "Artist"}
        </Text>
        {editable && (
          <IconButton
            name="settings"
            label="Playlist settings"
            onPress={() => setEditing((v) => !v)}
            variant="outline"
            size={40}
          />
        )}
      </View>

      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 14 }}>
        {songs[0] ? (
          <Art song={songs[0]} size={92} radius={12} />
        ) : (
          <View
            style={{
              width: 92,
              height: 92,
              borderRadius: 12,
              backgroundColor: colors.surfaceInset,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="library" size={30} color={colors.faint} />
          </View>
        )}
        <View style={{ flex: 1, gap: 3 }}>
          <Text numberOfLines={2} style={[type.title, { color: colors.text }]}>
            {params.name ?? "Collection"}
          </Text>
          <Text style={[type.meta, { color: colors.muted }]}>
            {songs.length} {songs.length === 1 ? "track" : "tracks"}
            {total > 0 ? ` · ${Math.floor(total / 60)} min` : ""}
          </Text>
          {!!songs[0]?.artist && kind !== "artist" && (
            <Text
              numberOfLines={1}
              style={[type.meta, { color: colors.faint }]}
            >
              {kind === "album" ? songs[0].artist : "Curated on your server"}
            </Text>
          )}
        </View>
      </View>

      {!offline && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingVertical: 2,
          }}
        >
          <Icon
            name="phone"
            size={12}
            color={phone.complete ? colors.accent : colors.faint}
          />
          <Text
            style={[
              type.meta,
              { color: phone.complete ? colors.accent : colors.muted },
            ]}
          >
            {phone.complete} of {phone.total} unique tracks on this phone
            {phone.pending ? ` · ${phone.pending} in progress` : ""}
          </Text>
        </View>
      )}

      <Row>
        <Action
          title="Play"
          icon="play"
          variant="primary"
          disabled={!songs.length || discovery}
          onPress={() => player.select(songs, 0)}
        />
        {!offline && (
          <Action
            title={`Download missing tracks (${phone.missing.length})`}
            icon="download"
            disabled={!phone.missing.length}
            onPress={() =>
              confirm(
                "Download missing tracks?",
                `Store ${phone.missing.length} missing tracks on this phone? Existing completed copies and queued transfers are kept.`,
                () => {
                  session!.offline.enqueue(phone.missing);
                  router.push("/downloads");
                },
              )
            }
          />
        )}
      </Row>

      {discovery && (
        <Text style={[type.meta, { color: colors.muted }]}>
          Choose one suggestion to play it. The suggestion list never autoplays.
        </Text>
      )}
      {offline && kind === "playlist" && (
        <Text style={[type.meta, { color: colors.muted }]}>
          Only completed phone copies are included. Open the playlist online to
          refresh its membership or edit it.
        </Text>
      )}

      {editable && editing && (
        <Card inset padding={spacing.md} style={{ gap: spacing.sm }}>
          <SectionTitle title="Playlist settings" />
          <Field
            label="Playlist name"
            value={name}
            onChange={setName}
            maxLength={256}
          />
          <Row>
            <Action
              title={working ? "Updating…" : "Rename"}
              disabled={working || !name.trim()}
              onPress={() =>
                run(async () => {
                  await session!.api.rest("updatePlaylist", {
                    playlistId: id,
                    name: name.trim(),
                  });
                  await queryClient.invalidateQueries({
                    queryKey: [session!.scope, "playlists"],
                  });
                  router.setParams({ name: name.trim() });
                })
              }
            />
            <Action
              title="Delete playlist"
              danger
              disabled={working}
              onPress={() =>
                confirm(
                  "Delete playlist?",
                  "The playlist is removed. Its server audio and phone downloads remain.",
                  () =>
                    void run(async () => {
                      await session!.api.rest("deletePlaylist", { id });
                      queryClient.removeQueries({ queryKey: playlistKey });
                      await queryClient.invalidateQueries({
                        queryKey: [session!.scope, "playlists"],
                      });
                      router.back();
                    }),
                )
              }
            />
          </Row>
        </Card>
      )}

      {current.isPending && !offline && <Busy label="Loading collection" />}
      {current.isError && !offline && (
        <Banner
          tone="danger"
          title={current.error.message}
          message="Showing any cached tracks."
          action="Retry collection"
          onAction={() => current.refetch()}
        />
      )}
      {editing && editable && (
        <Text
          style={[
            type.micro,
            { color: colors.faint, textTransform: "uppercase" },
          ]}
        >
          Use the row controls below to reorder or remove tracks
        </Text>
      )}
    </View>
  );
  return (
    <Page title="" scroll={false}>
      <SongList
        songs={songs}
        header={header}
        emptyText={
          offline
            ? "No completed phone copies in this collection. For playlists, open them online once to save their track list."
            : current.isPending
              ? "Loading collection…"
              : "This collection has no tracks."
        }
        onPlay={(index) =>
          player.select(
            discovery ? [songs[index]!] : songs,
            discovery ? 0 : index,
          )
        }
        refreshing={!offline && current.isFetching}
        refresh={offline ? undefined : () => void current.refetch()}
        extra={
          editable
            ? (_song, index) => (
                <Row>
                  <Action
                    title="Move up"
                    disabled={working || index === 0}
                    onPress={() =>
                      run(async () => {
                        const next = [...songs];
                        [next[index - 1], next[index]] = [
                          next[index]!,
                          next[index - 1]!,
                        ];
                        await session!.api.movePlaylistTrack(
                          id,
                          index,
                          index - 1,
                          songs.map((song) => song.id),
                        );
                        await updateCache(next);
                      })
                    }
                  />
                  <Action
                    title="Move down"
                    disabled={working || index === songs.length - 1}
                    onPress={() =>
                      run(async () => {
                        const next = [...songs];
                        [next[index + 1], next[index]] = [
                          next[index]!,
                          next[index + 1]!,
                        ];
                        await session!.api.movePlaylistTrack(
                          id,
                          index,
                          index + 1,
                          songs.map((song) => song.id),
                        );
                        await updateCache(next);
                      })
                    }
                  />
                  <Action
                    title="Remove from playlist"
                    danger
                    disabled={working}
                    onPress={() =>
                      run(async () => {
                        await session!.api.removePlaylistTrack(id, index);
                        await updateCache(songs.filter((_, i) => i !== index));
                      })
                    }
                  />
                </Row>
              )
            : undefined
        }
      />
    </Page>
  );
}
