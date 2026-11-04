import { beforeEach, afterAll, expect, it, vi } from "vitest";
vi.mock("expo-sqlite", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const database = new DatabaseSync(":memory:");
  return {
    openDatabaseSync: () => ({
      execSync: (sql: string) => database.exec(sql),
      runSync: (sql: string, ...params: any[]) =>
        database.prepare(sql).run(...params),
      getFirstSync: (sql: string, ...params: any[]) =>
        database.prepare(sql).get(...params),
      getAllSync: (sql: string, ...params: any[]) =>
        database.prepare(sql).all(...params),
      withTransactionSync: (fn: () => void) => {
        database.exec("BEGIN");
        try {
          fn();
          database.exec("COMMIT");
        } catch (e) {
          database.exec("ROLLBACK");
          throw e;
        }
      },
      closeSync: () => database.close(),
    }),
  };
});
import { db, read, write, clearCachedMetadata } from "../src/db";
import {
  laterSongs,
  saveLater,
  removeLater,
  watchLater,
} from "../src/listen-later";
import {
  createBackup,
  parseBackup,
  prepareRestore,
  type Backup,
} from "../src/backup";
import { collection, emptyQueue } from "../src/queue";
import { collectionDownloads } from "../src/download-policy";
import { Api, type Song } from "../src/api";
const song: Song = {
  id: "one",
  title: "One",
  artist: "Artist",
  duration: 120,
  onServer: false,
};
const api = new Api({
  server: "https://music.example.test",
  username: "synthetic-user",
  password: "synthetic-password",
});
beforeEach(() => {
  db.execSync("DELETE FROM kv; DELETE FROM downloads");
  vi.restoreAllMocks();
});
afterAll(() => db.closeSync());
it("bookmarks persist metadata once, isolate accounts and never call the network", () => {
  const fetch = vi.spyOn(globalThis, "fetch");
  const listener = vi.fn();
  const stop = watchLater("a", listener);
  saveLater("a", song);
  saveLater("a", song);
  expect(laterSongs("a")).toEqual([song]);
  expect(laterSongs("b")).toEqual([]);
  expect(listener).toHaveBeenCalledTimes(2);
  expect(fetch).not.toHaveBeenCalled();
  removeLater("b", song.id);
  expect(laterSongs("a")).toHaveLength(1);
  removeLater("a", song.id);
  expect(laterSongs("a")).toEqual([]);
  stop();
});
it("recovers valid bookmarks from damaged records and excludes transport credentials", () => {
  write("a", "listen-later", [
    null,
    { ...song, headers: { Authorization: "secret" }, uri: "secret-url" },
    { ...song, duration: -1 },
  ]);
  expect(laterSongs("a")).toEqual([song]);
});
it("clearing cached metadata preserves deliberate bookmarks, queue, transfers and preferences", () => {
  saveLater("a", song);
  for (const key of [
    "queue",
    "wifi-only",
    "pause-background",
    "songs:title",
    "playlist:p",
    "playlists",
    "search-history",
  ])
    write("a", key, "value");
  write("b", "songs:title", "other-account");
  clearCachedMetadata("a");
  expect(laterSongs("a")).toEqual([song]);
  for (const key of ["queue", "wifi-only", "pause-background"])
    expect(read("a", key, null)).toBe("value");
  for (const key of [
    "songs:title",
    "playlist:p",
    "playlists",
    "search-history",
  ])
    expect(read("a", key, null)).toBeNull();
  expect(read("b", "songs:title", null)).toBe("other-account");
});
it("download completeness counts unique files and queues only missing or paused tracks", () => {
  const songs = [
    song,
    song,
    { ...song, id: "two" },
    { ...song, id: "three" },
    { ...song, id: "four" },
  ];
  const result = collectionDownloads(songs, [
    { id: "one", state: "complete" },
    { id: "two", state: "transferring" },
    { id: "three", state: "paused" },
  ]);
  expect(result.total).toBe(4);
  expect(result.complete).toBe(1);
  expect(result.pending).toBe(1);
  expect(result.missing.map((s) => s.id)).toEqual(["three", "four"]);
});
it("exports a usable phone-only backup offline without credentials, URLs or download paths", async () => {
  saveLater("a", song);
  const rest = vi.spyOn(api, "rest").mockRejectedValue(Error("Offline"));
  const queue = collection([
    {
      ...song,
      headers: { Authorization: "must-not-export" },
      uri: "file:///private.mp3",
    } as Song,
  ]);
  const backup = await createBackup(api, "a", queue, [song], false);
  const text = JSON.stringify(backup);
  for (const forbidden of [
    "synthetic-password",
    "synthetic-user",
    "must-not-export",
    "file:///private",
    "Authorization",
  ])
    expect(text).not.toContain(forbidden);
  expect(rest).not.toHaveBeenCalled();
  expect(parseBackup(text).listenLater).toEqual([song]);
});
it("full exports fetch favorite and user-playlist metadata without discovery or acquisition", async () => {
  const rest = vi.spyOn(api, "rest").mockImplementation(async (endpoint) =>
    endpoint === "getStarred2"
      ? { starred2: { song: [song] } }
      : endpoint === "getPlaylists"
        ? {
            playlists: {
              playlist: [{ id: "p", name: "Mine", songCount: 1 }],
            },
          }
        : { playlist: { entry: [song] } },
  );
  const backup = await createBackup(api, "a", emptyQueue(), [], true);
  expect(backup.library?.favorites).toHaveLength(1);
  expect(backup.library?.playlists.map((p) => p.id)).toEqual(["p"]);
  expect(rest.mock.calls.map(([endpoint]) => endpoint)).toEqual([
    "getStarred2",
    "getPlaylists",
    "getPlaylist",
  ]);
});
it("validates imports before writes, merges local bookmarks and restores no offline-file index", async () => {
  saveLater("a", song);
  const backup = await createBackup(
    api,
    "a",
    { ...collection([song]), position: 20 },
    [song],
    false,
  );
  saveLater("a", { ...song, id: "newer" });
  const plan = prepareRestore(
    parseBackup(JSON.stringify(backup)),
    "a",
    api.credentials.server,
  );
  expect(plan.listenLater.map((s) => s.id)).toEqual(["newer", "one"]);
  expect(plan.queue.position).toBe(20);
  expect(plan.queue.entries[0]!.song.audioReady).toBeUndefined();
  expect(db.getAllSync("SELECT * FROM downloads")).toEqual([]);
  expect(() =>
    prepareRestore(backup, "wrong-account", api.credentials.server),
  ).toThrow("same primary");
});
it("rejects unsupported or corrupted backup contents and does not depend on JSON key order", async () => {
  const backup = await createBackup(api, "a", emptyQueue(), [], false);
  expect(() => parseBackup("bad json")).toThrow("valid JSON");
  expect(() => parseBackup(JSON.stringify({ ...backup, version: 99 }))).toThrow(
    "Unsupported",
  );
  expect(() =>
    parseBackup(
      JSON.stringify({ ...backup, queue: { ...backup.queue, position: -1 } }),
    ),
  ).toThrow("queue");
  const reversed = Object.fromEntries(Object.entries(backup.queue).reverse());
  expect(
    parseBackup(JSON.stringify({ ...backup, queue: reversed })).queue,
  ).toEqual(emptyQueue());
});
