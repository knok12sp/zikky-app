import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
} from "react";
import {
  useAudioPlaylist,
  useAudioPlaylistStatus,
  setAudioModeAsync,
} from "expo-audio";
import { useSession } from "./session";
import { addressOrder, Song } from "./api";
import {
  Queue,
  emptyQueue,
  collection,
  shuffleQueue,
  insert,
  remove,
  move,
  restoreQueue,
} from "./queue";
import { read, write } from "./db";
import * as FS from "expo-file-system/legacy";
import { playbackSource } from "./playback-source";
import type { AudioPlaylist } from "expo-audio";
import { stringList } from "./library";
type NativePlaylist = AudioPlaylist & {
  setSleepTimer(seconds: number): void;
  setSleepAfterTrack(enabled: boolean): void;
};
const PlaybackContext = createContext<ReturnType<typeof useController> | null>(
  null,
);
function useController() {
  const { session } = useSession();
  if (!session) throw new Error("Connection required");
  const { api, offline, scope } = session;
  const native = useAudioPlaylist({ updateInterval: 1000 }) as NativePlaylist;
  const status = useAudioPlaylistStatus(native);
  const [queue, setQueue] = useState<Queue>(() =>
    restoreQueue(read<unknown>(scope, "queue", null)),
  );
  const ref = useRef(queue);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [sleep, setSleep] = useState<number | null>(null);
  const [sleepAfterTrack, setSleepAfterTrack] = useState(false);
  const generation = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const lastSelection = useRef<{ songs: Song[]; index: number } | null>(null);
  const lastPlayed = useRef("");
  const lastArtwork = useRef("");
  const lastPlaying = useRef(false);
  const failoverAttempts = useRef(new Set<string>());
  const sourceServers = useRef(new Map<string, string>());
  const audioSession = useRef<Promise<void> | null>(null);
  function ensureAudio() {
    return (audioSession.current ??= setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
      shouldRouteThroughEarpiece: false,
    }).catch((e) => {
      audioSession.current = null;
      throw e;
    }));
  }
  function commit(q: Queue) {
    ref.current = q;
    setQueue(q);
    write(scope, "queue", q);
  }
  const artworkPaths = useRef<Record<string, string>>({});
  const artworkPending = useRef(new Map<string, Promise<string | undefined>>());
  const artworkId = (song: Song) => song.coverArt ?? song.id;
  async function art(song: Song) {
    if (
      offline.local(song.id) &&
      (await FS.getInfoAsync(offline.artwork(song.id))).exists
    )
      return offline.artwork(song.id);
    const id = artworkId(song);
    const pendingArt = artworkPending.current.get(id);
    if (pendingArt) return pendingArt;
    const task = fetchArtwork(song);
    artworkPending.current.set(id, task);
    try {
      return await task;
    } finally {
      artworkPending.current.delete(id);
    }
  }
  async function fetchArtwork(song: Song): Promise<string | undefined> {
    const id = artworkId(song);
    const dir = FS.cacheDirectory + scope + "/art/";
    const path = dir + encodeURIComponent(id) + ".jpg";
    try {
      await FS.makeDirectoryAsync(dir, { intermediates: true });
      if (!(await FS.getInfoAsync(path)).exists) {
        const ordered = addressOrder(api.addresses, api.activeServer);
        let saved = false;
        for (const address of ordered) {
          const temporary = path + ".part";
          try {
            const result = await FS.downloadAsync(
              api.artwork(id, address).uri,
              temporary,
              { headers: api.headers() },
            );
            if (result.status >= 200 && result.status < 300) {
              await FS.moveAsync({ from: temporary, to: path });
              api.preferServer(address);
              saved = true;
              break;
            }
          } catch {
            /* Try the next configured route. */
          } finally {
            await FS.deleteAsync(temporary, { idempotent: true }).catch(
              () => {},
            );
          }
        }
        if (!saved) return undefined;
      }
      artworkPaths.current[id] = path;
      return path;
    } catch {
      return undefined;
    }
  }
  function metadata(song: Song) {
    return {
      title: song.title,
      artist: song.artist,
      albumTitle: song.album,
      // Only point the lock screen at artwork that already exists; the status
      // listener refreshes it once the background download completes.
      artworkUrl: offline.local(song.id)
        ? offline.artwork(song.id)
        : artworkPaths.current[artworkId(song)],
    };
  }
  async function load(q: Queue, play: boolean) {
    const token = ++generation.current;
    lastPlaying.current = play;
    native.pause();
    native.clear();
    sourceServers.current.clear();
    commit(q);
    if (!q.entries.length) {
      native.clearLockScreenControls();
      return;
    }
    try {
      for (const e of q.entries) {
        sourceServers.current.set(e.key, api.activeServer);
        native.add(
          playbackSource(
            e,
            api,
            offline.local(e.song.id),
            metadata(e.song).artworkUrl,
          ),
        );
      }
      native.loop = q.repeat;
      native.skipTo(q.index);
      if (q.position) await native.seekTo(q.position);
      if (token !== generation.current) return;
      const song = q.entries[q.index]!.song;
      native.setActiveForLockScreen(true, metadata(song), {
        showNextTrack: true,
        showPreviousTrack: true,
      });
      if (play) native.play();
      setError("");
    } catch {
      if (token === generation.current)
        setError(
          "Playback could not start. Check server connectivity and retry.",
        );
    }
  }
  useEffect(() => {
    const token = generation.current;
    ensureAudio()
      .then(() => {
        if (generation.current === token && !pending.current)
          return load(ref.current, false);
      })
      .catch(() => setError("Audio session could not be initialized."));
    return () => {
      generation.current++;
      pending.current?.abort();
      native.pause();
    };
  }, []);
  useEffect(() => {
    const listener = native.addListener("playlistStatusUpdate", (s) => {
      const current = ref.current.entries[s.currentIndex];
      if (
        s.trackCount !== ref.current.entries.length ||
        !current ||
        !("entryKey" in s) ||
        s.entryKey !== current.key
      )
        return;
      const hadPlaybackIntent = lastPlaying.current;
      const afterTrack = (
        native.currentStatus as typeof s & { sleepAfterTrack?: boolean }
      ).sleepAfterTrack;
      if (typeof afterTrack === "boolean") setSleepAfterTrack(afterTrack);
      const timerActive = (
        native.currentStatus as typeof s & { sleepTimerActive?: boolean }
      ).sleepTimerActive;
      if (timerActive === false) setSleep(null);
      const failedAddress =
        sourceServers.current.get(current.key) ?? api.activeServer;
      const hasError = "error" in s;
      if (hasError) lastPlaying.current = false;
      else lastPlaying.current = s.playing;
      if (hasError)
        setError(
          "This track could not be played. Check your server and retry playback.",
        );
      commit({
        ...ref.current,
        index: s.currentIndex,
        position: s.currentTime,
      });
      if (hasError && hadPlaybackIntent) {
        const token = generation.current;
        const pauseCount = "pauseCount" in s ? s.pauseCount : undefined;
        const attempt = `${current.key}:${failedAddress}`;
        if (!failoverAttempts.current.has(attempt)) {
          failoverAttempts.current.add(attempt);
          void api
            .rest("ping")
            .then(() => {
              if (
                api.activeServer !== failedAddress &&
                generation.current === token &&
                (native.currentStatus as typeof s & { pauseCount?: unknown })
                  ?.pauseCount === pauseCount &&
                ref.current.entries[s.currentIndex]?.key === current.key
              ) {
                lastPlaying.current = true;
                setError(
                  `Switched server address. Resuming on ${api.activeServer}…`,
                );
                void load({ ...ref.current, position: s.currentTime }, true);
              }
            })
            .catch(() => {});
        }
      }
      if (s.playing && s.isLoaded && lastPlayed.current !== current.key) {
        lastPlayed.current = current.key;
        const played = stringList(read(scope, "local-played", []));
        write(
          scope,
          "local-played",
          [
            current.song.id,
            ...played.filter((id) => id !== current.song.id),
          ].slice(0, 500),
        );
        void api.rest("scrobble", { id: current.song.id }).catch(() => {});
      }
      if (s.playing && s.isLoaded && lastArtwork.current !== current.key) {
        lastArtwork.current = current.key;
        void art(current.song).then(() => {
          if (ref.current.entries[s.currentIndex]?.key === current.key)
            native.updateLockScreenMetadata(metadata(current.song));
        });
      }
      if (s.playing && s.isLoaded) failoverAttempts.current.clear();
    });
    return () => listener.remove();
  }, [native]);
  async function select(songs: Song[], index: number) {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    const selected = songs[index];
    if (!selected) return;
    lastSelection.current = { songs, index };
    setError("");
    setBusy("Preparing audio…");
    try {
      controller.signal.throwIfAborted();
      await ensureAudio();
      controller.signal.throwIfAborted();
      const q = collection(songs, index);
      await load(q, true);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : "Playback failed.");
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setBusy("");
      }
    }
  }
  async function edit(q: Queue) {
    const previous = ref.current;
    // Adding or removing a queued entry must not restart the current stream.
    if (
      previous.entries.length &&
      q.entries.length === previous.entries.length + 1
    ) {
      const oldKeys = new Set(previous.entries.map((e) => e.key));
      const index = q.entries.findIndex((e) => !oldKeys.has(e.key));
      const e = q.entries[index]!;
      commit(q);
      sourceServers.current.set(e.key, api.activeServer);
      native.insert(
        playbackSource(
          e,
          api,
          offline.local(e.song.id),
          metadata(e.song).artworkUrl,
        ),
        index,
      );
    } else if (q.entries.length === previous.entries.length - 1) {
      const newKeys = new Set(q.entries.map((e) => e.key));
      const index = previous.entries.findIndex((e) => !newKeys.has(e.key));
      sourceServers.current.delete(previous.entries[index]!.key);
      commit(q);
      native.remove(index);
      if (!q.entries.length) {
        native.clearLockScreenControls();
        lastSelection.current = null;
        lastPlaying.current = false;
        setError("");
        sleepFor(0);
      }
    } else await load(q, lastPlaying.current);
  }
  async function enqueue(song: Song, next: boolean) {
    await edit(insert(ref.current, song, next));
  }
  return {
    queue,
    status,
    error,
    busy,
    sleep,
    sleepAfterTrack,
    // Desktop-only control; phones use hardware volume.
    volume: 1,
    setVolume: (_value: number) => {},
    select,
    enqueue,
    refreshSources: (play = false) => load(ref.current, play),
    restore: async (value: Queue) => {
      pause();
      sleepFor(0);
      lastSelection.current = null;
      await ensureAudio();
      await load(value, false);
    },
    pause,
    toggle: async () => {
      if (status.playing || pending.current) return pause();
      if (!ref.current.entries.length) return;
      const controller = new AbortController();
      pending.current = controller;
      const token = ++generation.current;
      setBusy("Preparing audio…");
      try {
        await ensureAudio();
        const current = ref.current.entries[ref.current.index]!;
        if (controller.signal.aborted || token !== generation.current) return;
        if (
          !offline.local(current.song.id) &&
          api.activeServer !== sourceServers.current.get(current.key)
        )
          await load(ref.current, true);
        else {
          lastPlaying.current = true;
          native.play();
          setError("");
        }
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Server is unreachable.");
      } finally {
        if (pending.current === controller) {
          pending.current = null;
          setBusy("");
        }
      }
    },
    next: () => native.next(),
    previous: () => {
      if (status.currentTime > 3) void native.seekTo(0);
      else native.previous();
    },
    seek: (seconds: number) => native.seekTo(seconds),
    retry: async () => {
      if (!ref.current.entries.length) {
        if (lastSelection.current)
          return select(
            lastSelection.current.songs,
            lastSelection.current.index,
          );
        return;
      }
      pending.current?.abort();
      const controller = new AbortController();
      pending.current = controller;
      const token = ++generation.current;
      setBusy("Retrying playback…");
      try {
        await ensureAudio();
        if (controller.signal.aborted || token !== generation.current) return;
        await load(ref.current, true);
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Playback retry failed.");
      } finally {
        if (pending.current === controller) {
          pending.current = null;
          setBusy("");
        }
      }
    },
    shuffle: () => edit(shuffleQueue(ref.current)),
    repeat: () => {
      const repeat =
        ref.current.repeat === "none"
          ? "all"
          : ref.current.repeat === "all"
            ? "single"
            : "none";
      native.loop = repeat;
      commit({ ...ref.current, repeat });
    },
    remove: (index: number) => edit(remove(ref.current, index)),
    move: (index: number, to: number) => edit(move(ref.current, index, to)),
    clear: () => {
      pause();
      lastSelection.current = null;
      failoverAttempts.current.clear();
      setError("");
      sleepFor(0);
      return load(emptyQueue(), false);
    },
    skip: (index: number) => {
      pause();
      native.skipTo(index);
      lastPlaying.current = true;
      native.play();
    },
    sleepFor,
    sleepAfterCurrent: () => {
      setSleep(null);
      native.setSleepTimer(0);
      native.setSleepAfterTrack(true);
      setSleepAfterTrack(true);
    },
  };
  function sleepFor(minutes: number) {
    native.setSleepAfterTrack(false);
    setSleepAfterTrack(false);
    native.setSleepTimer(minutes * 60);
    setSleep(minutes ? Date.now() + minutes * 60000 : null);
  }
  function pause() {
    generation.current++;
    pending.current?.abort();
    pending.current = null;
    lastPlaying.current = false;
    native.pause();
    setBusy("");
  }
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
