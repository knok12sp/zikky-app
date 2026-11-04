# Contributing

Thanks for helping improve Zikky. This is a small, focused client: the server
owns the library, and the phone owns playback state and optional offline copies.

## Setup

```bash
git clone https://github.com/knok12sp/zikky-app.git
cd zikky-app/mobile
npm ci
npm run typecheck
npm test
```

Use a development build for manual testing:

```bash
npx expo run:android
# or on macOS
npx expo run:ios
```

You need a Subsonic-compatible server to exercise the app end to end. Do not
commit its address, credentials or library data.

## Ground rules

- Keep streaming and phone downloads separate. Browsing and search must never
  download audio; a phone copy is created only by an explicit action.
- Removing a phone copy must never delete anything from the server.
- Preserve queue, shuffle, repeat and playlist semantics.
- Preserve existing API contracts and the native audio bridge.
- Do not add paid services, analytics or tracking.
- Keep changes focused. Avoid unrelated refactors.
- Every icon-only control needs an accessible name and state.
- Do not claim device verification you did not perform.

## Design and code

- Put colours, spacing and type in `mobile/src/theme.ts`.
- Reuse primitives from `mobile/src/kit.tsx` and `mobile/src/ui.tsx`.
- Screens live in `mobile/app`; shared playback, API and storage logic in
  `mobile/src`.
- Run Prettier before committing: `npx prettier --write .`.

## Tests

```bash
cd mobile
npm run typecheck
npm test
```

Add tests for parsers, queue rules and screen interactions. The suite mocks
native modules, so note any behaviour that still needs a real phone.

## Pull requests

- Describe the problem, the change and the user-visible effect.
- Link the issue when one exists.
- Include the commands you ran and their results.
- Say what you tested on a device, simulator or not at all.
- Update documentation when behaviour or configuration changes.
- Never include credentials, private hosts, personal paths, music files or
  private screenshots.

## Reporting bugs and requesting features

Use the GitHub issue templates. For security issues, follow
[SECURITY.md](SECURITY.md) instead of opening a public issue.
