import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAudioPlaylist, useAudioPlaylistStatus } from "expo-audio";
import { BookDetail } from "./api";
import { useSession } from "./session";
import { usePlayback } from "./playback";
import { claimAudio, onAudioOwnerChange } from "./audio-owner";

type Current = { book: BookDetail; index: number };

type BookPlayback = {
  current: Current | null;
  chapterIndex: number;
  playing: boolean;
  position: number;
  rate: number;
  volume: number;
  setVolume: (volume: number) => void;
  sleepMinutes: number;
  setSleepMinutes: (minutes: number) => void;
  error: string;
  start: (book: BookDetail, index: number, position: number) => Promise<void>;
  toggle: () => void;
  seek: (seconds: number) => void;
  next: () => void;
  previous: () => void;
  setRate: (rate: number) => void;
  stop: () => void;
};

const Context = createContext<BookPlayback | null>(null);
export const useBookPlayback = () => useContext(Context)!;

export const BOOK_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];

/** Audiobook player: one book at a time, progress saved per account. */
export function BookPlaybackProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session } = useSession();
  const music = usePlayback();
  const api = session?.api;
  const native = useAudioPlaylist({ updateInterval: 1000 }) as any;
  const status = useAudioPlaylistStatus(native);
  const [current, setCurrent] = useState<Current | null>(null);
  const [rate, setRateState] = useState(1);
  const [volume, setVolume] = useState(1);
  const [sleepMinutes, setSleepMinutes] = useState(0);
  const [error, setError] = useState("");
  const starting = useRef(false);
  useEffect(() => {
    native.volume = volume;
  }, [native, volume]);
  useEffect(() => {
    native.setSleepTimer(sleepMinutes * 60);
    return () => native.setSleepTimer(0);
  }, [native, sleepMinutes]);
  const currentRef = useRef<Current | null>(null);
  const statusRef = useRef(status);
  const savedAt = useRef(0);
  currentRef.current = current;
  statusRef.current = status;

  useEffect(() => {
    if ((status as any).sleepTimerActive === false) setSleepMinutes(0);
  }, [(status as any).sleepTimerActive]);

  useEffect(() => {
    const chapter = current?.book.chapters[status.currentIndex];
    if (current && chapter)
      native.updateLockScreenMetadata?.({
        title: chapter.title,
        artist: current.book.title,
        albumTitle: current.book.author,
      });
  }, [native, current, status.currentIndex]);

  const activeChapter = useCallback(() => {
    const c = currentRef.current;
    if (!c) return undefined;
    return (
      c.book.chapters[statusRef.current.currentIndex] ??
      c.book.chapters[c.index]
    );
  }, []);

  const save = useCallback(
    (force: boolean) => {
      const c = currentRef.current;
      const chapter = activeChapter();
      if (!api || !c || !chapter || starting.current) return;
      if (!force && Date.now() - savedAt.current < 10000) return;
      savedAt.current = Date.now();
      void api
        .saveBookProgress(c.book.id, chapter.id, statusRef.current.currentTime)
        .catch(() => {});
    },
    [api, activeChapter],
  );

  useEffect(() => {
    if (!current) return;
    const timer = setInterval(() => save(false), 10000);
    return () => clearInterval(timer);
  }, [current, save]);

  const wasPlaying = useRef(false);
  useEffect(() => {
    if (wasPlaying.current && !status.playing) save(true);
    wasPlaying.current = status.playing;
  }, [status.playing, save]);

  useEffect(() => {
    const unsubscribe = onAudioOwnerChange((owner) => {
      if (owner !== "music") return;
      save(true);
      native.pause();
    });
    return () => {
      unsubscribe();
      save(true);
      native.pause();
    };
  }, [native, save]);

  useEffect(() => {
    if (current) native.playbackRate = rate;
  }, [native, rate, current]);

  const start = async (book: BookDetail, index: number, position: number) => {
    if (!api || !book.chapters.length || starting.current) return;
    const safeIndex = Math.min(Math.max(index, 0), book.chapters.length - 1);
    save(true);
    starting.current = true;
    setError("");
    try {
      music.pause();
      claimAudio("book");
      currentRef.current = { book, index: safeIndex };
      setCurrent({ book, index: safeIndex });
      savedAt.current = 0;
      native.pause();
      native.clear();
      for (const chapter of book.chapters)
        native.add(api.bookChapterMedia(book.id, chapter.id));
      native.loop = "none";
      native.skipTo(safeIndex);
      if (position > 0) await native.seekTo(position);
      native.playbackRate = rate;
      const chapter = book.chapters[safeIndex]!;
      native.setActiveForLockScreen(true, {
        title: chapter.title,
        artist: book.title,
        albumTitle: book.author,
      });
      native.play();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not play this chapter.",
      );
    } finally {
      starting.current = false;
    }
  };

  const stop = () => {
    save(true);
    native.pause();
    native.clear();
    currentRef.current = null;
    setCurrent(null);
  };

  return (
    <Context.Provider
      value={{
        current,
        chapterIndex: status.currentIndex ?? current?.index ?? 0,
        playing: status.playing,
        position: status.currentTime,
        rate,
        volume,
        setVolume: (value) => setVolume(Math.max(0, Math.min(1, value))),
        sleepMinutes,
        setSleepMinutes,
        error,
        start,
        toggle: () => {
          if (status.playing) {
            save(true);
            native.pause();
          } else {
            music.pause();
            claimAudio("book");
            native.play();
          }
        },
        seek: (seconds: number) => {
          const duration = activeChapter()?.duration || Infinity;
          void native
            .seekTo(Math.max(0, Math.min(duration, seconds)))
            .catch(() => setError("Could not seek. Try again."));
        },
        next: () => native.next(),
        previous: () => {
          if (status.currentTime > 3) void native.seekTo(0);
          else native.previous();
        },
        setRate: (value: number) => setRateState(value),
        stop,
      }}
    >
      {children}
    </Context.Provider>
  );
}
