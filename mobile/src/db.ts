import * as SQLite from "expo-sqlite";
import { migrate } from "./migrations";
export const db = SQLite.openDatabaseSync("zikky.sqlite");
db.execSync("PRAGMA journal_mode=WAL");
migrate(db);
export function read<T>(scope: string, key: string, fallback: T): T {
  const row = db.getFirstSync<{ value: string }>(
    "SELECT value FROM kv WHERE scope=? AND key=?",
    scope,
    key,
  );
  if (!row) return fallback;
  try {
    return JSON.parse(row.value);
  } catch {
    return fallback;
  }
}
export function write(scope: string, key: string, value: unknown) {
  db.runSync(
    "INSERT OR REPLACE INTO kv VALUES(?,?,?)",
    scope,
    key,
    JSON.stringify(value),
  );
}
export function clearCachedMetadata(scope: string) {
  db.runSync(
    "DELETE FROM kv WHERE scope=? AND (key LIKE 'songs:%' OR key LIKE 'playlist:%' OR key IN ('playlists','search-history','local-played'))",
    scope,
  );
}
