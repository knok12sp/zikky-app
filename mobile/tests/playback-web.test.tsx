import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Api, type Song } from "../src/api";
import { collection } from "../src/queue";

const state = vi.hoisted(() => ({
  saved: new Map<string, unknown>(),
  session: null as any,
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
import { PlaybackProvider, usePlayback } from "../src/playback.web";
class AudioMock extends EventTarget {
  static instance: AudioMock;
  src = "";
  currentTime = 0;
  duration = 180;
  paused = true;
  volume = 1;
  preload = "";
  constructor() {
    super();
    AudioMock.instance = this;
  }
  load = vi.fn(() => {
    this.currentTime = 0;
  });
  play = vi.fn(async () => {
    this.dispatchEvent(new Event("loadedmetadata"));
    this.paused = false;
    this.dispatchEvent(new Event("play"));
    this.dispatchEvent(new Event("playing"));
  });
  pause = vi.fn(() => {
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  });
  removeAttribute() {
    this.src = "";
  }
}
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
async function emit(event: string) {
  await act(async () => {
    AudioMock.instance.dispatchEvent(new Event(event));
  });
}
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("window", { Audio: AudioMock });
  state.saved.clear();
  const api = new Api({
    server: "https://a.test",
    alternateServers: ["https://b.test", "https://c.test"],
    username: "test",
    password: "synthetic",
  });
  vi.spyOn(api, "rest").mockResolvedValue({});
  state.session = { api, scope: "test" };
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  tree = undefined;
  vi.unstubAllGlobals();
});
it("stops audio on unmount even when mounted with an empty queue", async () => {
  await mount();
  await act(async () => player.select([song], 0));
  await act(async () => tree?.unmount());
  tree = undefined;
  expect(AudioMock.instance.paused).toBe(true);
  expect(AudioMock.instance.src).toBe("");
});
it("restores the saved seek position after metadata loads without autoplay", async () => {
  state.saved.set("queue", { ...collection([song]), position: 42 });
  await mount();
  await emit("loadedmetadata");
  expect(AudioMock.instance.currentTime).toBe(42);
  expect(AudioMock.instance.paused).toBe(true);
});
it("checkpoints playback position without rewriting storage on every timeupdate", async () => {
  await mount();
  await act(async () => player.select([song], 0));
  AudioMock.instance.currentTime = 24;
  await emit("timeupdate");
  await act(async () => player.pause());
  expect((state.saved.get("queue") as any).position).toBe(24);
});
it("tries each configured route once and preserves position", async () => {
  await mount();
  await act(async () => player.select([song], 0));
  AudioMock.instance.currentTime = 25;
  await emit("timeupdate");
  AudioMock.instance.play.mockImplementation(async () => {});
  await emit("error");
  expect(state.session.api.activeServer).toBe("https://b.test");
  await emit("loadedmetadata");
  expect(AudioMock.instance.currentTime).toBe(25);
  await emit("error");
  expect(state.session.api.activeServer).toBe("https://c.test");
  await emit("error");
  expect(player.error).toContain("Cannot play");
});
it("ignores an obsolete play rejection after another track has started", async () => {
  await mount();
  await act(async () => player.select([song], 0));
  let reject!: (reason: Error) => void;
  AudioMock.instance.play.mockImplementationOnce(
    () =>
      new Promise((_, no) => {
        reject = no;
      }),
  );
  let old!: Promise<void>;
  await act(async () => {
    old = player.select([song], 0);
  });
  await act(async () => player.select([{ ...song, id: "two" }], 0));
  await act(async () => {
    reject(new Error("Aborted"));
    await old;
  });
  expect(player.error).toBe("");
});
it("clearing the queue resets the timeline", async () => {
  await mount();
  await act(async () => player.select([song], 0));
  AudioMock.instance.currentTime = 40;
  await emit("timeupdate");
  await act(async () => player.clear());
  expect(player.status.currentTime).toBe(0);
  expect(player.status.duration).toBe(0);
});
it("media keys use current controls and release handlers on unmount", async () => {
  const handlers = new Map<string, any>();
  const mediaSession = {
    metadata: null,
    playbackState: "none",
    setPositionState: vi.fn(),
    setActionHandler: vi.fn((action: string, handler: any) =>
      handlers.set(action, handler),
    ),
  };
  vi.stubGlobal("navigator", { mediaSession });
  vi.stubGlobal(
    "MediaMetadata",
    class {
      constructor(data: object) {
        Object.assign(this, data);
      }
    },
  );
  await mount();
  await act(async () =>
    player.select([song, { ...song, id: "two", title: "Two" }], 0),
  );
  await act(async () => handlers.get("pause")());
  expect(AudioMock.instance.paused).toBe(true);
  await act(async () => handlers.get("play")());
  expect(AudioMock.instance.paused).toBe(false);
  await act(async () => handlers.get("nexttrack")());
  expect(player.queue.index).toBe(1);
  expect(mediaSession.metadata).toMatchObject({ title: "Two" });
  await act(async () => handlers.get("seekto")({ seekTime: 999 }));
  expect(AudioMock.instance.currentTime).toBe(180);
  await act(async () => tree?.unmount());
  tree = undefined;
  expect([...handlers.values()].every((handler) => handler === null)).toBe(
    true,
  );
  expect(mediaSession.metadata).toBeNull();
});
it("repeat all wraps previous to the last song and sleep-after-song takes priority", async () => {
  await mount();
  await act(async () => player.select([song, { ...song, id: "two" }], 0));
  await act(async () => player.repeat());
  await act(async () => player.previous());
  expect(player.queue.index).toBe(1);
  await act(async () => player.sleepAfterCurrent());
  await emit("ended");
  expect(player.queue.index).toBe(1);
  expect(player.sleepAfterTrack).toBe(false);
  expect(player.status.playing).toBe(false);
});
it("scrobbles a restored queue only when playback actually starts", async () => {
  state.saved.set("queue", collection([song]));
  await mount();
  expect(state.session.api.rest).not.toHaveBeenCalled();
  await act(async () => player.toggle());
  expect(state.session.api.rest).toHaveBeenCalledWith("scrobble", {
    id: song.id,
  });
});
it("throttles position checkpoints while keeping the latest position on pause", async () => {
  let now = 10000;
  const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
  try {
    await mount();
    await act(async () => player.select([song], 0));
    AudioMock.instance.currentTime = 10;
    await emit("timeupdate");
    const checkpoint = state.saved.get("queue");
    now += 1000;
    AudioMock.instance.currentTime = 11;
    await emit("timeupdate");
    expect(state.saved.get("queue")).toBe(checkpoint);
    await act(async () => player.pause());
    expect((state.saved.get("queue") as any).position).toBe(11);
  } finally {
    clock.mockRestore();
  }
});
it("remembers volume and rejects invalid control values", async () => {
  state.saved.set("volume", 0.35);
  await mount();
  await act(async () => player.select([song], 0));
  expect(AudioMock.instance.volume).toBe(0.35);
  await act(async () => player.setVolume(0.6));
  expect(state.saved.get("volume")).toBe(0.6);
  await act(async () => {
    player.setVolume(NaN);
    await player.seek(Infinity);
  });
  expect(AudioMock.instance.volume).toBe(0.6);
  expect(AudioMock.instance.currentTime).toBe(0);
});
it("advances automatically and repeats one without skipping the song", async () => {
  await mount();
  await act(async () => player.select([song, { ...song, id: "two" }], 0));
  await emit("ended");
  expect(player.queue.index).toBe(1);
  await act(async () => {
    player.repeat();
    player.repeat();
  });
  AudioMock.instance.currentTime = 180;
  await emit("ended");
  expect(player.queue.index).toBe(1);
  expect(AudioMock.instance.currentTime).toBe(0);
});
it("continues playback if a webview rejects unsupported media actions", async () => {
  vi.stubGlobal("navigator", {
    mediaSession: {
      setActionHandler() {
        throw new Error("Unsupported");
      },
    },
  });
  await mount();
  await act(async () => player.select([song], 0));
  expect(player.status.playing).toBe(true);
});
it("ignores late audio events after sign-out", async () => {
  await mount();
  await act(async () => player.select([song], 0));
  AudioMock.instance.currentTime = 30;
  await emit("timeupdate");
  await act(async () => tree?.unmount());
  tree = undefined;
  AudioMock.instance.currentTime = 0;
  await emit("timeupdate");
  expect((state.saved.get("queue") as any).position).toBe(30);
});
it("fails over from the actual audio route even if a library request changed the API route", async () => {
  await mount();
  await act(async () => player.select([song], 0));
  state.session.api.preferServer("https://b.test");
  AudioMock.instance.play.mockImplementation(async () => {});
  await emit("error");
  expect(new URL(AudioMock.instance.src).origin).toBe("https://b.test");
});
