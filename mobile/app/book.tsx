import Slider from "@react-native-community/slider";
import { useQuery } from "@tanstack/react-query";
import { Image, Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Page, Busy, Label, useTheme } from "../src/ui";
import { useSession } from "../src/session";
import { useBookPlayback, BOOK_RATES } from "../src/book-playback";
import { IconButton } from "../src/kit";
import { Action } from "../src/ui";
import { radius, spacing, type } from "../src/theme";

function clock(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = String(total % 60).padStart(2, "0");
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}`
    : `${minutes}:${rest}`;
}

export default function BookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const { colors } = useTheme();
  const books = useBookPlayback();
  const query = useQuery({
    queryKey: ["book", session?.scope, id],
    queryFn: () => session!.api.book(id!),
    enabled: !!session && !!id,
  });
  const book = query.data;
  const mine = books.current?.book.id === book?.id;

  if (query.isLoading)
    return (
      <Page title="Book">
        <Busy label="Loading book" />
      </Page>
    );
  if (!book)
    return (
      <Page title="Book">
        <Text style={[type.body, { color: colors.muted }]}>
          {query.error instanceof Error
            ? query.error.message
            : "This book is not on the server."}
        </Text>
      </Page>
    );

  const progress = book.progress;
  const resumeIndex = progress
    ? book.chapters.findIndex((c) => c.id === progress.chapterId)
    : -1;
  const index = resumeIndex >= 0 ? resumeIndex : 0;
  const position = mine ? books.position : (progress?.position ?? 0);

  return (
    <Page title={book.title} subtitle={book.author || "Unknown author"}>
      <View style={{ flexDirection: "row", gap: spacing.md }}>
        {book.hasCover && session ? (
          <Image
            source={session.api.bookCover(book.id) as never}
            style={{
              width: 120,
              height: 120,
              borderRadius: radius.lg,
              backgroundColor: colors.surfaceInset,
            }}
          />
        ) : (
          <View
            style={{
              width: 120,
              height: 120,
              borderRadius: radius.lg,
              backgroundColor: colors.surfaceInset,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={[type.numeric, { color: colors.faint, fontSize: 40 }]}>
              {book.title.slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[type.meta, { color: colors.muted }]}>
            {book.chapterCount} chapters · {clock(book.duration)}
          </Text>
          <Text style={[type.meta, { color: colors.faint }]}>
            {progress
              ? `Saved at ${book.chapters[index]?.title ?? "chapter"} · ${clock(
                  progress.position,
                )}`
              : "Not started"}
          </Text>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: 8 }}>
            <Action
              title={
                mine && books.playing ? "Pause" : progress ? "Continue" : "Play"
              }
              onPress={() => {
                if (mine) return books.toggle();
                void books.start(book, index, progress?.position ?? 0);
              }}
            />
            <Action title="Back" onPress={() => router.back()} />
          </View>
        </View>
      </View>

      {mine && (
        <View
          style={{
            marginTop: spacing.lg,
            padding: spacing.md,
            borderRadius: radius.lg,
            backgroundColor: colors.surface,
            gap: spacing.sm,
          }}
        >
          <Text style={[type.body, { color: colors.text }]} numberOfLines={1}>
            {book.chapters[books.chapterIndex]?.title ?? "Chapter"}
          </Text>
          <Text style={[type.meta, { color: colors.muted }]}>
            {clock(books.position)} /{" "}
            {clock(book.chapters[books.chapterIndex]?.duration ?? 0)}
          </Text>
          <Slider
            accessibilityLabel="Chapter position"
            minimumValue={0}
            maximumValue={Math.max(
              1,
              book.chapters[books.chapterIndex]?.duration ?? 0,
            )}
            value={books.position}
            onSlidingComplete={books.seek}
            minimumTrackTintColor={colors.accent}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.accent}
            style={{ height: 44 }}
          />
          <Text style={[type.meta, { color: colors.muted }]}>
            Volume · {Math.round(books.volume * 100)}%
          </Text>
          <Slider
            accessibilityLabel="Audiobook volume"
            minimumValue={0}
            maximumValue={1}
            value={books.volume}
            onValueChange={books.setVolume}
            minimumTrackTintColor={colors.accent}
            thumbTintColor={colors.accent}
            style={{ height: 44 }}
          />
          <Text style={[type.meta, { color: colors.muted }]}>Sleep timer</Text>
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}
          >
            {[0, 15, 30, 60].map((minutes) => (
              <Action
                key={minutes}
                title={minutes ? `${minutes} min` : "Off"}
                variant={
                  books.sleepMinutes === minutes ? "primary" : "secondary"
                }
                onPress={() => books.setSleepMinutes(minutes)}
              />
            ))}
          </View>
          {!!books.error && (
            <Text accessibilityRole="alert" style={{ color: colors.muted }}>
              {books.error}
            </Text>
          )}
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              gap: spacing.sm,
            }}
          >
            <IconButton
              name="previous"
              label="Previous chapter"
              onPress={books.previous}
            />
            <IconButton
              name="retry"
              label="Back 15 seconds"
              onPress={() => books.seek(books.position - 15)}
            />
            <IconButton
              name={books.playing ? "pause" : "play"}
              label={books.playing ? "Pause" : "Play"}
              onPress={books.toggle}
            />
            <IconButton name="next" label="Next chapter" onPress={books.next} />
            <IconButton
              name="clock"
              label="Forward 30 seconds"
              onPress={() => books.seek(books.position + 30)}
            />
          </View>
          <View
            style={{ flexDirection: "row", gap: spacing.xs, flexWrap: "wrap" }}
          >
            {BOOK_RATES.map((rate) => (
              <Pressable
                key={rate}
                onPress={() => books.setRate(rate)}
                style={{
                  paddingHorizontal: 10,
                  minHeight: 44,
                  justifyContent: "center",
                  paddingVertical: 5,
                  borderRadius: radius.pill,
                  backgroundColor:
                    books.rate === rate ? colors.accent : colors.surfaceInset,
                }}
              >
                <Text
                  style={[
                    type.meta,
                    {
                      color:
                        books.rate === rate ? colors.onAccent : colors.muted,
                      fontWeight: "700",
                    },
                  ]}
                >
                  {rate}×
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <Label>Chapters</Label>
      {book.chapters.map((chapter, i) => {
        const active = mine && books.chapterIndex === i;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Play chapter ${i + 1}: ${chapter.title}`}
            accessibilityState={{ selected: active }}
            key={chapter.id}
            onPress={() => void books.start(book, i, 0)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              paddingVertical: spacing.sm,
              borderBottomWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text
              style={[
                type.meta,
                { color: active ? colors.accent : colors.faint, width: 28 },
              ]}
            >
              {i + 1}
            </Text>
            <Text
              numberOfLines={1}
              style={[
                type.body,
                {
                  flex: 1,
                  color: active ? colors.accent : colors.text,
                  fontWeight: active ? "700" : "400",
                },
              ]}
            >
              {chapter.title}
            </Text>
            <Text style={[type.meta, { color: colors.faint }]}>
              {clock(chapter.duration)}
            </Text>
          </Pressable>
        );
      })}
      <View style={{ height: spacing.xl }} />
    </Page>
  );
}
