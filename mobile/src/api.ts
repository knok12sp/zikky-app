export type Credentials = {
  /** Stable preferred address; kept first so account-scoped downloads survive route changes. */
  server: string;
  alternateServers?: string[];
  preferredServer?: string;
  username: string;
  password: string;
};
export type Song = {
  id: string;
  title: string;
  artist: string;
  album?: string;
  albumId?: string;
  artistId?: string;
  duration: number;
  coverArt?: string;
  starred?: string;
  onServer?: boolean;
  audioReady?: boolean;
};
export type Playlist = {
  id: string;
  name: string;
  songCount: number;
  entry?: Song[];
};
export function normalizeServer(value: string) {
  const url = new URL(value.trim());
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Use a server HTTP(S) address without credentials or query parameters.",
    );
  return url.toString().replace(/\/$/, "");
}
export function normalizeServers(value: string | string[]) {
  const raw = Array.isArray(value) ? value : value.split(/[\n,]/);
  const servers = [
    ...new Set(
      raw
        .map((server) => server.trim())
        .filter(Boolean)
        .map(normalizeServer),
    ),
  ];
  if (!servers.length) throw new Error("Enter at least one server address.");
  if (servers.length > 4) throw new Error("Use at most four server addresses.");
  return servers;
}
export function addressOrder(addresses: string[], preferred: string) {
  const unique = [...new Set(addresses)];
  const index = unique.indexOf(preferred);
  return index < 0
    ? unique
    : [...unique.slice(index), ...unique.slice(0, index)];
}
export function parseSong(value: unknown): Song {
  if (!value || typeof value !== "object")
    throw new Error("Invalid song response.");
  const s = value as Record<string, unknown>;
  if (
    typeof s.id !== "string" ||
    !s.id ||
    typeof s.title !== "string" ||
    typeof s.duration !== "number" ||
    s.duration < 0 ||
    !Number.isFinite(s.duration)
  )
    throw new Error("Invalid song metadata.");
  const artist =
    typeof s.artist === "string" && s.artist.trim()
      ? s.artist
      : "Unknown artist";
  for (const key of ["album", "albumId", "artistId", "coverArt", "starred"])
    if (s[key] !== undefined && typeof s[key] !== "string")
      throw new Error("Invalid song metadata.");
  for (const key of ["onServer", "audioReady"])
    if (s[key] !== undefined && typeof s[key] !== "boolean")
      throw new Error("Invalid song storage status.");
  return { ...(s as Song), artist };
}
export function parseSongs(value: unknown): Song[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("Invalid song list.");
  return value.map(parseSong);
}
export function parsePlaylists(value: unknown): Playlist[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("Invalid playlist list.");
  return value.map((p) => {
    if (
      !p ||
      typeof p.id !== "string" ||
      !p.id ||
      typeof p.name !== "string" ||
      !Number.isInteger(p.songCount) ||
      p.songCount < 0
    )
      throw new Error("Invalid playlist metadata.");
    return {
      id: p.id,
      name: p.name,
      songCount: p.songCount,
      ...(p.entry !== undefined ? { entry: parseSongs(p.entry) } : {}),
    };
  });
}
export function basic(c: Credentials) {
  const bytes = new TextEncoder().encode(`${c.username}:${c.password}`);
  return (
    "Basic " + btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""))
  );
}
class ApiResponseError extends Error {
  constructor(status: number, path: string) {
    let message = `Server request failed (${status}). Retry when the server is available.`;
    if (status === 0) message = "Server returned invalid JSON.";
    else if (status === 401 || status === 403)
      message = "Login rejected. Check your username and password.";
    else if (status === 404)
      message = "Requested music was not found. Refresh and retry.";
    else if (status === 429) message = "Server is busy. Retry shortly.";
    else if (status === 409)
      message =
        "Playlist changed on the server. Refresh this collection before editing again.";
    else if (status === 413)
      message = "This playlist is too large to update in one request.";
    else if (status === 400 || status === 422)
      message = "The server rejected this request. Check the values and retry.";
    super(message);
  }
}
const SORT_TYPES: Record<string, string> = {
  title: "alphabeticalByName",
  artist: "alphabeticalByArtist",
  recent: "newest",
  played: "recent",
};
export class Api {
  private activeServerValue: string;
  constructor(readonly credentials: Credentials) {
    const servers = this.addresses;
    this.activeServerValue = servers.includes(credentials.preferredServer ?? "")
      ? credentials.preferredServer!
      : credentials.server;
  }
  get addresses() {
    return [
      ...new Set([
        this.credentials.server,
        ...(this.credentials.alternateServers ?? []),
      ]),
    ];
  }
  get activeServer() {
    return this.activeServerValue;
  }
  preferServer(server: string) {
    if (this.addresses.includes(server)) this.activeServerValue = server;
  }
  headers() {
    return { Authorization: basic(this.credentials) };
  }
  authQuery() {
    return new URLSearchParams({
      u: this.credentials.username,
      p: this.credentials.password,
      v: "1.16.1",
      c: "Zikky",
      f: "json",
    });
  }
  url(path: string) {
    return this.activeServerValue + path;
  }
  async request(
    path: string,
    options: RequestInit = {},
    policy: { retrySafe?: boolean; timeoutMs?: number } = {},
  ) {
    const ordered = addressOrder(this.addresses, this.activeServerValue);
    const retrySafe =
      policy.retrySafe ?? ["GET", "HEAD"].includes(options.method ?? "GET");
    for (const server of ordered) {
      options.signal?.throwIfAborted();
      const controller = new AbortController();
      const abort = () => controller.abort();
      options.signal?.addEventListener("abort", abort, { once: true });
      const timeout = setTimeout(abort, policy.timeoutMs ?? 7000);
      try {
        const response = await fetch(server + path, {
          ...options,
          headers: { ...this.headers(), ...options.headers },
          signal: controller.signal,
        });
        if (response.status === 408 || response.status >= 500) {
          if (retrySafe && server !== ordered[ordered.length - 1]) continue;
        }
        this.activeServerValue = server;
        if (!response.ok) throw new ApiResponseError(response.status, path);
        if (options.method === "HEAD") return response;
        let data: unknown;
        try {
          data = await response.json();
        } catch (e) {
          if (controller.signal.aborted) throw e;
          throw new ApiResponseError(0, path);
        }
        options.signal?.throwIfAborted();
        return data as any;
      } catch (e) {
        if (options.signal?.aborted) throw e;
        if (e instanceof ApiResponseError) throw e;
        if (!retrySafe)
          throw new Error(
            "Connection lost before confirmation. Refresh before repeating this action; it may already have completed.",
          );
      } finally {
        clearTimeout(timeout);
        options.signal?.removeEventListener("abort", abort);
      }
    }
    throw new Error(
      "Could not reach any configured server address. Check the network and server URL.",
    );
  }
  async rest(
    endpoint: string,
    params: Record<string, string | string[]> = {},
    signal?: AbortSignal,
  ) {
    const body = this.authQuery();
    for (const [key, value] of Object.entries(params))
      for (const item of Array.isArray(value) ? value : [value])
        body.append(key, item);
    const retrySafe =
      endpoint.startsWith("get") ||
      ["ping", "star", "unstar", "setRating"].includes(endpoint) ||
      (endpoint === "createPlaylist" && !!params.playlistId) ||
      (endpoint === "updatePlaylist" &&
        !params.songIdToAdd &&
        !params.songIndexToRemove);
    const data = await this.request(
      "/rest/" + endpoint,
      {
        method: "POST",
        body: body.toString(),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal,
      },
      { retrySafe, timeoutMs: endpoint === "ping" ? 7000 : 45000 },
    );
    const envelope = data?.["subsonic-response"];
    if (!envelope || envelope.status !== "ok")
      throw new Error(
        envelope?.error?.code === 40
          ? "Login rejected. Check your credentials."
          : envelope?.error?.code === 70
            ? "The song or playlist no longer exists. Refresh this collection."
            : envelope?.error?.code === 50
              ? "This playlist is read-only."
              : "Music operation failed. Please retry.",
      );
    return envelope;
  }
  private albumSongs(albumId: string, signal?: AbortSignal) {
    return this.rest("getAlbum", { id: albumId }, signal).then((data) =>
      parseSongs(data.album?.song),
    );
  }
  private async albums(type: string, count: number, signal?: AbortSignal) {
    const found: string[] = [];
    for (let offset = 0; offset < count; offset += 500) {
      const data = await this.rest(
        "getAlbumList2",
        { type, size: "500", offset: String(offset) },
        signal,
      );
      const page = data.albumList2?.album;
      const albums = Array.isArray(page) ? page : [];
      for (const album of albums)
        if (album && typeof album.id === "string") found.push(album.id);
      if (albums.length < 500) break;
    }
    return found.slice(0, count);
  }
  private async songsForAlbums(albumIds: string[], signal?: AbortSignal) {
    const result: Song[] = [];
    for (let index = 0; index < albumIds.length; index += 8) {
      signal?.throwIfAborted();
      const batch = await Promise.all(
        albumIds
          .slice(index, index + 8)
          .map((id) => this.albumSongs(id, signal)),
      );
      for (const songs of batch) result.push(...songs);
    }
    const seen = new Set<string>();
    return result.filter((song) => {
      if (seen.has(song.id)) return false;
      seen.add(song.id);
      return true;
    });
  }
  async songs(q = "", sort = "title", signal?: AbortSignal): Promise<Song[]> {
    if (q.trim()) return this.search(q, signal);
    const type = SORT_TYPES[sort] ?? SORT_TYPES.title!;
    const albums = await this.albums(
      type,
      sort === "recent" || sort === "played" ? 120 : 4000,
      signal,
    );
    const songs = await this.songsForAlbums(albums, signal);
    if (sort === "title")
      return songs.sort(
        (a, b) =>
          a.title.localeCompare(b.title) || a.artist.localeCompare(b.artist),
      );
    if (sort === "artist")
      return songs.sort(
        (a, b) =>
          a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title),
      );
    return songs;
  }
  async search(q: string, signal?: AbortSignal) {
    const result: Song[] = [];
    const seen = new Set<string>();
    for (let offset = 0; offset <= 4000; offset += 500) {
      const data = await this.rest(
        "search3",
        {
          query: q,
          songCount: "500",
          songOffset: String(offset),
          albumCount: "0",
          artistCount: "0",
        },
        signal,
      );
      const page = parseSongs(data.searchResult3?.song);
      for (const song of page)
        if (!seen.has(song.id)) {
          seen.add(song.id);
          result.push(song);
        }
      if (page.length < 500) break;
    }
    return result;
  }
  async smart(id: string, signal?: AbortSignal) {
    if (id.endsWith("favorites")) {
      const data = await this.rest("getStarred2", {}, signal);
      return parseSongs(data.starred2?.song);
    }
    if (id.endsWith("discover")) {
      const data = await this.rest("getRandomSongs", { size: "50" }, signal);
      return parseSongs(data.randomSongs?.song);
    }
    const albums = await this.albums(
      id.endsWith("played") ? "recent" : "newest",
      20,
      signal,
    );
    return this.songsForAlbums(albums, signal);
  }
  movePlaylistTrack(id: string, from: number, to: number, songs: string[]) {
    const next = [...songs];
    const [moved] = next.splice(from, 1);
    if (moved === undefined) return Promise.resolve();
    next.splice(to, 0, moved);
    return this.replacePlaylist(id, next);
  }
  replacePlaylist(id: string, songIds: string[]) {
    return this.rest("createPlaylist", {
      playlistId: id,
      ...(songIds.length ? { songId: songIds } : {}),
    });
  }
  removePlaylistTrack(id: string, index: number) {
    return this.rest("updatePlaylist", {
      playlistId: id,
      songIndexToRemove: String(index),
    });
  }
  media(id: string) {
    const query = this.authQuery();
    query.set("id", id);
    return {
      uri: this.url("/rest/stream?" + query.toString()),
      headers: this.headers(),
    };
  }
  async mediaInfo(id: string, signal?: AbortSignal) {
    const response: Response = await this.request(this.mediaPath(id), {
      method: "HEAD",
      signal,
    });
    const size = Number(response.headers.get("content-length"));
    if (!Number.isSafeInteger(size) || size <= 128)
      throw new Error("Server did not provide a valid audio size.");
    return {
      size,
      etag:
        response.headers.get("etag") ??
        response.headers.get("last-modified") ??
        "",
    };
  }
  private mediaPath(id: string) {
    const query = this.authQuery();
    query.set("id", id);
    return "/rest/stream?" + query.toString();
  }
  playingMedia(id: string) {
    return this.media(id);
  }
  artwork(id: string, server = this.activeServerValue) {
    const query = this.authQuery();
    query.set("id", id);
    query.set("size", "600");
    return {
      uri: server + "/rest/getCoverArt?" + query.toString(),
      headers: this.headers(),
    };
  }
}
