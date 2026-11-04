import { parseSong, type Song } from "./api";

/** Only portable music metadata belongs in bookmarks or backups. */
export function songMetadata(value: unknown): Song {
  const song = parseSong(value);
  if (
    song.id.length > 256 ||
    song.title.length > 4096 ||
    song.artist.length > 4096 ||
    song.duration > 86400
  )
    throw new Error("Song metadata exceeds the supported bounds.");
  const result: Song = {
    id: song.id,
    title: song.title,
    artist: song.artist,
    duration: song.duration,
  };
  for (const key of [
    "album",
    "albumId",
    "artistId",
    "coverArt",
    "starred",
  ] as const) {
    if (song[key] !== undefined) {
      if (song[key]!.length > 4096)
        throw new Error("Song metadata exceeds the supported bounds.");
      result[key] = song[key];
    }
  }
  if (song.onServer !== undefined) result.onServer = song.onServer;
  if (song.audioReady !== undefined) result.audioReady = song.audioReady;
  return result;
}
