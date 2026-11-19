import { useEffect, useRef, useState } from "react";
import {
  Image,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import type { Book, BookDetail } from "../api";
import { claimAudio, onAudioOwnerChange } from "../audio-owner";
import { Icon } from "../icon";
import {
  Chip,
  EmptyState,
  IconButton,
  PageHeader,
  SectionTitle,
} from "../kit";
import { usePlayback } from "../playback";
import { useSession } from "../session";
import { breakpoints, font, radius, spacing, type } from "../theme";
import { Busy, useTheme } from "../ui";

const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];

function clock(value: number) {
  const total = Math.max(0, Math.floor(value || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Audiobooks on the desktop build. Uses one HTML audio element and the
 *  salted /rest URLs so seeking and cover images work without extra headers. */
export function DesktopBooks() {
  const { session } = useSession();
  const music = usePlayback();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [openId, setOpenId] = useState<string | null>(null);
  const [active, setActive] = useState<{
    book: BookDetail;
    index: number;
  } | null>(null);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [sleepMinutes, setSleepMinutes] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    if (audio.current) audio.current.volume = volume;
  }, [volume]);
  useEffect(() => {
    if (!sleepMinutes) return;
    const timer = setTimeout(() => {
      audio.current?.pause();
      setSleepMinutes(0);
    }, sleepMinutes * 60000);
    return () => clearTimeout(timer);
  }, [sleepMinutes]);
  function resume() {
    music.pause();
    claimAudio("book");
    setError("");
    void audio.current
      ?.play()
      .catch(() =>
        setError(
          "Could not play this chapter. Check your connection and try again.",
        ),
      );
  }
  function toggle() {
    playing ? audio.current?.pause() : resume();
  }

  const audio = useRef<HTMLAudioElement | null>(null);
  const activeRef = useRef(active);
  const startRef = useRef<
    (book: BookDetail, index: number, at: number) => void
  >(() => {});
  const rateRef = useRef(rate);
  const pending = useRef(0);
  const savedAt = useRef(0);
  const chapterId = useRef("");
  activeRef.current = active;
  rateRef.current = rate;

  const list = useQuery({
    queryKey: ["books", session?.scope],
    queryFn: () => session!.api.books(),
    enabled: !!session,
  });
  const detail = useQuery({
    queryKey: ["book", session?.scope, openId],
    queryFn: () => session!.api.book(openId!),
    enabled: !!session && !!openId,
  });

  function save(force = false) {
    const el = audio.current;
    const current = activeRef.current;
    if (!el || !current || !session) return;
    const now = Date.now();
    if (!force && now - savedAt.current < 10_000) return;
    savedAt.current = now;
    const chapter =
      current.book.chapters.find((item) => item.id === chapterId.current) ??
      current.book.chapters[current.index];
    if (!chapter) return;
    void session.api
      .saveBookProgress(current.book.id, chapter.id, el.currentTime)
      .catch(() => {});
  }

  function start(book: BookDetail, index: number, at: number) {
    const el = audio.current;
    if (!el || !session) return;
    const chapter = book.chapters[index];
    if (!chapter) return;
    save(true);
    music.pause();
    claimAudio("book");
    chapterId.current = chapter.id;
    el.src = session.api.bookChapterUrl(book.id, chapter.id);
    el.playbackRate = rateRef.current;
    pending.current = at;
    savedAt.current = 0;
    setActive({ book, index });
    setPosition(at);
    activeRef.current = { book, index };
    resume();
  }
  startRef.current = start;

  useEffect(() => {
    const el = new Audio();
    el.preload = "metadata";
    audio.current = el;
    el.onloadedmetadata = () => {
      if (pending.current > 0 && el.duration) {
        el.currentTime = Math.min(pending.current, el.duration - 1);
      }
      pending.current = 0;
    };
    el.ontimeupdate = () => setPosition(el.currentTime);
    el.onerror = () =>
      setError(
        "Could not load chapter audio. Check your connection and try again.",
      );
    el.onplay = () => {
      setPlaying(true);
      setError("");
    };
    el.onpause = () => {
      setPlaying(false);
      save(true);
    };
    el.onended = () => {
      const current = activeRef.current;
      if (!current) return;
      const next = current.index + 1;
      if (current.book.chapters[next]) {
        startRef.current(current.book, next, 0);
      } else {
        setPlaying(false);
        save(true);
      }
    };
    const off = onAudioOwnerChange((owner) => {
      if (owner === "music" && !el.paused) el.pause();
    });
    return () => {
      save(true);
      off();
      el.pause();
      el.removeAttribute("src");
      el.load();
      audio.current = null;
    };
  }, []);

  useEffect(() => {
    if (audio.current) audio.current.playbackRate = rate;
  }, [rate]);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => save(false), 10_000);
    return () => clearInterval(timer);
  }, [active]);

  const book = detail.data ?? null;
  const progress = book?.progress ?? null;
  const resumeIndex = progress
    ? Math.max(
        0,
        book!.chapters.findIndex(
          (chapter) => chapter.id === progress.chapterId,
        ),
      )
    : 0;
  const mine = active && book && active.book.id === book.id;
  const currentChapter = mine ? active!.book.chapters[active!.index] : null;
  const books = list.data?.books ?? [];
  const compact = width < breakpoints.compact;

  if (!openId) {
    return (
      <>
        <PageHeader
          title="Audiobooks"
          subtitle={
            list.data
              ? books.length
                ? `${books.length} ${books.length === 1 ? "book" : "books"} on your server`
                : "No books on your server"
              : undefined
          }
        />
        {!list.data ? (
          list.error ? (
            <EmptyState
              icon="server"
              title="Could not load audiobooks"
              message="Check your connection, then try this view again."
              action="Try again"
              onAction={() => list.refetch()}
            />
          ) : (
            <Busy label="Loading audiobooks" />
          )
        ) : books.length ? (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: spacing.lg,
            }}
          >
            {books.map((item: Book) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`${item.title} by ${item.author}, ${
                  item.progress
                    ? `continue chapter ${(item.progress.chapterIndex ?? 0) + 1}`
                    : `${item.chapterCount} chapters`
                }`}
                onPress={() => setOpenId(item.id)}
                style={({ pressed }) => ({
                  width: 172,
                  gap: spacing.sm,
                  opacity: pressed ? 0.65 : 1,
                })}
              >
                {item.hasCover ? (
                  <Image
                    accessibilityLabel={`Cover of ${item.title}`}
                    source={{ uri: session!.api.bookCoverUrl(item.id) }}
                    style={{
                      width: "100%",
                      aspectRatio: 1,
                      borderRadius: radius.sm,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: "100%",
                      aspectRatio: 1,
                      borderRadius: radius.sm,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.accentSoft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name="note" size={40} color={colors.faint} />
                  </View>
                )}
                <View style={{ gap: 2 }}>
                  <View style={{ minHeight: 44 }}>
                    <Text
                      numberOfLines={2}
                      style={{
                        color: colors.text,
                        ...type.meta,
                        fontFamily: font.uiMedium,
                      }}
                    >
                      {item.title}
                    </Text>
                  </View>
                  <Text
                    numberOfLines={1}
                    style={{ color: colors.muted, ...type.meta }}
                  >
                    {item.author}
                  </Text>
                  <Text style={{ color: colors.faint, ...type.micro }}>
                    {item.progress
                      ? `Continue · chapter ${(item.progress.chapterIndex ?? 0) + 1}`
                      : `${item.chapterCount} chapters · ${clock(item.duration)}`}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <EmptyState
            icon="note"
            title="No audiobooks yet"
            message="Add folders to audiobooks/Author/Title and rescan from Manage."
          />
        )}
      </>
    );
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="All audiobooks"
        onPress={() => setOpenId(null)}
        style={({ pressed }) => ({
          alignSelf: "flex-start",
          minHeight: 44,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Icon name="chevronLeft" size={16} color={colors.muted} />
        <Text style={{ color: colors.muted, ...type.meta }}>
          All audiobooks
        </Text>
      </Pressable>
      {!book ? (
        detail.error ? (
          <EmptyState
            icon="server"
            title="Could not load this book"
            message="Check your connection, then try again."
            action="Try again"
            onAction={() => detail.refetch()}
          />
        ) : (
          <Busy label="Loading book" />
        )
      ) : (
        <>
          <View
            style={{
              flexDirection: compact ? "column" : "row",
              gap: spacing.xxl,
            }}
          >
            {book.hasCover ? (
              <Image
                accessibilityLabel={`Cover of ${book.title}`}
                source={{ uri: session!.api.bookCoverUrl(book.id) }}
                style={{
                  width: compact ? "100%" : 168,
                  maxWidth: compact ? 260 : undefined,
                  aspectRatio: 1,
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                }}
              />
            ) : (
              <View
                style={{
                  width: compact ? "100%" : 168,
                  maxWidth: compact ? 260 : undefined,
                  aspectRatio: 1,
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                  backgroundColor: colors.accentSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="note" size={56} color={colors.faint} />
              </View>
            )}
            <View
              style={{
                flex: 1,
                gap: spacing.sm,
                justifyContent: "center",
                paddingVertical: spacing.sm,
              }}
            >
              <Text style={{ color: colors.text, ...type.display }}>
                {book.title}
              </Text>
              <Text style={{ color: colors.muted, ...type.body }}>
                {book.author}
              </Text>
              <Text style={{ color: colors.faint, ...type.meta }}>
                {book.chapterCount} chapters · {clock(book.duration)}
                {progress
                  ? ` · saved at chapter ${resumeIndex + 1}, ${clock(progress.position)}`
                  : ""}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  mine && playing
                    ? "Pause audiobook"
                    : progress
                      ? "Continue audiobook"
                      : "Play audiobook"
                }
                onPress={() =>
                  mine
                    ? toggle()
                    : start(book, resumeIndex, progress?.position ?? 0)
                }
                style={({ pressed }) => ({
                  alignSelf: "flex-start",
                  marginTop: spacing.sm,
                  minHeight: 48,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  paddingHorizontal: spacing.xl,
                  borderRadius: radius.sm,
                  backgroundColor: colors.accent,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Icon
                  name={mine && playing ? "pause" : "play"}
                  size={16}
                  color={colors.onAccent}
                />
                <Text
                  style={{
                    color: colors.onAccent,
                    ...type.meta,
                    fontFamily: font.uiMedium,
                  }}
                >
                  {mine && playing ? "Pause" : progress ? "Continue" : "Play"}
                </Text>
              </Pressable>
            </View>
          </View>

          {mine && currentChapter ? (
            <View
              style={{
                gap: spacing.md,
                padding: spacing.lg,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.sm,
                backgroundColor: colors.surfaceInset,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: spacing.md,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{ flex: 1, color: colors.text, ...type.heading }}
                >
                  {currentChapter.title}
                </Text>
                <Text style={{ color: colors.faint, ...type.numeric }}>
                  {clock(position)} / {clock(currentChapter.duration)}
                </Text>
              </View>
              <input
                type="range"
                aria-label="Chapter position"
                min={0}
                max={Math.max(1, currentChapter.duration)}
                value={position}
                step={1}
                style={{
                  width: "100%",
                  minHeight: 44,
                  accentColor: colors.accent,
                }}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (audio.current) audio.current.currentTime = value;
                  setPosition(value);
                }}
              />
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: spacing.xs,
                }}
              >
                <IconButton
                  name="previous"
                  label="Previous chapter"
                  iconSize={18}
                  onPress={() => start(book, Math.max(0, active!.index - 1), 0)}
                />
                <IconButton
                  name="retry"
                  label="Back 15 seconds"
                  iconSize={16}
                  onPress={() => {
                    const el = audio.current;
                    if (el) el.currentTime = Math.max(0, el.currentTime - 15);
                  }}
                />
                <IconButton
                  name={playing ? "pause" : "play"}
                  label={playing ? "Pause" : "Play"}
                  variant="filled"
                  size={44}
                  iconSize={18}
                  onPress={() => toggle()}
                />
                <IconButton
                  name="repeat"
                  label="Forward 30 seconds"
                  iconSize={16}
                  onPress={() => {
                    const el = audio.current;
                    if (!el) return;
                    el.currentTime = Math.min(
                      el.duration || currentChapter.duration,
                      el.currentTime + 30,
                    );
                  }}
                />
                <IconButton
                  name="next"
                  label="Next chapter"
                  iconSize={18}
                  onPress={() => start(book, active!.index + 1, 0)}
                />
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: spacing.sm,
                }}
              >
                <Text
                  style={{
                    color: colors.muted,
                    ...type.meta,
                    marginRight: spacing.xs,
                  }}
                >
                  Speed
                </Text>
                {RATES.map((value) => (
                  <Chip
                    key={value}
                    title={`${value}×`}
                    label={`Playback speed ${value} times`}
                    active={value === rate}
                    onPress={() => setRate(value)}
                  />
                ))}
              </View>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.lg,
                }}
              >
                <label
                  style={{
                    flex: 1,
                    minWidth: 200,
                    display: "flex",
                    flexDirection: "column",
                    gap: spacing.xs,
                    color: colors.muted,
                    fontSize: type.meta.fontSize,
                    fontFamily: font.uiMedium,
                  }}
                >
                  Volume · {Math.round(volume * 100)}%
                  <input
                    type="range"
                    aria-label="Audiobook volume"
                    min={0}
                    max={1}
                    step={0.01}
                    value={volume}
                    onChange={(event) => setVolume(Number(event.target.value))}
                    style={{
                      width: "100%",
                      minHeight: 44,
                      accentColor: colors.accent,
                    }}
                  />
                </label>
                <label
                  style={{
                    minWidth: 180,
                    display: "flex",
                    flexDirection: "column",
                    gap: spacing.xs,
                    color: colors.muted,
                    fontSize: type.meta.fontSize,
                    fontFamily: font.uiMedium,
                  }}
                >
                  Sleep timer
                  <select
                    aria-label="Sleep timer"
                    value={sleepMinutes}
                    onChange={(event) =>
                      setSleepMinutes(Number(event.target.value))
                    }
                    style={{
                      minHeight: 44,
                      paddingLeft: spacing.md,
                      paddingRight: spacing.md,
                      borderRadius: radius.sm,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surfaceInset,
                      color: colors.text,
                      fontSize: type.meta.fontSize,
                    }}
                  >
                    {[0, 15, 30, 60].map((m) => (
                      <option key={m} value={m}>
                        {m ? `${m} minutes` : "Off"}
                      </option>
                    ))}
                  </select>
                </label>
              </View>
              {!!error && (
                <Text
                  accessibilityRole="alert"
                  style={{ color: colors.danger, ...type.meta }}
                >
                  {error}
                </Text>
              )}
            </View>
          ) : null}

          <View style={{ gap: spacing.xs }}>
            <SectionTitle title="Chapters" />
            {book.chapters.map((chapter, index) => {
              const on = !!(mine && active!.index === index);
              return (
                <Pressable
                  key={chapter.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Play chapter ${index + 1}, ${chapter.title}${on ? ", playing now" : ""}`}
                  onPress={() => start(book, index, 0)}
                  style={({ pressed }) => ({
                    minHeight: 48,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                    paddingVertical: spacing.sm,
                    paddingHorizontal: spacing.md,
                    backgroundColor: on ? colors.accentSoft : "transparent",
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    opacity: pressed ? 0.65 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: on ? colors.accent : colors.faint,
                      width: 28,
                      ...type.numeric,
                    }}
                  >
                    {index + 1}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{ flex: 1, color: colors.text, ...type.body }}
                  >
                    {chapter.title}
                  </Text>
                  <Text style={{ color: colors.faint, ...type.numeric }}>
                    {clock(chapter.duration)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </>
  );
}
