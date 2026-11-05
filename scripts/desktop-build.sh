#!/usr/bin/env bash
# Build the Linux desktop AppImage and stage it for the Arch package.
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -f "$HOME/.cargo/env" ]]; then source "$HOME/.cargo/env"; fi

if ! command -v cargo >/dev/null || ! command -v rustc >/dev/null; then
  echo "Rust is required. Install it with: curl https://sh.rustup.rs -sSf | sh" >&2
  exit 1
fi
if ! pkg-config --exists webkit2gtk-4.1 || ! pkg-config --exists gtk+-3.0; then
  echo "Install webkit2gtk-4.1 and gtk3 development packages first." >&2
  exit 1
fi

cd mobile
if [[ "${SKIP_INSTALL:-0}" != "1" ]]; then
  npm ci
fi
npx expo export --platform web --output-dir dist-web
python3 ../scripts/desktop-html.py
npx tauri build --bundles appimage

artifact=$(find src-tauri/target/release/bundle/appimage -maxdepth 1 -name '*.AppImage' -print -quit)
if [[ -z "$artifact" ]]; then
  echo "Tauri did not produce an AppImage." >&2
  exit 1
fi

mkdir -p ../packaging/arch
cp "$artifact" ../packaging/arch/Zikky-0.6.0-x86_64.AppImage
chmod +x ../packaging/arch/Zikky-0.6.0-x86_64.AppImage
echo "AppImage: packaging/arch/Zikky-0.6.0-x86_64.AppImage"
echo "Install on Arch: cd packaging/arch && makepkg -si"
