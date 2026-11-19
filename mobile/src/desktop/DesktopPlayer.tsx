import { useRef, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Art } from "../components";
import { Icon } from "../icon";
import { Chip, IconButton, PlayButton } from "../kit";
import { font, radius, spacing, type } from "../theme";
import { report, useTheme } from "../ui";
import { usePlayback } from "../playback";
import { useSession, queryClient } from "../session";
import { Rail } from "./Transport";

const clock = (s: number) =>
  `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, "0")}`;

export function DesktopPlayer({ onClose, onQueue }: { onClose: () => void; onQueue: () => void }) {
  const p = usePlayback();
  const { session } = useSession();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [options, setOptions] = useState(false);
  const [favorite, setFavorite] = useState<{ id: string; value: boolean } | null>(null);
  const lastVolume = useRef(p.volume || 0.7);
  const [rated, setRated] = useState<{ id: string; value: number } | null>(null);

  const song = p.queue.entries[p.queue.index]?.song;
  const upcoming = p.queue.entries.slice(p.queue.index + 1, p.queue.index + 4);
  const starred = favorite && favorite.id === song?.id ? favorite.value : !!song?.starred;
  const rating = rated && rated.id === song?.id ? rated.value : (song?.rating ?? 0);
  const wide = width >= 900;
  const plate = wide ? 396 : Math.min(width - 48, 320);
  const remaining = Math.max(0, p.status.duration - p.status.currentTime);

  async function rate(value: number) {
    if (!song) return;
    const next = rating === value ? 0 : value;
    setRated({ id: song.id, value: next });
    try {
      await session!.api.rest("setRating", { id: song.id, rating: String(next) });
      await queryClient.invalidateQueries({ queryKey: [session!.scope] });
    } catch (e) {
      setRated({ id: song.id, value: rating });
      report(e);
    }
  }

  async function toggleFavorite() {
    if (!song) return;
    const next = !starred;
    setFavorite({ id: song.id, value: next });
    try {
      await session!.api.rest(next ? "star" : "unstar", { id: song.id });
      await queryClient.invalidateQueries({ queryKey: [session!.scope] });
    } catch (e) {
      setFavorite({ id: song.id, value: !next });
      report(e);
    }
  }

  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, zIndex: 30 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, padding: wide ? spacing.gutter : spacing.xl, paddingTop: spacing.xl, gap: spacing.xxl }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <View
              style={{
                width: 24,
                height: 24,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                backgroundColor: colors.surfaceInset,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="note" size={13} color={colors.accent} />
            </View>
            <Text style={[type.micro, { color: colors.muted }]}>ZIKKY</Text>
            <Text style={[type.micro, { color: colors.faint }]}>/ NOW PLAYING</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <IconButton name="queue" label="Queue" onPress={onQueue} size={36} color={colors.muted} iconSize={16} />
            <IconButton name="chevronDown" label="Close now playing" onPress={onClose} size={36} color={colors.muted} iconSize={18} />
          </View>
        </View>

        <View style={{ flex: 1, justifyContent: "center", paddingVertical: spacing.xxl }}>
        <View
          style={{
            flexDirection: wide ? "row" : "column",
            alignItems: wide ? "flex-start" : "stretch",
            gap: wide ? spacing.gutter : spacing.xl,
            maxWidth: 1120,
            width: "100%",
            alignSelf: "center",
          }}
        >
          <View style={{ gap: spacing.md }}>
            <View
              style={{
                width: plate,
                height: plate,
                overflow: "hidden",
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                backgroundColor: colors.surfaceInset,
              }}
            >
              {song ? (
                <Art song={song} fill artworkSize={1200} />
              ) : (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                  <Icon name="note" size={44} color={colors.faint} />
                </View>
              )}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <View style={{ width: 5, height: 5, backgroundColor: p.status.playing ? colors.accent : colors.faint }} />
              <Text style={[type.micro, { color: colors.muted }]}>
                {p.status.playing ? "PLAYING FROM YOUR SERVER" : song ? "PAUSED" : "STANDBY"}
              </Text>
            </View>
          </View>

          <View style={{ flex: 1, minWidth: 0, maxWidth: wide ? 620 : undefined, gap: spacing.xl, paddingTop: wide ? spacing.sm : 0 }}>
            <View style={{ gap: spacing.sm }}>
              <Text accessibilityRole="header" numberOfLines={2} style={[type.hero, { color: colors.text }]}>
                {song?.title ?? "Nothing playing"}
              </Text>
              <Text numberOfLines={1} style={[type.title, { fontFamily: font.ui, color: colors.muted }]}>
                {song ? song.artist : "Choose a track from your library."}
              </Text>
              {!!song?.album && (
                <Text numberOfLines={1} style={[type.meta, { color: colors.faint }]}>
                  {song.album}
                </Text>
              )}
            </View>

            <View
              style={{
                backgroundColor: colors.surfaceInset,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.sm,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                gap: spacing.sm,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <Text style={[type.readout, { color: colors.accent, width: 44 }]}>{clock(p.status.currentTime)}</Text>
                <View style={{ flex: 1 }}>
                  <Rail
                    value={p.status.currentTime}
                    max={Math.max(1, p.status.duration)}
                    onChange={(v) => void p.seek(v)}
                    label="Playback position"
                    track={colors.border}
                  />
                </View>
                <Text style={[type.readout, { color: colors.faint, width: 48, textAlign: "right" }]}>−{clock(remaining)}</Text>
              </View>
              <Text style={[type.micro, { color: colors.faint }]}>
                {p.status.duration > 0 ? `${clock(p.status.duration)} TOTAL · ON SERVER` : "NO TRACK LOADED"}
              </Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: wide ? spacing.xl : spacing.lg, paddingTop: spacing.xs }}>
              <IconButton
                name="shuffle"
                label={p.queue.shuffle ? "Shuffle on" : "Shuffle off"}
                active={p.queue.shuffle}
                onPress={p.shuffle}
                size={36}
                iconSize={17}
                color={p.queue.shuffle ? colors.accent : colors.muted}
              />
              <IconButton name="previous" label="Previous track" onPress={p.previous} size={40} iconSize={19} color={colors.text} />
              <PlayButton playing={p.status.playing} busy={!!p.busy} onPress={p.toggle} size={56} />
              <IconButton name="next" label="Next track" onPress={p.next} size={40} iconSize={19} color={colors.text} />
              <IconButton
                name={p.queue.repeat === "single" ? "repeatOne" : "repeat"}
                label={`Repeat ${p.queue.repeat}`}
                active={p.queue.repeat !== "none"}
                onPress={p.repeat}
                size={36}
                iconSize={17}
                color={p.queue.repeat !== "none" ? colors.accent : colors.muted}
              />
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                flexWrap: "wrap",
                gap: spacing.md,
                paddingTop: spacing.sm,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <IconButton
                name={starred ? "heartFilled" : "heart"}
                label={starred ? "Remove favorite" : "Add favorite"}
                onPress={toggleFavorite}
                size={34}
                iconSize={15}
                color={starred ? colors.accent : colors.muted}
                disabled={!song}
              />
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityLabel={rating === value ? `Clear ${value} star rating` : `Rate ${value} star${value === 1 ? "" : "s"}`}
                    accessibilityState={{ selected: rating >= value }}
                    disabled={!song}
                    onPress={() => void rate(value)}
                    style={({ pressed }) => ({
                      width: 26,
                      height: 34,
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: pressed ? 0.55 : !song ? 0.35 : 1,
                    })}
                  >
                    <Icon name={rating >= value ? "starFilled" : "star"} size={14} color={rating >= value ? colors.accent : colors.faint} />
                  </Pressable>
                ))}
              </View>
              <IconButton
                name="clock"
                label="Sleep timer"
                onPress={() => setOptions(!options)}
                size={34}
                iconSize={15}
                color={p.sleep || p.sleepAfterTrack ? colors.accent : colors.muted}
              />
              <View style={{ flex: 1 }} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, width: wide ? 176 : 130 }}>
                <IconButton
                  name={p.volume === 0 ? "volumeOff" : "volume"}
                  label={p.volume === 0 ? "Unmute" : "Mute"}
                  onPress={() => {
                    if (p.volume > 0) {
                      lastVolume.current = p.volume;
                      p.setVolume(0);
                    } else p.setVolume(lastVolume.current);
                  }}
                  size={30}
                  iconSize={15}
                  color={colors.muted}
                />
                <View style={{ flex: 1 }}>
                  <Rail value={p.volume} max={1} onChange={p.setVolume} label="Volume" track={colors.border} />
                </View>
              </View>
            </View>

            {!!options && (
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.sm,
                  padding: spacing.md,
                  gap: spacing.md,
                }}
              >
                <Text style={[type.micro, { color: colors.muted }]}>SLEEP TIMER</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                  <Chip
                    title="Finish track"
                    active={p.sleepAfterTrack}
                    onPress={() => {
                      p.sleepAfterCurrent();
                      setOptions(false);
                    }}
                  />
                  {[15, 30, 60].map((m) => (
                    <Chip
                      key={m}
                      title={`${m} min`}
                      onPress={() => {
                        p.sleepFor(m);
                        setOptions(false);
                      }}
                    />
                  ))}
                  <Chip
                    title="Cancel timer"
                    onPress={() => {
                      p.sleepFor(0);
                      setOptions(false);
                    }}
                  />
                </View>
                {!!p.sleep && (
                  <Text style={[type.meta, { color: colors.muted }]}>Stops at {new Date(p.sleep).toLocaleTimeString()}.</Text>
                )}
                {p.sleepAfterTrack && <Text style={[type.meta, { color: colors.muted }]}>Stops when the current track finishes.</Text>}
              </View>
            )}

            {(!!p.error || !!p.busy || p.status.isBuffering) && (
              <Text accessibilityLiveRegion="polite" style={[type.meta, { color: p.error ? colors.danger : colors.accent }]}>
                {p.busy || p.error || "Buffering…"}
              </Text>
            )}

            {!!upcoming.length && (
              <View style={{ gap: 0 }}>
                <Text style={[type.micro, { color: colors.muted, marginBottom: spacing.sm }]}>UP NEXT</Text>
                {upcoming.map((entry) => (
                  <Pressable
                    key={entry.key}
                    accessibilityRole="button"
                    accessibilityLabel={`Play ${entry.song.title}`}
                    onPress={() => p.skip(p.queue.entries.findIndex((e) => e.key === entry.key))}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                      paddingVertical: spacing.sm,
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                      backgroundColor: pressed ? colors.surface : "transparent",
                    })}
                  >
                    <Art song={entry.song} size={32} radius={2} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={[type.meta, { color: colors.text }]}>
                        {entry.song.title}
                      </Text>
                      <Text numberOfLines={1} style={[type.micro, { color: colors.faint }]}>
                        {entry.song.artist}
                      </Text>
                    </View>
                    <Text style={[type.numeric, { color: colors.muted }]}>{clock(entry.song.duration ?? 0)}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>
        </View>
      </ScrollView>
    </View>
  );
}
