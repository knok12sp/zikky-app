# Zikky design language

Zikky is a personal music player with a permanent library on your server and a
phone that streams from it. The interface behaves like studio hardware: graphite
panels, one amber accent that behaves like an illuminated meter, mono numerals,
hairline rules and controls that sit exactly where your hand expects them.
Artwork is the only bright, saturated object on the screen.

Dark is the primary theme. Light is a paper-and-ink counterpart, not an
inversion.

## Principles

1. **Music first, chrome second.** Artwork, title and artist lead every surface.
   Controls are compact, familiar and reachable with one thumb.
2. **One primary action.** A screen has one obvious thing to do. Everything else
   is a quiet icon or a contextual sheet, not another rectangle of text.
3. **Physical confidence.** Pressed states move like a button, rows respond on
   the press rather than the release, and the deck keeps the transport in the
   same place on every screen.
4. **Honest status.** Buffering, downloading and offline availability are
   separate states with separate words. Nothing pretends.
5. **No decoration that lies.** No fake equaliser, no animated bars, no
   visualiser without real audio data. Personality comes from the mono readout,
   the hairline grid and the mechanical control layout.

## Colour

Tokens live in `mobile/src/theme.ts`; screens never hardcode a hex outside that
file. Palette keys are unchanged from previous systems, so components switch
theme without knowing anything.

| Role                | Dark                          | Light                       |
| ------------------- | ----------------------------- | --------------------------- |
| App background      | `#0C0B09` warm graphite       | `#F2EDE3` paper             |
| Surface             | `#131210`                     | `#FBF8F2`                   |
| Panel (bar, sheet)  | `#171512`                     | `#FBF8F2`                   |
| Raised surface      | `#1E1B17`                     | `#FFFDF8`                   |
| Inset / well        | `#070605`                     | `#E7E0D3`                   |
| Metal (header strip)| `#242019`                     | `#E5DED1`                   |
| Primary text        | `#F3EEE4` ivory               | `#16140F` ink               |
| Secondary text      | `#A69E91`                     | `#514C44`                   |
| Faint text          | `#918A7E`                     | `#655F55`                   |
| Border              | `#2A2621`                     | `#DAD3C6`                   |
| Border strong       | `#403A32`                     | `#BEB5A4`                   |
| Accent              | `#E9A13B` amber               | `#9C570B` burnt amber       |
| Accent strong       | `#F6BE6B`                     | `#7A4307`                   |
| Accent text on fill | `#191207`                     | `#FFF9EF`                   |
| Accent soft         | `#2B2113`                     | `#F1E3CB`                   |
| Focus ring          | `#F6BE6B`                     | `#9C570B`                   |
| Danger              | `#E8837A`                     | `#94241D`                   |

Rules:

- Accent marks **state and the one primary action**. It is not used for large
  backgrounds, body copy or every icon.
- Dark surfaces step up in value: background → surface → panel → raised. Inset
  wells are darker than the background and are used for displays, search fields
  and progress tracks.
- Light theme reads as paper and ink with the same hierarchy; it is not a
  value-inverted copy of dark.
- Text on accent always uses `onAccent`, never white by habit.
- `faint` still clears 4.5:1 against every surface it labels; the contrast test
  in `mobile/tests/theme.test.ts` fails the build if that breaks. Hierarchy
  comes from size and spacing, not from washing text out.

## Typography

Two self-hosted families, loaded through `expo-font` in `mobile/src/fonts.ts`
before the first screen renders (`assets/fonts/`):

- **Archivo** — interface and display: `Archivo`, `ArchivoMedium`, `ArchivoBold`.
- **IBM Plex Mono** — time, counters, storage, small-caps labels:
  `IBMPlexMono`, `IBMPlexMonoMedium`.

Exactly three weights: 400, 500, 700. Weight is chosen with the family token
(`font.ui`, `font.uiMedium`, `font.uiBold`); never with `fontWeight`, which
synthesises a fourth weight on web.

| Token     | Size / line height / tracking | Family        | Use                            |
| --------- | ----------------------------- | ------------- | ------------------------------ |
| `hero`    | 44 / 46 / −1.8                | `uiBold`      | page title, Now Playing title  |
| `display` | 32 / 36 / −1.1                | `uiBold`      | hero statement                 |
| `title`   | 24 / 29 / −0.6                | `uiBold`      | sheet and block headings       |
| `heading` | 18 / 23 / −0.2                | `uiMedium`    | section heading                |
| `body`    | 15 / 22 / −0.05               | `ui`          | body copy, buttons, fields     |
| `meta`    | 13 / 18                       | `ui`          | row titles, secondary values   |
| `micro`   | 10 / 14 / 1.5 uppercase       | `monoMedium`  | section labels, captions       |
| `numeric` | 12 / 16 / 0.3                 | `mono` tabular| durations, counts in rows      |
| `readout` | 13 / 17 / 1.0                 | `monoMedium`  | elapsed / remaining time       |
| `count`   | 24 / 28 / −0.3                | `uiBold` tabular | headline figures           |

- Track titles are medium or bold and truncate to one line. Artist and album are
  `meta`/`micro` and never compete with the title.
- Section labels are `micro`: uppercase mono with wide tracking. They separate
  regions without drawing a box around them.
- Numerals in columns and time readouts are tabular so they do not jitter while
  playing.

## Spacing, shape and elevation

- Spacing: `xs 4`, `sm 8`, `md 12`, `lg 16`, `xl 24`, `xxl 32`, `xxxl 48`,
  `gutter 40`. Inside a control cluster stays at 4–16; regions are separated by
  24–48 and by a hairline.
- Radii: `sm 2`, `md 4`, `lg 6`, `pill 999`. Artwork is 2, controls 4, sheets 2.
  Nothing is rounded for decoration.
- **No cards.** Regions are separated by 1 px `border` rules and by space.
  Bordered plates are reserved for things that really are objects: artwork,
  fields, the readout well, the sign-in panel, modal surfaces.
- Elevation is a hairline plus a fill step, never a drop shadow. No gradients,
  no glass, no blur.
- Touch targets are at least 44 px; primary actions are 46–56 px.
- Artwork radius is 2 everywhere it appears, at every size, from 18 px thumbnails
  to the Now Playing plate. Missing artwork shows a note glyph on an inset
  surface, never a broken image.

## Icons

`mobile/src/icon.tsx` is a real vector set drawn on a 24 px grid with
`react-native-svg`; no character glyphs. Stroke weight is solved from the render
size so a 14 px icon and a 40 px icon read as the same object. Icons are
decorative to screen readers; the surrounding button carries the accessible
name (`Options for Title, Artist`, `Close now playing`).

## Components (`mobile/src/kit.tsx`)

- `PageHeader` — hero title, subtitle, optional actions and in-view search well.
- `Card` — a bordered plate for things that are real objects (sign-in panel,
  readout, modal body); not a layout container. Regions use `Rule` instead.
- `SectionHead` / `SectionTitle` — uppercase mono label with a trailing hairline
  rule and an optional inline text action.
- `Rule` — a single hairline; the primary way to divide a page.
- `Readout` — mono display text for time, counts and storage figures.
- `IconButton` — 32–40 px square target, plain/filled/outline, active and busy
  states, no shadow.
- `PlayButton` — amber rectangle plate, 4 px radius, pressed scale. The loudest
  control on a screen.
- `Chip` / `Segmented` — rectangular hairline controls; selected state is
  `accentSoft` fill plus accent border plus medium text, never colour alone.
- `ProgressBar` — real 0..1 progress only, 3 px, square ends.
- `Banner` — flat tinted inline error or status with an optional retry.
- `EmptyState` — icon, title, one sentence, optional action; centred, no box.
- `Stat` — a `count` figure with an uppercase caption.
- `BackButton` — 44 px back affordance on secondary screens.
- `SongTable` — column labels (NO / TITLE / ALBUM / RATED / TIME) that match the
  row grid exactly, with a trailing width for the action cluster.
- `NavGroup` — labelled sidebar section on desktop.

Shared music pieces live in `mobile/src/components.tsx`:

- `Art` — authenticated server artwork, local offline file first, note-glyph
  fallback.
- `SongList` — 56 px rows separated by full-width hairlines: 44 px artwork,
  title, `artist · duration`, a status line, favourite marker, overflow button.
  It owns the track sheet: Listen later, favourite, Download to this phone,
  Play next, Append to queue, Add to playlist, Create playlist. The sheet guards
  double taps and never starts a download for a playlist add or bookmark.
- `MiniPlayer` — 56 px strip above the tab bar: 1 px real progress hairline,
  artwork, title, artist, play/pause and next. It opens Now Playing.

## Navigation and layout

### Desktop (React Native Web)

- A 208 px navigation rail on `surface` with a hairline right edge: ZIKKY plate,
  grouped destinations with an amber 2 px marker on the active item, and a
  connection readout at the foot.
- The transport deck is a permanent 80 px bar across the bottom of the window:
  current track, transport, seek rail with elapsed and minus-remaining, volume,
  queue toggle and a control that expands Now Playing.
- Queue is a 336 px slide-over panel from the right; it never steals content
  width from the library.
- Now Playing is a full-window deck: artwork plate on the left, title, readout
  well, transport, rating, sleep timer and Up next on the right. Wide layouts
  split into columns at `breakpoints.compact` (1120).
- Content gutters are 40 px (24 below the breakpoint), 32 px above, 48 px below.

### Phone (Expo / React Native)

- Four destinations: **Home**, **Library**, **Search**, **Books**. The tab bar is
  58 px, icons above 9 px uppercase labels, with a 2 px amber bar over the active
  icon instead of a pill.
- Secondary destinations are pushed screens with a consistent back button: Now
  Playing, Queue, Collection, Listen later, On this phone, Settings, Backup,
  Book detail.
- Now Playing is a full-screen deck that rises over the app; the same components
  as desktop at two sizes.
- Every screen respects safe areas. Tab screens rely on the tab bar; pushed
  screens add bottom padding for the home indicator.
- Content is a single vertical scroll or a `FlatList` — never nested scrolling
  lists. Long lists use stable keys and windowing.

## Now Playing

- Artwork is a framed plate (2 px radius, hairline border, inset well) and the
  only saturated object on screen. Below it, a 5 px status square and a mono
  `PLAYING` / `PAUSED` / `STANDBY` label.
- Title in `hero`, artist in `title`, album in `meta`. Nothing else competes.
- The time display is an inset well: mono elapsed, a 3 px seek rail with amber
  fill, and remaining time prefixed with a minus sign. It reads like a device
  display without imitating a specific product.
- Transport is one row: shuffle, previous, large play/pause, next, repeat.
  Shuffle and repeat show state through accent and a `1` for repeat-one; the
  accessible label spells the state out. Playback position is also adjustable
  with an `adjustable` slider that carries the label `Playback position`.
- Utility controls (favourite, rating, sleep timer, volume, download, queue)
  sit on a hairline-divided row beneath the transport.
- Up next previews the following tracks without duplicating the queue screen.

## Motion and feedback

- Motion tokens: `fast 120`, `base 180`, `slow 260` ms. Motion is `Animated`
  only — there is no animation library.
- The vocabulary is small and literal: controls scale to 0.96 on press, sheets
  slide in from their edge, the queue panel slides from the right, Now Playing
  fades and rises into place, the mini-player hands off to the full-screen deck.
- Motion is feedback, never decoration: it starts from the current value, stays
  interruptible, and never blocks input. `prefers-reduced-motion` removes the
  movement and keeps the state change.
- Every asynchronous action shows a busy state and a specific failure message
  with a retry, rather than silently doing nothing.
- Destructive actions use the danger colour and a confirmation.

## Accessibility

- All icon-only controls have explicit names and state (`selected`, `disabled`,
  `busy`).
- Rows expose a single `Play Title, Artist` action; the overflow is separate.
- Titles, subtitles and status lines are real text, so Dynamic Type can scale
  them. Rows use minimum heights rather than fixed heights.
- Colour is never the only signal: selected chips also use medium text and a
  border, the current queue row also says `Now playing`, download state also has
  text.
- Contrast targets WCAG AA for body text in both themes, enforced by tests.
- Focus is visible on every interactive element (`:focus-visible` outline in
  `focus`), and the whole desktop shell works with a keyboard.

## Server versus phone

This distinction is a product rule, not a visual nicety.

| Meaning                                  | Wording                                    | Icon     |
| ---------------------------------------- | ------------------------------------------ | -------- |
| Exists in the permanent server library   | `On server` / `Library`                    | server   |
| Streamed from the server                  | `Online`                                   | wifi     |
| Explicit offline copy on this phone      | `On this phone`, `Downloads on this phone` | phone    |
| Explicit action to make an offline copy  | `Download to this phone`                   | download |

- Browsing, searching, favourites, playlists and recommendations never download.
- Removing a phone copy never deletes the server copy, and removal never clears
  the queue. Downloads are only created by an explicit user action.
- The two stores use different screens, different icons and different empty
  states so they can never be confused.

## File map

| Concern                                        | File                                                   |
| ---------------------------------------------- | ------------------------------------------------------ |
| Colour, type, spacing, radius, motion tokens   | `mobile/src/theme.ts`                                  |
| Font loading                                   | `mobile/src/fonts.ts`, `mobile/assets/fonts/`          |
| Icon set                                       | `mobile/src/icon.tsx`                                  |
| Shared primitives                              | `mobile/src/kit.tsx`                                   |
| Page, labels, fields, themed actions           | `mobile/src/ui.tsx`                                    |
| Artwork, song rows, track sheet, mini-player   | `mobile/src/components.tsx`                            |
| Desktop shell, rail, transport, queue          | `mobile/src/desktop/DesktopApp.tsx`, `.../Transport.tsx` |
| Desktop Now Playing deck                       | `mobile/src/desktop/DesktopPlayer.tsx`                 |
| Primary tabs                                   | `mobile/app/(tabs)/`                                   |
| Now Playing / Queue                            | `mobile/app/player.tsx`, `mobile/app/queue.tsx`        |
| Collection browsing                            | `mobile/app/collection.tsx`                            |
| Server vs phone stores                         | `mobile/app/downloads.tsx`                             |
| Settings / backup                              | `mobile/app/settings.tsx`, `mobile/app/backup.tsx`     |
