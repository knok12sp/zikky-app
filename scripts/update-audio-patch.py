#!/usr/bin/env python3
"""Regenerate the pinned expo-audio native patch from npm package source."""
from __future__ import annotations

import difflib
import io
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "mobile/node_modules/expo-audio"
ARCHIVE = Path("/tmp/zikky-audio/expo-audio-58.0.11.tgz")
OUTPUT = ROOT / "mobile/patches/expo-audio+58.0.11.patch"

if not PACKAGE.is_dir() or not ARCHIVE.is_file():
    raise SystemExit("Install expo-audio@58.0.11 and keep its pinned npm tarball available.")

with tarfile.open(ARCHIVE, "r:gz") as archive:
    baseline = {
        Path(member.name.removeprefix("package/")): archive.extractfile(member).read()
        for member in archive.getmembers()
        if member.isfile()
        and member.name.startswith("package/")
        and Path(member.name).suffix in {".kt", ".swift"}
        and ("/android/src/" in member.name or "/ios/" in member.name)
    }

current = {
    path.relative_to(PACKAGE): path.read_bytes()
    for root in (PACKAGE / "android/src", PACKAGE / "ios")
    if root.exists()
    for path in root.rglob("*")
    if path.is_file() and path.suffix in {".kt", ".swift"}
}
chunks: list[str] = []
for rel in sorted(set(baseline) | set(current), key=str):
    before = baseline.get(rel, b"").decode("utf-8").splitlines(keepends=True)
    after = current.get(rel, b"").decode("utf-8").splitlines(keepends=True)
    if before == after:
        continue
    target = f"node_modules/expo-audio/{rel.as_posix()}"
    chunks.append(f"diff --git a/{target} b/{target}\n")
    if rel not in baseline:
        chunks.append("new file mode 100644\n")
    old = "/dev/null" if rel not in baseline else f"a/{target}"
    new = "/dev/null" if rel not in current else f"b/{target}"
    chunks.extend(difflib.unified_diff(before, after, fromfile=old, tofile=new))
OUTPUT.write_text("".join(chunks))
print(f"Wrote {OUTPUT.relative_to(ROOT)} ({len(chunks)} lines)")
