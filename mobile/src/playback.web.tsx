import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useSession } from "./session";
import { addressOrder, type Song } from "./api";
import {
  type Queue,
  emptyQueue,
  collection,
  shuffleQueue,
  insert,
  remove,
  move,
  nextIndex,
  restoreQueue,
} from "./queue";
import { read, write } from "./db";
import { stringList } from "./library";

const PlaybackContext = createContext<ReturnType<typeof useController> | null>(
  null,
);

function useController() {
  const { session } = useSession();
  if (!session) throw new Error("Connection required");
  const { api, scope } = session;
  const audio = useRef<HTMLAudioElement | null>(null);
  const [queue, setQueue] = useState<Queue>(() =>
    restoreQueue(read<unknown>(scope, "queue", null)),
  );
  const ref = useRef(queue);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [sleep, setSleep] = useState<number | null>(null);
  const [sleepAfterTrack, setSleepAfterTrack] = useState(false);
  const sleepAfter = useRef(false);
  const sleepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playIntent = useRef(false);
  const failed = useRef(0);
  const lastPlayed = useRef("");
  const [volume, setVolumeState] = useState(1);
  const [status, setStatus] = useState({
    currentIndex: 0,
    playing: false,
    currentTime: 0,
    duration: 0,
    isLoaded: false,
    isBuffering: false,
  });

  function commit(q: Queue) {
    ref.current = q;
    setQueue(q);
    write(scope, "queue", q);
  }

  function element() {
    if (audio.current) return audio.current;
    if (typeof window === "undefined") return null;
    const value = new window.Audio();
    value.preload = "auto";
    value.volume = volume;
    value.addEventListener("timeupdate", () =>
      setStatus((current) => ({
        ...current,
        currentTime: value.currentTime,
        duration: Number.isFinite(value.duration)
          ? value.duration
          : current.duration,
      })),
    );
    value.addEventListener("loadedmetadata", () =>
      setStatus((current) => ({
        ...current,
        isLoaded: true,
        duration: Number.isFinite(value.duration)
          ? value.duration
          : current.duration,
      })),
    );
    value.addEventListener("play", () =>
      setStatus((current) => ({ ...current, playing: true })),
    );
    value.addEventListener("pause", () =>
      setStatus((current) => ({ ...current, playing: false })),
    );
    value.addEventListener("waiting", () =>
      setStatus((current) => ({ ...current, isBuffering: true })),
    );
    value.addEventListener("canplay", () =>
      setStatus((current) => ({ ...current, isBuffering: false })),
    );
    value.addEventListener("playing", () => {
      failed.current = 0;
      setStatus((current) => ({
        ...current,
        isBuffering: false,
        isLoaded: true,
        playing: true,
      }));
    });
    value.addEventListener("ended", () => void ended());
    value.addEventListener("error", () => void playbackError());
    audio.current = value;
    return value;
  }

  function currentEntry() {
    return ref.current.entries[ref.current.index];
  }

  async function loadCurrent(play: boolean) {
    const media = element();
    const entry = currentEntry();
    if (!media || !entry) return;
    setStatus((current) => ({
      ...current,
      currentIndex: ref.current.index,
      currentTime: 0,
      duration: entry.song.duration,
      isLoaded: false,
      isBuffering: true,
    }));
    media.src = api.streamUrl(entry.song.id);
    media.load();
    if (!play) {
      media.pause();
      playIntent.current = false;
      setBusy("");
      return;
    }
    playIntent.current = true;
    setBusy("Preparing audio…");
    try {
      await media.play();
      setError("");
      if (lastPlayed.current !== entry.key) {
        lastPlayed.current = entry.key;
        const played = stringList(read(scope, "local-played", []));
        write(
          scope,
          "local-played",
          [entry.song.id, ...played.filter((id) => id !== entry.song.id)].slice(
            0,
            500,
          ),
        );
        void api.rest("scrobble", { id: entry.song.id }).catch(() => {});
      }
    } catch {
      setBusy("");
      if (playIntent.current)
        setError(
          "Playback could not start. Check that the server is reachable and the track is downloaded there.",
        );
    } finally {
      setBusy("");
    }
  }

  async function playbackError() {
    if (!playIntent.current) return;
    const ordered = addressOrder(api.addresses, api.activeServer);
    if (failed.current < ordered.length - 1) {
      failed.current++;
      const next = ordered[failed.current] ?? ordered[0]!;
      api.preferServer(next);
      await loadCurrent(true);
      return;
    }
    setStatus((current) => ({ ...current, playing: false }));
    setBusy("");
    setError(
      "Cannot play this track. Check your server, the file format and the current network route.",
    );
  }

  async function ended() {
    const q = ref.current;
    playIntent.current = false;
    if (sleepAfter.current) {
      sleepAfter.current = false;
      setSleepAfterTrack(false);
      setStatus((current) => ({ ...current, playing: false }));
      return;
    }
    if (q.repeat === "single") {
      const media = element();
      if (media) {
        media.currentTime = 0;
        playIntent.current = true;
        await media.play().catch(() => {});
      }
      return;
    }
    const next = nextIndex(q, true);
    if (next === null) {
      setStatus((current) => ({ ...current, playing: false }));
      return;
    }
    commit({ ...q, index: next, position: 0 });
    await loadCurrent(true);
  }

  useEffect(() => {
    if (!ref.current.entries.length) return;
    setStatus((current) => ({
      ...current,
      currentIndex: ref.current.index,
      duration: ref.current.entries[ref.current.index]?.song.duration ?? 0,
    }));
    void loadCurrent(false);
    return () => {
      playIntent.current = false;
      audio.current?.pause();
      if (sleepTimer.current) clearTimeout(sleepTimer.current);
    };
    // The initial queue is restored once for this account.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pause() {
    playIntent.current = false;
    audio.current?.pause();
    setBusy("");
  }

  function sleepFor(minutes: number) {
    if (sleepTimer.current) clearTimeout(sleepTimer.current);
    sleepTimer.current = null;
    sleepAfter.current = false;
    setSleepAfterTrack(false);
    if (!minutes) {
      setSleep(null);
      return;
    }
    setSleep(Date.now() + minutes * 60000);
    sleepTimer.current = setTimeout(() => {
      playIntent.current = false;
      audio.current?.pause();
      setSleep(null);
    }, minutes * 60000);
  }

  async function select(songs: Song[], index: number) {
    const selected = songs[index];
    if (!selected) return;
    setError("");
    failed.current = 0;
    commit(collection(songs, index));
    await loadCurrent(true);
  }

  async function edit(q: Queue) {
    const previous = ref.current;
    const currentKey = previous.entries[previous.index]?.key;
    commit(q);
    if (!q.entries.length) {
      pause();
      audio.current?.removeAttribute("src");
      setError("");
      sleepFor(0);
      return;
    }
    if (q.entries[q.index]?.key !== currentKey) await loadCurrent(playIntent.current);
  }

  const value = {
    queue,
    status,
    error,
    busy,
    sleep,
    sleepAfterTrack,
    volume,
    setVolume(next: number) {
      const bounded = Math.max(0, Math.min(1, next));
      setVolumeState(bounded);
      if (audio.current) audio.current.volume = bounded;
    },
    select,
    enqueue: async (song: Song, next: boolean) => {
      await edit(insert(ref.current, song, next));
    },
    refreshSources: (play = false) => loadCurrent(play),
    restore: async (restored: Queue) => {
      pause();
      sleepFor(0);
      commit(restored);
      await loadCurrent(false);
    },
    pause,
    toggle: async () => {
      const media = element();
      if (!media || !ref.current.entries.length) return;
      if (!media.src || media.src === "") return loadCurrent(true);
      if (media.paused) {
        playIntent.current = true;
        try {
          await media.play();
          setError("");
        } catch {
          setError("Playback could not resume. Retry the track.");
        }
      } else {
        pause();
      }
    },
    next: async () => {
      const next = nextIndex(ref.current, false);
      if (next === null) return;
      pausedState();
      commit({ ...ref.current, index: next, position: 0 });
      await loadCurrent(true);
    },
    previous: async () => {
      const media = element();
      if (media && media.currentTime > 3) {
        media.currentTime = 0;
        return;
      }
      const index = Math.max(0, ref.current.index - 1);
      if (index === ref.current.index) {
        if (media) media.currentTime = 0;
        return;
      }
      pausedState();
      commit({ ...ref.current, index, position: 0 });
      await loadCurrent(true);
    },
    seek: async (seconds: number) => {
      const media = element();
      if (!media) return;
      media.currentTime = Math.max(0, seconds);
    },
    retry: async () => {
      failed.current = 0;
      setError("");
      await loadCurrent(true);
    },
    shuffle: async () => {
      const next = shuffleQueue(ref.current);
      commit(next);
    },
    repeat: () => {
      const repeat =
        ref.current.repeat === "none"
          ? "all"
          : ref.current.repeat === "all"
            ? "single"
            : "none";
      commit({ ...ref.current, repeat });
    },
    remove: async (index: number) => {
      await edit(remove(ref.current, index));
    },
    move: async (index: number, to: number) => {
      await edit(move(ref.current, index, to));
    },
    drop: async (ids: Set<string>) => {
      const entries = ref.current.entries.filter((entry) => !ids.has(entry.song.id));
      if (entries.length === ref.current.entries.length) return;
      const currentKey = ref.current.entries[ref.current.index]?.key;
      const index = entries.findIndex((entry) => entry.key === currentKey);
      await edit({
        ...ref.current,
        entries,
        original: ref.current.original.filter((key) =>
          entries.some((entry) => entry.key === key),
        ),
        index:
          index >= 0
            ? index
            : Math.min(ref.current.index, Math.max(0, entries.length - 1)),
        position: index >= 0 ? ref.current.position : 0,
      });
    },
    clear: async () => {
      pause();
      playIntent.current = false;
      audio.current?.removeAttribute("src");
      setError("");
      sleepFor(0);
      await edit(emptyQueue());
    },
    skip: async (index: number) => {
      if (!ref.current.entries[index]) return;
      pausedState();
      commit({ ...ref.current, index, position: 0 });
      await loadCurrent(true);
    },
    sleepFor,
    sleepAfterCurrent: () => {
      sleepFor(0);
      sleepAfter.current = true;
      setSleepAfterTrack(true);
    },
  };

  function pausedState() {
    playIntent.current = true;
    audio.current?.pause();
  }

  return value;
}

export function PlaybackProvider({ children }: { children: React.ReactNode }) {
  const value = useController();
  return (
    <PlaybackContext.Provider value={value}>
      {children}
    </PlaybackContext.Provider>
  );
}

export function usePlayback() {
  const value = useContext(PlaybackContext);
  if (!value) throw new Error("Playback unavailable");
  return value;
}
