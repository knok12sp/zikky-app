import { useRef, useState } from "react";
import { View, Text } from "react-native";
import type { Song } from "./api";
import { useSession, queryClient } from "./session";
import { Action, Field, useTheme } from "./ui";
import { spacing, type } from "./theme";

/** The parent keys this editor by song ID so drafts never leak between songs. */
export function GenreEditor({ song }: { song: Song }) {
  const { session } = useSession();
  const { colors } = useTheme();
  const [genre, setGenre] = useState(song.genre ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  async function save() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage("");
    try {
      const value = genre.trim().replace(/\s+/g, " ");
      await session!.api.rest("setGenre", { id: song.id, genre: value });
      session!.offline.setGenre?.(song.id, value);
      setGenre(value);
      await queryClient.invalidateQueries({ queryKey: [session!.scope] });
      setMessage(value ? "Genre saved" : "Genre removed");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save genre. Your server must support genre editing.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: spacing.sm }}>
      <Field
        label="Genre label"
        value={genre}
        onChange={setGenre}
        maxLength={80}
      />
      <Text style={[type.meta, { color: colors.muted }]}>
        For example: Rock, Jazz, or Electronic. Leave empty to remove the label.
      </Text>
      <Action
        title={busy ? "Saving genre…" : "Save genre"}
        disabled={busy}
        onPress={() => void save()}
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
