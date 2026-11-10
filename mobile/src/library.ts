import type { Song } from "./api";
export function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
export function matchesSong(song: Song, query: string) {
  const normalize = (s: string) =>
    s.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase();
  const text = normalize(
    `${song.title} ${song.artist} ${song.album ?? ""} ${song.genre ?? ""}`,
  );
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
        (kind === "genre"
          ? genreKey(song) === id
          : kind === "album"
            ? song.albumId === id
            : song.artistId === id)),
  );
}

export function genreKey(song: Song) {
  return song.genre?.trim().toLocaleLowerCase() || "";
}
export function genreGroups(songs: Song[]) {
  const groups = new Map<string, { id: string; name: string; count: number }>();
  for (const song of songs) {
    const id = genreKey(song);
    const group = groups.get(id);
    if (group) group.count++;
    else
      groups.set(id, {
        id,
        name: song.genre?.trim() || "Unlabelled",
        count: 1,
      });
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}
