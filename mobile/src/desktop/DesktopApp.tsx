import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Art } from "../components";
import { Icon, IconName } from "../icon";
import { Action, Busy, Field, report, useTheme } from "../ui";
import { IconButton, PlayButton } from "../kit";
import { usePlaylists, useSongs } from "../data";
import { usePlayback } from "../playback";
import { queryClient, useSession, type Session } from "../session";
import { Playlist, Song, parseSongs } from "../api";
import { matchesSong } from "../library";
import { radius, spacing, type } from "../theme";
import { DesktopPlayer } from "./DesktopPlayer";

type ViewKey =
  | "home"
  | "songs"
  | "albums"
  | "artists"
  | "playlists"
  | "favorites"
  | "settings";

type Selection = {
  kind: "album" | "artist" | "playlist";
  id: string;
  name: string;
  detail?: string;
} | null;

const NAV: { key: ViewKey; title: string; icon: IconName }[] = [
  { key: "home", title: "Home", icon: "home" },
  { key: "songs", title: "Songs", icon: "note" },
  { key: "albums", title: "Albums", icon: "library" },
  { key: "artists", title: "Artists", icon: "artist" },
  { key: "playlists", title: "Playlists", icon: "queue" },
  { key: "favorites", title: "Favorites", icon: "heart" },
];

const PLAYLIST_ICON: Record<string, IconName> = {
  bridge_all: "library",
  bridge_favorites: "heartFilled",
  bridge_top_rated: "starFilled",
  bridge_recent: "clock",
  bridge_played: "play",
  bridge_discover: "sparkle",
};

const clock = (s: number) =>
  `${Math.floor(Math.max(0, s) / 60)}:${String(
    Math.floor(Math.max(0, s) % 60),
  ).padStart(2, "0")}`;

function NavItem({
  title,
  icon,
  active,
  onPress,
}: {
  title: string;
  icon: IconName;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        height: 40,
        paddingHorizontal: 12,
        borderRadius: radius.md,
        backgroundColor: active ? colors.accentSoft : "transparent",
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Icon name={icon} size={17} color={active ? colors.accent : colors.muted} />
      <Text
        style={[
          type.body,
          {
            color: active ? colors.accent : colors.muted,
            fontWeight: active ? "700" : "500",
            fontSize: 14,
          },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

function SongRow({
  song,
  index,
  playing,
  onPlay,
  onFavorite,
  showArtist = true,
  showAlbum = true,
  showIndex = true,
}: {
  song: Song;
  index: number;
  playing?: boolean;
  onPlay: () => void;
  onFavorite: () => void;
  showArtist?: boolean;
  showAlbum?: boolean;
  showIndex?: boolean;
}) {
  const { colors } = useTheme();
  const [hover, setHover] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Play ${song.title} by ${song.artist}`}
      onPress={onPlay}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        minHeight: 54,
        paddingHorizontal: 10,
        borderRadius: radius.sm,
        backgroundColor: pressed
          ? colors.surfaceRaised
          : hover
            ? colors.surface
            : playing
              ? colors.accentSoft
              : "transparent",
      })}
    >
      {showIndex && (
        <View style={{ width: 24, alignItems: "center" }}>
          {playing ? (
            <Icon name="play" size={12} color={colors.accent} />
          ) : (
            <Text style={[type.numeric, { color: colors.faint }]}>
              {index + 1}
            </Text>
          )}
        </View>
      )}
      <Art song={song} size={38} radius={7} />
      <View style={{ flex: 1, minWidth: 120 }}>
        <Text
          numberOfLines={1}
          style={[
            type.body,
            {
              color: playing ? colors.accent : colors.text,
              fontWeight: "600",
              fontSize: 14,
            },
          ]}
        >
          {song.title}
        </Text>
        {showArtist && (
          <Text
            numberOfLines={1}
            style={[type.micro, { color: colors.muted, fontSize: 11 }]}
          >
            {song.artist}
          </Text>
        )}
      </View>
      {showAlbum && (
        <Text
          numberOfLines={1}
          style={[type.meta, { color: colors.faint, flex: 0.7, fontSize: 12 }]}
        >
          {song.album ?? ""}
        </Text>
      )}
      <View
        style={{
          width: 52,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 3,
        }}
      >
        {!!song.rating && (
          <>
            <Icon name="starFilled" size={11} color={colors.accent} />
            <Text style={[type.numeric, { color: colors.muted, fontSize: 10 }]}>
              {song.rating}
            </Text>
          </>
        )}
      </View>
      <Text style={[type.numeric, { color: colors.faint, width: 44 }]}>
        {clock(song.duration)}
      </Text>
      <IconButton
        name={song.starred ? "heartFilled" : "heart"}
        label={song.starred ? "Remove favorite" : "Add favorite"}
        onPress={onFavorite}
        size={30}
        iconSize={14}
        color={song.starred ? colors.accent : colors.faint}
      />
    </Pressable>
  );
}

function AlbumCard({
  song,
  tracks,
  onPress,
}: {
  song: Song;
  tracks: Song[];
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const [hover, setHover] = useState(false);
  const { width } = useWindowDimensions();
  const size = width > 1500 ? 196 : width > 1100 ? 180 : 148;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open album ${song.album}`}
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={({ pressed }) => ({
        width: size,
        gap: 8,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          borderRadius: radius.md,
          overflow: "hidden",
          transform: [{ scale: hover ? 1.015 : 1 }],
        }}
      >
        <Art song={song} size={size} radius={10} />
      </View>
      <View style={{ gap: 1 }}>
        <Text
          numberOfLines={1}
          style={[type.meta, { color: colors.text, fontWeight: "700" }]}
        >
          {song.album ?? "Singles"}
        </Text>
        <Text
          numberOfLines={1}
          style={[type.micro, { color: colors.muted, fontSize: 11 }]}
        >
          {song.artist} · {tracks.length} {tracks.length === 1 ? "track" : "tracks"}
        </Text>
      </View>
    </Pressable>
  );
}

function StandardHeader({
  title,
  subtitle,
  query,
  setQuery,
  showSearch = true,
  children,
}: {
  title: string;
  subtitle?: string;
  query: string;
  setQuery: (v: string) => void;
  showSearch?: boolean;
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const [searchFocused, setSearchFocused] = useState(false);
  return (
    <View style={{ gap: spacing.lg, paddingBottom: spacing.md }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: spacing.xl,
        }}
      >
        <View style={{ gap: 4, flex: 1 }}>
          <Text style={[type.display, { color: colors.text }]}>{title}</Text>
          {!!subtitle && (
            <Text style={[type.meta, { color: colors.muted }]}>{subtitle}</Text>
          )}
        </View>
        {showSearch && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              width: 290,
              height: 42,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: searchFocused ? colors.accent : colors.border,
              backgroundColor: colors.surface,
              paddingHorizontal: 14,
            }}
          >
            <Icon name="search" size={16} color={colors.faint} />
            <TextInput
              accessibilityLabel={`Search ${title.toLowerCase()}`}
              placeholder="Search this view"
              placeholderTextColor={colors.faint}
              value={query}
              onChangeText={setQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              style={{
                flex: 1,
                color: colors.text,
                fontSize: 14,
                ...(Platform.OS === "web"
                  ? {
                      outlineStyle: "solid" as const,
                      outlineWidth: 0,
                      outlineColor: "transparent",
                    }
                  : {}),
              }}
            />
            {!!query && (
              <IconButton
                name="close"
                label="Clear search"
                onPress={() => setQuery("")}
                size={24}
                iconSize={12}
              />
            )}
          </View>
        )}
      </View>
      {children}
    </View>
  );
}

function HomeView({
  songs,
  playlists,
  onAlbum,
  onPlaylist,
}: {
  songs: Song[];
  playlists: Playlist[];
  onAlbum: (value: NonNullable<Selection>) => void;
  onPlaylist: (value: NonNullable<Selection>) => void;
}) {
  const { colors } = useTheme();
  const player = usePlayback();
  const { session } = useSession();
  const recent = useSongs("recent");
  const albums = useMemo(() => {
    const map = new Map<string, Song[]>();
    for (const song of songs)
      if (song.albumId) map.set(song.albumId, [...(map.get(song.albumId) ?? []), song]);
    return [...map.values()].slice(0, 8);
  }, [songs]);
  const favorites = songs.filter((s) => s.starred).slice(0, 6);
  const now = player.queue.entries[player.queue.index]?.song;
  return (
    <View style={{ gap: 34 }}>
      <View
        style={{
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          padding: 28,
          flexDirection: "row",
          alignItems: "center",
          gap: 24,
        }}
      >
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={[type.micro, { color: colors.accent }]}>
            {now ? (player.status.playing ? "NOW PLAYING" : "PAUSED") : "READY"}
          </Text>
          <Text
            style={{
              color: colors.text,
              fontSize: 34,
              lineHeight: 40,
              fontWeight: "800",
              letterSpacing: -1.2,
            }}
          >
            {now ? now.title : "Your library, in one quiet place."}
          </Text>
          <Text style={[type.body, { color: colors.muted }]}>
            {now
              ? now.artist
              : `${songs.length} ${songs.length === 1 ? "track" : "tracks"} · ${playlists.length} playlists on your server`}
          </Text>
          <View style={{ flexDirection: "row", gap: 10, paddingTop: 8 }}>
            <Action
              title={
                now
                  ? player.status.playing
                    ? "Pause"
                    : "Resume"
                  : "Shuffle library"
              }
              variant="primary"
              icon={now ? (player.status.playing ? "pause" : "play") : "shuffle"}
              onPress={() => {
                if (now) {
                  player.toggle();
                  return;
                }
                if (!songs.length) return;
                void player.select(songs, Math.floor(Math.random() * songs.length));
              }}
            />
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {songs.slice(0, 3).map((song, i) => (
            <View
              key={song.id}
              style={{
                transform: [{ rotate: `${(i - 1) * 3}deg` }],
                opacity: 0.9 - i * 0.12,
              }}
            >
              <Art song={song} size={i === 1 ? 130 : 100} radius={12} />
            </View>
          ))}
        </View>
      </View>

      {!!albums.length && (
        <View style={{ gap: 14 }}>
          <Text style={[type.micro, { color: colors.muted }]}>
            RECENTLY ADDED
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 18 }}>
              {albums.map((tracks) => (
                <AlbumCard
                  key={tracks[0]!.id}
                  song={tracks[0]!}
                  tracks={tracks}
                  onPress={() =>
                    onAlbum({
                      kind: "album",
                      id: tracks[0]!.albumId!,
                      name: tracks[0]!.album ?? "Singles",
                      detail: tracks[0]!.artist,
                    })
                  }
                />
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      <View style={{ flexDirection: "row", gap: 30, alignItems: "flex-start" }}>
        <View style={{ flex: 1, gap: 10 }}>
          <Text style={[type.micro, { color: colors.muted }]}>FAVORITES</Text>
          {favorites.length ? (
            favorites.map((song, i) => (
              <SongRow
                key={song.id}
                song={song}
                index={i}
                showIndex={false}
                showAlbum={false}
                onPlay={() => void player.select(favorites, i)}
                onFavorite={() => void toggleStar(session!, song)}
              />
            ))
          ) : (
            <Text style={[type.meta, { color: colors.faint }]}>
              Tracks you favorite appear here.
            </Text>
          )}
        </View>
        <View style={{ width: 340, gap: 10 }}>
          <Text style={[type.micro, { color: colors.muted }]}>PLAYLISTS</Text>
          {playlists.slice(0, 6).map((playlist) => (
            <Pressable
              key={playlist.id}
              accessibilityRole="button"
              accessibilityLabel={`Open playlist ${playlist.name}`}
              onPress={() =>
                onPlaylist({
                  kind: "playlist",
                  id: playlist.id,
                  name: playlist.name,
                })
              }
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                padding: 10,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                opacity: pressed ? 0.65 : 1,
              })}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 9,
                  backgroundColor: colors.accentSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon
                  name={PLAYLIST_ICON[playlist.id] ?? "queue"}
                  size={16}
                  color={colors.accent}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={1}
                  style={[type.meta, { color: colors.text, fontWeight: "700" }]}
                >
                  {playlist.name}
                </Text>
                <Text style={[type.micro, { color: colors.faint }]}>
                  {playlist.songCount}{" "}
                  {playlist.songCount === 1 ? "TRACK" : "TRACKS"}
                </Text>
              </View>
              <Icon name="chevronRight" size={16} color={colors.faint} />
            </Pressable>
          ))}
          {!playlists.length && (
            <Text style={[type.meta, { color: colors.faint }]}>
              No playlists yet.
            </Text>
          )}
        </View>
      </View>
      {!!recent.data?.length && (
        <Text style={[type.micro, { color: colors.faint }]}>
          {recent.data.length} TRACKS IN YOUR LIBRARY
        </Text>
      )}
    </View>
  );
}

async function toggleStar(session: Session, song: Song) {
  try {
    await session.api.rest(song.starred ? "unstar" : "star", { id: song.id });
    await queryClient.invalidateQueries({ queryKey: [session.scope] });
  } catch (e) {
    report(e);
  }
}

function DetailView({
  selection,
  songs,
  onBack,
}: {
  selection: NonNullable<Selection>;
  songs: Song[];
  onBack: () => void;
}) {
  const { colors } = useTheme();
  const player = usePlayback();
  const { session } = useSession();
  const playlist = useQuery({
    queryKey: [session!.scope, "playlist", selection.id],
    enabled: selection.kind === "playlist",
    queryFn: async ({ signal }) => {
      const data = await session!.api.rest("getPlaylist", {
        id: selection.id,
      });
      return parseSongs(data.playlist?.entry);
    },
  });
  const tracks =
    selection.kind === "playlist" ? (playlist.data ?? []) : songs;
  const [filter, setFilter] = useState("");
  const visible = tracks.filter((song) => matchesSong(song, filter));
  const artworkSong = tracks[0];
  const album = selection.kind === "album";
  const artist = selection.kind === "artist";
  return (
    <View style={{ gap: spacing.lg }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: spacing.xxl,
          paddingBottom: spacing.lg,
        }}
      >
        <View
          style={{
            width: 200,
            height: 200,
            borderRadius: artist ? 100 : 16,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceInset,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {artworkSong ? (
            <Art song={artworkSong} size={200} radius={artist ? 100 : 16} />
          ) : (
            <Icon name={artist ? "artist" : "library"} size={54} color={colors.faint} />
          )}
        </View>
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={[type.micro, { color: colors.faint }]}>
            {album ? "ALBUM" : artist ? "ARTIST" : "PLAYLIST"}
          </Text>
          <Text
            accessibilityRole="header"
            style={{
              color: colors.text,
              fontSize: 40,
              lineHeight: 46,
              fontWeight: "800",
              letterSpacing: -1.4,
            }}
          >
            {selection.name}
          </Text>
          <Text style={[type.meta, { color: colors.muted }]}>
            {selection.detail ? `${selection.detail} · ` : ""}
            {tracks.length} {tracks.length === 1 ? "track" : "tracks"}
          </Text>
          <View style={{ flexDirection: "row", gap: 10, paddingTop: 8 }}>
            <Action
              title="Play"
              variant="primary"
              icon="play"
              disabled={!tracks.length}
              onPress={() => void player.select(tracks, 0)}
            />
            <Action
              title="Shuffle"
              icon="shuffle"
              disabled={!tracks.length}
              onPress={() => {
                if (!tracks.length) return;
                void player.select(tracks, Math.floor(Math.random() * tracks.length));
                if (!player.queue.shuffle) player.shuffle();
              }}
            />
            <Action title="Back" icon="chevronLeft" variant="ghost" onPress={onBack} />

          </View>
        </View>
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          borderBottomWidth: 1,
          borderColor: colors.border,
          paddingBottom: 8,
        }}
      >
        <Text style={[type.micro, { color: colors.faint, width: 34 }]}>#</Text>
        <Text style={[type.micro, { color: colors.faint, flex: 1 }]}>TITLE</Text>
        <Text style={[type.micro, { color: colors.faint, width: 52 }]}>
          RATING
        </Text>
        <Text style={[type.micro, { color: colors.faint, width: 44 }]}>TIME</Text>
        <View style={{ width: 70 }} />
      </View>
      {playlist.isPending && selection.kind === "playlist" ? (
        <Busy label="Loading playlist" />
      ) : visible.length ? (
        visible.map((song, i) => (
          <SongRow
            key={song.id}
            song={song}
            index={i}
            onPlay={() => void player.select(visible, i)}
            onFavorite={() => void toggleStar(session!, song)}
            showAlbum={!album}
            showArtist={!artist}
          />
        ))
      ) : (
        <Text style={[type.body, { color: colors.faint, paddingVertical: 30 }]}>
          {playlist.isError
            ? "This playlist could not be loaded. Refresh and try again."
            : "No tracks here."}
        </Text>
      )}
    </View>
  );
}

function SettingsView() {
  const { colors, mode, setMode } = useTheme();
  const { session, logout, updateAddresses } = useSession();
  const [alternates, setAlternates] = useState(
    (session?.api.credentials.alternateServers ?? []).join("\n"),
  );
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  return (
    <View style={{ gap: spacing.xl, maxWidth: 820 }}>
      <StandardHeader
        title="Settings"
        subtitle="Connection, appearance and library behaviour."
        query=""
        setQuery={() => {}}
        showSearch={false}
      />
      {!!error && (
        <Text style={[type.meta, { color: colors.danger }]}>{error}</Text>
      )}
      <View
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.lg,
          backgroundColor: colors.surface,
          padding: spacing.xl,
          gap: spacing.md,
        }}
      >
        <Text style={[type.heading, { color: colors.text }]}>Connection</Text>
        <Text style={[type.meta, { color: colors.muted }]}>
          {session?.api.credentials.username} · {session?.api.activeServer}
        </Text>
        <Field
          label="Alternate server addresses (one per line)"
          value={alternates}
          onChange={setAlternates}
          multiline
          maxLength={2048}
          placeholder="http://192.168.1.10:8787"
        />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Action
            title={busy === "addresses" ? "Testing…" : "Save addresses"}
            disabled={!!busy}
            onPress={async () => {
              setBusy("addresses");
              setError("");
              try {
                await updateAddresses(alternates);
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy("");
              }
            }}
          />
          <Action
            title="Sign out"
            danger
            disabled={!!busy}
            onPress={() => void logout()}
          />
        </View>
        <Text style={[type.micro, { color: colors.faint }]}>
          STREAMING ONLY · NO MUSIC IS STORED ON THIS COMPUTER
        </Text>
      </View>
      <View
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.lg,
          backgroundColor: colors.surface,
          padding: spacing.xl,
          gap: spacing.md,
        }}
      >
        <Text style={[type.heading, { color: colors.text }]}>Appearance</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {["system", "dark", "light"].map((value) => (
            <Action
              key={value}
              title={value[0]!.toUpperCase() + value.slice(1)}
              selected={mode === value}
              onPress={() => setMode(value)}
            />
          ))}
        </View>
        <Text style={[type.meta, { color: colors.muted }]}>
          System follows your desktop appearance automatically.
        </Text>
      </View>
      <View
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.lg,
          backgroundColor: colors.surface,
          padding: spacing.xl,
          gap: spacing.sm,
        }}
      >
        <Text style={[type.heading, { color: colors.text }]}>Your library</Text>
        <Text style={[type.meta, { color: colors.muted }]}>
          This player streams from a standard Subsonic server and never changes
          its library. Use the full Zikky server installation to manage the
          music stored there.
        </Text>
      </View>
    </View>
  );
}

export function DesktopApp() {
  const { colors } = useTheme();
  const { session } = useSession();
  const player = usePlayback();
  const { width } = useWindowDimensions();
  const [view, setView] = useState<ViewKey>("home");
  const [selection, setSelection] = useState<Selection>(null);
  const [query, setQuery] = useState("");
  const [queueOpen, setQueueOpen] = useState(width >= 1280);
  useEffect(() => {
    if (width < 1280) setQueueOpen(false);
  }, [width]);
  const [playerOpen, setPlayerOpen] = useState(false);
  const songs = useSongs();
  const playlists = usePlaylists();
  const all = songs.data ?? [];
  const compact = width < 1120;
  const persistentQueue = queueOpen && width >= 1280;
  const albums = useMemo(() => {
    const map = new Map<string, Song[]>();
    for (const song of all)
      if (song.albumId)
        map.set(song.albumId, [...(map.get(song.albumId) ?? []), song]);
    return [...map.entries()]
      .map(([id, tracks]) => ({ id, tracks, name: tracks[0]!.album ?? "Singles" }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [all]);
  const artists = useMemo(() => {
    const map = new Map<string, Song[]>();
    for (const song of all)
      if (song.artistId)
        map.set(song.artistId, [...(map.get(song.artistId) ?? []), song]);
    return [...map.entries()]
      .map(([id, tracks]) => ({ id, tracks, name: tracks[0]!.artist }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [all]);

  function go(next: ViewKey) {
    setView(next);
    setSelection(null);
    setQuery("");
  }

  const filtered = all.filter((song) => matchesSong(song, query));
  const current = player.queue.entries[player.queue.index]?.song;
  const libraryCurrent = current
    ? all.find((song) => song.id === current.id)
    : undefined;
  const currentStarred = libraryCurrent
    ? !!libraryCurrent.starred
    : !!current?.starred;
  const title = selection
    ? selection.name
    : view === "home"
      ? "Home"
      : view === "songs"
        ? "Songs"
        : view === "albums"
          ? "Albums"
          : view === "artists"
            ? "Artists"
            : view === "playlists"
              ? "Playlists"
              : view === "favorites"
                ? "Favorites"
                : "Settings";

  const main = (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingHorizontal: compact ? 26 : 38,
        paddingTop: 26,
        paddingBottom: 120,
        gap: spacing.lg,
      }}
    >
      {selection ? (
        <DetailView
          selection={selection}
          songs={
            selection.kind === "album"
              ? all.filter((song) => song.albumId === selection.id)
              : all.filter((song) => song.artistId === selection.id)
          }
          onBack={() => setSelection(null)}
        />
      ) : view === "home" ? (
        <View style={{ gap: spacing.xl }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: spacing.xl,
            }}
          >
            <View style={{ gap: 4, flex: 1 }}>
              <Text style={[type.display, { color: colors.text }]}>Home</Text>
              <Text style={[type.meta, { color: colors.muted }]}>
                {session?.api.credentials.username} · your server library
              </Text>
            </View>
            <Text style={[type.meta, { color: colors.muted }]}>
              {all.length} tracks · {albums.length} albums
            </Text>
          </View>
          {songs.isPending && !all.length ? (
            <Busy label="Loading your library" />
          ) : songs.isError && !all.length ? (
            <Text style={[type.body, { color: colors.danger }]}>
              Could not load your library. {songs.error?.message}
            </Text>
          ) : (
            <HomeView
              songs={all}
              playlists={playlists.data ?? []}
              onAlbum={setSelection}
              onPlaylist={setSelection}
            />
          )}
        </View>
      ) : view === "settings" ? (
        <SettingsView />
      ) : (
        <>
          <StandardHeader
            title={title}
            subtitle={
              view === "favorites"
                ? "The tracks you keep close."
                : `${all.length} tracks in your library`
            }
            query={query}
            setQuery={setQuery}
            showSearch={view !== "playlists" || !!playlists.data?.length}
          />
          {songs.isPending && !all.length ? (
            <Busy label="Loading your library" />
          ) : songs.isError && !all.length ? (
            <Text style={[type.body, { color: colors.danger }]}>
              Could not load your library. {songs.error?.message}
            </Text>
          ) : view === "albums" ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 22 }}>
              {albums
                .filter((album) =>
                  matchesSong(album.tracks[0]!, query),
                )
                .map((album) => (
                  <AlbumCard
                    key={album.id}
                    song={album.tracks[0]!}
                    tracks={album.tracks}
                    onPress={() =>
                      setSelection({
                        kind: "album",
                        id: album.id,
                        name: album.name,
                        detail: album.tracks[0]!.artist,
                      })
                    }
                  />
                ))}
            </View>
          ) : view === "artists" ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 26 }}>
              {artists
                .filter((artist) => matchesSong(artist.tracks[0]!, query))
                .map((artist) => (
                  <Pressable
                    key={artist.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Open artist ${artist.name}`}
                    onPress={() =>
                      setSelection({
                        kind: "artist",
                        id: artist.id,
                        name: artist.name,
                      })
                    }
                    style={({ pressed }) => ({
                      width: 156,
                      alignItems: "center",
                      gap: 9,
                      opacity: pressed ? 0.65 : 1,
                    })}
                  >
                    <View
                      style={{
                        width: 140,
                        height: 140,
                        borderRadius: 70,
                        overflow: "hidden",
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Art song={artist.tracks[0]!} size={140} radius={70} />
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[type.meta, { color: colors.text, fontWeight: "700" }]}
                    >
                      {artist.name}
                    </Text>
                    <Text style={[type.micro, { color: colors.faint }]}>
                      {artist.tracks.length} TRACKS
                    </Text>
                  </Pressable>
                ))}
            </View>
          ) : view === "playlists" ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
              {(playlists.data ?? [])
                .filter((playlist) =>
                  playlist.name.toLowerCase().includes(query.toLowerCase()),
                )
                .map((playlist) => (
                  <Pressable
                    key={playlist.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Open playlist ${playlist.name}`}
                    onPress={() =>
                      setSelection({
                        kind: "playlist",
                        id: playlist.id,
                        name: playlist.name,
                        detail: "Playlist",
                      })
                    }
                    style={({ pressed }) => ({
                      width: 250,
                      padding: spacing.lg,
                      gap: 22,
                      borderRadius: radius.lg,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                      opacity: pressed ? 0.65 : 1,
                    })}
                  >
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        backgroundColor: colors.accentSoft,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon
                        name={PLAYLIST_ICON[playlist.id] ?? "queue"}
                        size={20}
                        color={colors.accent}
                      />
                    </View>
                    <View>
                      <Text
                        numberOfLines={1}
                        style={[type.body, { color: colors.text, fontWeight: "700" }]}
                      >
                        {playlist.name}
                      </Text>
                      <Text style={[type.micro, { color: colors.faint }]}>
                        {playlist.songCount}{" "}
                        {playlist.songCount === 1 ? "TRACK" : "TRACKS"}
                      </Text>
                    </View>
                  </Pressable>
                ))}
            </View>
          ) : (
            <View style={{ gap: 2 }}>
              {(view === "favorites"
                ? filtered.filter((song) => song.starred)
                : filtered
              ).map((song, i, list) => (
                <SongRow
                  key={song.id}
                  song={song}
                  index={i}
                  playing={current?.id === song.id}
                  onPlay={() => void player.select(list, i)}
                  onFavorite={() => void toggleStar(session!, song)}
                />
              ))}
              {!filtered.length && (
                <View style={{ alignItems: "center", paddingVertical: 80, gap: 8 }}>
                  <Icon name="note" size={34} color={colors.faint} />
                  <Text style={[type.heading, { color: colors.text }]}>
                    Nothing here
                  </Text>
                  <Text style={[type.meta, { color: colors.muted }]}>
                    {query
                      ? "No tracks match this search."
                      : view === "favorites"
                        ? "Favorite a track to find it here."
                        : "Your server library is empty."}
                  </Text>
                </View>
              )}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, flexDirection: "row" }}>
      <View
        style={{
          width: 224,
          borderRightWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          paddingHorizontal: 12,
          paddingTop: 18,
          paddingBottom: 14,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 10,
            paddingBottom: 20,
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              backgroundColor: colors.accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="note" size={18} color={colors.onAccent} />
          </View>
          <View>
            <Text
              style={{
                color: colors.text,
                fontSize: 16,
                fontWeight: "800",
                letterSpacing: 2.4,
              }}
            >
              ZIKKY
            </Text>
            <Text style={[type.micro, { color: colors.faint, fontSize: 8 }]}>
              DESKTOP PLAYER
            </Text>
          </View>
        </View>
        <View style={{ gap: 3 }}>
          {NAV.map((item) => (
            <NavItem
              key={item.key}
              title={item.title}
              icon={item.icon}
              active={view === item.key && !selection}
              onPress={() => go(item.key)}
            />
          ))}

        </View>
        <View style={{ flex: 1 }} />
        <View style={{ gap: 3 }}>
          <NavItem
            title="Settings"
            icon="settings"
            active={view === "settings" && !selection}
            onPress={() => go("settings")}
          />
          <View
            style={{
              marginTop: 10,
              paddingHorizontal: 10,
              paddingVertical: 10,
              borderRadius: radius.md,
              backgroundColor: colors.surfaceInset,
              gap: 3,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: colors.accent,
                }}
              />
              <Text style={[type.micro, { color: colors.accent }]}>
                CONNECTED
              </Text>
            </View>
            <Text
              numberOfLines={1}
              style={[type.micro, { color: colors.faint, textTransform: "none" }]}
            >
              {session?.api.credentials.username} ·{" "}
              {session?.api.activeServer.replace(/^https?:\/\//, "")}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>{main}</View>

      {queueOpen && !persistentQueue && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close queue"
          onPress={() => setQueueOpen(false)}
          style={{
            position: "absolute",
            top: 0,
            left: 224,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(3,7,4,0.5)",
            zIndex: 19,
          }}
        />
      )}
      {queueOpen && (
        <View
          style={{
            width: 310,
            borderLeftWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: 16,
            gap: 10,
            ...(persistentQueue
              ? {}
              : {
                  position: "absolute",
                  top: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 20,
                  shadowColor: "#000",
                  shadowOpacity: 0.35,
                  shadowRadius: 24,
                  shadowOffset: { width: -12, height: 0 },
                  elevation: 16,
                }),
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View>
              <Text style={[type.micro, { color: colors.muted }]}>QUEUE</Text>
              <Text style={[type.meta, { color: colors.faint }]}>
                {player.queue.entries.length} tracks
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 2 }}>
              {!!player.queue.entries.length && (
                <IconButton
                  name="close"
                  label="Clear queue"
                  onPress={() => void player.clear()}
                  size={30}
                  iconSize={13}
                  color={colors.faint}
                />
              )}
              <IconButton
                name="chevronRight"
                label="Close queue"
                onPress={() => setQueueOpen(false)}
                size={30}
                iconSize={15}
              />
            </View>
          </View>
          <ScrollView contentContainerStyle={{ gap: 4, paddingBottom: 90 }}>
            {player.queue.entries.map((entry, index) => (
              <Pressable
                key={entry.key}
                accessibilityRole="button"
                accessibilityLabel={`Play ${entry.song.title}`}
                onPress={() => player.skip(index)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 9,
                  padding: 7,
                  borderRadius: radius.sm,
                  backgroundColor:
                    index === player.queue.index
                      ? colors.accentSoft
                      : pressed
                        ? colors.surfaceRaised
                        : "transparent",
                })}
              >
                <Art song={entry.song} size={34} radius={6} />
                <View style={{ flex: 1 }}>
                  <Text
                    numberOfLines={1}
                    style={[
                      type.meta,
                      {
                        color:
                          index === player.queue.index
                            ? colors.accent
                            : colors.text,
                        fontWeight: "600",
                        fontSize: 12,
                      },
                    ]}
                  >
                    {entry.song.title}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[type.micro, { color: colors.muted, fontSize: 10 }]}
                  >
                    {entry.song.artist}
                  </Text>
                </View>
                <IconButton
                  name="close"
                  label={`Remove ${entry.song.title} from queue`}
                  onPress={() => void player.remove(index)}
                  size={22}
                  iconSize={10}
                  color={colors.faint}
                />
              </Pressable>
            ))}
            {!player.queue.entries.length && (
              <Text style={[type.meta, { color: colors.faint }]}>
                Nothing queued. Play a track to start.
              </Text>
            )}
          </ScrollView>
        </View>
      )}

      {!!current && (
        <View
          style={{
            position: "absolute",
            left: 224,
            right: persistentQueue ? 310 : 0,
            bottom: 0,
            height: 78,
            borderTopWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 18,
            gap: 16,
          }}
        >
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 2,
              backgroundColor: colors.border,
            }}
          >
            <View
              style={{
                height: 2,
                width: `${Math.min(100, (player.status.currentTime / Math.max(1, player.status.duration)) * 100)}%`,
                backgroundColor: colors.accent,
              }}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open full-screen player"
            onPress={() => setPlayerOpen(true)}
            style={{ flexDirection: "row", alignItems: "center", gap: 11, width: 300 }}
          >
            <Art song={current} size={50} radius={8} />
            <View style={{ flex: 1 }}>
              <Text
                numberOfLines={1}
                style={[type.body, { color: colors.text, fontWeight: "700", fontSize: 14 }]}
              >
                {current.title}
              </Text>
              <Text
                numberOfLines={1}
                style={[type.micro, { color: colors.muted, fontSize: 11 }]}
              >
                {current.artist}
              </Text>
            </View>
          </Pressable>
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <IconButton
              name={currentStarred ? "heartFilled" : "heart"}
              label={currentStarred ? "Remove favorite" : "Add favorite"}
              onPress={() => void toggleStar(session!, current)}
              size={32}
              iconSize={15}
              color={currentStarred ? colors.accent : colors.muted}
            />
            <IconButton
              name="previous"
              label="Previous track"
              onPress={player.previous}
              size={34}
              iconSize={16}
            />
            <PlayButton
              playing={player.status.playing}
              busy={!!player.busy}
              onPress={player.toggle}
              size={42}
            />
            <IconButton
              name="next"
              label="Next track"
              onPress={player.next}
              size={34}
              iconSize={16}
            />
            <Text
              numberOfLines={1}
              style={[type.numeric, { color: colors.faint, marginLeft: 8, width: 84, flexShrink: 0 }]}
            >
              {clock(player.status.currentTime)} / {clock(player.status.duration)}
            </Text>
          </View>
          <View
            style={{
              width: 190,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 2,
            }}
          >
            <IconButton
              name={player.volume === 0 ? "volumeOff" : "volume"}
              label={player.volume === 0 ? "Unmute" : "Mute"}
              onPress={() => player.setVolume(player.volume === 0 ? 0.7 : 0)}
              size={30}
              iconSize={14}
              color={colors.muted}
            />
            <IconButton
              name="queue"
              label={queueOpen ? "Hide queue" : "Show queue"}
              active={queueOpen}
              onPress={() => setQueueOpen(!queueOpen)}
              size={34}
              iconSize={16}
            />
            <IconButton
              name="chevronDown"
              label="Open full-screen player"
              onPress={() => setPlayerOpen(true)}
              rotate={180}
              size={34}
              iconSize={17}
            />
          </View>
        </View>
      )}

      {playerOpen && (
        <DesktopPlayer
          onClose={() => setPlayerOpen(false)}
          onQueue={() => {
            setQueueOpen(true);
            setPlayerOpen(false);
          }}
        />
      )}

    </View>
  );
}
