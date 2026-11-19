import { useEffect, useRef, useState } from "react";
import {
  Animated,
  GestureResponderEvent,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Art } from "../components";
import { IconButton, PlayButton } from "../kit";
import { breakpoints, font, radius, spacing, type } from "../theme";
import { useTheme } from "../ui";
import { usePlayback } from "../playback";

const clock = (s: number) =>
  `${Math.floor(Math.max(0, s) / 60)}:${String(
    Math.floor(Math.max(0, s) % 60),
  ).padStart(2, "0")}`;

/** A thin rail you can tap anywhere on: the only seek affordance in the deck. */
export function Rail({
  value,
  max,
  onChange,
  height = 3,
  label,
  color,
  track,
}: {
  value: number;
  max: number;
  onChange?: (next: number) => void;
  height?: number;
  label?: string;
  color?: string;
  track?: string;
}) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;

  function pick(event: GestureResponderEvent) {
    if (!onChange || !width) return;
    // react-native-web forwards the DOM event, which carries offsetX instead of locationX.
    const native = event.nativeEvent as typeof event.nativeEvent & {
      offsetX?: number;
    };
    const x = Number.isFinite(native.locationX) ? native.locationX : native.offsetX;
    if (x === undefined || !Number.isFinite(x)) return;
    onChange(Math.min(1, Math.max(0, x / width)) * max);
  }

  return (
    <Pressable
      accessibilityRole="adjustable"
      accessibilityLabel={label ?? "Position"}
      accessibilityValue={{ min: 0, max: Math.round(max), now: Math.round(value) }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onPress={pick}
      style={{ height: 14, justifyContent: "center" }}
    >
      <View
        style={{
          height,
          backgroundColor: track ?? colors.surfaceInset,
          borderRadius: radius.sm,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${ratio * 100}%`,
            height,
            backgroundColor: color ?? colors.accent,
          }}
        />
      </View>
    </Pressable>
  );
}

export function TransportBar({
  onQueue,
  onExpand,
  queueOpen,
}: {
  onQueue: () => void;
  onExpand: () => void;
  queueOpen: boolean;
}) {
  const p = usePlayback();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const narrow = width < breakpoints.compact;
  const song = p.queue.entries[p.queue.index]?.song;
  const duration = p.status.duration;
  const elapsed = Math.min(p.status.currentTime, duration || p.status.currentTime);

  return (
    <View
      style={{
        height: 80,
        flexDirection: "row",
        alignItems: "center",
        gap: narrow ? 14 : 28,
        paddingHorizontal: 20,
        borderTopWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.panel,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open now playing"
        onPress={onExpand}
        disabled={!song}
        style={({ pressed }) => ({
          width: narrow ? 190 : 268,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: radius.sm,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceInset,
          }}
        >
          {song ? <Art song={song} size={46} radius={radius.sm} /> : null}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[type.meta, { color: colors.text, fontFamily: font.uiMedium }]}>
            {song?.title ?? "Nothing playing"}
          </Text>
          <Text numberOfLines={1} style={[type.micro, { color: colors.faint, textTransform: "uppercase" }]}>
            {song?.artist ?? "Pick a track"}
          </Text>
        </View>
      </Pressable>

      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
          }}
        >
          <IconButton
            name="shuffle"
            label={p.queue.shuffle ? "Shuffle on" : "Shuffle off"}
            active={p.queue.shuffle}
            onPress={p.shuffle}
            size={30}
            iconSize={14}
            color={p.queue.shuffle ? colors.accent : colors.faint}
          />
          <IconButton name="previous" label="Previous track" onPress={p.previous} size={32} iconSize={15} />
          <PlayButton playing={p.status.playing} busy={!!p.busy} onPress={p.toggle} size={40} />
          <IconButton name="next" label="Next track" onPress={p.next} size={32} iconSize={15} />
          <IconButton
            name={p.queue.repeat === "single" ? "repeatOne" : "repeat"}
            label={`Repeat ${p.queue.repeat}`}
            active={p.queue.repeat !== "none"}
            onPress={p.repeat}
            size={30}
            iconSize={14}
            color={p.queue.repeat !== "none" ? colors.accent : colors.faint}
          />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, alignSelf: "center", width: "100%", maxWidth: 560 }}>
          <Text style={[type.numeric, { color: colors.text, width: 40, textAlign: "right" }]}>{clock(elapsed)}</Text>
          <View style={{ flex: 1 }}>
            <Rail
              value={p.status.currentTime}
              max={duration}
              label="Playback position"
              track={colors.border}
              onChange={(next) => void p.seek(next)}
            />
          </View>
          <Text style={[type.numeric, { color: colors.faint, width: 48, textAlign: "right" }]}>
            −{clock(Math.max(0, duration - p.status.currentTime))}
          </Text>
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 6,
          width: narrow ? 96 : 196,
        }}
      >
        {!narrow && (
          <>
            <IconButton
              name={p.volume === 0 ? "volumeOff" : "volume"}
              label={p.volume === 0 ? "Unmute" : "Mute"}
              onPress={() => p.setVolume(p.volume === 0 ? 0.7 : 0)}
              size={30}
              iconSize={14}
              color={colors.muted}
            />
            <View style={{ width: 76 }}>
              <Rail
                value={p.volume}
                max={1}
                label="Volume"
                onChange={p.setVolume}
                color={colors.muted}
                track={colors.border}
              />
            </View>
          </>
        )}
        <IconButton
          name="queue"
          label={queueOpen ? "Hide queue" : "Show queue"}
          active={queueOpen}
          onPress={onQueue}
          size={32}
          iconSize={15}
        />
        <IconButton
          name="chevronDown"
          label="Open now playing"
          onPress={onExpand}
          rotate={180}
          size={32}
          iconSize={16}
        />
      </View>
    </View>
  );
}

export function QueuePanel({ onClose }: { onClose: () => void }) {
  const p = usePlayback();
  const { colors } = useTheme();
  const slide = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [slide]);

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 80,
        width: 336,
        borderLeftWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.panel,
        zIndex: 25,
        transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [0, 336] }) }],
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          paddingHorizontal: 18,
          paddingTop: 20,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderColor: colors.border,
        }}
      >
        <View style={{ gap: 3 }}>
          <Text style={[type.micro, { color: colors.muted }]}>Queue</Text>
          <Text style={[type.meta, { color: colors.text, fontFamily: font.uiMedium }]}>
            {p.queue.entries.length} {p.queue.entries.length === 1 ? "track" : "tracks"}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 2 }}>
          {!!p.queue.entries.length && (
            <IconButton
              name="trash"
              label="Clear queue"
              onPress={() => void p.clear()}
              size={28}
              iconSize={13}
              color={colors.faint}
            />
          )}
          <IconButton name="close" label="Close queue" onPress={onClose} size={28} iconSize={14} />
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {p.queue.entries.map((entry, index) => {
          const active = index === p.queue.index;
          return (
            <View
              key={entry.key}
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderBottomWidth: 1,
                borderColor: colors.border,
                backgroundColor: active ? colors.accentSoft : "transparent",
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Play ${entry.song.title}${active ? ", now playing" : ""}`}
                onPress={() => p.skip(index)}
                style={({ pressed }) => ({
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  paddingVertical: 8,
                  paddingLeft: 18,
                  paddingRight: 6,
                  backgroundColor: pressed ? colors.surfaceRaised : "transparent",
                })}
              >
                <Text style={[type.numeric, { color: active ? colors.accent : colors.faint, width: 18 }]}>
                  {String(index + 1).padStart(2, "0")}
                </Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={[type.meta, { color: active ? colors.accent : colors.text }]}
                  >
                    {entry.song.title}
                  </Text>
                  <Text numberOfLines={1} style={[type.micro, { color: colors.faint, textTransform: "none" }]}>
                    {entry.song.artist}
                  </Text>
                </View>
                <Text style={[type.numeric, { color: colors.faint }]}>{clock(entry.song.duration)}</Text>
              </Pressable>
              <IconButton
                name="close"
                label={`Remove ${entry.song.title} from queue`}
                onPress={() => void p.remove(index)}
                size={26}
                iconSize={12}
                color={colors.faint}
              />
              <View style={{ width: 8 }} />
            </View>
          );
        })}
        {!p.queue.entries.length && (
          <Text
            style={[
              type.meta,
              { color: colors.faint, paddingHorizontal: 18, paddingTop: spacing.lg },
            ]}
          >
            Nothing queued. Play a track to start.
          </Text>
        )}
      </ScrollView>
    </Animated.View>
  );
}
