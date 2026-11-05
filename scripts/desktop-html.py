#!/usr/bin/env python3
"""Ensure the exported desktop page fills the Tauri webview."""
from pathlib import Path

index = Path(__file__).resolve().parent.parent / "mobile" / "dist-web" / "index.html"
css = (
    "\n      html, body { width: 100%; margin: 0; }\n"
    "      #root { width: 100%; }\n"
    "      #root > div { width: 100%; }\n    "
)
text = index.read_text()
if "#root > div { width: 100%; }" not in text:
    index.write_text(text.replace("</style>", css + "</style>", 1))
