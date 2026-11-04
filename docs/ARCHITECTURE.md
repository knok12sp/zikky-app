# Architecture

Zikky is a client-only Expo application. A Subsonic-compatible server owns the
music library; the phone owns playback state, a metadata cache and optional
offline copies.

```text
Subsonic server  ◄── REST + stream ──►  mobile/src/api.ts
                                             │
                       ┌─────────────────────┼─────────────────────┐
                       ▼                     ▼                     ▼
                 TanStack Query        PlaybackProvider       Offline worker
                 metadata cache        native queue           phone files
                       │                     │                     │
                       └──────────── Expo Router screens ─────────┘
```

## Mobile layers

| Layer       | Files                                                        | Responsibility                                                                      |
| ----------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| API         | `src/api.ts`                                                 | Subsonic REST calls, address failover, response validation, stream and artwork URLs |
| Session     | `src/session.tsx`                                            | Credentials, account scope, login/logout, secure storage, address updates           |
| Query       | `src/data.ts`                                                | TanStack Query hooks with SQLite-backed initial data                                |
| Playback    | `src/playback.tsx`, `src/queue.ts`, `src/playback-source.ts` | Native queue, shuffle/repeat, seek, sleep timer, scrobbling                         |
| Offline     | `src/offline.ts`, `src/download-policy.ts`                   | Explicit phone downloads, resumable transfers, integrity checks                     |
| Persistence | `src/db.ts`, `src/migrations.ts`                             | SQLite cache for songs, playlists, settings and downloads                           |
| Design      | `src/theme.ts`, `src/kit.tsx`, `src/icon.tsx`, `src/ui.tsx`  | Tokens, primitives, icons and page chrome                                           |
| Screens     | `app/`                                                       | Router destinations and presentation                                                |

## Server contract

Zikky speaks the standard Subsonic API with JSON responses:

- `ping` — login validation.
- `getAlbumList2` + `getAlbum` — build the song and album catalogue.
- `search3` — server-side search.
- `getArtists` / `getArtist` / `getAlbum` — collection browsing.
- `getStarred2` — favourites.
- `getPlaylists` / `getPlaylist` — playlists.
- `updatePlaylist` — add or remove tracks.
- `createPlaylist` — create a playlist or replace its ordered track list.
- `star` / `unstar` — favourites.
- `scrobble` — play submission.
- `stream` — progressive audio.
- `getCoverArt` — artwork.

The client validates every response shape before it reaches a screen. Server
errors are reduced to safe, user-facing messages; upstream response bodies are
not shown.

## Catalogue loading

Subsonic has no "all songs" endpoint, so `Api.songs()` pages
`getAlbumList2` (500 albums per request) and then requests each album with
`getAlbum`, eight at a time. Results are deduplicated and sorted locally. The
complete list is cached in SQLite so later launches render immediately and
refresh in the background.

Search uses `search3` with 500 songs per page, bounded to 4,000 results.

This approach is correct but makes the first load proportional to album count.
For very large libraries, use search rather than waiting for a full catalogue
sync.

## Playback and queue

`PlaybackProvider` owns the authoritative queue. Selecting songs builds queue
entries and native playlist metadata without fetching audio. The current entry
resolves to either a local file (when a completed phone download exists) or the
server's `stream` URL. Native playback handles buffering, background audio,
lock-screen metadata, headset controls and end-of-track transitions.

Shuffle preserves the current track and the original order. Repeat cycles
through off, all and one. Queue edits preserve the playing entry where possible.
These rules live in `src/queue.ts` and are covered by tests.

## Phone downloads

Downloads are explicit and independent of the server library:

1. The user chooses **Download to this phone**.
2. A row is queued in SQLite.
3. The worker checks network policy and free space.
4. It requests the stream, writes to a `.part` file, validates the audio header
   and reports progress.
5. Only a validated file is promoted and marked complete.
6. Removing a download deletes the local file and row. It never contacts the
   server to delete anything.

Checkpoints can resume interrupted transfers when the server provides a stable
size and ETag. Invalid or changed files restart from zero.

## Persistence and privacy

- Credentials live in Expo SecureStore, not SQLite.
- The account scope is a SHA-256 of the primary server URL and username.
- Cached metadata is scoped per account and can be cleared from Settings.
- Server addresses, playlists, favourites and queue are the only account data.
- No analytics, telemetry or third-party tracking is included.

## Failure handling

- Requests fail over between configured addresses for safe, idempotent reads.
  Non-idempotent playlist edits are not silently replayed.
- The UI distinguishes offline cached data from live server data.
- Playback and downloads surface specific errors and retry actions rather than
  failing silently.
- A route change during playback attempts one controlled reload when the track
  fails.

## Extension points

- Add Subsonic endpoints in `src/api.ts` and validate their response shape.
- Add screens under `app/`; shared visuals belong in `src/kit.tsx`.
- Keep the server/phone storage distinction in every new action.
- Add tests for parsers, queue rules and screen interactions.
