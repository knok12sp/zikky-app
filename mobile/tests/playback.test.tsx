import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { Api, type Song } from "../src/api";
import { collection } from "../src/queue";
import { setAudioModeAsync } from "expo-audio";
const state = vi.hoisted(() => ({
  saved: new Map<string, unknown>(),
  locals: new Set<string>(),
  session: null as any,
  listener: null as any,
  sources: [] as any[],
  currentIndex: 0,
  playing: false,
  pauseCount: 0,
  sleepAfterTrack: false,
  timerActive: false,
}));
vi.mock("../src/session", () => ({
  useSession: () => ({ session: state.session }),
}));
vi.mock("../src/db", () => ({
  read: (_scope: string, key: string, fallback: unknown) =>
    state.saved.get(key) ?? fallback,
  write: (_scope: string, key: string, value: unknown) =>
    state.saved.set(key, value),
}));
vi.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///cache/",
  getInfoAsync: async () => ({ exists: true }),
}));
const engine = {
  pause: vi.fn(() => {
    state.playing = false;
    state.pauseCount++;
  }),
  get currentStatus() {
    return {
      pauseCount: state.pauseCount,
      sleepAfterTrack: state.sleepAfterTrack,
      sleepTimerActive: state.timerActive,
    };
  },
  clear: vi.fn(() => {
    state.sources = [];
    state.currentIndex = 0;
  }),
  add: vi.fn((source: any) => state.sources.push(source)),
  insert: vi.fn((source: any, index: number) =>
    state.sources.splice(index, 0, source),
  ),
  remove: vi.fn((index: number) => state.sources.splice(index, 1)),
  skipTo: vi.fn((index: number) => {
    state.currentIndex = index;
  }),
  seekTo: vi.fn(async () => {}),
  play: vi.fn(() => {
    state.playing = true;
  }),
  setActiveForLockScreen: vi.fn(),
  clearLockScreenControls: vi.fn(),
  updateLockScreenMetadata: vi.fn(),
  setSleepTimer: vi.fn((seconds: number) => {
    state.timerActive = seconds > 0;
  }),
  setSleepAfterTrack: vi.fn((enabled: boolean) => {
    state.sleepAfterTrack = enabled;
  }),
  addListener: vi.fn((_name: string, listener: any) => {
    state.listener = listener;
    return {
      remove: () => {
        state.listener = null;
      },
    };
  }),
  next: vi.fn(),
  previous: vi.fn(),
  loop: "none",
};
vi.mock("expo-audio", () => ({
  useAudioPlaylist: () => engine,
  useAudioPlaylistStatus: () => ({
    get playing() {
      return state.playing;
    },
    get currentIndex() {
      return state.currentIndex;
    },
    currentTime: 0,
  }),
  setAudioModeAsync: vi.fn(async () => {}),
}));
import { PlaybackProvider, usePlayback } from "../src/playback";
let player: ReturnType<typeof usePlayback>;
let tree: ReactTestRenderer | undefined;
const song: Song = {
  id: "one",
  title: "One",
  artist: "Artist",
  duration: 180,
  onServer: true,
};
function Probe() {
  player = usePlayback();
  return null;
}
async function mount() {
  await act(async () => {
    tree = create(
      <PlaybackProvider>
        <Probe />
      </PlaybackProvider>,
    );
  });
}
function emit(extra: object = {}) {
  state.listener({
    trackCount: state.sources.length,
    currentIndex: state.currentIndex,
    entryKey: state.sources[state.currentIndex]?.entryKey,
    currentTime: 0,
    isLoaded: true,
    playing: state.playing,
    pauseCount: state.pauseCount,
    ...extra,
  });
}
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  state.saved.clear();
  state.locals.clear();
  state.sources = [];
  state.playing = false;
  state.currentIndex = 0;
  state.pauseCount = 0;
  state.sleepAfterTrack = false;
  state.timerActive = false;
  const api = new Api({
    server: "https://home.test",
    alternateServers: ["https://remote.test"],
    username: "test",
    password: "synthetic",
  });
  vi.spyOn(api, "request").mockResolvedValue({ version: 1 });
  vi.spyOn(api, "rest").mockResolvedValue({});
  state.session = {
    api,
    scope: "a",
    offline: {
      local: (id: string) =>
        state.locals.has(id) ? `file:///offline/${id}.mp3` : undefined,
      artwork: (id: string) => `file:///offline/${id}.jpg`,
    },
  };
});
afterEach(async () => {
  if (tree) await act(async () => tree!.unmount());
  tree = undefined;
});
it("plays, pauses, resumes and retries completed phone files while every server request fails", async () => {
  state.locals.add(song.id);
  state.session.api.request.mockRejectedValue(new Error("Airplane mode"));
  await mount();
  await act(async () => {
    await player.select([song], 0);
  });
  expect(engine.play).toHaveBeenCalledTimes(1);
  expect(state.sources[0].uri).toBe("file:///offline/one.mp3");
  await act(async () => player.pause());
  await act(async () => {
    await player.toggle();
  });
  await act(async () => {
    await player.retry();
  });
  expect(engine.play).toHaveBeenCalledTimes(3);
  expect(state.session.api.request).not.toHaveBeenCalled();
  expect(player.error).toBe("");
});
it("restores queue and position without autoplaying", async () => {
  state.saved.set("queue", { ...collection([song], 0), position: 43 });
  await mount();
  expect(engine.seekTo).toHaveBeenCalledWith(43);
  expect(engine.play).not.toHaveBeenCalled();
  expect(state.session.api.request).not.toHaveBeenCalled();
});
it("adding and removing an upcoming track preserves the playing stream", async () => {
  await mount();
  await act(async () => {
    await player.select([song], 0);
  });
  const clears = engine.clear.mock.calls.length;
  const plays = engine.play.mock.calls.length;
  await act(async () => {
    await player.enqueue({ ...song, id: "two" }, true);
  });
  expect(engine.insert).toHaveBeenCalled();
  expect(engine.clear).toHaveBeenCalledTimes(clears);
  expect(engine.play).toHaveBeenCalledTimes(plays);
  await act(async () => {
    await player.remove(1);
  });
  expect(engine.clear).toHaveBeenCalledTimes(clears);
  expect(state.sources).toHaveLength(1);
});
it("pause cancels a pending play request and prevents late autoplay", async () => {
  await mount();
  let finish!: (value: unknown) => void;
  state.session.api.rest.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let pending!: Promise<void>;
  await act(async () => {
    pending = player.select([song], 0);
  });
  await act(async () => player.pause());
  await act(async () => {
    finish({});
    await pending;
  });
  expect(engine.play).not.toHaveBeenCalled();
});
it("recovers stale native URLs even if a metadata request already selected the alternate address", async () => {
  await mount();
  await act(async () => {
    await player.select([song], 0);
  });
  state.session.api.preferServer("https://remote.test");
  await act(async () =>
    emit({ error: { message: "Network failed" }, playing: false }),
  );
  expect(state.sources[0].uri).toContain("https://remote.test/");
  expect(engine.play).toHaveBeenCalledTimes(2);
});
it("a late failover response cannot restart playback after pause", async () => {
  await mount();
  await act(async () => {
    await player.select([song], 0);
  });
  let finish!: (value: unknown) => void;
  state.session.api.rest.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await act(async () => emit({ error: {}, playing: false }));
  await act(async () => player.pause());
  state.session.api.preferServer("https://remote.test");
  await act(async () => finish({}));
  expect(engine.play).toHaveBeenCalledTimes(1);
});
it("clearing the queue also clears failed-selection retry intent", async () => {
  await mount();
  state.session.api.request.mockRejectedValue(new Error("Offline"));
  await act(async () => {
    await player.select([song], 0);
    await player.clear();
  });
  state.session.api.request.mockClear();
  await act(async () => {
    await player.retry();
  });
  expect(state.session.api.request).not.toHaveBeenCalled();
  expect(player.queue.entries).toHaveLength(0);
});
it("a native media-control pause also cancels a pending route recovery", async () => {
  await mount();
  await act(async () => {
    await player.select([song], 0);
  });
  let finish!: (value: unknown) => void;
  state.session.api.rest.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await act(async () => emit({ error: {}, playing: false }));
  engine.pause();
  state.session.api.preferServer("https://remote.test");
  await act(async () => finish({}));
  expect(engine.play).toHaveBeenCalledTimes(1);
});
it("audio-session initialization cannot overwrite a deliberate early play with a paused restore", async () => {
  let finish!: () => void;
  vi.mocked(setAudioModeAsync).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await mount();
  let selection!: Promise<void>;
  await act(async () => {
    selection = player.select([song], 0);
  });
  await act(async () => {
    finish();
    await selection;
  });
  expect(engine.play).toHaveBeenCalledTimes(1);
  expect(state.playing).toBe(true);
});
it("end-of-track sleep uses native state and is mutually exclusive with the timed sleep timer", async () => {
  await mount();
  await act(async () => {
    await player.select([song], 0);
    player.sleepAfterCurrent();
  });
  expect(engine.setSleepAfterTrack).toHaveBeenLastCalledWith(true);
  expect(engine.setSleepTimer).toHaveBeenCalledWith(0);
  expect(player.sleepAfterTrack).toBe(true);
  expect(player.sleep).toBeNull();
  await act(async () => player.sleepFor(15));
  expect(engine.setSleepAfterTrack).toHaveBeenLastCalledWith(false);
  expect(player.sleepAfterTrack).toBe(false);
  await act(async () => player.sleepAfterCurrent());
  state.sleepAfterTrack = false;
  state.playing = false;
  await act(async () => emit({ playing: false, didJustFinish: true }));
  expect(player.sleepAfterTrack).toBe(false);
});
it("restores a portable queue paused without a server probe or acquisition", async () => {
  await mount();
  state.session.api.request.mockRejectedValue(Error("Offline"));
  const restored = { ...collection([song]), position: 24 };
  await act(async () => {
    await player.restore(restored);
  });
  expect(player.queue.position).toBe(24);
  expect(engine.seekTo).toHaveBeenCalledWith(24);
  expect(engine.play).not.toHaveBeenCalled();
  expect(state.session.api.request).not.toHaveBeenCalled();
});
it("native timed-sleep completion updates the UI without a JS timeout that can cancel the native stop", async () => {
  await mount();
  await act(async () => {
    await player.select([song], 0);
    player.sleepFor(15);
  });
  expect(player.sleep).not.toBeNull();
  expect(engine.setSleepTimer).toHaveBeenLastCalledWith(900);
  const calls = engine.setSleepTimer.mock.calls.length;
  state.timerActive = false;
  state.playing = false;
  await act(async () => emit({ playing: false }));
  expect(player.sleep).toBeNull();
  expect(engine.setSleepTimer).toHaveBeenCalledTimes(calls);
});

it("removing the final queue entry cancels the native sleep timer before a future listening session", async () => {
  await mount();
  await act(async () => {
    await player.select([song], 0);
    player.sleepFor(15);
  });
  expect(state.timerActive).toBe(true);
  await act(async () => player.remove(0));
  expect(engine.setSleepTimer).toHaveBeenLastCalledWith(0);
  expect(state.timerActive).toBe(false);
  expect(player.sleep).toBeNull();
  expect(player.queue.entries).toHaveLength(0);
});
