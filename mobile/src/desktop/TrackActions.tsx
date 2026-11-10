import { useRef, useState } from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import type { Song } from "../api";
import { usePlaylists } from "../data";
import { GenreEditor } from "../genre";
import { IconButton } from "../kit";
import { usePlayback } from "../playback";
import { queryClient, useSession } from "../session";
import { spacing, radius, type } from "../theme";
import { Action, Field, useTheme } from "../ui";

export function CreatePlaylist({ song }: { song?: Song }) {
  const { session } = useSession();
  const { colors } = useTheme();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  async function create() {
    if (pending.current || !name.trim()) return;
    pending.current = true;
    setBusy(true);
    setMessage("");
    try {
      await session!.api.rest("createPlaylist", {
        name: name.trim(),
        ...(song ? { songId: [song.id] } : {}),
      });
      setName("");
      await queryClient.invalidateQueries({
        queryKey: [session!.scope, "playlists"],
      });
      setMessage("Playlist created");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not create playlist",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: spacing.sm, maxWidth: 440, width: "100%" }}>
      <Field
        label="New playlist name"
        value={name}
        onChange={setName}
        maxLength={256}
      />
      <Action
        title={busy ? "Creating…" : "Create playlist"}
        disabled={busy || !name.trim()}
        onPress={() => void create()}
      />
      {!!message && (
        <Text
          accessibilityLiveRegion="polite"
          style={[type.meta, { color: colors.text }]}
        >
          {message}
        </Text>
      )}
    </View>
  );
}

export function TrackActions({ song }: { song: Song }) {
  const { session } = useSession();
  const { colors } = useTheme();
  const player = usePlayback();
  const [open, setOpen] = useState(false);
  const playlists = usePlaylists(open);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  async function add(id: string) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage("");
    try {
      await session!.api.rest("updatePlaylist", {
        playlistId: id,
        songIdToAdd: song.id,
      });
      await queryClient.invalidateQueries({ queryKey: [session!.scope] });
      setMessage("Added to playlist");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add song");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <IconButton
        name="more"
        label={`Options for ${song.title}`}
        onPress={() => setOpen(true)}
        size={40}
      />
      <Modal visible={open} transparent onRequestClose={() => setOpen(false)}>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.65)",
            alignItems: "center",
            justifyContent: "center",
            padding: spacing.lg,
          }}
        >
          <ScrollView
            style={{
              maxHeight: "90%",
              width: "100%",
              maxWidth: 520,
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
            }}
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          >
            <Text
              accessibilityRole="header"
              style={[type.heading, { color: colors.text }]}
            >
              {song.title}
            </Text>
            <Action
              title="Close track options"
              onPress={() => setOpen(false)}
            />
            <Action
              title="Play next"
              onPress={() => {
                void player.enqueue(song, true);
                setOpen(false);
              }}
            />
            <Action
              title="Add to queue"
              onPress={() => {
                void player.enqueue(song, false);
                setOpen(false);
              }}
            />
            <GenreEditor key={song.id} song={song} />
            <Text style={[type.heading, { color: colors.text }]}>
              Add to playlist
            </Text>
            {playlists.isPending && (
              <Text style={{ color: colors.muted }}>Loading playlists…</Text>
            )}
            {playlists.isError && (
              <Action
                title="Retry playlists"
                onPress={() => playlists.refetch()}
              />
            )}
            {playlists.data
              ?.filter((p) => !p.id.startsWith("bridge_"))
              .map((p) => (
                <Action
                  key={p.id}
                  title={`Add to ${p.name}`}
                  disabled={busy}
                  onPress={() => void add(p.id)}
                />
              ))}
            {!!message && (
              <Text
                accessibilityLiveRegion="polite"
                style={{ color: colors.text }}
              >
                {message}
              </Text>
            )}
            <CreatePlaylist song={song} />
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
