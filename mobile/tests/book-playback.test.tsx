import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ index: 0, position: 0, playing: false }));
const engine = vi.hoisted(() => ({
  pause: vi.fn(),
  play: vi.fn(),
  clear: vi.fn(),
  add: vi.fn(),
  skipTo: vi.fn(),
  seekTo: vi.fn(async (_seconds: number) => {}),
  next: vi.fn(),
  previous: vi.fn(),
  setActiveForLockScreen: vi.fn(),
  setSleepTimer: vi.fn(),
  volume: 1,
  loop: "none",
  playbackRate: 1,
}));
const api = vi.hoisted(() => ({
  saveBookProgress: vi.fn(async () => {}),
  bookChapterMedia: vi.fn(() => ({ uri: "test.mp3" })),
}));
const music = vi.hoisted(() => ({ pause: vi.fn() }));
vi.mock("expo-audio", () => ({
  useAudioPlaylist: () => engine,
  useAudioPlaylistStatus: () => ({
    currentIndex: state.index,
    currentTime: state.position,
    playing: state.playing,
  }),
}));
vi.mock("../src/session", () => ({
  useSession: () => ({ session: { api, scope: "test" } }),
}));
vi.mock("../src/playback", () => ({ usePlayback: () => music }));
import { BookPlaybackProvider, useBookPlayback } from "../src/book-playback";
import { claimAudio } from "../src/audio-owner";
let player: ReturnType<typeof useBookPlayback>;
let tree: ReactTestRenderer;
const book = {
  id: "book",
  title: "Book",
  author: "Author",
  chapters: [
    { id: "one", title: "One", duration: 90 },
    { id: "two", title: "Two", duration: 120 },
  ],
} as any;
function Probe() {
  player = useBookPlayback();
  return null;
}
beforeEach(async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  state.index = 0;
  state.position = 0;
  state.playing = false;
  await act(async () => {
    tree = create(
      <BookPlaybackProvider>
        <Probe />
      </BookPlaybackProvider>,
    );
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
});
it("loads all chapters, resumes at the saved position, and uses the native no-loop mode", async () => {
  await act(async () => player.start(book, 1, 35));
  expect(engine.add).toHaveBeenCalledTimes(2);
  expect(engine.skipTo).toHaveBeenCalledWith(1);
  expect(engine.seekTo).toHaveBeenCalledWith(35);
  expect(engine.loop).toBe("none");
});
it("clamps seeking and volume and configures the native background sleep timer", async () => {
  await act(async () => player.start(book, 0, 0));
  await act(async () => {
    player.seek(200);
    player.setVolume(0.35);
    player.setSleepMinutes(30);
  });
  expect(engine.seekTo).toHaveBeenLastCalledWith(90);
  expect(engine.volume).toBe(0.35);
  expect(engine.setSleepTimer).toHaveBeenLastCalledWith(1800);
  await act(async () => player.setVolume(5));
  expect(engine.volume).toBe(1);
});
it("pauses when music starts and reclaims audio when the book resumes", async () => {
  await act(async () => player.start(book, 0, 0));
  await act(async () => claimAudio("music"));
  expect(engine.pause).toHaveBeenCalled();
  music.pause.mockClear();
  await act(async () => player.toggle());
  expect(music.pause).toHaveBeenCalledOnce();
});
it("reports failed resume seeks instead of leaking a rejected promise", async () => {
  engine.seekTo.mockRejectedValueOnce(new Error("Unavailable"));
  await act(async () => player.start(book, 0, 20));
  expect(player.error).toBe("Unavailable");
  expect(engine.play).not.toHaveBeenCalled();
});
