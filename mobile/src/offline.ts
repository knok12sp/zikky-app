import * as FS from "expo-file-system/legacy";
import { File } from "expo-file-system";
import { Api, Song, parseSong } from "./api";
import { db, read, write } from "./db";
import NetInfo from "@react-native-community/netinfo";
import { validAudio, recovery } from "./download-policy";
import {
  clearCheckpoint,
  clearCheckpoints,
  checkpointIds,
  readCheckpoint,
  saveCheckpoint,
  type TransferCheckpoint,
} from "./transfer-state";
export type Download = {
  id: string;
  song: string;
  state: string;
  bytes: number;
  total: number;
  error: string;
};
export function downloadSong(item: Download): Song | undefined {
  try {
    const song = parseSong(JSON.parse(item.song));
    return song.id === item.id ? song : undefined;
  } catch {
    return undefined;
  }
}
export function completedSongs(items: Download[]) {
  return items
    .filter((d) => d.state === "complete")
    .flatMap((d) => {
      const song = downloadSong(d);
      return song ? [song] : [];
    });
}
const listeners = new Set<() => void>();
export const watchDownloads = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
const emit = () => listeners.forEach((fn) => fn());
export class Offline {
  wifiOnly = true;
  pauseOnBackground = true;
  private backgrounded = false;
  private backgroundPause: Promise<void> | null = null;
  private pauses = new Map<string, Promise<boolean>>();
  private automaticPauses = new Set<string>();
  setWifiOnly(value: boolean, startQueued = true) {
    this.wifiOnly = value;
    write(this.scope, "wifi-only", value);
    if (startQueued) void this.pump();
    emit();
  }
  setPauseOnBackground(value: boolean) {
    this.pauseOnBackground = value;
    write(this.scope, "pause-background", value);
    emit();
  }
  async onAppState(state: string) {
    this.backgrounded = state !== "active";
    if (this.backgrounded) {
      if (this.pauseOnBackground && this.active) {
        const work = this.pause(this.active, true);
        this.backgroundPause = work;
        try {
          await work;
        } finally {
          if (this.backgroundPause === work) this.backgroundPause = null;
        }
      }
    } else {
      await this.backgroundPause;
      if (this.stopped) return;
      for (const item of this.list())
        if (item.state === "paused-background")
          this.update(item.id, "queued", item.bytes, item.total);
      await this.pump();
    }
  }
  private worker: Promise<void> | null = null;
  private activeAbort: AbortController | null = null;
  private held = false;
  lastError = "";
  private transfer: FS.DownloadResumable | null = null;
  private active: string | null = null;
  private activeMedia: {
    url: string;
    total: number;
    etag: string;
    authorization: string;
  } | null = null;
  private stopped = false;
  private cancelled = new Set<string>();
  readonly root: string;
  constructor(
    readonly scope: string,
    readonly api: Api,
    foreground = true,
  ) {
    this.backgrounded = !foreground;
    this.wifiOnly = read(scope, "wifi-only", true);
    this.pauseOnBackground = read(scope, "pause-background", true);
    this.root = `${FS.documentDirectory}offline/${scope}/`;
  }
  list() {
    return db.getAllSync<Download>(
      "SELECT id,song,state,bytes,total,error FROM downloads WHERE scope=? ORDER BY rowid",
      this.scope,
    );
  }
  setGenre(id: string, genre: string) {
    const row = this.list().find((item) => item.id === id);
    const song = row && downloadSong(row);
    if (!song) return;
    db.runSync(
      "UPDATE downloads SET song=? WHERE scope=? AND id=?",
      JSON.stringify({ ...song, genre }),
      this.scope,
      id,
    );
    emit();
  }
  path(id: string) {
    return this.root + encodeURIComponent(id) + ".mp3";
  }
  artwork(id: string) {
    return this.root + encodeURIComponent(id) + ".jpg";
  }
  local(id: string) {
    const row = db.getFirstSync<Download>(
      "SELECT * FROM downloads WHERE scope=? AND id=? AND state=?",
      this.scope,
      id,
      "complete",
    );
    return row ? this.path(id) : undefined;
  }
  private update(id: string, state: string, bytes = 0, total = 0, error = "") {
    db.runSync(
      "UPDATE downloads SET state=?,bytes=?,total=?,error=? WHERE scope=? AND id=?",
      state,
      bytes,
      total,
      error,
      this.scope,
      id,
    );
    emit();
  }
  async init() {
    await FS.makeDirectoryAsync(this.root, { intermediates: true });
    const storedCheckpoints = new Set(await checkpointIds(this.scope));
    // Atomic files are validated again after a crash before they can be preferred for playback.
    for (const item of this.list()) {
      const path = this.path(item.id);
      const checkpoint = storedCheckpoints.has(item.id)
        ? await readCheckpoint(this.scope, item.id)
        : null;
      if (
        checkpoint &&
        ["paused", "pausing", "paused-background", "queued"].includes(
          item.state,
        ) &&
        checkpoint.authorization === this.api.headers().Authorization &&
        this.api.addresses.some((address) =>
          checkpoint.url.startsWith(address + "/rest/stream?"),
        )
      ) {
        this.update(
          item.id,
          checkpoint.automatic ? "queued" : "paused",
          checkpoint.bytes,
          checkpoint.total,
          "Secure checkpoint restored. Resume continues where supported.",
        );
        continue;
      }
      if (storedCheckpoints.has(item.id))
        await clearCheckpoint(this.scope, item.id);
      const partial = await FS.getInfoAsync(path + ".part");
      if (
        ["transferring", "pausing"].includes(item.state) &&
        item.total > 128 &&
        partial.exists &&
        !partial.isDirectory &&
        (await this.validate(path + ".part", partial.size, item.total))
      ) {
        await FS.moveAsync({ from: path + ".part", to: path });
        this.update(item.id, "complete", partial.size, item.total);
        continue;
      }
      const info = await FS.getInfoAsync(path);
      const valid =
        item.state === "complete" &&
        info.exists &&
        !info.isDirectory &&
        (await this.validate(path, info.size, item.total || item.bytes));
      if (valid)
        this.update(
          item.id,
          "complete",
          info.exists && !info.isDirectory ? info.size : 0,
          item.total,
        );
      else {
        if (info.exists) await FS.deleteAsync(path, { idempotent: true });
        this.update(
          item.id,
          recovery(item.state, info.exists, false),
          0,
          0,
          ["cancelled", "failed", "interrupted"].includes(item.state)
            ? item.error
            : item.state === "queued"
              ? ""
              : "Transfer must restart.",
        );
      }
      await FS.deleteAsync(path + ".part", { idempotent: true });
    }
    void this.pump();
  }
  async validate(path: string, size: number, total: number) {
    try {
      const handle = new File(path).open();
      try {
        return validAudio(await handle.readBytes(3), size, total);
      } finally {
        handle.close();
      }
    } catch {
      return false;
    }
  }
  enqueue(songs: Song[]) {
    songs = songs.map(parseSong);
    for (const song of songs) {
      if (this.local(song.id)) continue;
      db.runSync(
        "INSERT INTO downloads(scope,id,song,state) VALUES(?,?,?,?) ON CONFLICT(scope,id) DO UPDATE SET state=excluded.state,song=excluded.song,error='' WHERE downloads.state NOT IN ('transferring','acquiring','queued','pausing','complete')",
        this.scope,
        song.id,
        JSON.stringify(song),
        "queued",
      );
    }
    emit();
    void this.pump();
  }
  pump(): Promise<void> {
    if (
      this.stopped ||
      this.held ||
      (this.backgrounded && this.pauseOnBackground)
    )
      return Promise.resolve();
    if (this.worker) return this.worker;
    this.worker = this.run();
    return this.worker;
  }
  private async run() {
    await Promise.resolve();
    this.lastError = "";
    const attempted = new Map<string, Set<string>>();
    try {
      while (
        !this.stopped &&
        !this.held &&
        !(this.backgrounded && this.pauseOnBackground)
      ) {
        const network = await NetInfo.fetch();
        if (this.stopped || (this.backgrounded && this.pauseOnBackground))
          break;
        if (!network.isConnected || (this.wifiOnly && network.type !== "wifi"))
          break;
        const item = this.list().find((d) => d.state === "queued");
        if (!item) break;
        this.active = item.id;
        const abort = new AbortController();
        this.activeAbort = abort;
        this.cancelled.delete(item.id);
        const path = this.path(item.id),
          part = path + ".part";
        let keepPartial = false,
          routeFailure = false,
          resumeUsed = false;
        try {
          this.update(item.id, "transferring", item.bytes, item.total);
          const media = await this.api.mediaInfo(item.id, abort.signal);
          abort.signal.throwIfAborted();
          const required = Math.max(
            100 * 1024 * 1024,
            media.size + 50 * 1024 * 1024,
          );
          if ((await FS.getFreeDiskStorageAsync()) < required)
            throw new Error(
              "Not enough free phone storage for this track and a safety margin. Remove phone downloads before retrying.",
            );
          abort.signal.throwIfAborted();
          const url = this.api.media(item.id).uri;
          const saved = await readCheckpoint(this.scope, item.id);
          let checkpoint: TransferCheckpoint | null =
            saved &&
            saved.url === url &&
            saved.authorization === this.api.headers().Authorization &&
            saved.total === media.size &&
            saved.etag === media.etag &&
            !!media.etag
              ? saved
              : null;
          if (checkpoint && /^\d+$/.test(checkpoint.resumeData)) {
            const local = await FS.getInfoAsync(part);
            if (
              !local.exists ||
              local.isDirectory ||
              local.size !== Number(checkpoint.resumeData)
            )
              checkpoint = null;
          }
          if (!checkpoint) {
            await clearCheckpoint(this.scope, item.id);
            await FS.deleteAsync(part, { idempotent: true });
          }
          abort.signal.throwIfAborted();
          this.update(
            item.id,
            "transferring",
            checkpoint?.bytes ?? 0,
            media.size,
          );
          this.activeMedia = {
            url,
            total: media.size,
            etag: media.etag,
            authorization: this.api.headers().Authorization,
          };
          this.transfer = FS.createDownloadResumable(
            url,
            part,
            {
              headers: {
                ...this.api.headers(),
                ...(checkpoint ? { "If-Range": checkpoint.etag } : {}),
              },
              sessionType: FS.FileSystemSessionType.BACKGROUND,
            },
            (progress) => {
              if (
                this.cancelled.has(item.id) ||
                this.stopped ||
                this.pauses.has(item.id)
              )
                return;
              this.update(
                item.id,
                "transferring",
                progress.totalBytesWritten,
                media.size,
              );
            },
            checkpoint?.resumeData,
          );
          resumeUsed = !!checkpoint;
          const result = await (
            resumeUsed
              ? this.transfer.resumeAsync()
              : this.transfer.downloadAsync()
          ).catch(() => {
            routeFailure = true;
            throw new Error(
              "Phone transfer interrupted. Retry to restart, or resume a saved checkpoint.",
            );
          });
          if (this.cancelled.has(item.id) || this.stopped) break;
          if (!result && this.pauses.has(item.id)) {
            keepPartial = await this.pauses.get(item.id)!;
            const row = this.list().find((d) => d.id === item.id)!;
            this.update(
              item.id,
              this.automaticPauses.has(item.id)
                ? "paused-background"
                : "paused",
              row.bytes,
              row.total,
              keepPartial
                ? "Paused securely. Resume continues where supported."
                : "Paused without a usable checkpoint. Resume restarts this transfer.",
            );
            break;
          }
          if (
            !result ||
            ![200, 206].includes(result.status) ||
            (!resumeUsed && result.status !== 200)
          ) {
            routeFailure = true;
            throw new Error("Transfer failed. Retry to restart.");
          }
          const info = await FS.getInfoAsync(part);
          const length = Number(
            result.headers["Content-Length"] ??
              result.headers["content-length"] ??
              0,
          );
          const range =
            result.headers["Content-Range"] ?? result.headers["content-range"];
          if (
            result.status === 206 &&
            (!range || Number(range.split("/")[1]) !== media.size)
          )
            throw new Error("Server could not safely resume this transfer.");
          if (
            !info.exists ||
            info.isDirectory ||
            (!resumeUsed && length !== media.size) ||
            !(await this.validate(part, info.size, media.size))
          )
            throw new Error("Incomplete or invalid MP3. Retry to restart.");
          await FS.moveAsync({ from: part, to: path });
          if (this.cancelled.has(item.id) || this.stopped) {
            await FS.deleteAsync(path, { idempotent: true });
            break;
          }
          const original = downloadSong(item);
          if (original)
            db.runSync(
              "UPDATE downloads SET song=? WHERE scope=? AND id=?",
              JSON.stringify({
                ...original,
                onServer: true,
                audioReady: true,
              }),
              this.scope,
              item.id,
            );
          this.update(item.id, "complete", info.size, media.size);
          try {
            await FS.downloadAsync(
              this.api.artwork(item.id).uri,
              this.artwork(item.id),
              { headers: this.api.headers() },
            );
          } catch {
            /* Artwork failure never invalidates completed audio. */
          }
        } catch (error) {
          if (!this.cancelled.has(item.id) && !this.stopped) {
            if (this.pauses.has(item.id)) {
              keepPartial = await this.pauses.get(item.id)!;
              const row = this.list().find((d) => d.id === item.id)!;
              this.update(
                item.id,
                this.automaticPauses.has(item.id)
                  ? "paused-background"
                  : "paused",
                row.bytes,
                row.total,
                keepPartial
                  ? "Paused securely. Resume continues where supported."
                  : "Source preparation paused. Resume restarts preparation.",
              );
            } else if (resumeUsed) {
              await clearCheckpoint(this.scope, item.id);
              this.update(
                item.id,
                "queued",
                0,
                0,
                "Checkpoint could not resume safely. Restarting from the beginning.",
              );
            } else {
              const failedAddress = this.api.activeServer;
              const tried = attempted.get(item.id) ?? new Set<string>();
              tried.add(failedAddress);
              attempted.set(item.id, tried);
              if (routeFailure) {
                try {
                  await this.api.rest("ping", {}, abort.signal);
                } catch {
                  /* Retain the transfer failure if no route works. */
                }
              }
              if (
                !this.cancelled.has(item.id) &&
                !this.stopped &&
                routeFailure &&
                this.api.activeServer !== failedAddress &&
                !tried.has(this.api.activeServer)
              )
                this.update(
                  item.id,
                  "queued",
                  0,
                  0,
                  "Server address changed. Restarting the transfer.",
                );
              else
                this.update(
                  item.id,
                  "failed",
                  0,
                  0,
                  error instanceof Error ? error.message : "Download failed.",
                );
            }
          }
        } finally {
          try {
            if (!keepPartial) await FS.deleteAsync(part, { idempotent: true });
            if (!keepPartial) await clearCheckpoint(this.scope, item.id);
          } finally {
            this.transfer = null;
            this.activeAbort = null;
            this.active = null;
            this.activeMedia = null;
            this.pauses.delete(item.id);
            this.automaticPauses.delete(item.id);
          }
        }
        if (this.cancelled.has(item.id)) break;
      }
    } catch {
      this.lastError =
        "Could not finish checking network, secure transfer state or phone storage. Retry the download queue.";
    } finally {
      this.worker = null;
      emit();
    }
  }
  async pause(id: string, automatic = false) {
    const row = this.list().find((item) => item.id === id);
    if (!row || row.state === "complete") return;
    const pendingPause = this.pauses.get(id);
    if (pendingPause) {
      await pendingPause;
      await this.worker;
      return;
    }
    if (this.active !== id) {
      this.update(
        id,
        automatic ? "paused-background" : "paused",
        row.bytes,
        row.total,
        "Paused. Resume starts the queued transfer.",
      );
      return;
    }
    const worker = this.worker;
    let finish!: (saved: boolean) => void;
    const done = new Promise<boolean>((resolve) => {
      finish = resolve;
    });
    this.pauses.set(id, done);
    if (automatic) this.automaticPauses.add(id);
    this.update(id, "pausing", row.bytes, row.total);
    let persisted = false;
    try {
      if (this.transfer) {
        const media = this.activeMedia;
        const state = await this.transfer.pauseAsync();
        const current = this.list().find((item) => item.id === id)!;
        if (
          state.resumeData &&
          media &&
          !this.cancelled.has(id) &&
          !this.stopped
        ) {
          const bytes = /^\d+$/.test(state.resumeData)
            ? Number(state.resumeData)
            : current.bytes;
          if (
            media.etag &&
            media.total === current.total &&
            bytes <= media.total &&
            state.url === media.url
          ) {
            await saveCheckpoint(this.scope, id, {
              version: 1,
              url: state.url,
              authorization: media.authorization,
              resumeData: state.resumeData,
              bytes,
              total: media.total,
              etag: media.etag,
              automatic,
            });
            persisted = !this.cancelled.has(id) && !this.stopped;
            if (persisted) this.update(id, "pausing", bytes, media.total);
          }
        }
      } else this.activeAbort?.abort();
    } catch {
      /* A failed secure/native checkpoint falls back to an honest restart. */
    } finally {
      finish(persisted);
    }
    await worker;
    if (
      this.list().find((item) => item.id === id)?.state === "complete" ||
      this.cancelled.has(id) ||
      this.stopped
    )
      await clearCheckpoint(this.scope, id);
  }
  resume(id: string) {
    const row = this.list().find((item) => item.id === id);
    if (!row || !["paused", "paused-background"].includes(row.state)) return;
    this.update(id, "queued", row.bytes, row.total);
    void this.pump();
  }
  async cancel(id: string) {
    this.cancelled.add(id);
    const pausing = this.pauses.get(id);
    if (this.active === id) {
      const task = this.worker;
      this.activeAbort?.abort();
      if (this.transfer && !pausing)
        try {
          await this.transfer.pauseAsync();
        } catch {
          /* Completion and cancellation can race; the final guard prevents promotion. */
        }
      await pausing;
      await task;
    }
    await clearCheckpoint(this.scope, id);
    await FS.deleteAsync(this.path(id) + ".part", { idempotent: true });
    const row = this.list().find((d) => d.id === id);
    if (row?.state === "complete") return;
    this.update(
      id,
      "cancelled",
      0,
      0,
      "Cancelled. Retry restarts the transfer.",
    );
    void this.pump();
  }
  async remove(id: string) {
    await this.cancel(id);
    await FS.deleteAsync(this.path(id), { idempotent: true });
    await FS.deleteAsync(this.artwork(id), { idempotent: true });
    db.runSync("DELETE FROM downloads WHERE scope=? AND id=?", this.scope, id);
    emit();
  }
  async removeAll() {
    this.held = true;
    try {
      for (const d of this.list()) await this.remove(d.id);
    } finally {
      this.held = false;
      void this.pump();
    }
  }
  async stop() {
    this.stopped = true;
    if (this.active) await this.cancel(this.active);
    await this.worker;
    await clearCheckpoints(this.scope);
    for (const item of this.list()) {
      if (["paused", "paused-background", "pausing"].includes(item.state)) {
        await FS.deleteAsync(this.path(item.id) + ".part", {
          idempotent: true,
        });
        this.update(
          item.id,
          "interrupted",
          0,
          0,
          "Secure transfer credentials removed on sign-out. Retry restarts the download.",
        );
      }
    }
  }
}
