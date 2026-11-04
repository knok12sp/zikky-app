import type { Api } from "./api";
import type { Entry } from "./queue";

/** Building a queue is metadata-only; native play streams the current entry. */
export function playbackSource(
  entry: Entry,
  api: Api,
  local: string | undefined,
  artworkUrl: string,
) {
  const song = entry.song;
  return {
    ...(local ? { uri: local } : api.playingMedia(song.id)),
    entryKey: entry.key,
    name: song.title,
    metadata: {
      title: song.title,
      artist: song.artist,
      albumTitle: song.album,
      artworkUrl,
    },
  };
}
