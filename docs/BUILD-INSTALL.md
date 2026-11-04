# Build and install

Zikky is a native Expo app. You need Node.js 24 and an existing
Subsonic-compatible music server. The server is not part of this repository.

## Requirements

| Component | Requirement                                         |
| --------- | --------------------------------------------------- |
| Node.js   | 24.x                                                |
| npm       | 10 or newer                                         |
| Android   | JDK 21, Android SDK 36, Android 7.0+ device         |
| iOS       | macOS, Xcode, CocoaPods, iOS 16.4+ device           |
| Server    | Subsonic API 1.16.x (Navidrome, Airsonic, Gonic, …) |

Zikky uses a patched native audio module. Expo Go cannot load it; use a
development build or a release build.

## Install dependencies

```bash
git clone https://github.com/knok12sp/zikky-app.git
cd zikky-app/mobile
npm ci
```

`npm ci` also applies the pinned `expo-audio` patch through `patch-package`.

## Development build

```bash
npx expo run:android
# or on macOS
npx expo run:ios
```

Once the app is installed, start Metro with:

```bash
npm start
```

### Plain HTTP servers

HTTPS needs no extra configuration. For plain HTTP, set the allowed hosts before
prebuild or run:

```bash
ZIKKY_HTTP_HOSTS=192.0.2.10,music.lan npx expo prebuild --clean
ZIKKY_HTTP_HOSTS=192.0.2.10,music.lan npx expo run:android
```

The variable is a comma-separated list of bare hostnames or IP addresses. It
creates the iOS App Transport Security exception and the Android cleartext
configuration for exactly those hosts. Rebuild the native app after changing it.

## Release builds

### Android

The repository provides local scripts:

```bash
./scripts/android-build.sh
./scripts/android-key.sh
./scripts/android-sign.sh
```

`android-build.sh` runs type checking, tests, prebuild and a Gradle release
build. `android-key.sh` creates a signing key once; keep it outside the
repository. `android-sign.sh` signs the generated APK. The resulting file is in
`artifacts/` (ignored by Git).

You can also build directly:

```bash
cd mobile
npx expo run:android --variant release
```

### iOS

```bash
./scripts/ios-build.sh
```

This produces an unsigned device archive and IPA in `artifacts/`. Installing on
a phone requires your own Apple signing identity:

- open `mobile/ios/Zikky.xcworkspace` in Xcode and configure your team, or
- re-sign the IPA with a sideloading tool.

A free personal Apple team signature expires after seven days. This repository
does not provide a signed IPA or a way around Apple's signing requirement.

## Connecting

1. Start the server and confirm its web interface works.
2. Open Zikky on the phone.
3. Enter the server base URL, for example `https://music.example.com`. Do not add
   `/rest` or a trailing slash.
4. Enter the Subsonic username and password.
5. Choose **Test connection and sign in**.

You can enter up to four addresses. Keep the first one stable: it defines the
account scope used by phone downloads and cached metadata. Alternate addresses
should reach the same server and account.

## Verification

```bash
cd mobile
npm run typecheck
npm test
```

The tests mock native modules. Device playback, lock-screen controls, background
downloads, rendering and accessibility still require the manual checklist in
[DEVICE-ACCEPTANCE.md](DEVICE-ACCEPTANCE.md).

## Troubleshooting

- **`npm ci` fails the audio patch** — use the committed `package-lock.json` and
  Node.js 24; do not install with a different package manager.
- **Metro cannot find a development build** — run `npx expo run:android` or
  `npx expo run:ios` once; `npm start` alone does not build the native app.
- **Login fails over HTTP** — set `ZIKKY_HTTP_HOSTS` and rebuild.
- **iOS pods fail** — run `cd mobile/ios && pod install` and confirm Xcode
  command-line tools are selected.
- **Android SDK mismatch** — install SDK 36 and JDK 21, then remove
  `mobile/android` and re-run `npx expo prebuild --platform android`.
