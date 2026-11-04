#!/usr/bin/env bash
set -euo pipefail
[[ "$(uname -s)" == Darwin ]] || { printf '%s\n' 'Requires macOS with Xcode and CocoaPods. SideStore does not compile apps.' >&2; exit 1; }
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$project_dir/mobile"
npm ci
npm run typecheck
npm test
npx expo prebuild --platform ios --no-install
(cd ios && pod install)
mkdir -p "$project_dir/artifacts"
xcodebuild -workspace ios/Zikky.xcworkspace -scheme Zikky -configuration Release -sdk iphoneos -destination 'generic/platform=iOS' -archivePath "$project_dir/artifacts/Zikky.xcarchive" CODE_SIGNING_ALLOWED=NO archive
app="$project_dir/artifacts/Zikky.xcarchive/Products/Applications/Zikky.app"
[[ -f "$app/main.jsbundle" ]] || { printf '%s\n' 'Embedded standalone bundle missing.' >&2; exit 1; }
/usr/libexec/PlistBuddy -c 'Print UIBackgroundModes' "$app/Info.plist"
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
mkdir "$stage/Payload"
cp -R "$app" "$stage/Payload/"
(cd "$stage" && zip -qry "$project_dir/artifacts/Zikky-unsigned.ipa" Payload)
printf '%s\n' 'Unsigned device IPA created. SideStore must re-sign it for your device and Apple team; installation is NOT yet verified.'
