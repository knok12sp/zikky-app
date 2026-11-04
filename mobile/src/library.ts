import type { Song } from "./api";
export function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
export function matchesSong(song: Song, query: string) {
  const normalize = (s: string) =>
    s.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase();
  const text = normalize(`${song.title} ${song.artist} ${song.album ?? ""}`);
  return normalize(query)
    .trim()
    .split(/\s+/)
    .every((word) => text.includes(word));
}
export function collectionSongs(
  songs: Song[],
  kind: string,
  id: string,
  offlineIds?: Set<string>,
) {
  return songs.filter(
    (song) =>
      (!offlineIds || offlineIds.has(song.id)) &&
      (kind === "playlist" ||
        (kind === "album" ? song.albumId === id : song.artistId === id)),
  );
}
