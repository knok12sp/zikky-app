import { read, write } from "./db";
import { type Song } from "./api";
import { songMetadata } from "./metadata";
export const laterKey = "listen-later";
export const maxBookmarks = 5000;
const listeners = new Map<string, Set<() => void>>();
export function watchLater(scope: string, listener: () => void) {
  const group = listeners.get(scope) ?? new Set<() => void>();
  group.add(listener);
  listeners.set(scope, group);
  return () => {
    group.delete(listener);
    if (!group.size) listeners.delete(scope);
  };
}
export function notifyLater(scope: string) {
  listeners.get(scope)?.forEach((listener) => listener());
}
export function laterSongs(scope: string): Song[] {
  const cached = read<unknown>(scope, laterKey, []);
  if (!Array.isArray(cached)) return [];
  const songs = new Map<string, Song>();
  for (const value of cached.slice(0, maxBookmarks)) {
    try {
      const song = songMetadata(value);
      if (!songs.has(song.id)) songs.set(song.id, song);
    } catch {
      /* Keep valid bookmarks when one metadata record is damaged. */
    }
  }
  return [...songs.values()];
}
export function saveLater(scope: string, value: Song) {
  const song = songMetadata(value);
  const existing = laterSongs(scope).filter((item) => item.id !== song.id);
  if (existing.length >= maxBookmarks)
    throw new Error(
      "Listen later is full. Remove a bookmark before adding another.",
    );
  write(scope, laterKey, [song, ...existing]);
  notifyLater(scope);
}
export function removeLater(scope: string, id: string) {
  write(
    scope,
    laterKey,
    laterSongs(scope).filter((song) => song.id !== id),
  );
  notifyLater(scope);
}
