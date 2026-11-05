import { describe, it, expect, vi, afterEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import {
  Api,
  parseSong,
  parseSongs,
  normalizeServer,
  normalizeServers,
  addressOrder,
  Song,
  parsePlaylists,
} from "../src/api";
import {
  collection,
  shuffleQueue,
  insert,
  remove,
  move,
  nextIndex,
  restoreQueue,
} from "../src/queue";
import { playbackSource } from "../src/playback-source";
import { validAudio, recovery } from "../src/download-policy";
import { migrate, migrations } from "../src/migrations";
const songs: Song[] = Array.from({ length: 12 }, (_, i) => ({
  id: String(i),
  title: "Track " + i,
  artist: "Artist",
  duration: 180,
}));
const credentials = {
  server: "https://music.example.test",
  username: "test",
  password: "synthetic-test-only",
};
afterEach(() => vi.unstubAllGlobals());
describe("API trust boundaries", () => {
  it("rejects credential-bearing addresses and malformed song metadata", () => {
    expect(() => normalizeServer("https://user:pass@example.test")).toThrow();
    expect(() => normalizeServer("file:///a")).toThrow();
    expect(normalizeServer(" https://example.test/ ")).toBe(
      "https://example.test",
    );
    expect(
      normalizeServers(
        "https://example.test/\n https://backup.example.test,https://example.test",
      ),
    ).toEqual(["https://example.test", "https://backup.example.test"]);
    expect(() => normalizeServers("\n, ")).toThrow("at least one");
    expect(() =>
      normalizeServers([
        "http://one.example",
        "http://two.example",
        "http://three.example",
        "http://four.example",
        "http://five.example",
      ]),
    ).toThrow("at most four");
    expect(addressOrder(["home", "tailnet", "backup"], "tailnet")).toEqual([
      "tailnet",
      "backup",
      "home",
    ]);
    expect(() =>
      parseSong({ id: "x", title: "x", artist: "a", duration: -1 }),
    ).toThrow();
  });
  it("keeps login in POST body, validates protocol auth errors, and never exposes server error content", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          "subsonic-response": {
            status: "failed",
            error: { code: 40, message: "secret-bearing-upstream" },
          },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    await expect(new Api(credentials).rest("ping")).rejects.toThrow(
      "Login rejected",
    );
    expect(fetch.mock.calls[0]![0]).not.toContain(credentials.password);
    expect(fetch.mock.calls[0]![1].body).toContain("p=synthetic-test-only");
  });
  it("retrieves search results beyond one page without touching audio", async () => {
    const fetch = vi
      .fn()
      .mockImplementation(async (_url: string, init: RequestInit) => {
        const page = String(init.body).includes("songOffset=0")
          ? Array.from({ length: 500 }, (_, i) => ({
              ...songs[0],
              id: "page-" + i,
            }))
          : [songs[1]];
        return new Response(
          JSON.stringify({
            "subsonic-response": {
              status: "ok",
              searchResult3: { song: page },
            },
          }),
        );
      });
    vi.stubGlobal("fetch", fetch);
    expect(await new Api(credentials).search("track")).toHaveLength(501);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(
      fetch.mock.calls.every((c) => !String(c[0]).includes("/stream")),
    ).toBe(true);
  });
  it("reports invalid JSON and HTTP login errors usefully", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bad json")));
    await expect(new Api(credentials).request("/health")).rejects.toThrow(
      "invalid JSON",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 401 })),
    );
    await expect(new Api(credentials).request("/health")).rejects.toThrow(
      "Login rejected",
    );
  });
  it("keeps artwork and stream URLs stable across renders for image caching", () => {
    const api = new Api(credentials);
    const first = api.artwork("cover");
    expect(api.artwork("cover").uri).toBe(first.uri);
    expect(first.uri).toContain("/rest/getCoverArt?");
    expect(first.uri).toContain("t=");
    expect(first.uri).not.toContain(credentials.password);
    expect(api.streamUrl("one")).toBe(api.streamUrl("one"));
  });
  it("automatically retries the alternate address after a network failure", async () => {
    const api = new Api({
      ...credentials,
      alternateServers: ["https://backup.example.test"],
    });
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Network request failed"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ version: 1 })));
    vi.stubGlobal("fetch", fetch);
    expect(await api.request("/health")).toEqual({ version: 1 });
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      "https://music.example.test/health",
      "https://backup.example.test/health",
    ]);
    expect(api.activeServer).toBe("https://backup.example.test");
    expect(api.url("/rest/stream?id=1")).toBe(
      "https://backup.example.test/rest/stream?id=1",
    );
  });
  it("does not try other addresses when authentication is rejected", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("", { status: 401 }));
    vi.stubGlobal("fetch", fetch);
    const api = new Api({
      ...credentials,
      alternateServers: ["https://backup.example.test"],
    });
    await expect(api.request("/health")).rejects.toThrow("Login rejected");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
describe("authoritative queue", () => {
  it("restores original ordering with duplicate songs after shuffle", () => {
    const q = collection([...songs, songs[0]!], 4);
    const shuffled = shuffleQueue(q, () => 0.3);
    expect(shuffled.entries[0]!.song.id).toBe("4");
    expect(new Set(shuffled.entries.map((e) => e.key)).size).toBe(13);
    const restored = shuffleQueue(shuffled);
    expect(restored.entries.map((e) => e.key)).toEqual(
      q.entries.map((e) => e.key),
    );
    expect(restored.index).toBe(4);
  });
  it("retains the current item on reorder, insert and earlier removal", () => {
    let q = collection(songs, 3);
    const current = q.entries[3]!.key;
    q = move(q, 3, 7);
    expect(q.entries[q.index]!.key).toBe(current);
    q = remove(q, 0);
    expect(q.entries[q.index]!.key).toBe(current);
    q = insert(q, songs[0]!, true);
    expect(q.entries[q.index + 1]!.song.id).toBe("0");
  });
  it("implements repeat one, all and stop at end", () => {
    const q = collection(songs, 11);
    expect(nextIndex(q, true)).toBeNull();
    expect(nextIndex({ ...q, repeat: "single" }, true)).toBe(11);
    expect(nextIndex({ ...q, repeat: "single" }, false)).toBeNull();
    expect(nextIndex({ ...q, repeat: "all" }, true)).toBe(0);
    expect(remove(collection([songs[0]!]), 0).entries).toHaveLength(0);
  });
  it("rejects invalid reorder indexes without moving the wrong track", () => {
    const q = collection(songs, 3);
    expect(move(q, -1, 0)).toBe(q);
    expect(move(q, 0, 99)).toBe(q);
  });
  it("validates restored queue data and preserves valid playback state", () => {
    const q = {
      ...collection(songs.slice(0, 2), 1),
      position: 18,
      repeat: "all" as const,
    };
    expect(restoreQueue(q)).toEqual(q);
    expect(
      restoreQueue({ ...q, original: [q.original[0], q.original[0]] }),
    ).toEqual({
      entries: [],
      original: [],
      index: 0,
      shuffle: false,
      repeat: "none",
      position: 0,
    });
    expect(restoreQueue({ ...q, position: Number.NaN }).entries).toHaveLength(
      0,
    );
  });
  it("builds streaming metadata without fetching audio early", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const api = new Api(credentials);
    const q = collection([{ ...songs[0]!, onServer: false }]);
    const source = playbackSource(
      q.entries[0]!,
      api,
      undefined,
      "https://music.example.test/art.jpg",
    );
    expect(source.uri).toContain("/rest/stream?");
    expect(source.uri).toContain("id=0");
    expect(source.metadata.title).toBe("Track 0");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("uses an explicit local file without a stream URL", () => {
    const source = playbackSource(
      collection([songs[0]!]).entries[0]!,
      new Api(credentials),
      "file:///offline/0.mp3",
      "",
    );
    expect(source.uri).toBe("file:///offline/0.mp3");
  });
  it("always streams from the standard endpoint for server tracks", () => {
    const source = playbackSource(
      collection([{ ...songs[0]!, onServer: true, audioReady: true }])
        .entries[0]!,
      new Api(credentials),
      undefined,
      "",
    );
    expect(source.uri).toContain("/rest/stream?");
  });
});
describe("stale search isolation", () => {
  it("late results cannot replace the currently observed query", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    let finish!: (v: string[]) => void;
    const observer = new QueryObserver(client, {
      queryKey: ["online", "old"],
      queryFn: () =>
        new Promise<string[]>((resolve) => {
          finish = resolve;
        }),
    });
    const off = observer.subscribe(() => {});
    await Promise.resolve();
    observer.setOptions({
      queryKey: ["online", "new"],
      queryFn: async () => ["new result"],
    });
    await new Promise((r) => setTimeout(r, 10));
    finish(["old result"]);
    await new Promise((r) => setTimeout(r, 10));
    expect(observer.getCurrentResult().data).toEqual(["new result"]);
    off();
    client.clear();
  });
  it("passes cancellation through to the transport", async () => {
    const abort = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, options) => {
        expect(options.signal).not.toBe(abort.signal);
        abort.abort();
        expect(options.signal.aborted).toBe(true);
        throw new DOMException("Cancelled", "AbortError");
      }),
    );
    await expect(
      new Api(credentials).search("test", abort.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
describe("offline completion and recovery", () => {
  it("rejects short, truncated and non-audio payloads", () => {
    expect(validAudio(new Uint8Array([0x49, 0x44, 0x33]), 1000, 1000)).toBe(
      true,
    );
    expect(validAudio(new Uint8Array([0xff, 0xfb, 0]), 1000, 1000)).toBe(true);
    expect(validAudio(new Uint8Array([0x49, 0x44, 0x33]), 1000, 2000)).toBe(
      false,
    );
    expect(validAudio(new Uint8Array([0x3c, 0x68, 0x74]), 1000, 1000)).toBe(
      false,
    );
    expect(validAudio(new Uint8Array([0x49, 0x44, 0x33]), 3, 3)).toBe(false);
  });
  it("only preserves validated complete files and never promotes an unfinished transfer", () => {
    expect(recovery("complete", true, true)).toBe("complete");
    expect(recovery("transferring", true, false)).toBe("interrupted");
    expect(recovery("complete", false, false)).toBe("interrupted");
  });
});
describe("SQLite migration", () => {
  it("is repeatable, preserves account isolation, and rejects unknown future schemas", () => {
    const sql = new DatabaseSync(":memory:");
    const adapter = {
      execSync: (s: string) => sql.exec(s),
      getFirstSync: <T>(s: string) => sql.prepare(s).get() as T,
    };
    migrate(adapter);
    sql
      .prepare("INSERT INTO kv VALUES(?,?,?)")
      .run("account-a", "queue", "preserved");
    migrate(adapter);
    expect(
      sql.prepare("SELECT value FROM kv WHERE scope=?").get("account-a")?.value,
    ).toBe("preserved");
    expect(
      sql.prepare("SELECT * FROM kv WHERE scope=?").get("account-b"),
    ).toBeUndefined();
    sql.exec("PRAGMA user_version=99");
    expect(() => migrate(adapter)).toThrow("newer");
    sql.close();
  });
  it("rolls back a failing migration", () => {
    const sql = new DatabaseSync(":memory:");
    const adapter = {
      execSync: (s: string) => {
        if (s.startsWith("CREATE TABLE")) throw Error("disk failure");
        sql.exec(s);
      },
      getFirstSync: <T>(s: string) => sql.prepare(s).get() as T,
    };
    expect(() => migrate(adapter)).toThrow("disk failure");
    expect(sql.prepare("PRAGMA user_version").get()?.user_version).toBe(0);
    sql.close();
  });
});

describe("audit regressions", () => {
  it("rejects malformed playlist payloads before they reach screens", () => {
    expect(() => parsePlaylists({ playlist: [] })).toThrow("Invalid playlist");
    expect(() =>
      parsePlaylists([{ id: "p", name: "List", songCount: -1 }]),
    ).toThrow();
    expect(() => parseSong({ ...songs[0], audioReady: "true" })).toThrow(
      "storage status",
    );
    expect(parseSongs(songs[0])).toHaveLength(1);
    expect(
      parsePlaylists({ id: "p", name: "List", songCount: 1 }),
    ).toHaveLength(1);
  });
  it("does not issue requests for an already cancelled search", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const abort = new AbortController();
    abort.abort();
    await expect(
      new Api(credentials).search("artist", abort.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not replay an unconfirmed playlist creation or append on another route", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValue(
        new TypeError("network error with secret-bearing URL"),
      );
    vi.stubGlobal("fetch", fetch);
    const api = new Api({
      ...credentials,
      alternateServers: ["https://backup.example.test"],
    });
    await expect(api.rest("createPlaylist", { name: "New" })).rejects.toThrow(
      "may already have completed",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    fetch.mockClear();
    await expect(
      api.rest("updatePlaylist", { playlistId: "p", songIdToAdd: "one" }),
    ).rejects.toThrow("Refresh");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("still retries an idempotent ping on an alternate route", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(Error("network"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            "subsonic-response": { status: "ok", version: "1.16.1" },
          }),
        ),
      );
    vi.stubGlobal("fetch", fetch);
    const api = new Api({
      ...credentials,
      alternateServers: ["https://backup.example.test"],
    });
    expect((await api.rest("ping")).status).toBe("ok");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("sanitizes network errors and does not mistake an old 503 response for a later network result", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("upstream secret", { status: 503 }))
      .mockRejectedValueOnce(Error("secret-bearing-url"));
    vi.stubGlobal("fetch", fetch);
    const api = new Api({
      ...credentials,
      alternateServers: ["https://backup.example.test"],
    });
    await expect(api.request("/health")).rejects.toThrow("Could not reach");
    fetch.mockRejectedValue(Error("secret-bearing-url"));
    await expect(api.request("/health")).rejects.not.toThrow(
      "secret-bearing-url",
    );
  });
});

it("falls back to a one-byte range request when HEAD has no usable size", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response("", { status: 405 }))
    .mockResolvedValueOnce(
      new Response(null, {
        status: 206,
        headers: { "Content-Range": "bytes 0-0/4096", ETag: '"audio-v2"' },
      }),
    );
  vi.stubGlobal("fetch", fetch);
  expect(await new Api(credentials).mediaInfo("one")).toEqual({
    size: 4096,
    etag: '"audio-v2"',
  });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[1]![1]).toMatchObject({
    headers: expect.objectContaining({ Range: "bytes=0-0" }),
  });
});

it("authenticates media HEAD requests without attempting JSON parsing", async () => {
  const fetch = vi.fn().mockResolvedValue(
    new Response(null, {
      headers: { "Content-Length": "1024", ETag: '"audio-v1"' },
    }),
  );
  vi.stubGlobal("fetch", fetch);
  expect(await new Api(credentials).mediaInfo("one")).toEqual({
    size: 1024,
    etag: '"audio-v1"',
  });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(String(fetch.mock.calls[0]![0])).toContain(
    credentials.server + "/rest/stream?",
  );
  expect(String(fetch.mock.calls[0]![0])).toContain("id=one");
  expect(fetch.mock.calls[0]![1]).toMatchObject({
    method: "HEAD",
    headers: { Authorization: expect.stringMatching(/^Basic /) },
  });
});
