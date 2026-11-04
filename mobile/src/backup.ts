import { parsePlaylists, parseSongs, type Api, type Song } from "./api";
import { songMetadata } from "./metadata";
import { restoreQueue, type Queue } from "./queue";
import { laterSongs, maxBookmarks } from "./listen-later";
import { read } from "./db";
export const maxBackupBytes = 10 * 1024 * 1024;
export type LibrarySnapshot = {
  favorites: Song[];
  playlists: { id: string; name: string; songs: Song[] }[];
};
export type Backup = {
  format: "zikky-metadata";
  version: 1;
  createdAt: string;
  server: string;
  accountScope: string;
  listenLater: Song[];
  queue: Queue;
  settings: {
    wifiOnly: boolean;
    pauseOnBackground: boolean;
    appearance: "system" | "dark" | "light";
  };
  downloadedTracks: Song[];
  library: LibrarySnapshot | null;
};
function metadataList(value: unknown, maximum = 50000) {
  if (!Array.isArray(value) || value.length > maximum)
    throw new Error("Invalid or oversized backup song list.");
  return value.map(songMetadata);
}
function portableQueue(value: unknown): Queue {
  if (
    !value ||
    typeof value !== "object" ||
    !Array.isArray((value as Queue).entries) ||
    (value as Queue).entries.length > 10000
  )
    throw new Error("Invalid backup queue.");
  const restored = restoreQueue(value);
  const raw = value as Queue;
  if (
    restored.entries.length !== raw.entries.length ||
    restored.index !== raw.index ||
    restored.shuffle !== raw.shuffle ||
    restored.repeat !== raw.repeat ||
    restored.position !== raw.position ||
    !Array.isArray(raw.original) ||
    restored.original.length !== raw.original.length ||
    restored.original.some((key, index) => key !== raw.original[index])
  )
    throw new Error("Invalid backup queue.");
  return {
    ...restored,
    entries: restored.entries.map((entry) => ({
      key: entry.key,
      song: songMetadata(entry.song),
    })),
  };
}
export function parseBackup(text: string): Backup {
  if (new TextEncoder().encode(text).byteLength > maxBackupBytes)
    throw new Error("Backup is larger than 10 MB.");
  let value: any;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("This is not a valid JSON backup.");
  }
  if (
    !value ||
    value.format !== "zikky-metadata" ||
    value.version !== 1 ||
    typeof value.createdAt !== "string" ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    typeof value.server !== "string" ||
    value.server.length > 2048 ||
    typeof value.accountScope !== "string" ||
    value.accountScope.length > 1024 ||
    typeof value.settings?.wifiOnly !== "boolean" ||
    !["system", "dark", "light"].includes(value.settings?.appearance)
  )
    throw new Error("Unsupported or invalid Zikky backup.");
  let library: LibrarySnapshot | null = null;
  if (value.library !== null) {
    if (
      !value.library ||
      !Array.isArray(value.library.playlists) ||
      value.library.playlists.length > 1000
    )
      throw new Error("Invalid backup playlists.");
    let count = 0;
    library = {
      favorites: metadataList(value.library.favorites),
      playlists: value.library.playlists.map((p: any) => {
        if (
          typeof p.id !== "string" ||
          p.id.length > 256 ||
          typeof p.name !== "string" ||
          p.name.length > 4096
        )
          throw new Error("Invalid backup playlist.");
        const songs = metadataList(p.songs);
        count += songs.length;
        if (count > 50000)
          throw new Error("Backup contains too many playlist tracks.");
        return { id: p.id, name: p.name, songs };
      }),
    };
  }
  if (
    value.settings.pauseOnBackground !== undefined &&
    typeof value.settings.pauseOnBackground !== "boolean"
  )
    throw new Error("Invalid background download preference.");
  return {
    format: "zikky-metadata",
    version: 1,
    createdAt: value.createdAt,
    server: value.server,
    accountScope: value.accountScope,
    settings: {
      wifiOnly: value.settings.wifiOnly,
      pauseOnBackground: value.settings.pauseOnBackground ?? true,
      appearance: value.settings.appearance,
    },
    listenLater: metadataList(value.listenLater, maxBookmarks),
    queue: portableQueue(value.queue),
    downloadedTracks: metadataList(value.downloadedTracks),
    library,
  };
}
export async function createBackup(
  api: Api,
  scope: string,
  queue: Queue,
  downloaded: Song[],
  includeLibrary: boolean,
  signal?: AbortSignal,
  progress?: (done: number, total: number) => void,
): Promise<Backup> {
  let library: LibrarySnapshot | null = null;
  if (includeLibrary) {
    const starred = await api.rest("getStarred2", {}, signal);
    const lists = parsePlaylists(
      (await api.rest("getPlaylists", {}, signal)).playlists?.playlist,
    );
    if (lists.length > 1000)
      throw new Error("Too many playlists for one backup.");
    library = {
      favorites: parseSongs(starred.starred2?.song).map(songMetadata),
      playlists: [],
    };
    progress?.(0, lists.length);
    for (const playlist of lists) {
      signal?.throwIfAborted();
      const data = await api.rest("getPlaylist", { id: playlist.id }, signal);
      library.playlists.push({
        id: playlist.id,
        name: playlist.name,
        songs: parseSongs(data.playlist?.entry).map(songMetadata),
      });
      progress?.(library.playlists.length, lists.length);
    }
  }
  const backup: Backup = {
    format: "zikky-metadata",
    version: 1,
    createdAt: new Date().toISOString(),
    server: api.credentials.server,
    accountScope: scope,
    listenLater: laterSongs(scope),
    queue,
    settings: {
      wifiOnly: read(scope, "wifi-only", true),
      pauseOnBackground: read(scope, "pause-background", true),
      appearance: read("device", "appearance", "system"),
    },
    downloadedTracks: downloaded,
    library,
  };
  // Whitelist portable fields, check bounds and reject malformed cached preferences before exporting.
  return parseBackup(JSON.stringify(backup));
}
export function prepareRestore(backup: Backup, scope: string, server: string) {
  if (backup.accountScope !== scope || backup.server !== server)
    throw new Error(
      "Sign in with the same primary server address and account before restoring this backup.",
    );
  const merged = new Map(laterSongs(scope).map((song) => [song.id, song]));
  for (const song of backup.listenLater)
    if (!merged.has(song.id))
      merged.set(song.id, { ...song, audioReady: undefined });
  if (merged.size > maxBookmarks)
    throw new Error(
      "The merged Listen later list would exceed 5,000 bookmarks.",
    );
  return {
    listenLater: [...merged.values()],
    queue: {
      ...backup.queue,
      entries: backup.queue.entries.map((entry) => ({
        ...entry,
        song: { ...entry.song, audioReady: undefined },
      })),
    },
    settings: backup.settings,
  };
}
