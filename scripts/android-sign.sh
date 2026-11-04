#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
: "${ANDROID_HOME:?Set ANDROID_HOME}"
: "${ZIKKY_KEYSTORE:?Set private reusable keystore path outside the repository}"
: "${ZIKKY_SIGNING_PASSWORD_FILE:?Set private password-file path}"
: "${JAVA_HOME:?Set JAVA_HOME}"
export PATH="$JAVA_HOME/bin:$PATH"
if [[ ! -f "$ZIKKY_KEYSTORE" || ! -f "$ZIKKY_SIGNING_PASSWORD_FILE" ]]; then
 printf '%s\n' 'Signing files missing. Create the key with android-key.sh first.' >&2; exit 1
fi
build_tools="$ANDROID_HOME/build-tools/37.0.0"
"$build_tools/zipalign" -f -p 4 "$project_dir/artifacts/Zikky-unsigned.apk" "$project_dir/artifacts/Zikky-aligned.apk"
"$build_tools/apksigner" sign --ks "$ZIKKY_KEYSTORE" --ks-key-alias zikky --ks-pass "file:$ZIKKY_SIGNING_PASSWORD_FILE" --out "$project_dir/artifacts/Zikky.apk" "$project_dir/artifacts/Zikky-aligned.apk"
"$build_tools/apksigner" verify --verbose "$project_dir/artifacts/Zikky.apk"
