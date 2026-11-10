import type { Song } from "./api";

/** Desktop is streaming-first. This stub keeps phone-only offline code out of web. */
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
    return JSON.parse(item.song) as Song;
  } catch {
    return undefined;
  }
}
export function completedSongs(_items: Download[]) {
  return [] as Song[];
}
export const watchDownloads = (_fn: () => void) => () => {};
export class Offline {
  wifiOnly = false;
  pauseOnBackground = false;
  lastError = "";
  list(): Download[] {
    return [];
  }
  setGenre(_id: string, _genre: string) {}
  path(_id: string) {
    return "";
  }
  artwork(_id: string) {
    return "";
  }
  local(_id: string) {
    return undefined;
  }
  async init() {}
  enqueue(_songs: Song[]) {
    throw new Error(
      "Offline downloads are available in the Zikky mobile app. Desktop streams from your server.",
    );
  }
  async pump() {}
  async onAppState(_state: string) {}
  async pause(_id: string, _automatic = false) {}
  resume(_id: string) {}
  async cancel(_id: string) {}
  async remove(_id: string) {}
  async removeAll() {}
  async stop() {}
  setWifiOnly(_value: boolean, _startQueued = true) {}
  setPauseOnBackground(_value: boolean) {}
}
