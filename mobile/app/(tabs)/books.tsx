import { useQuery } from "@tanstack/react-query";
import { Image, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Page, Busy, Label, useTheme } from "../../src/ui";
import { useSession } from "../../src/session";
import { useBookPlayback } from "../../src/book-playback";
import { IconButton } from "../../src/kit";
import { radius, spacing, type } from "../../src/theme";

export default function Books() {
  const { session } = useSession();
  const { colors } = useTheme();
  const books = useBookPlayback();
  const query = useQuery({
    queryKey: ["books", session?.scope],
    queryFn: () => session!.api.books(),
    enabled: !!session,
  });

  const list = query.data?.books ?? [];
  const current = books.current;

  return (
    <Page title="Books" subtitle="Audiobooks from your server">
      {current && (
        <Pressable
          onPress={() => router.push(`/book?id=${current.book.id}`)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            padding: spacing.md,
            marginBottom: spacing.lg,
            borderRadius: radius.lg,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ flex: 1 }}>
            <Label>Now playing</Label>
            <Text
              numberOfLines={1}
              style={[type.body, { color: colors.text, fontWeight: "700" }]}
            >
              {current.book.title}
            </Text>
            <Text numberOfLines={1} style={[type.meta, { color: colors.muted }]}>
              {current.book.chapters[books.chapterIndex]?.title ??
                current.book.author}
            </Text>
          </View>
          <IconButton
            name={books.playing ? "pause" : "play"}
            label={books.playing ? "Pause" : "Play"}
            onPress={books.toggle}
          />
        </Pressable>
      )}

      {query.isLoading && <Busy label="Loading books" />}
      {query.error && (
        <Text style={[type.meta, { color: colors.danger }]}>
          {query.error instanceof Error
            ? query.error.message
            : "Could not load books."}
        </Text>
      )}
      {!query.isLoading && !list.length && (
        <Text style={[type.body, { color: colors.muted }]}>
          No audiobooks yet. Put a folder at audiobooks/Author/Title/ on the
          server, each chapter as one audio file, then rescan from Manage.
        </Text>
      )}

      {list.map((book) => {
        const progress = book.progress;
        const started = !!progress && progress.position > 0;
        const percent = started
          ? Math.min(
              100,
              Math.round((progress!.position / Math.max(1, book.duration)) * 100),
            )
          : 0;
        return (
          <Pressable
            key={book.id}
            onPress={() => router.push(`/book?id=${book.id}`)}
            style={{
              flexDirection: "row",
              gap: spacing.md,
              padding: spacing.md,
              marginBottom: spacing.sm,
              alignItems: "center",
              borderRadius: radius.lg,
              backgroundColor: colors.surface,
            }}
          >
            {book.hasCover && session ? (
              <Image
                source={session.api.bookCover(book.id) as never}
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: radius.md,
                  backgroundColor: colors.surfaceInset,
                }}
              />
            ) : (
              <View
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: radius.md,
                  backgroundColor: colors.surfaceInset,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={[type.numeric, { color: colors.faint }]}>
                  {book.title.slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                numberOfLines={1}
                style={[type.body, { color: colors.text, fontWeight: "700" }]}
              >
                {book.title}
              </Text>
              <Text numberOfLines={1} style={[type.meta, { color: colors.muted }]}>
                {book.author || "Unknown author"} · {book.chapterCount} chapter
                {book.chapterCount === 1 ? "" : "s"}
              </Text>
              {started && (
                <View
                  style={{
                    height: 3,
                    marginTop: 4,
                    borderRadius: 2,
                    backgroundColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      width: `${Math.max(2, percent)}%`,
                      height: 3,
                      borderRadius: 2,
                      backgroundColor: colors.accent,
                    }}
                  />
                </View>
              )}
            </View>
            <Text style={[type.meta, { color: colors.faint }]}>
              {started ? `${percent}%` : ""}
            </Text>
          </Pressable>
        );
      })}

    </Page>
  );
}
