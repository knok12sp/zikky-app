import { CreatePlaylist, TrackActions } from "./TrackActions";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Art } from "../components";
import { Icon, IconName } from "../icon";
import { Action, Busy, Field, report, useTheme } from "../ui";
import { EmptyState, IconButton, NavGroup, PageHeader, SongTable } from "../kit";
import { usePlaylists, useSongs } from "../data";
import { usePlayback } from "../playback";
import { queryClient, useSession, type Session } from "../session";
import { Playlist, Song, parseSongs } from "../api";
import { matchesSong, genreGroups, genreKey } from "../library";
import { breakpoints, font, radius, spacing, type } from "../theme";
import { DesktopPlayer } from "./DesktopPlayer";
import { DesktopBooks } from "./DesktopBooks";
import { QueuePanel, TransportBar } from "./Transport";

type ViewKey =
  | "home"
  | "songs"
  | "albums"
  | "artists"
  | "genres"
  | "playlists"
  | "favorites"
  | "books"
  | "settings";

type Selection = {
  kind: "album" | "artist" | "playlist" | "genre";
  id: string;
  name: string;
  detail?: string;
} | null;

const NAV: { key: ViewKey; title: string; icon: IconName }[] = [
  { key: "home", title: "Home", icon: "home" },
  { key: "songs", title: "Songs", icon: "note" },
  { key: "albums", title: "Albums", icon: "library" },
  { key: "artists", title: "Artists", icon: "artist" },
  { key: "genres", title: "Genres", icon: "library" },
  { key: "books", title: "Books", icon: "note" },
  { key: "playlists", title: "Playlists", icon: "queue" },
  { key: "favorites", title: "Favorites", icon: "heart" },
];

const NAV_GROUPS: {
  title?: string;
  keys: Exclude<ViewKey, "settings">[];
}[] = [
  { keys: ["home"] },
  { title: "Library", keys: ["songs", "albums", "artists", "genres"] },
  { title: "Collections", keys: ["playlists", "favorites"] },
  { title: "Audiobooks", keys: ["books"] },
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
        gap: 10,
        height: 32,
        paddingHorizontal: 10,
        borderRadius: radius.sm,
        backgroundColor: pressed ? colors.surfaceRaised : "transparent",
      })}
    >
      <View
        style={{
          position: "absolute",
          left: 0,
          top: 7,
          bottom: 7,
          width: 2,
          backgroundColor: active ? colors.accent : "transparent",
        }}
      />
      <Icon
        name={icon}
        size={15}
        color={active ? colors.accent : colors.muted}
      />
      <Text
        style={[
          type.meta,
          {
            color: active ? colors.text : colors.muted,
            fontFamily: active ? font.uiMedium : font.ui,
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
  onDelete,
  showArtist = true,
  showAlbum = true,
  showIndex = true,
}: {
  song: Song;
  index: number;
  playing?: boolean;
  onPlay: () => void;
  onFavorite: () => void;
  onDelete?: () => void;
  showArtist?: boolean;
  showAlbum?: boolean;
  showIndex?: boolean;
}) {
  const { colors } = useTheme();
  const [hover, setHover] = useState(false);
  const tint = playing ? colors.accent : colors.text;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: 1,
        borderColor:
          playing || hover ? colors.borderStrong : colors.border,
        backgroundColor: playing
          ? colors.accentSoft
          : hover
            ? colors.surface
            : "transparent",
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Play ${song.title} by ${song.artist}`}
        onPress={onPlay}
        onHoverIn={() => setHover(true)}
        onHoverOut={() => setHover(false)}
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          minHeight: 48,
          paddingHorizontal: spacing.sm,
          opacity: pressed ? 0.72 : 1,
        })}
      >
        {showIndex && (
          <View style={{ width: 24, alignItems: "center" }}>
            {playing ? (
              <Icon name="play" size={10} color={colors.accent} />
            ) : (
              <Text style={[type.numeric, { color: colors.faint }]}>
                {index + 1}
              </Text>
            )}
          </View>
        )}
        <Art song={song} size={32} radius={radius.sm} />
        <View style={{ flex: 1, minWidth: 120, gap: 1 }}>
          <Text
            numberOfLines={1}
            style={[type.meta, { color: tint, fontFamily: font.uiMedium }]}
          >
            {song.title}
          </Text>
          {showArtist && (
            <Text
              numberOfLines={1}
              style={[type.micro, { color: colors.muted }]}
            >
              {song.artist}
            </Text>
          )}
        </View>
        {showAlbum && (
          <Text
            numberOfLines={1}
            style={[type.meta, { color: colors.faint, flex: 0.7 }]}
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
            gap: 4,
          }}
        >
          {!!song.rating && (
            <>
              <Icon name="starFilled" size={10} color={colors.accent} />
              <Text style={[type.numeric, { color: colors.muted }]}>
                {song.rating}
              </Text>
            </>
          )}
        </View>
        <Text
          style={[
            type.numeric,
            { color: colors.faint, width: 48, textAlign: "right" },
          ]}
        >
          {clock(song.duration)}
        </Text>
      </Pressable>
      <TrackActions song={song} />
      <IconButton
        name={song.starred ? "heartFilled" : "heart"}
        label={song.starred ? "Remove favorite" : "Add favorite"}
        onPress={onFavorite}
        size={28}
        iconSize={13}
        color={song.starred ? colors.accent : hover ? colors.muted : colors.faint}
      />
      {!!onDelete && (
        <IconButton
          name="trash"
          label={`Delete ${song.title} from server`}
          onPress={onDelete}
          size={28}
          iconSize={13}
          color={colors.faint}
        />
      )}
      <View style={{ width: spacing.sm }} />
    </View>
  );
}

function AlbumCard({
  song,
  size = 172,
  onPress,
}: {
  song: Song;
  size?: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const [hover, setHover] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open album ${song.album}`}
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={({ pressed }) => ({
        width: size,
        gap: spacing.sm,
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius.sm,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: hover ? colors.borderStrong : colors.border,
        }}
      >
        <Art song={song} size={size} radius={radius.sm} />
        <View
          style={{
            position: "absolute",
            right: 8,
            bottom: 8,
            width: 26,
            height: 26,
            borderRadius: radius.sm,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.accent,
            opacity: hover ? 1 : 0,
          }}
        >
          <Icon name="play" size={11} color={colors.onAccent} />
        </View>
      </View>
      <View style={{ gap: 1 }}>
        <Text
          numberOfLines={1}
          style={[type.meta, { color: colors.text, fontFamily: font.uiMedium }]}
        >
          {song.album ?? "Singles"}
        </Text>
        <Text numberOfLines={1} style={[type.micro, { color: colors.faint }]}>
          {song.artist}
        </Text>
      </View>
    </Pressable>
  );
}

function SectionHead({
  title,
  aside,
}: {
  title: string;
  aside?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        marginBottom: spacing.lg,
      }}
    >
      <Text
        style={[
          type.micro,
          { color: colors.muted, textTransform: "uppercase" },
        ]}
      >
        {title}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      {aside}
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
  const { width } = useWindowDimensions();
  const albums = useMemo(() => {
    const map = new Map<string, Song[]>();
    for (const song of songs)
      if (song.albumId)
        map.set(song.albumId, [...(map.get(song.albumId) ?? []), song]);
    return [...map.values()].slice(0, 8);
  }, [songs]);
  const favorites = songs.filter((s) => s.starred);
  const now = player.queue.entries[player.queue.index]?.song;
  const hero = now ?? songs[0];
  const heroAlbum = hero?.albumId
    ? songs.find((song) => song.albumId === hero.albumId)
    : undefined;
  const tile = width < 1280 ? 152 : 172;
  const wide = width >= 1280;
  return (
    <View style={{ gap: spacing.xxxl }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: spacing.gutter,
        }}
      >
        <View
          style={{
            flex: 1,
            minWidth: 0,
            gap: spacing.sm,
            paddingBottom: spacing.xs,
          }}
        >
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                backgroundColor:
                  now && player.status.playing ? colors.accent : colors.faint,
              }}
            />
            <Text
              style={[
                type.micro,
                {
                  color:
                    now && player.status.playing
                      ? colors.accent
                      : colors.muted,
                  textTransform: "uppercase",
                },
              ]}
            >
              {now ? (player.status.playing ? "Now playing" : "Paused") : "Ready"}
            </Text>
          </View>
          <Text
            numberOfLines={2}
            style={[type.display, { color: colors.text }]}
          >
            {now ? now.title : "Your library, in one quiet place."}
          </Text>
          <Text
            numberOfLines={1}
            style={[type.body, { color: colors.muted }]}
          >
            {now
              ? now.artist
              : `${songs.length} ${songs.length === 1 ? "track" : "tracks"} · ${playlists.length} playlists on your server`}
          </Text>
          <View style={{ flexDirection: "row", paddingTop: spacing.md }}>
            <Action
              title={
                now
                  ? player.status.playing
                    ? "Pause"
                    : "Resume"
                  : "Shuffle library"
              }
              variant="primary"
              icon={
                now ? (player.status.playing ? "pause" : "play") : "shuffle"
              }
              onPress={() => {
                if (now) {
                  player.toggle();
                  return;
                }
                if (!songs.length) return;
                void player.select(
                  songs,
                  Math.floor(Math.random() * songs.length),
                );
                player.shuffle();
              }}
            />
          </View>
        </View>
        {hero && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open album ${hero.album ?? "Singles"}`}
            disabled={!heroAlbum}
            onPress={() => {
              if (!heroAlbum?.albumId) return;
              onAlbum({
                kind: "album",
                id: heroAlbum.albumId,
                name: heroAlbum.album ?? "Singles",
                detail: heroAlbum.artist,
              });
            }}
            style={({ pressed }) => ({
              width: wide ? 236 : 184,
              gap: spacing.sm,
              opacity: pressed ? 0.72 : 1,
            })}
          >
            <Art song={hero} size={wide ? 236 : 184} radius={radius.sm} />
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  numberOfLines={1}
                  style={[
                    type.meta,
                    { color: colors.text, fontFamily: font.uiMedium },
                  ]}
                >
                  {hero.album ?? hero.title}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[type.micro, { color: colors.faint }]}
                >
                  {now ? now.artist : hero.artist}
                </Text>
              </View>
              <Icon name="chevronRight" size={14} color={colors.faint} />
            </View>
          </Pressable>
        )}
      </View>

      {!!albums.length && (
        <View>
          <SectionHead title="Recently added" />
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: spacing.lg,
            }}
          >
            {albums.map((tracks) => (
              <AlbumCard
                key={tracks[0]!.id}
                song={tracks[0]!}
                size={tile}
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
        </View>
      )}

      <View
        style={{
          flexDirection: "row",
          gap: spacing.gutter,
          alignItems: "flex-start",
        }}
      >
        <View style={{ flex: 1.6, minWidth: 0 }}>
          <SectionHead title="Favorites" />
          {favorites.length ? (
            favorites.slice(0, 6).map((song, i) => (
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
        <View style={{ width: wide ? 340 : 260, minWidth: 0 }}>
          <SectionHead title="Playlists" />
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
                gap: spacing.md,
                minHeight: 48,
                borderRadius: radius.sm,
                borderBottomWidth: 1,
                borderColor: colors.border,
                opacity: pressed ? 0.65 : 1,
              })}
            >
              <Icon
                name={PLAYLIST_ICON[playlist.id] ?? "queue"}
                size={14}
                color={colors.faint}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  numberOfLines={1}
                  style={[
                    type.meta,
                    { color: colors.text, fontFamily: font.uiMedium },
                  ]}
                >
                  {playlist.name}
                </Text>
                <Text style={[type.micro, { color: colors.faint }]}>
                  {playlist.songCount}{" "}
                  {playlist.songCount === 1 ? "TRACK" : "TRACKS"}
                </Text>
              </View>
              <Icon name="chevronRight" size={14} color={colors.faint} />
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
        <Text
          style={[
            type.micro,
            {
              color: colors.faint,
              textTransform: "uppercase",
              paddingTop: spacing.md,
              borderTopWidth: 1,
              borderColor: colors.border,
            },
          ]}
        >
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
  onDelete,
}: {
  selection: NonNullable<Selection>;
  songs: Song[];
  onBack: () => void;
  onDelete?: (songs: Song[]) => void;
}) {
  const { colors } = useTheme();
  const player = usePlayback();
  const { session } = useSession();
  const playlist = useQuery({
    queryKey: [session!.scope, "playlist", selection.id],
    enabled: selection.kind === "playlist",
    queryFn: async () => {
      const data = await session!.api.rest("getPlaylist", {
        id: selection.id,
      });
      return parseSongs(data.playlist?.entry);
    },
  });
  const tracks = selection.kind === "playlist" ? (playlist.data ?? []) : songs;
  const artworkSong = tracks[0];
  const album = selection.kind === "album";
  const artist = selection.kind === "artist";
  const genre = selection.kind === "genre";
  return (
    <View style={{ gap: spacing.xl }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: spacing.gutter,
        }}
      >
        <View
          style={{
            width: 168,
            height: 168,
            borderRadius: radius.sm,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surfaceInset,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {artworkSong ? (
            <Art song={artworkSong} size={168} radius={radius.sm} />
          ) : (
            <Icon
              name={artist ? "artist" : "library"}
              size={40}
              color={colors.faint}
            />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: spacing.sm }}>
          <Text
            style={[
              type.micro,
              { color: colors.faint, textTransform: "uppercase" },
            ]}
          >
            {album ? "Album" : artist ? "Artist" : genre ? "Genre" : "Playlist"}
          </Text>
          <Text
            accessibilityRole="header"
            numberOfLines={2}
            style={[type.hero, { color: colors.text }]}
          >
            {selection.name}
          </Text>
          <Text style={[type.meta, { color: colors.muted }]}>
            {selection.detail ? `${selection.detail} · ` : ""}
            {tracks.length} {tracks.length === 1 ? "track" : "tracks"}
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              gap: spacing.sm,
              paddingTop: spacing.md,
            }}
          >
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
                void player.select(
                  tracks,
                  Math.floor(Math.random() * tracks.length),
                );
                if (!player.queue.shuffle) player.shuffle();
              }}
            />
            <Action
              title="Back"
              icon="chevronLeft"
              variant="ghost"
              onPress={onBack}
            />
            {album && !!onDelete && (
              <Action
                title="Delete album"
                icon="trash"
                danger
                onPress={() => onDelete(tracks)}
              />
            )}
          </View>
        </View>
      </View>
      <View style={{ height: 1, backgroundColor: colors.border }} />
      {playlist.isPending && selection.kind === "playlist" ? (
        <Busy label="Loading playlist" />
      ) : tracks.length ? (
        <SongTable showAlbum={!album} trailing={onDelete ? 116 : 88}>
          {tracks.map((song, i) => (
            <SongRow
              key={song.id}
              song={song}
              index={i}
              onPlay={() => void player.select(tracks, i)}
              onFavorite={() => void toggleStar(session!, song)}
              onDelete={onDelete ? () => onDelete([song]) : undefined}
              showAlbum={!album}
              showArtist={!artist}
            />
          ))}
        </SongTable>
      ) : playlist.isError ? (
        <Text style={[type.body, { color: colors.faint, paddingVertical: 30 }]}>
          This playlist could not be loaded. Refresh and try again.
        </Text>
      ) : (
        <EmptyState title="No tracks here." />
      )}
    </View>
  );
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        gap: spacing.md,
        paddingBottom: spacing.xl,
        borderBottomWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={[type.heading, { color: colors.text }]}>{title}</Text>
      {children}
    </View>
  );
}

function SettingsView({ canManage }: { canManage: boolean }) {
  const { colors, mode, setMode } = useTheme();
  const { session, logout, updateAddresses } = useSession();
  const [alternates, setAlternates] = useState(
    (session?.api.credentials.alternateServers ?? []).join("\n"),
  );
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  return (
    <View style={{ gap: spacing.xl, maxWidth: 720 }}>
      <PageHeader
        title="Settings"
        subtitle="Connection, appearance and library behaviour."
      />
      {!!error && (
        <Text style={[type.meta, { color: colors.danger }]}>{error}</Text>
      )}
      <SettingsSection title="Connection">
        <Text style={[type.micro, { color: colors.muted }]}>
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
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
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
        <Text
          style={[
            type.micro,
            { color: colors.faint, textTransform: "uppercase" },
          ]}
        >
          STREAMING ONLY · NO MUSIC IS STORED ON THIS COMPUTER
        </Text>
      </SettingsSection>
      <SettingsSection title="Appearance">
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
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
      </SettingsSection>
      <SettingsSection title={canManage ? "Server library" : "Your library"}>
        <Text style={[type.meta, { color: colors.muted, maxWidth: 620 }]}>
          {canManage
            ? "This Zikky build can permanently remove tracks and albums from your server library. Deletion is available from track rows, album screens and Now Playing. Phone downloads already stored on other devices are not affected."
            : "This player streams from a standard Subsonic server and never changes its library. Use the full Zikky server installation to manage the music stored there."}
        </Text>
      </SettingsSection>
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
  const [queueOpen, setQueueOpen] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);
  const canManage = false;
  const songs = useSongs();
  const playlists = usePlaylists();
  const all = songs.data ?? [];
  const compact = width < breakpoints.compact;
  const albums = useMemo(() => {
    const map = new Map<string, Song[]>();
    for (const song of all)
      if (song.albumId)
        map.set(song.albumId, [...(map.get(song.albumId) ?? []), song]);
    return [...map.entries()]
      .map(([id, tracks]) => ({
        id,
        tracks,
        name: tracks[0]!.album ?? "Singles",
      }))
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
  const genres = genreGroups(filtered);
  const listedSongs =
    view === "favorites" ? filtered.filter((song) => song.starred) : filtered;
  const plural = (count: number, word: string) =>
    `${count} ${word}${count === 1 ? "" : "s"}`;
  const collectionSubtitle =
    view === "favorites"
      ? "The tracks you keep close."
      : view === "albums"
        ? `${plural(albums.length, "album")} in your library`
        : view === "artists"
          ? `${plural(artists.length, "artist")} in your library`
          : view === "genres"
            ? `${plural(genreGroups(all).length, "genre")} in your library`
            : view === "playlists"
              ? `${plural(playlists.data?.length ?? 0, "playlist")} in your library`
              : `${all.length} tracks in your library`;
  const current = player.queue.entries[player.queue.index]?.song;
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
            : view === "genres"
              ? "Genres"
              : view === "playlists"
                ? "Playlists"
                : view === "favorites"
                  ? "Favorites"
                  : view === "books"
                    ? "Audiobooks"
                      : "Settings";

  const main = (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingHorizontal: compact ? 24 : 40,
        paddingTop: 32,
        paddingBottom: spacing.xxxl,
        gap: spacing.xl,
      }}
    >
      {selection ? (
        <DetailView
          selection={selection}
          songs={
            selection.kind === "album"
              ? all.filter((song) => song.albumId === selection.id)
              : selection.kind === "genre"
                ? all.filter((song) => genreKey(song) === selection.id)
                : all.filter((song) => song.artistId === selection.id)
          }
          onBack={() => setSelection(null)}
        />
      ) : view === "home" ? (
        <View style={{ gap: spacing.xl }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: spacing.xl,
              paddingBottom: spacing.sm,
            }}
          >
            <Text style={[type.micro, { color: colors.muted }]}>
              {session?.api.credentials.username} · your server library
            </Text>
            <Text style={[type.numeric, { color: colors.faint }]}>
              {plural(all.length, "track")} · {plural(albums.length, "album")}
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
        <SettingsView canManage={canManage} />
      ) : (
        <>
          <PageHeader
            title={title}
            subtitle={collectionSubtitle}
            query={query}
            onQuery={setQuery}
            showSearch={view !== "playlists" || !!playlists.data?.length}
          />
          {songs.isPending && !all.length ? (
            <Busy label="Loading your library" />
          ) : songs.isError && !all.length ? (
            <Text style={[type.body, { color: colors.danger }]}>
              Could not load your library. {songs.error?.message}
            </Text>
          ) : view === "albums" ? (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.lg,
              }}
            >
              {albums
                .filter((album) => matchesSong(album.tracks[0]!, query))
                .map((album) => (
                  <AlbumCard
                    key={album.id}
                    song={album.tracks[0]!}
                    size={width < 1280 ? 152 : 172}
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
                      width: width < 1280 ? 152 : 172,
                      gap: spacing.sm,
                      opacity: pressed ? 0.65 : 1,
                    })}
                  >
                    <View
                      style={{
                        width: width < 1280 ? 152 : 172,
                        height: width < 1280 ? 152 : 172,
                        borderRadius: radius.sm,
                        overflow: "hidden",
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Art
                        song={artist.tracks[0]!}
                        size={width < 1280 ? 152 : 172}
                        radius={radius.sm}
                      />
                    </View>
                    <View style={{ gap: 1 }}>
                      <Text
                        numberOfLines={1}
                        style={[
                          type.meta,
                          { color: colors.text, fontFamily: font.uiMedium },
                        ]}
                      >
                        {artist.name}
                      </Text>
                      <Text style={[type.micro, { color: colors.faint }]}>
                        {artist.tracks.length} TRACKS
                      </Text>
                    </View>
                  </Pressable>
                ))}
            </View>
          ) : view === "genres" ? (
            <View>
              {genres.map((group) => (
                <View
                  key={group.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${group.name}, ${plural(group.count, "track")}`}
                    onPress={() =>
                      setSelection({
                        kind: "genre",
                        id: group.id,
                        name: group.name,
                      })
                    }
                    style={({ pressed }) => ({
                      flex: 1,
                      minHeight: 52,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                      opacity: pressed ? 0.65 : 1,
                    })}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        type.meta,
                        {
                          flexShrink: 1,
                          color: colors.text,
                          fontFamily: font.uiMedium,
                        },
                      ]}
                    >
                      {group.name}
                    </Text>
                    <View style={{ flex: 1 }} />
                    <Text style={[type.numeric, { color: colors.faint }]}>
                      {group.count}
                    </Text>
                  </Pressable>
                  <IconButton
                    name="play"
                    label={`Play ${group.name}`}
                    size={28}
                    iconSize={13}
                    color={colors.faint}
                    onPress={() =>
                      void player.select(
                        filtered.filter((song) => genreKey(song) === group.id),
                        0,
                      )
                    }
                  />
                </View>
              ))}
              {!genres.length && (
                <EmptyState
                  icon="note"
                  title={query ? "No genres match" : "No genres yet"}
                  message={
                    query
                      ? "No genres match this search."
                      : "Add genre labels from a track’s options."
                  }
                  action={query ? "Clear search" : "Browse songs"}
                  onAction={() => (query ? setQuery("") : go("songs"))}
                />
              )}
            </View>
          ) : view === "playlists" ? (
            <View style={{ gap: spacing.xl }}>
              <View style={{ maxWidth: 440 }}>
                <CreatePlaylist />
              </View>
              <View>
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
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.md,
                        minHeight: 52,
                        borderBottomWidth: 1,
                        borderColor: colors.border,
                        opacity: pressed ? 0.65 : 1,
                      })}
                    >
                      <Icon
                        name={PLAYLIST_ICON[playlist.id] ?? "queue"}
                        size={15}
                        color={colors.faint}
                      />
                      <Text
                        numberOfLines={1}
                        style={[
                          type.meta,
                          {
                            flex: 1,
                            color: colors.text,
                            fontFamily: font.uiMedium,
                          },
                        ]}
                      >
                        {playlist.name}
                      </Text>
                      <Text style={[type.micro, { color: colors.faint }]}>
                        {playlist.songCount}{" "}
                        {playlist.songCount === 1 ? "TRACK" : "TRACKS"}
                      </Text>
                      <Icon name="chevronRight" size={14} color={colors.faint} />
                    </Pressable>
                  ))}
              </View>
            </View>
          ) : (
            <View style={{ gap: 2 }}>
              {listedSongs.length ? (
                <SongTable trailing={88}>
                  {listedSongs.map((song, i, list) => (
                    <SongRow
                      key={song.id}
                      song={song}
                      index={i}
                      playing={current?.id === song.id}
                      onPlay={() => void player.select(list, i)}
                      onFavorite={() => void toggleStar(session!, song)}
                    />
                  ))}
                </SongTable>
              ) : (
                <EmptyState
                  title="Nothing here"
                  message={
                    query
                      ? "No tracks match this search."
                      : view === "favorites"
                        ? "Favorite a track to find it here."
                        : "Your server library is empty."
                  }
                />
              )}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, flexDirection: "row", minHeight: 0 }}>
      <View
        style={{
          width: 208,
          borderRightWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          paddingHorizontal: 8,
          paddingTop: 18,
          paddingBottom: 12,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 9,
            paddingHorizontal: 10,
            paddingBottom: 22,
          }}
        >
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: radius.sm,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surfaceInset,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="note" size={15} color={colors.accent} />
          </View>
          <View style={{ gap: 1 }}>
            <Text
              style={[
                type.meta,
                {
                  color: colors.text,
                  fontFamily: font.uiBold,
                  letterSpacing: 3.2,
                  fontSize: 13,
                },
              ]}
            >
              ZIKKY
            </Text>
            <Text style={[type.micro, { color: colors.faint, fontSize: 8 }]}>
              DESKTOP PLAYER
            </Text>
          </View>
        </View>
        <ScrollView
          style={{ flex: 1, minHeight: 0 }}
          contentContainerStyle={{ gap: 0 }}
          showsVerticalScrollIndicator={false}
        >
          {NAV_GROUPS.map((group, index) => (
            <NavGroup key={group.title ?? index} title={group.title}>
              {group.keys.map((key) => {
                const item = NAV.find((entry) => entry.key === key)!;
                return (
                  <NavItem
                    key={item.key}
                    title={item.title}
                    icon={item.icon}
                    active={view === item.key && !selection}
                    onPress={() => go(item.key)}
                  />
                );
              })}
            </NavGroup>
          ))}
        </ScrollView>
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
              borderTopWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: 10,
              paddingTop: 10,
              gap: 4,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  backgroundColor: colors.accent,
                }}
              />
              <Text style={[type.micro, { color: colors.accent }]}>
                CONNECTED
              </Text>
            </View>
            <Text
              numberOfLines={1}
              style={[
                type.micro,
                { color: colors.faint, textTransform: "none", fontSize: 10 },
              ]}
            >
              {session?.api.credentials.username} ·{" "}
              {session?.api.activeServer.replace(/^https?:\/\//, "")}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        {/* Kept mounted so an audiobook keeps playing while another view is open. */}
        <ScrollView
          style={{
            flex: 1,
            minHeight: 0,
            display: view === "books" ? "flex" : "none",
          }}
          contentContainerStyle={{
            paddingHorizontal: compact ? 24 : 40,
            paddingTop: 32,
            gap: spacing.xl,
            paddingBottom: spacing.xxxl,
          }}
        >
          <DesktopBooks />
        </ScrollView>
        {view === "books" ? null : main}
      </View>

      </View>

      <TransportBar
        queueOpen={queueOpen}
        onQueue={() => setQueueOpen(!queueOpen)}
        onExpand={() => setPlayerOpen(true)}
      />

      {queueOpen && <QueuePanel onClose={() => setQueueOpen(false)} />}

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
