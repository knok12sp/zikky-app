import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { migrations } from "../src/migrations";
import type { Api, Song } from "../src/api";
const state = vi.hoisted(() => ({
  files: new Map<string, Uint8Array>(),
  mode: "good",
  database: null as DatabaseSync | null,
  online: true,
  moveGate: null as Promise<void> | null,
  artworkGate: null as Promise<void> | null,
  artworkStarted: false,
  apiAddress: "home",
  switchOnProbe: false,
  moved: false,
  secure: new Map<string, string>(),
  transferStarted: false,
  finishTransfer: null as ((value: any) => void) | null,
  resumes: 0,
  etag: "audio-v1",
  secureGate: null as Promise<void> | null,
  failSecure: false,
  freeGate: null as Promise<void> | null,
  spaceChecked: false,
}));
vi.mock("expo-secure-store", () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 7,
  getItemAsync: vi.fn(async (key: string) => state.secure.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    if (state.secureGate) await state.secureGate;
    if (state.failSecure) throw Error("synthetic secure storage unavailable");
    state.secure.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    state.secure.delete(key);
  }),
}));
vi.mock("../src/db", () => ({
  db: {
    runSync: (sql: string, ...args: (string | number)[]) =>
      state.database!.prepare(sql).run(...args),
    getFirstSync: (sql: string, ...args: string[]) =>
      state.database!.prepare(sql).get(...args),
    getAllSync: (sql: string, ...args: string[]) =>
      state.database!.prepare(sql).all(...args),
  },
  read: () => true,
  write: vi.fn(),
}));
vi.mock("@react-native-community/netinfo", () => ({
  default: { fetch: async () => ({ isConnected: state.online, type: "wifi" }) },
}));
vi.mock("expo-file-system", () => ({
  File: class {
    constructor(readonly path: string) {}
    open() {
      const bytes = state.files.get(this.path);
      if (!bytes) throw Error("missing");
      return {
        readBytes: async (n: number) => bytes.slice(0, n),
        close: () => {},
      };
    }
  },
}));
vi.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///documents/",
  FileSystemSessionType: { BACKGROUND: 0 },
  makeDirectoryAsync: async () => {},
  getInfoAsync: async (path: string) =>
    state.files.has(path)
      ? {
          exists: true,
          isDirectory: false,
          size: state.files.get(path)!.length,
        }
      : { exists: false },
  deleteAsync: async (path: string) => {
    state.files.delete(path);
  },
  getFreeDiskStorageAsync: async () => {
    state.spaceChecked = true;
    if (state.freeGate) await state.freeGate;
    return 1e10;
  },
  moveAsync: async ({ from, to }: { from: string; to: string }) => {
    state.moved = true;
    if (state.moveGate) await state.moveGate;
    state.files.set(to, state.files.get(from)!);
    state.files.delete(from);
  },
  downloadAsync: async (_url: string, path: string) => {
    if (state.artworkGate) {
      state.artworkStarted = true;
      await state.artworkGate;
    }
    state.files.set(path, new Uint8Array(30));
  },
  createDownloadResumable: (
    _url: string,
    path: string,
    _options: unknown,
    progress: (p: unknown) => void,
    resumeData?: string,
  ) => ({
    pauseAsync: async () => {
      state.finishTransfer?.(undefined);
      state.finishTransfer = null;
      return { url: _url, fileUri: path, options: _options, resumeData: "500" };
    },
    resumeAsync: async () => {
      state.resumes++;
      expect(resumeData).toBe("500");
      const audio = new Uint8Array(state.mode === "bad-resume" ? 1500 : 1000);
      audio.set([73, 68, 51]);
      state.files.set(path, audio);
      return {
        status: 206,
        headers: {
          "Content-Length": "500",
          "Content-Range": "bytes 500-999/1000",
        },
      };
    },
    downloadAsync: async () => {
      if (state.mode === "hold") {
        const partial = new Uint8Array(500);
        partial.set([73, 68, 51]);
        state.files.set(path, partial);
        progress({ totalBytesWritten: 500, totalBytesExpectedToWrite: 1000 });
        state.transferStarted = true;
        return new Promise<any>((resolve) => {
          state.finishTransfer = resolve;
        });
      }
      if (state.mode === "network-error") {
        throw new Error("Network request failed");
      }
      const audio = new Uint8Array(1000);
      audio.set(state.mode === "html" ? [60, 104, 116] : [73, 68, 51]);
      state.files.set(path, audio);
      progress({
        totalBytesWritten: 1000,
        totalBytesExpectedToWrite: state.mode === "truncated" ? 2000 : 1000,
      });
      return {
        status: 200,
        headers: {
          "Content-Length": state.mode === "truncated" ? "2000" : "1000",
        },
      };
    },
  }),
}));
import { Offline } from "../src/offline";
const song: Song = {
  id: "test-track",
  title: "Track",
  artist: "Artist",
  duration: 180,
};
let api: Api;
beforeEach(() => {
  state.files.clear();
  state.mode = "good";
  state.online = true;
  state.moveGate = null;
  state.artworkGate = null;
  state.artworkStarted = false;
  state.apiAddress = "home";
  state.switchOnProbe = false;
  state.moved = false;
  state.secureGate = null;
  state.failSecure = false;
  state.freeGate = null;
  state.spaceChecked = false;
  state.secure.clear();
  state.transferStarted = false;
  state.finishTransfer = null;
  state.resumes = 0;
  state.etag = "audio-v1";
  state.database = new DatabaseSync(":memory:");
  state.database.exec(migrations[0]!);
  api = {
    get activeServer() {
      return "https://" + state.apiAddress + ".test";
    },
    addresses: ["https://home.test", "https://tailnet.test"],
    mediaInfo: vi.fn(async () => ({ size: 1000, etag: state.etag })),
    rest: vi.fn(async (endpoint: string) => {
      if (endpoint === "ping" && state.switchOnProbe) {
        state.apiAddress = "tailnet";
        state.mode = "good";
        state.switchOnProbe = false;
      }
      return { status: "ok" };
    }),
    request: vi.fn(async () => ({})),
    media: () => ({
      uri: "https://" + state.apiAddress + ".test/rest/stream?id=test-track",
    }),
    headers: () => ({ Authorization: "synthetic-test" }),
    artwork: () => ({ uri: "https://music.example/artwork/test-track" }),
  } as unknown as Api;
});
afterEach(() => state.database!.close());
it("persists only validated atomic files and removing phone audio never calls a server deletion", async () => {
  const worker = new Offline("a", api);
  await worker.init();
  worker.enqueue([song, song]);
  await vi.waitFor(() => expect(worker.list()[0]?.state).toBe("complete"));
  expect(worker.local(song.id)).toBe(worker.path(song.id));
  expect(state.files.has(worker.path(song.id) + ".part")).toBe(false);
  await worker.remove(song.id);
  expect(worker.local(song.id)).toBeUndefined();
  expect(api.mediaInfo).toHaveBeenCalledTimes(1);
});
it.each(["html", "truncated"])(
  "rejects %s transfers and cleans temporary files",
  async (mode) => {
    state.mode = mode;
    const worker = new Offline("a", api);
    await worker.init();
    worker.enqueue([song]);
    await vi.waitFor(() => expect(worker.list()[0]?.state).toBe("failed"));
    expect(worker.local(song.id)).toBeUndefined();
    expect(state.files.has(worker.path(song.id) + ".part")).toBe(false);
  },
);
it("recovers an interrupted transfer without promoting its temporary file or automatically restarting it", async () => {
  const worker = new Offline("a", api);
  state
    .database!.prepare(
      "INSERT INTO downloads(scope,id,song,state) VALUES(?,?,?,?)",
    )
    .run("a", song.id, JSON.stringify(song), "transferring");
  state.files.set(worker.path(song.id) + ".part", new Uint8Array(1000));
  await worker.init();
  expect(worker.list()[0]!.state).toBe("interrupted");
  expect(worker.local(song.id)).toBeUndefined();
  expect(state.files.has(worker.path(song.id) + ".part")).toBe(false);
  await worker.stop();
});
it("cancellation before a transfer starts cannot later promote a phone download", async () => {
  const worker = new Offline("a", api);
  await worker.init();
  worker.enqueue([song]);
  const cancel = worker.cancel(song.id);
  await cancel;
  await vi.waitFor(() => expect(worker.list()[0]?.state).toBe("cancelled"));
  expect(worker.local(song.id)).toBeUndefined();
  await worker.stop();
});
it("retains completed files across restart and isolates accounts", async () => {
  const worker = new Offline("a", api);
  await worker.init();
  worker.enqueue([song]);
  await vi.waitFor(() => expect(worker.list()[0]?.state).toBe("complete"));
  await worker.stop();
  const next = new Offline("a", api);
  await next.init();
  expect(next.local(song.id)).toBeTruthy();
  const other = new Offline("b", api);
  await other.init();
  expect(other.list()).toHaveLength(0);
  await next.stop();
  await other.stop();
});

it("cancelling during final rename cannot mark a track complete", async () => {
  let release!: () => void;
  state.moveGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const worker = new Offline("a", api);
  await worker.init();
  worker.enqueue([song]);
  await vi.waitFor(() => expect(state.moved).toBe(true));
  const cancellation = worker.cancel(song.id);
  release();
  await cancellation;
  await worker.pump();
  expect(worker.list()[0]?.state).toBe("cancelled");
  expect(state.files.has(worker.path(song.id))).toBe(false);
  await worker.stop();
});
it("removing a download during rename cannot leave an orphan audio file", async () => {
  let release!: () => void;
  state.moveGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const worker = new Offline("a", api);
  await worker.init();
  worker.enqueue([song]);
  await vi.waitFor(() => expect(state.moved).toBe(true));
  const removal = worker.remove(song.id);
  release();
  await removal;
  await worker.pump();
  expect(worker.list()).toHaveLength(0);
  expect(state.files.has(worker.path(song.id))).toBe(false);
  await worker.stop();
});

it("stopping during post-download artwork fetch preserves completed audio", async () => {
  let release!: () => void;
  state.artworkGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const worker = new Offline("a", api);
  await worker.init();
  worker.enqueue([song]);
  await vi.waitFor(() => expect(worker.list()[0]?.state).toBe("complete"));
  await vi.waitFor(() => expect(state.artworkStarted).toBe(true));
  const stopping = worker.stop();
  release();
  await stopping;
  expect(worker.list()[0]?.state).toBe("complete");
  expect(worker.local(song.id)).toBe(worker.path(song.id));
});

it("restarts a failed phone transfer through the alternate server address", async () => {
  state.mode = "network-error";
  state.switchOnProbe = true;
  const worker = new Offline("a", api);
  await worker.init();
  worker.enqueue([song]);
  await vi.waitFor(() => expect(worker.list()[0]?.state).toBe("complete"));
  expect(state.apiAddress).toBe("tailnet");
  expect(worker.list()[0]?.bytes).toBe(1000);
  expect(api.mediaInfo).toHaveBeenCalledTimes(2);
  await worker.stop();
});

it("retains cancelled and failed states across restart instead of relabeling them as interrupted", async () => {
  const worker = new Offline("a", api);
  for (const value of ["cancelled", "failed"])
    state
      .database!.prepare(
        "INSERT INTO downloads(scope,id,song,state,error) VALUES(?,?,?,?,?)",
      )
      .run(
        "a",
        value,
        JSON.stringify({ ...song, id: value }),
        value,
        "Keep this reason",
      );
  await worker.init();
  expect(worker.list().map((d) => [d.state, d.error])).toEqual([
    ["cancelled", "Keep this reason"],
    ["failed", "Keep this reason"],
  ]);
  await worker.stop();
});
it("bounds route retries when transfers keep failing and probes alternate between routes", async () => {
  state.mode = "network-error";
  vi.mocked(api.rest).mockImplementation(async (endpoint: string) => {
    if (endpoint === "ping")
      state.apiAddress = state.apiAddress === "home" ? "tailnet" : "home";
    return { status: "ok" };
  });
  const worker = new Offline("a", api);
  await worker.init();
  worker.enqueue([song]);
  await vi.waitFor(() => expect(worker.list()[0]?.state).toBe("failed"));
  await worker.stop();
});

it("pauses with an encrypted checkpoint, preserves partial bytes and resumes after an app restart", async () => {
  state.mode = "hold";
  const worker = new Offline("a", api);
  await worker.init();
  worker.enqueue([song]);
  await vi.waitFor(() => expect(state.transferStarted).toBe(true));
  await worker.pause(song.id);
  expect(worker.list()[0]?.state).toBe("paused");
  expect(worker.list()[0]?.bytes).toBe(500);
  expect(state.files.get(worker.path(song.id) + ".part")?.length).toBe(500);
  expect(
    [...state.secure.values()].some((value) =>
      value.includes("synthetic-test"),
    ),
  ).toBe(true);
  expect(
    JSON.stringify(state.database!.prepare("SELECT * FROM downloads").all()),
  ).not.toContain("synthetic-test");
  // Simulate process loss without calling explicit sign-out, which intentionally clears credentials.
  state.mode = "good";
  const restarted = new Offline("a", api);
  await restarted.init();
  expect(restarted.list()[0]?.state).toBe("paused");
  restarted.resume(song.id);
  await vi.waitFor(() => expect(restarted.list()[0]?.state).toBe("complete"));
  expect(state.resumes).toBe(1);
  expect(restarted.list()[0]?.bytes).toBe(1000);
  await restarted.stop();
  expect(state.secure.size).toBe(0);
});
it("safe background mode checkpoints and resumes on foreground without duplicating the worker", async () => {
  state.mode = "hold";
  const worker = new Offline("a", api);
  await worker.init();
  worker.enqueue([song]);
  await vi.waitFor(() => expect(state.transferStarted).toBe(true));
  await worker.onAppState("background");
  expect(worker.list()[0]?.state).toBe("paused-background");
  state.mode = "good";
  await worker.onAppState("active");
  expect(worker.list()[0]?.state).toBe("complete");
  expect(state.resumes).toBe(1);
  await worker.stop();
});
it("invalid native resume output restarts safely instead of promoting appended or truncated audio", async () => {
  state.mode = "hold";
  const worker = new Offline("a", api);
  await worker.init();
  worker.enqueue([song]);
  await vi.waitFor(() => expect(state.transferStarted).toBe(true));
  await worker.pause(song.id);
  state.mode = "bad-resume";
  worker.resume(song.id);
  await vi.waitFor(() => expect(worker.list()[0]?.state).toBe("complete"));
  expect(state.resumes).toBe(1);
  expect(state.files.get(worker.path(song.id))?.length).toBe(1000);
  await worker.stop();
});
it("changed server files invalidate old checkpoints before downloading new bytes", async () => {
  state.mode = "hold";
  const worker = new Offline("a", api);
  await worker.init();
  worker.enqueue([song]);
  await vi.waitFor(() => expect(state.transferStarted).toBe(true));
  await worker.pause(song.id);
  state.mode = "good";
  state.etag = "audio-v2";
  worker.resume(song.id);
  await vi.waitFor(() => expect(worker.list()[0]?.state).toBe("complete"));
  expect(state.resumes).toBe(0);
  await worker.stop();
});
it("reconciles a fully completed temporary file after interruption without acquiring again", async () => {
  const worker = new Offline("a", api);
  state
    .database!.prepare(
      "INSERT INTO downloads(scope,id,song,state,bytes,total) VALUES(?,?,?,?,?,?)",
    )
    .run("a", song.id, JSON.stringify(song), "transferring", 1000, 1000);
  const audio = new Uint8Array(1000);
  audio.set([73, 68, 51]);
  state.files.set(worker.path(song.id) + ".part", audio);
  await worker.init();
  expect(worker.list()[0]?.state).toBe("complete");
  expect(worker.local(song.id)).toBeTruthy();
  await worker.stop();
});
it("explicit sign-out removes encrypted resume credentials and forces a clean retry", async () => {
  state.mode = "hold";
  const worker = new Offline("a", api);
  await worker.init();
  worker.enqueue([song]);
  await vi.waitFor(() => expect(state.transferStarted).toBe(true));
  await worker.pause(song.id);
  expect(state.secure.size).toBeGreaterThan(0);
  await worker.stop();
  expect(state.secure.size).toBe(0);
  expect(worker.list()[0]?.state).toBe("interrupted");
  expect(state.files.has(worker.path(song.id) + ".part")).toBe(false);
});

it("a failed secure checkpoint pauses honestly and retries fresh without exposing credentials", async () => {
  state.mode = "hold";
  const worker = new Offline("a", api);
  await worker.init();
  worker.enqueue([song]);
  await vi.waitFor(() => expect(state.transferStarted).toBe(true));
  state.failSecure = true;
  await worker.pause(song.id);
  expect(worker.list()[0]?.state).toBe("paused");
  expect(worker.list()[0]?.error).toContain("restarts");
  expect(state.secure.size).toBe(0);
  expect(state.files.has(worker.path(song.id) + ".part")).toBe(false);
  state.failSecure = false;
  state.mode = "good";
  worker.resume(song.id);
  await vi.waitFor(() => expect(worker.list()[0]?.state).toBe("complete"));
  expect(state.resumes).toBe(0);
  await worker.stop();
});
it("sign-out clears indexed transfer credentials even if the SQLite download row was lost", async () => {
  state.mode = "hold";
  const worker = new Offline("a", api);
  await worker.init();
  worker.enqueue([song]);
  await vi.waitFor(() => expect(state.transferStarted).toBe(true));
  await worker.pause(song.id);
  state.database!.exec("DELETE FROM downloads");
  await worker.stop();
  expect(state.secure.size).toBe(0);
});
it("cancellation during storage preflight cannot start a late native transfer", async () => {
  let release!: () => void;
  state.freeGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const worker = new Offline("a", api);
  await worker.init();
  worker.enqueue([song]);
  await vi.waitFor(() => expect(state.spaceChecked).toBe(true));
  const cancel = worker.cancel(song.id);
  release();
  await cancel;
  expect(worker.list()[0]?.state).toBe("cancelled");
  expect(worker.local(song.id)).toBeUndefined();
  expect(state.files.size).toBe(0);
  await worker.stop();
});
it("a quick background-to-foreground transition waits for encrypted checkpoint persistence", async () => {
  state.mode = "hold";
  const worker = new Offline("a", api);
  await worker.init();
  worker.enqueue([song]);
  await vi.waitFor(() => expect(state.transferStarted).toBe(true));
  let release!: () => void;
  state.secureGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const background = worker.onAppState("background");
  const foreground = worker.onAppState("active");
  state.mode = "good";
  release();
  await background;
  await foreground;
  expect(worker.list()[0]?.state).toBe("complete");
  expect(state.resumes).toBe(1);
  await worker.stop();
});
