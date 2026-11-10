import { test } from "node:test";
import assert from "node:assert/strict";
import { forbiddenPath } from "./check-client-only.mjs";

test("blocks server code, deployment files and local secrets", () => {
  for (const path of ["backend/app.py", "copy/musicbridge/app.py", "docker-compose.yml", "compose.yaml", "backend/Dockerfile", "mobile/src/server-delete.ts", ".env", ".env.production", "signing/release.keystore", "data/library.sqlite3", "deploy/private.pem"]) {
    assert.equal(forbiddenPath(path), true, path);
  }
});
test("allows buildable client source and configuration examples", () => {
  for (const path of ["mobile/src/api.ts", "mobile/src/playback.web.tsx", "mobile/src-tauri/src/lib.rs", "mobile/app.config.ts", ".env.example", "mobile/package-lock.json", "docs/ARCHITECTURE.md"]) {
    assert.equal(forbiddenPath(path), false, path);
  }
});
