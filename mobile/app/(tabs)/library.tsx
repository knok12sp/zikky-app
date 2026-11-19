import { useState, useEffect, useRef } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import {
  Page,
  Row,
  Busy,
  Field,
  report,
  useTheme,
  Action,
} from "../../src/ui";
import { SongList, Art } from "../../src/components";
import type { Song } from "../../src/api";
import { useSongs, usePlaylists } from "../../src/data";
import { useSession, queryClient } from "../../src/session";
import { watchDownloads, completedSongs } from "../../src/offline";
import { read } from "../../src/db";
import { matchesSong, stringList, genreGroups } from "../../src/library";
import { Chip, Segmented, SectionTitle } from "../../src/kit";
import { Icon } from "../../src/icon";
import { font, radius, spacing, type } from "../../src/theme";

const MODES = ["Songs", "Albums", "Artists", "Genres", "Playlists"] as const;
const SORTS = [
  ["title", "Title"],
  ["artist", "Artist"],
  ["recent", "Recently added"],
  ["played", "Recently played"],
] as const;

function GroupRow({
  title,
  detail,
  marker,
  icon,
  song,
  onPress,
}: {
  title: string;
  detail?: string;
  marker?: string;
  icon?: "library" | "note";
  song?: Song;
  onPress: () => unknown;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: 10,
        paddingHorizontal: 4,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {song ? (
        <Art song={song} size={36} radius={2} />
      ) : (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.sm,
            backgroundColor: colors.surfaceInset,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {marker ? (
            <Text style={[type.numeric, { color: colors.accent, fontSize: 15 }]}>
              {marker}
            </Text>
          ) : (
            <Icon name={icon ?? "library"} size={16} color={colors.faint} />
          )}
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Text
          numberOfLines={2}
          style={[
            type.meta,
            { color: colors.text, fontFamily: font.uiMedium },
          ]}
        >
          {title}
        </Text>
        {!!detail && (
          <Text numberOfLines={1} style={[type.micro, { color: colors.faint }]}>
            {detail}
          </Text>
        )}
      </View>
      <Icon name="chevronRight" size={16} color={colors.faint} />
    </Pressable>
  );
}

export default function Library() {
  const { colors } = useTheme();
  const { session } = useSession();
  const [mode, setMode] = useState<(typeof MODES)[number]>("Songs"),
    [sort, setSort] = useState("title"),
    [offline, setOffline] = useState(false),
    [filter, setFilter] = useState(""),
    [name, setName] = useState(""),
    [creating, setCreating] = useState(false);
  const createPending = useRef(false);
  const [, tick] = useState(0);
  useEffect(() => watchDownloads(() => tick((v) => v + 1)), []);
  const songs = useSongs(sort);
  const playlists = usePlaylists(mode === "Playlists");
  const downloaded = completedSongs(session!.offline.list());
  if (sort === "title" || sort === "artist")
    downloaded.sort((a, b) =>
      (sort === "title" ? a.title : a.artist).localeCompare(
        sort === "title" ? b.title : b.artist,
      ),
    );
  else if (sort === "recent") downloaded.reverse();
  else {
    const played = new Map(
      stringList(read(session!.scope, "local-played", [])).map((id, index) => [
        id,
        index,
      ]),
    );
    downloaded.sort(
      (a, b) => (played.get(a.id) ?? 1e6) - (played.get(b.id) ?? 1e6),
    );
  }
  const data = (offline ? downloaded : (songs.data ?? [])).filter((s) =>
    matchesSong(s, filter),
  );
  const groups: { id?: string; name: string; detail: string; song?: Song }[] =
    mode === "Genres"
      ? genreGroups(data).map((g) => ({ ...g, detail: `${g.count} tracks` }))
      : Array.from(
          new Map(
            data.map((s) =>
              mode === "Albums"
                ? [
                    s.albumId,
                    {
                      id: s.albumId,
                      name: s.album ?? "Singles",
                      detail: s.artist,
                      song: s,
                    },
                  ]
                : [
                    s.artistId,
                    { id: s.artistId, name: s.artist, detail: "", song: s },
                  ],
            ),
          ).values(),
        ).filter((g) => g.id);
  if (sort === "title") groups.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === "artist")
    groups.sort(
      (a, b) =>
        (a.detail || a.name).localeCompare(b.detail || b.name) ||
        a.name.localeCompare(b.name),
    );

  const header = (
    <View style={{ gap: spacing.md }}>
      <Segmented
        options={MODES.map((m) => ({ key: m, title: m }))}
        value={mode}
        onChange={setMode}
      />
      <Field
        label={
          mode === "Playlists" ? "Filter playlists" : "Filter this collection"
        }
        value={filter}
        onChange={setFilter}
        maxLength={256}
      />
      <Row>
        <Chip
          title="Offline only"
          active={offline}
          icon="phone"
          onPress={() => setOffline(!offline)}
          label="Offline only"
        />
        {mode !== "Playlists" &&
          SORTS.map(([key, title]) => (
            <Chip
              key={key}
              title={title}
              active={sort === key}
              onPress={() => setSort(key)}
            />
          ))}
      </Row>
      <Text style={[type.meta, { color: colors.faint }]}>
        {offline
          ? "Completed copies on this phone only"
          : mode === "Playlists"
            ? "Your playlists and smart collections"
            : "Music saved on your server"}
      </Text>
      {mode === "Playlists" && (
        <View style={{ gap: spacing.sm }}>
          <SectionTitle title="New playlist" />
          <Field
            label="New playlist name"
            value={name}
            onChange={setName}
            maxLength={256}
          />
          <Row>
            <Action
              disabled={creating || offline || !name.trim()}
              title={creating ? "Creating…" : "Create playlist"}
              onPress={async () => {
                if (createPending.current || !name.trim() || offline) return;
                createPending.current = true;
                setCreating(true);
                try {
                  await session!.api.rest("createPlaylist", {
                    name: name.trim(),
                  });
                  setName("");
                  await queryClient.invalidateQueries({
                    queryKey: [session!.scope, "playlists"],
                  });
                } catch (e) {
                  report(e);
                } finally {
                  createPending.current = false;
                  setCreating(false);
                }
              }}
              label="Create playlist"
            />
          </Row>
          {offline && (
            <Text style={[type.meta, { color: colors.faint }]}>
              Only completed phone copies are shown when you open a playlist.
            </Text>
          )}
        </View>
      )}
      {songs.isPending && !offline && mode !== "Playlists" && (
        <Busy label="Reading library" />
      )}
      {songs.isError && !offline && mode !== "Playlists" && (
        <View
          style={{
            gap: spacing.sm,
            borderWidth: 1,
            borderRadius: radius.sm,
            borderColor: colors.danger,
            backgroundColor: colors.dangerSoft,
            padding: spacing.md,
          }}
        >
          <Text style={[type.meta, { color: colors.danger }]}>
            {songs.error.message} Cached metadata is shown where available.
          </Text>
          <Row>
            <Chip title="Retry library" onPress={() => songs.refetch()} />
          </Row>
        </View>
      )}
      {mode === "Playlists" && playlists.isPending && (
        <Busy label="Loading playlists" />
      )}
      {mode === "Playlists" && playlists.isError && (
        <View
          style={{
            gap: spacing.sm,
            borderWidth: 1,
            borderRadius: radius.sm,
            borderColor: colors.danger,
            backgroundColor: colors.dangerSoft,
            padding: spacing.md,
          }}
        >
          <Text style={[type.meta, { color: colors.danger }]}>
            Could not refresh playlists. Saved playlists remain available.
          </Text>
          <Row>
            <Chip title="Retry playlists" onPress={() => playlists.refetch()} />
          </Row>
        </View>
      )}
    </View>
  );

  return (
    <Page
      title="Library"
      subtitle={
        offline
          ? "Your offline collection"
          : mode === "Playlists"
            ? "Playlists and smart collections"
            : "Your saved music"
      }
      scroll={false}
    >
      {mode === "Songs" ? (
        <SongList
          songs={data}
          header={header}
          emptyText={
            offline
              ? "No downloaded songs match. Download a track explicitly from its menu."
              : "No saved songs match this filter."
          }
          refreshing={!offline && songs.isFetching}
          refresh={offline ? undefined : () => void songs.refetch()}
        />
      ) : mode === "Playlists" ? (
        <FlatList
          ListHeaderComponent={
            <View style={{ gap: 18, paddingBottom: 10 }}>{header}</View>
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          data={(playlists.data ?? []).filter((p) =>
            p.name.toLocaleLowerCase().includes(filter.toLocaleLowerCase()),
          )}
          keyExtractor={(p) => p.id}
          ItemSeparatorComponent={() => (
            <View
              style={{ height: 1, backgroundColor: colors.border }}
            />
          )}
          ListEmptyComponent={
            <Text
              style={[type.meta, { color: colors.muted, paddingVertical: 20 }]}
            >
              No playlists match.
            </Text>
          }
          refreshing={playlists.isFetching}
          onRefresh={() => void playlists.refetch()}
          renderItem={({ item }) => (
            <GroupRow
              title={item.name}
              detail={`${item.songCount} ${item.songCount === 1 ? "track" : "tracks"}${item.id.startsWith("bridge_") ? " · Smart collection" : ""}`}
              marker={item.id.startsWith("bridge_") ? "✦" : "≡"}
              onPress={() =>
                router.push({
                  pathname: "/collection",
                  params: {
                    kind: "playlist",
                    id: item.id,
                    name: item.name,
                    offline: offline ? "1" : "0",
                  },
                })
              }
            />
          )}
        />
      ) : (
        <FlatList
          ListHeaderComponent={
            <View style={{ gap: 18, paddingBottom: 10 }}>{header}</View>
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          data={groups}
          keyExtractor={(g) => g.id!}
          ItemSeparatorComponent={() => (
            <View
              style={{ height: 1, backgroundColor: colors.border }}
            />
          )}
          ListEmptyComponent={
            <Text
              style={[type.meta, { color: colors.muted, paddingVertical: 20 }]}
            >
              No {offline ? "downloaded" : "saved"} {mode.toLowerCase()} match.
            </Text>
          }
          refreshing={!offline && songs.isFetching}
          onRefresh={offline ? undefined : () => void songs.refetch()}
          renderItem={({ item }) => (
            <GroupRow
              title={item.name + (item.detail ? " · " + item.detail : "")}
              detail={mode === "Genres" ? item.detail : undefined}
              marker={item.name.slice(0, 1).toUpperCase()}
              song={mode === "Genres" ? undefined : item.song}
              onPress={() =>
                router.push({
                  pathname: "/collection",
                  params: {
                    kind:
                      mode === "Genres"
                        ? "genre"
                        : mode === "Albums"
                          ? "album"
                          : "artist",
                    id: item.id!,
                    name: item.name,
                    offline: offline ? "1" : "0",
                  },
                })
              }
            />
          )}
        />
      )}
    </Page>
  );
}
