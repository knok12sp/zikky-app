import { useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import Slider from "@react-native-community/slider";
import { LinearGradient } from "expo-linear-gradient";
import { Art } from "../components";
import { Icon } from "../icon";
import { Chip, IconButton, PlayButton } from "../kit";
import { dark, radius, spacing, type } from "../theme";
import { report, useTheme } from "../ui";
import { usePlayback } from "../playback";
import { useSession, queryClient } from "../session";

const ink = "#F4F8F1";
const soft = "rgba(244,248,241,0.72)";
const quiet = "rgba(244,248,241,0.48)";
const accent = dark.accent;
const clock = (s: number) =>
  `${Math.floor(Math.max(0, s) / 60)}:${String(
    Math.floor(Math.max(0, s) % 60),
  ).padStart(2, "0")}`;

export function DesktopPlayer({
  onClose,
  onQueue,
}: {
  onClose: () => void;
  onQueue: () => void;
}) {
  const p = usePlayback();
  const { session } = useSession();
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const [options, setOptions] = useState(false);
  const [favorite, setFavorite] = useState<boolean | null>(null);
  const [rated, setRated] = useState<{ id: string; value: number } | null>(
    null,
  );
  const song = p.queue.entries[p.queue.index]?.song;
  const upcoming = p.queue.entries.slice(p.queue.index + 1, p.queue.index + 4);
  const starred = favorite ?? !!song?.starred;
  const rating = rated && rated.id === song?.id ? rated.value : (song?.rating ?? 0);
  const wide = width >= 860;
  const cover = Math.round(Math.min(wide ? 360 : width * 0.62, height * 0.36));

  async function rate(value: number) {
    if (!song) return;
    const next = rating === value ? 0 : value;
    setRated({ id: song.id, value: next });
    try {
      await session!.api.rest("setRating", {
        id: song.id,
        rating: String(next),
      });
      await queryClient.invalidateQueries({ queryKey: [session!.scope] });
    } catch (e) {
      setRated({ id: song.id, value: rating });
      report(e);
    }
  }

  async function toggleFavorite() {
    if (!song) return;
    const next = !starred;
    setFavorite(next);
    try {
      await session!.api.rest(next ? "star" : "unstar", { id: song.id });
      await queryClient.invalidateQueries({ queryKey: [session!.scope] });
    } catch (e) {
      setFavorite(!next);
      report(e);
    }
  }

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: dark.bg,
        zIndex: 30,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      >
        {song ? (
          <Art song={song} fill artworkSize={1200} blurRadius={36} />
        ) : (
          <View style={{ flex: 1, backgroundColor: colors.surfaceInset }} />
        )}
      </View>
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(4,8,6,0.72)", "rgba(4,8,6,0.18)", "rgba(4,8,6,0.96)"]}
        locations={[0, 0.42, 1]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <View
        style={{
          flex: 1,
          paddingHorizontal: wide ? 64 : 32,
          paddingTop: 28,
          paddingBottom: 36,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 9,
                backgroundColor: accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="note" size={17} color={dark.onAccent} />
            </View>
            <Text style={[type.micro, { color: soft, letterSpacing: 2.4 }]}>
              ZIKKY
            </Text>
          </View>
          <Text style={[type.micro, { color: quiet, letterSpacing: 2.4 }]}>
            NOW PLAYING
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <IconButton
              name="queue"
              label="Queue"
              onPress={onQueue}
              size={40}
              color={soft}
            />
            <IconButton
              name="chevronDown"
              label="Close now playing"
              onPress={onClose}
              size={40}
              color={soft}
            />
          </View>
        </View>

        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          {!!song && (
            <View
              style={{
                width: cover,
                height: cover,
                borderRadius: 20,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: "rgba(244,248,241,0.16)",
                shadowColor: "#000",
                shadowOpacity: 0.5,
                shadowRadius: 34,
                shadowOffset: { width: 0, height: 18 },
                elevation: 18,
              }}
            >
              <Art song={song} size={cover} radius={20} artworkSize={1200} />
            </View>
          )}
        </View>

        <View
          style={{
            flexDirection: wide ? "row" : "column",
            alignItems: wide ? "flex-end" : "stretch",
            gap: wide ? 64 : 24,
          }}
        >
          <View style={{ flex: 1, gap: 14, maxWidth: 720 }}>
            <View style={{ gap: 4 }}>
              <Text
                numberOfLines={2}
                accessibilityRole="header"
                style={{
                  color: ink,
                  fontSize: wide ? 38 : 28,
                  lineHeight: wide ? 44 : 34,
                  fontWeight: "800",
                  letterSpacing: -1.2,
                }}
              >
                {song?.title ?? "Nothing playing"}
              </Text>
              <Text
                numberOfLines={1}
                style={[type.body, { color: soft, fontSize: wide ? 18 : 16 }]}
              >
                {song
                  ? `${song.artist}${song.album ? `  ·  ${song.album}` : ""}`
                  : "Choose a track from your library."}
              </Text>
            </View>
            {!!song && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: accent,
                  }}
                />
                <Text style={[type.micro, { color: soft, letterSpacing: 1.6 }]}>
                  STREAMING FROM YOUR SERVER
                </Text>
              </View>
            )}

            <View style={{ gap: 2, paddingTop: 4 }}>
              <Slider
                accessibilityLabel="Playback position"
                minimumValue={0}
                maximumValue={Math.max(1, p.status.duration)}
                value={p.status.currentTime}
                minimumTrackTintColor={accent}
                maximumTrackTintColor="rgba(255,255,255,0.22)"
                thumbTintColor={accent}
                disabled={!song || !p.status.isLoaded || p.status.duration <= 0}
                onSlidingComplete={(value) => void p.seek(value)}
                style={{ width: "100%", height: 34 }}
              />
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={[type.numeric, { color: accent, fontSize: 12 }]}>
                  {clock(p.status.currentTime)}
                </Text>
                <Text style={[type.numeric, { color: soft, fontSize: 12 }]}>
                  −{clock(Math.max(0, p.status.duration - p.status.currentTime))}
                </Text>
              </View>
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: wide ? 28 : 20,
                paddingVertical: 8,
              }}
            >
              <IconButton
                name="shuffle"
                label={p.queue.shuffle ? "Shuffle on" : "Shuffle off"}
                active={p.queue.shuffle}
                onPress={p.shuffle}
                size={44}
                color={p.queue.shuffle ? accent : soft}
              />
              <IconButton
                name="previous"
                label="Previous track"
                onPress={p.previous}
                size={46}
                iconSize={21}
                color={ink}
              />
              <PlayButton
                playing={p.status.playing}
                busy={!!p.busy}
                onPress={p.toggle}
                size={68}
              />
              <IconButton
                name="next"
                label="Next track"
                onPress={p.next}
                size={46}
                iconSize={21}
                color={ink}
              />
              <IconButton
                name={p.queue.repeat === "single" ? "repeatOne" : "repeat"}
                label={`Repeat ${p.queue.repeat}`}
                active={p.queue.repeat !== "none"}
                onPress={p.repeat}
                size={44}
                color={p.queue.repeat !== "none" ? accent : soft}
              />
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: spacing.lg,
                flexWrap: "wrap",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <IconButton
                  name={starred ? "heartFilled" : "heart"}
                  label={starred ? "Remove favorite" : "Add favorite"}
                  onPress={toggleFavorite}
                  size={40}
                  color={starred ? accent : soft}
                  disabled={!song}
                />
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginLeft: 6,
                  }}
                >
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Pressable
                      key={value}
                      accessibilityRole="button"
                      accessibilityLabel={
                        rating === value
                          ? `Clear ${value} star rating`
                          : `Rate ${value} star${value === 1 ? "" : "s"}`
                      }
                      accessibilityState={{ selected: rating >= value }}
                      disabled={!song}
                      onPress={() => void rate(value)}
                      style={({ pressed }) => ({
                        width: 28,
                        height: 40,
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: pressed ? 0.55 : !song ? 0.35 : 1,
                      })}
                    >
                      <Icon
                        name={rating >= value ? "starFilled" : "star"}
                        size={15}
                        color={rating >= value ? accent : quiet}
                      />
                    </Pressable>
                  ))}
                </View>
                <IconButton
                  name="clock"
                  label="Sleep timer"
                  onPress={() => setOptions(!options)}
                  size={40}
                  color={p.sleep || p.sleepAfterTrack ? accent : soft}
                />
                <IconButton
                  name="queue"
                  label="Open queue"
                  onPress={onQueue}
                  size={40}
                  color={soft}
                />
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  minWidth: 190,
                  flex: 0.55,
                }}
              >
                <IconButton
                  name={p.volume === 0 ? "volumeOff" : "volume"}
                  label={p.volume === 0 ? "Unmute" : "Mute"}
                  onPress={() => p.setVolume(p.volume === 0 ? 0.7 : 0)}
                  size={36}
                  color={soft}
                />
                <Slider
                  accessibilityLabel="Volume"
                  minimumValue={0}
                  maximumValue={1}
                  value={p.volume}
                  minimumTrackTintColor={accent}
                  maximumTrackTintColor="rgba(255,255,255,0.22)"
                  thumbTintColor={accent}
                  onValueChange={p.setVolume}
                  style={{ flex: 1, height: 28 }}
                />
              </View>
            </View>

            {!!options && (
              <View
                style={{
                  backgroundColor: "rgba(8,14,10,0.82)",
                  borderColor: "rgba(255,255,255,0.14)",
                  borderWidth: 1,
                  borderRadius: radius.lg,
                  padding: spacing.md,
                  gap: spacing.sm,
                  maxWidth: 560,
                }}
              >
                <Text style={[type.micro, { color: soft, letterSpacing: 1.6 }]}>
                  SLEEP TIMER
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
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
                  <Text style={[type.meta, { color: soft }]}>
                    Stops at {new Date(p.sleep).toLocaleTimeString()}.
                  </Text>
                )}
                {p.sleepAfterTrack && (
                  <Text style={[type.meta, { color: soft }]}>
                    Stops when the current track finishes.
                  </Text>
                )}
              </View>
            )}

            {(!!p.error || !!p.busy || p.status.isBuffering) && (
              <Text
                accessibilityLiveRegion="polite"
                style={{
                  color: p.error ? "#FFB0B0" : accent,
                  ...type.meta,
                }}
              >
                {p.busy || p.error || "Buffering…"}
              </Text>
            )}
          </View>

          {wide && !!upcoming.length && (
            <View style={{ width: 280, gap: 10, paddingBottom: 6 }}>
              <Text style={[type.micro, { color: quiet, letterSpacing: 1.8 }]}>
                UP NEXT
              </Text>
              {upcoming.map((entry) => (
                <Pressable
                  key={entry.key}
                  accessibilityRole="button"
                  accessibilityLabel={`Play ${entry.song.title}`}
                  onPress={() =>
                    p.skip(
                      p.queue.entries.findIndex((e) => e.key === entry.key),
                    )
                  }
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Art song={entry.song} size={38} radius={7} />
                  <View style={{ flex: 1 }}>
                    <Text
                      numberOfLines={1}
                      style={[type.meta, { color: ink, fontWeight: "600" }]}
                    >
                      {entry.song.title}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[type.micro, { color: soft }]}
                    >
                      {entry.song.artist}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
