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
  const failed = useRef(new Set<string>());
  const generation = useRef(0);
  const sourceServer = useRef(api.activeServer);
  const listeners = useRef<AbortController | null>(null);
  const pendingPosition = useRef<number | null>(null);
  const checkpointAt = useRef(0);
  const lastPlayed = useRef("");
  const [volume, setVolumeState] = useState(() => {
    const saved = read<unknown>(scope, "volume", 1);
    return typeof saved === "number" && Number.isFinite(saved)
      ? Math.max(0, Math.min(1, saved))
      : 1;
  });
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
    setStatus((current) => ({ ...current, currentIndex: q.index }));
    write(scope, "queue", q);
  }

  function element() {
    if (audio.current) return audio.current;
    if (typeof window === "undefined") return null;
    const value = new window.Audio();
    value.preload = "auto";
    value.volume = volume;
    const controller = new AbortController();
    listeners.current = controller;
    const on = (event: string, callback: () => void) =>
      value.addEventListener(event, callback, { signal: controller.signal });
    on("timeupdate", () => {
      if (!currentEntry() || pendingPosition.current !== null) return;
      const position = Number.isFinite(value.currentTime)
        ? value.currentTime
        : 0;
      ref.current = { ...ref.current, position };
      if (Date.now() - checkpointAt.current >= 5000) checkpoint();
      setStatus((current) => ({
        ...current,
        currentTime: position,
        duration: Number.isFinite(value.duration)
          ? value.duration
          : current.duration,
      }));
    });
    on("loadedmetadata", () => {
      if (pendingPosition.current !== null) {
        value.currentTime = Math.min(
          pendingPosition.current,
          Number.isFinite(value.duration) ? value.duration : Infinity,
        );
        pendingPosition.current = null;
      }
      setStatus((current) => ({
        ...current,
        currentTime: value.currentTime,
        isLoaded: true,
        duration: Number.isFinite(value.duration)
          ? value.duration
          : current.duration,
      }));
    });
    on("play", () => setStatus((current) => ({ ...current, playing: true })));
    on("pause", () => {
      checkpoint();
      setStatus((current) => ({ ...current, playing: false }));
    });
    on("waiting", () =>
      setStatus((current) => ({ ...current, isBuffering: true })),
    );
    on("canplay", () =>
      setStatus((current) => ({ ...current, isBuffering: false })),
    );
    on("playing", () => {
      failed.current.clear();
      const entry = currentEntry();
      if (entry && lastPlayed.current !== entry.key) {
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
      setStatus((current) => ({
        ...current,
        isBuffering: false,
        isLoaded: true,
        playing: true,
      }));
    });
    on("ended", () => void ended());
    on("error", () => void playbackError());
    audio.current = value;
    return value;
  }

  function currentEntry() {
    return ref.current.entries[ref.current.index];
  }

  function checkpoint() {
    write(scope, "queue", ref.current);
    checkpointAt.current = Date.now();
  }

  async function loadCurrent(play: boolean) {
    const token = ++generation.current;
    const media = element();
    const entry = currentEntry();
    if (!media || !entry) return;
    setStatus((current) => ({
      ...current,
      currentIndex: ref.current.index,
      currentTime: ref.current.position,
      duration: entry.song.duration,
      isLoaded: false,
      isBuffering: true,
    }));
    pendingPosition.current = ref.current.position;
    media.preload = play ? "auto" : "metadata";
    sourceServer.current = api.activeServer;
    media.src = api.streamUrl(entry.song.id, sourceServer.current);
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
      if (token !== generation.current) return;
      setError("");
    } catch {
      if (token === generation.current && playIntent.current)
        setError(
          "Playback could not start. Check that the server is reachable and the track is downloaded there.",
        );
    } finally {
      if (token === generation.current) setBusy("");
    }
  }

  async function playbackError() {
    if (!playIntent.current) return;
    failed.current.add(sourceServer.current);
    const next = addressOrder(api.addresses, sourceServer.current).find(
      (address) => !failed.current.has(address),
    );
    if (next) {
      api.preferServer(next);
      await loadCurrent(true);
      return;
    }
    generation.current++;
    playIntent.current = false;
    setStatus((current) => ({
      ...current,
      playing: false,
      isBuffering: false,
    }));
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
    if (ref.current.entries.length) void loadCurrent(false);
    return () => {
      generation.current++;
      playIntent.current = false;
      checkpoint();
      listeners.current?.abort();
      audio.current?.pause();
      audio.current?.removeAttribute("src");
      audio.current?.load();
      audio.current = null;
      if (sleepTimer.current) clearTimeout(sleepTimer.current);
    };
    // The initial queue is restored once for this account.
  }, []);

  function pause() {
    generation.current++;
    playIntent.current = false;
    checkpoint();
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
      pause();
      setSleep(null);
    }, minutes * 60000);
  }

  async function select(songs: Song[], index: number) {
    const selected = songs[index];
    if (!selected) return;
    setError("");
    failed.current.clear();
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
      audio.current?.load();
      pendingPosition.current = null;
      setStatus({
        currentIndex: 0,
        currentTime: 0,
        duration: 0,
        playing: false,
        isLoaded: false,
        isBuffering: false,
      });
      setError("");
      sleepFor(0);
      return;
    }
    if (q.entries[q.index]?.key !== currentKey)
      await loadCurrent(playIntent.current);
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
      if (!Number.isFinite(next)) return;
      const bounded = Math.max(0, Math.min(1, next));
      setVolumeState(bounded);
      write(scope, "volume", bounded);
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
      if (!restored.entries.length) return edit(restored);
      commit(restored);
      await loadCurrent(false);
    },
    pause,
    toggle: async () => {
      const media = element();
      if (!media || !ref.current.entries.length) return;
      if (!media.src || media.src === "") return loadCurrent(true);
      if (media.paused) {
        const token = ++generation.current;
        playIntent.current = true;
        try {
          await media.play();
          if (token === generation.current) setError("");
        } catch {
          if (token === generation.current)
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
      const index =
        ref.current.index === 0 && ref.current.repeat === "all"
          ? ref.current.entries.length - 1
          : Math.max(0, ref.current.index - 1);
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
      if (!media || !Number.isFinite(seconds)) return;
      const position = Math.max(
        0,
        Math.min(
          seconds,
          Number.isFinite(media.duration) ? media.duration : Infinity,
        ),
      );
      if (pendingPosition.current !== null) pendingPosition.current = position;
      else media.currentTime = position;
      commit({ ...ref.current, position });
    },
    retry: async () => {
      failed.current.clear();
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
      const entries = ref.current.entries.filter(
        (entry) => !ids.has(entry.song.id),
      );
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

  const controls = useRef(value);
  controls.current = value;
  useEffect(() => {
    const mediaSession =
      typeof navigator !== "undefined" ? navigator.mediaSession : undefined;
    if (!mediaSession) return;
    const handlers: Partial<
      Record<MediaSessionAction, MediaSessionActionHandler>
    > = {
      play: () => {
        if (audio.current?.paused) void controls.current.toggle();
      },
      pause: () => controls.current.pause(),
      stop: () => {
        controls.current.pause();
        void controls.current.seek(0);
      },
      nexttrack: () => void controls.current.next(),
      previoustrack: () => void controls.current.previous(),
      seekto: (details) => {
        if (details.seekTime !== undefined)
          void controls.current.seek(details.seekTime);
      },
      seekforward: (details) =>
        void controls.current.seek(
          (audio.current?.currentTime ?? 0) + (details.seekOffset ?? 10),
        ),
      seekbackward: (details) =>
        void controls.current.seek(
          (audio.current?.currentTime ?? 0) - (details.seekOffset ?? 10),
        ),
    };
    for (const [action, handler] of Object.entries(handlers)) {
      try {
        mediaSession.setActionHandler(action as MediaSessionAction, handler);
      } catch {
        /* Some webviews implement only a subset of media actions. */
      }
    }
    return () => {
      for (const action of Object.keys(handlers)) {
        try {
          mediaSession.setActionHandler(action as MediaSessionAction, null);
        } catch {
          /* Unsupported action. */
        }
      }
      mediaSession.metadata = null;
      mediaSession.playbackState = "none";
    };
  }, []);

  const song = queue.entries[queue.index]?.song;
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaSession) return;
    if (typeof MediaMetadata !== "undefined") {
      navigator.mediaSession.metadata = song
        ? new MediaMetadata({
            title: song.title,
            artist: song.artist,
            album: song.album ?? "",
          })
        : null;
    }
  }, [song]);
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaSession) return;
    navigator.mediaSession.playbackState = !song
      ? "none"
      : status.playing
        ? "playing"
        : "paused";
    if (navigator.mediaSession.setPositionState) {
      if (song && status.duration > 0 && Number.isFinite(status.duration)) {
        navigator.mediaSession.setPositionState({
          duration: status.duration,
          position: Math.max(0, Math.min(status.currentTime, status.duration)),
          playbackRate: 1,
        });
      } else navigator.mediaSession.setPositionState();
    }
  }, [song, status.playing, status.currentTime, status.duration]);

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
