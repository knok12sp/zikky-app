import { FlatList, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePlayback } from "../src/playback";
import { Art } from "../src/components";
import { useTheme, confirm } from "../src/ui";
import { Icon } from "../src/icon";
import { BackButton, EmptyState, IconButton, SectionTitle } from "../src/kit";
import { radius, spacing, type } from "../src/theme";

export default function Queue() {
  const p = usePlayback();
  const { colors } = useTheme();
  const entries = p.queue.entries;
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        }}
      >
        <BackButton />
        <View style={{ flex: 1 }}>
          <Text style={[type.title, { color: colors.text }]}>Queue</Text>
          <Text style={[type.meta, { color: colors.muted }]}>
            {entries.length === 0
              ? "Nothing lined up"
              : `${entries.length} ${entries.length === 1 ? "track" : "tracks"} · ${
                  p.queue.shuffle ? "shuffled" : "in order"
                }`}
          </Text>
        </View>
        {entries.length > 0 && (
          <IconButton
            name="trash"
            label="Clear queue"
            onPress={() =>
              confirm(
                "Clear the queue?",
                "Playback stops and the queue is emptied. Your library, playlists and phone downloads are untouched.",
                () => void p.clear(),
              )
            }
            variant="outline"
            size={42}
          />
        )}
      </View>
      <FlatList
        data={entries}
        keyExtractor={(e) => e.key}
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingBottom: 32,
        }}
        ListHeaderComponent={
          entries.length ? (
            <View style={{ paddingBottom: spacing.sm }}>
              <SectionTitle
                title={p.queue.shuffle ? "Shuffled queue" : "Playback order"}
                action={p.queue.repeat === "none" ? undefined : "Repeat on"}
                onAction={p.repeat}
              />
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          <EmptyState
            icon="queue"
            title="Your queue is empty"
            message="Play an album, playlist or track, or add songs from any track menu."
          />
        }
        renderItem={({ item, index }) => {
          const current = index === p.queue.index;
          return (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                paddingVertical: 6,
                paddingLeft: current ? 8 : 0,
                borderLeftWidth: current ? 2 : 0,
                borderLeftColor: colors.accent,
                backgroundColor: current ? colors.accentSoft : "transparent",
                borderRadius: radius.sm,
                marginBottom: 2,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Play ${item.song.title}, ${item.song.artist}`}
                onPress={() => p.skip(index)}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  paddingVertical: 4,
                }}
              >
                <View style={{ width: 20, alignItems: "center" }}>
                  {current ? (
                    <Icon name="play" size={12} color={colors.accent} />
                  ) : (
                    <Text style={[type.numeric, { color: colors.faint }]}>
                      {index + 1}
                    </Text>
                  )}
                </View>
                <Art song={item.song} size={44} radius={8} />
                <View style={{ flex: 1 }}>
                  <Text
                    numberOfLines={1}
                    style={[
                      type.body,
                      {
                        color: current ? colors.accent : colors.text,
                        fontWeight: "600",
                      },
                    ]}
                  >
                    {item.song.title}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[type.meta, { color: colors.muted }]}
                  >
                    {item.song.artist}
                    {current ? " · Now playing" : ""}
                  </Text>
                </View>
              </Pressable>
              <IconButton
                name="chevronDown"
                label={`Move ${item.song.title} up`}
                disabled={index === 0}
                onPress={() => p.move(index, index - 1)}
                size={34}
                iconSize={16}
                rotate={180}
              />
              <IconButton
                name="chevronDown"
                label={`Move ${item.song.title} down`}
                disabled={index === entries.length - 1}
                onPress={() => p.move(index, index + 1)}
                size={34}
                iconSize={16}
              />
              <IconButton
                name="close"
                label={`Remove ${item.song.title} from queue`}
                onPress={() => p.remove(index)}
                size={34}
                iconSize={14}
              />
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}
