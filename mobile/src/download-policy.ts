export function validAudio(bytes: Uint8Array, size: number, expected: number) {
  return (
    size > 128 &&
    (expected === 0 || size === expected) &&
    ((bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
      (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0))
  );
}
export function recovery(
  state: string,
  exists: boolean,
  valid: boolean,
): string {
  return state === "complete" && exists && valid
    ? "complete"
    : ["queued", "failed", "cancelled", "interrupted"].includes(state)
      ? state
      : "interrupted";
}
import type { Song } from "./api";
export function collectionDownloads(
  songs: Song[],
  downloads: { id: string; state: string }[],
) {
  const unique = [...new Map(songs.map((song) => [song.id, song])).values()];
  const states = new Map(
    downloads.map((download) => [download.id, download.state]),
  );
  const complete = unique.filter(
    (song) => states.get(song.id) === "complete",
  ).length;
  const pending = unique.filter((song) =>
    ["queued", "acquiring", "transferring", "pausing"].includes(
      states.get(song.id) ?? "",
    ),
  ).length;
  const missing = unique.filter(
    (song) =>
      !["complete", "queued", "acquiring", "transferring", "pausing"].includes(
        states.get(song.id) ?? "",
      ),
  );
  return { total: unique.length, complete, pending, missing };
}
