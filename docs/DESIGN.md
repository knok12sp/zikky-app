# Zikky design language

Zikky is a personal music player with a permanent library on your server and a
phone that streams from it. The interface should feel like a well-made portable
player: dark, quiet, tactile, and built around artwork. Green is the signature,
not the wallpaper. Retro details are structural and typographic, never costumes.

## Principles

1. **Music first, chrome second.** Artwork, title and artist lead every surface.
   Controls are compact, familiar and reachable with one thumb.
2. **One primary action.** A screen has one obvious thing to do. Everything else
   is a quiet icon or a contextual sheet, not another rectangle of text.
3. **Physical confidence.** Surfaces have clear depth, controls sit on a
   consistent grid, and pressed states feel like a button moving, not a colour
   flashing.
4. **Honest status.** Buffering, streaming, downloading and offline
   availability are separate states with separate words. Nothing pretends.
5. **No decoration that lies.** No fake equaliser, no animated bars, no
   visualiser without real audio data. The retro personality comes from the
   digital time readout, mono numerals, hairline rules and mechanical control
   layout.

## Colour

Tokens live in `mobile/src/theme.ts`; screens never hardcode a hex outside that
file.

| Role                | Dark                       | Light                |
| ------------------- | -------------------------- | -------------------- |
| App background      | `#0A0E0B` near-black green | `#F2F5EE` warm paper |
| Surface / card      | `#111712`                  | `#FFFFFF`            |
| Raised surface      | `#1B241C`                  | `#FFFFFF`            |
| Inset / well        | `#070A08`                  | `#E7ECE1`            |
| Primary text        | `#EDF2E9`                  | `#10160F`            |
| Secondary text      | `#9BA89C`                  | `#58655A`            |
| Accent              | `#65E39A` spring green     | `#0F6B3B` deep green |
| Accent text on fill | `#04140A`                  | `#FFFFFF`            |
| Display glow        | `#9CF5BE`                  | `#0A512C`            |
| Border              | `#242E26`                  | `#D5DED2`            |
| Danger              | `#FF9A9A`                  | `#A32235`            |

Rules:

- Accent marks **state and the one primary action**. It is not used for large
  backgrounds, body copy or every icon.
- Dark surfaces step up in value: background → surface → raised. Inset wells are
  darker than the background and are used for displays, search fields and
  progress tracks.
- Light theme mirrors the same hierarchy with paper and white rather than
  simply inverting the dark palette.
- Text on accent always uses `onAccent`, never white by habit.

## Typography

- One family: the platform UI sans. Numerals use the mono stack
  (`Menlo` on iOS, `monospace` elsewhere) for elapsed time, remaining time and
  storage figures.
- Scale: display 34/40 bold, title 28/34 bold, heading 18/24 semibold,
  body 16/23, meta 13/18, micro 11/14 uppercase with tracking, numeric 13/18.
- Track titles are body weight 600 and truncate to one line. Artist and album
  metadata are 13 px, muted, one line. Never let metadata compete with a title.
- Section labels are uppercase micro text with wide tracking; they organise a
  page without adding another card.

## Spacing, shape and elevation

- Spacing scale: 4, 8, 12, 16, 20, 24, 32. Screen gutters are 20.
- Radii: 8 (small controls), 12 (rows), 16 (cards), 22 (artwork / hero), 999
  (pills).
- Touch targets are at least 44 px; primary actions are 48–56 px.
- Cards use a 1 px border in `border` plus a slightly raised fill. Shadows are
  reserved for the circular play button and modals; they are never used to fake
  glass or gradients.
- Artwork is a square with a 12–22 px radius (larger radius at larger sizes).
  Missing artwork shows a note glyph on an inset surface, never a broken image.

## Icons

`mobile/src/icon.tsx` is a dependency-free set drawn from Views and a small
number of glyphs: play, pause, next, previous, shuffle, repeat, repeat one,
heart, download, downloaded, more, queue, close, chevrons, search, home,
library, settings, server, phone, plus, check, note, sort, clock, trash,
sparkle, wifi, retry. They are decorative to screen readers; the surrounding
button carries the accessible name. Icon-only buttons always have an
`accessibilityLabel` that states the action, including the track name where the
target is ambiguous (`Options for Title, Artist`).

## Components (`mobile/src/kit.tsx`)

- `Card` — the standard surface; `inset` for wells.
- `SectionTitle` — uppercase label with an optional inline text action.
- `IconButton` — 40 px target, plain/filled/outline, active state, busy state.
- `PlayButton` — 64 px accent circle, the loudest control on a screen.
- `Chip` / `Segmented` — selection and filters; selected state is accent text
  plus an accent border, never colour alone.
- `ProgressBar` — real 0..1 progress only.
- `Banner` — inline error or status with an optional retry.
- `EmptyState` — icon, short title, explanation, optional action.
- `Stat` — a numeric value with an uppercase caption.
- `BackButton` — consistent 44 px back affordance on secondary screens.

Shared music pieces live in `mobile/src/components.tsx`:

- `Art` — authenticated server artwork, with the local offline file taking
  priority and the same error fallback as before.
- `SongList` — compact 52 px rows: artwork, title, artist · duration, a small
  status line, favourite marker, and an overflow button. It owns the track
  sheet: Listen later, favourite, Download to this phone, Play next, Append to
  queue, Add to playlist, Create playlist. The sheet guards against duplicate
  taps; a playlist add or bookmark never downloads audio.
- `MiniPlayer` — persistent strip above the tab bar: artwork, title, artist,
  play/pause and next, plus a 2 px real progress hairline. It opens Now Playing.

## Navigation and layout

- Three primary tabs: **Home**, **Library**, **Search**. The tab bar is 56 px,
  uses icons plus 10 px labels, and sits below the mini-player.
- Secondary destinations are pushed screens with a consistent back button:
  Now Playing, Queue, Collection (album/artist/playlist/favourites), Listen
  later, On this phone, Settings, Backup.
- Every screen respects top and side safe areas. Pushed screens add bottom
  padding for the home indicator; the tab screens rely on the tab bar.
- Content is a single vertical scroll or a FlatList — never nested scrolling
  lists. Long lists use `FlatList` with stable keys and windowing.

## Now Playing

- Large framed artwork centred at the top, with a tiny metadata strip beneath:
  streaming/offline badge, album, track position.
- Title and artist are immediately readable; the album is secondary.
- The digital display is an inset well with mono elapsed time, a thin tick-mark
  seek rail, and remaining time prefixed with a minus sign. It reads like a
  device display without imitating a specific product.
- Transport is a single row: shuffle, previous, large play/pause, next, repeat.
  Shuffle and repeat show their state through accent and a small dot/`1`; the
  accessible label spells the state out.
- Utility actions (favourite, download to phone, queue, retry) are icon buttons
  under the transport. Sleep timer options live in a quiet card below.
- Up next previews the following tracks without duplicating the queue screen.

## Server versus phone

This distinction is a product rule, not a visual nicety.

| Meaning                              | Wording                                    | Icon     |
| ------------------------------------ | ------------------------------------------ | -------- |
| Exists in the server library         | `On server` / `Library`                    | server   |
| Streaming from the server            | `Streaming from your server`               | wifi     |
| Explicit offline copy on this phone  | `On this phone`, `Downloads on this phone` | phone    |
| Explicit action to make offline copy | `Download to this phone`                   | download |

- Browsing, searching, favourites and playlists never download audio.
- Removing a phone copy never deletes the server copy, and removal never clears
  the queue. Downloads are only created by an explicit user action.
- Phone downloads and the server library use different screens, icons and empty
  states so the two stores can never be confused.
- Zikky is a player: it does not acquire, upload or delete music on the server.

## Motion and feedback

- Motion is limited to a pressed scale on the play button, sheet slide-in, and
  state changes such as the mini-player progress hairline. There is no looping
  decorative animation.
- Reduced-motion preferences should disable non-essential transitions; the
  interface remains fully usable without them.
- Every asynchronous action shows a busy state and a specific failure message
  with a retry, rather than silently doing nothing.
- Destructive actions use the danger colour and an `Alert` confirmation.

## Accessibility

- All icon-only controls have explicit names and state (`selected`, `disabled`,
  `busy`).
- Rows expose a single `Play Title, Artist` action; the overflow is separate.
- Titles, subtitles and status lines are real text, so Dynamic Type can scale
  them. Rows use minimum heights rather than fixed heights.
- Colour is never the only signal: selected chips also use weight and border,
  the current queue row also says `Now playing`, download state also has text.
- Contrast targets WCAG AA for body text in both themes.

## File map

| Concern                                      | File                                                  |
| -------------------------------------------- | ----------------------------------------------------- |
| Colour, type, spacing, radius tokens         | `mobile/src/theme.ts`                                 |
| Icon set                                     | `mobile/src/icon.tsx`                                 |
| Shared primitives                            | `mobile/src/kit.tsx`                                  |
| Page, labels, fields, themed actions         | `mobile/src/ui.tsx`                                   |
| Artwork, song rows, track sheet, mini-player | `mobile/src/components.tsx`                           |
| Primary tabs                                 | `mobile/app/(tabs)/`                                  |
| Now Playing / Queue                          | `mobile/app/player.tsx`, `mobile/app/queue.tsx`       |
| Collection browsing                          | `mobile/app/collection.tsx`                           |
| Server vs phone stores                       | `mobile/app/activity.tsx`, `mobile/app/downloads.tsx` |
| Settings / backup                            | `mobile/app/settings.tsx`, `mobile/app/backup.tsx`    |
