#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
: "${JAVA_HOME:?Set JAVA_HOME to JDK 21}"
: "${ANDROID_HOME:?Set ANDROID_HOME to Android SDK}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
cd "$project_dir/mobile"
npm ci
npm run typecheck
npm test
npx expo prebuild --platform android --no-install
cd android
./gradlew --no-daemon --max-workers=4 '-Dorg.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g' assembleRelease -PreactNativeArchitectures=arm64-v8a
mkdir -p "$project_dir/artifacts"
cp app/build/outputs/apk/release/app-release-unsigned.apk "$project_dir/artifacts/Zikky-unsigned.apk"
printf '%s\n' 'Unsigned ARM64 APK ready. Run scripts/android-sign.sh with your private reusable key.'
