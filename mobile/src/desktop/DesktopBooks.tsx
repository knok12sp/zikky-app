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
import { usePlayback } from "../playback";
import { useSession } from "../session";
import { radius, spacing, type } from "../theme";
import { useTheme } from "../ui";

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
  const columns = width >= 1500 ? 5 : width >= 1180 ? 4 : 3;
  const card = Math.max(150, Math.floor((width - 300) / columns) - spacing.lg);

  if (!openId) {
    return (
      <>
        <View style={{ gap: spacing.xs }}>
          <Text style={{ color: colors.text, ...type.display }}>
            Audiobooks
          </Text>
          <Text style={{ color: colors.muted, ...type.meta }}>
            {list.data?.books.length
              ? `${list.data.books.length} books on your server`
              : "Add folders to audiobooks/Author/Title and rescan from Manage."}
          </Text>
        </View>
        <View
          style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.lg }}
        >
          {(list.data?.books ?? []).map((item: Book) => (
            <Pressable
              key={item.id}
              onPress={() => setOpenId(item.id)}
              style={{
                width: card,
                gap: spacing.sm,
                padding: spacing.sm,
                borderRadius: radius.lg,
                backgroundColor: colors.surface,
              }}
            >
              {item.hasCover ? (
                <Image
                  source={{ uri: session!.api.bookCoverUrl(item.id) }}
                  style={{
                    width: "100%",
                    aspectRatio: 1,
                    borderRadius: radius.md,
                  }}
                />
              ) : (
                <View
                  style={{
                    width: "100%",
                    aspectRatio: 1,
                    borderRadius: radius.md,
                    backgroundColor: colors.accentSoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: colors.accent, fontSize: 44 }}>
                    {item.title.slice(0, 1)}
                  </Text>
                </View>
              )}
              <Text
                numberOfLines={1}
                style={{ color: colors.text, ...type.body }}
              >
                {item.title}
              </Text>
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
            </Pressable>
          ))}
        </View>
      </>
    );
  }

  return (
    <>
      <Pressable
        onPress={() => setOpenId(null)}
        style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}
      >
        <Icon name="chevronLeft" size={16} color={colors.muted} />
        <Text style={{ color: colors.muted, ...type.meta }}>
          All audiobooks
        </Text>
      </Pressable>
      {!book ? (
        <Text style={{ color: colors.muted, ...type.body }}>
          {detail.error
            ? "Could not load book. Open All audiobooks and try again."
            : "Loading…"}
        </Text>
      ) : (
        <>
          <View style={{ flexDirection: "row", gap: spacing.xxl }}>
            {book.hasCover ? (
              <Image
                source={{ uri: session!.api.bookCoverUrl(book.id) }}
                style={{ width: 220, height: 220, borderRadius: radius.lg }}
              />
            ) : (
              <View
                style={{
                  width: 220,
                  height: 220,
                  borderRadius: radius.lg,
                  backgroundColor: colors.accentSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: colors.accent, fontSize: 64 }}>
                  {book.title.slice(0, 1)}
                </Text>
              </View>
            )}
            <View
              style={{ flex: 1, gap: spacing.sm, justifyContent: "center" }}
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
              <View
                style={{
                  flexDirection: "row",
                  gap: spacing.md,
                  marginTop: spacing.sm,
                }}
              >
                <Pressable
                  onPress={() =>
                    mine
                      ? toggle()
                      : start(book, resumeIndex, progress?.position ?? 0)
                  }
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                    paddingVertical: spacing.md,
                    paddingHorizontal: spacing.xl,
                    borderRadius: radius.pill,
                    backgroundColor: colors.accent,
                  }}
                >
                  <Icon
                    name={mine && playing ? "pause" : "play"}
                    size={16}
                    color={colors.onAccent}
                  />
                  <Text style={{ color: colors.onAccent, ...type.meta }}>
                    {mine && playing ? "Pause" : progress ? "Continue" : "Play"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          {mine && currentChapter ? (
            <View
              style={{
                padding: spacing.lg,
                borderRadius: radius.lg,
                backgroundColor: colors.surface,
                gap: spacing.md,
              }}
            >
              <Text style={{ color: colors.text, ...type.heading }}>
                {currentChapter.title}
              </Text>
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
              <label style={{ color: colors.muted }}>
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
              <label style={{ color: colors.muted }}>
                Sleep timer{" "}
                <select
                  aria-label="Sleep timer"
                  value={sleepMinutes}
                  onChange={(event) =>
                    setSleepMinutes(Number(event.target.value))
                  }
                  style={{ minHeight: 44 }}
                >
                  {[0, 15, 30, 60].map((m) => (
                    <option key={m} value={m}>
                      {m ? `${m} minutes` : "Off"}
                    </option>
                  ))}
                </select>
              </label>
              {!!error && (
                <Text accessibilityRole="alert" style={{ color: colors.muted }}>
                  {error}
                </Text>
              )}
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: spacing.lg,
                }}
              >
                <Text style={{ color: colors.faint, ...type.numeric }}>
                  {clock(position)} / {clock(currentChapter.duration)}
                </Text>
                <Pressable
                  onPress={() => start(book, Math.max(0, active!.index - 1), 0)}
                  accessibilityLabel="Previous chapter"
                >
                  <Icon name="previous" size={18} color={colors.text} />
                </Pressable>
                <Pressable
                  onPress={() => {
                    const el = audio.current;
                    if (el) el.currentTime = Math.max(0, el.currentTime - 15);
                  }}
                  accessibilityLabel="Back 15 seconds"
                >
                  <Icon name="retry" size={16} color={colors.text} />
                </Pressable>
                <Pressable
                  onPress={() => toggle()}
                  accessibilityLabel={playing ? "Pause" : "Play"}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: radius.pill,
                    backgroundColor: colors.accent,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon
                    name={playing ? "pause" : "play"}
                    size={16}
                    color={colors.onAccent}
                  />
                </Pressable>
                <Pressable
                  onPress={() => {
                    const el = audio.current;
                    if (!el) return;
                    el.currentTime = Math.min(
                      el.duration || currentChapter.duration,
                      el.currentTime + 30,
                    );
                  }}
                  accessibilityLabel="Forward 30 seconds"
                >
                  <Icon name="repeat" size={16} color={colors.text} />
                </Pressable>
                <Pressable
                  onPress={() => start(book, active!.index + 1, 0)}
                  accessibilityLabel="Next chapter"
                >
                  <Icon name="next" size={18} color={colors.text} />
                </Pressable>
                <View style={{ flex: 1 }} />
                {RATES.map((value) => (
                  <Pressable key={value} onPress={() => setRate(value)}>
                    <Text
                      style={{
                        color: value === rate ? colors.accent : colors.faint,
                        ...type.micro,
                      }}
                    >
                      {value}×
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <View style={{ gap: spacing.xs }}>
            {book.chapters.map((chapter, index) => {
              const on = mine && active!.index === index;
              return (
                <Pressable
                  key={chapter.id}
                  onPress={() => start(book, index, 0)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                    paddingVertical: spacing.sm,
                    paddingHorizontal: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: on ? colors.accentSoft : "transparent",
                  }}
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
