export const migrations = [
  `CREATE TABLE IF NOT EXISTS kv (scope TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(scope,key));
   CREATE TABLE IF NOT EXISTS downloads (scope TEXT NOT NULL, id TEXT NOT NULL, song TEXT NOT NULL, state TEXT NOT NULL, bytes INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL DEFAULT 0, error TEXT NOT NULL DEFAULT '', PRIMARY KEY(scope,id));`,
];
export function migrate(db: {
  execSync(sql: string): void;
  getFirstSync<T>(sql: string): T | null;
}) {
  const version =
    db.getFirstSync<{ user_version: number }>("PRAGMA user_version")
      ?.user_version ?? 0;
  if (version > migrations.length)
    throw new Error(
      "Local database is newer than this app. Install the newer version.",
    );
  db.execSync("BEGIN IMMEDIATE");
  try {
    for (let i = version; i < migrations.length; i++) {
      db.execSync(migrations[i]!);
      db.execSync(`PRAGMA user_version=${i + 1}`);
    }
    db.execSync("COMMIT");
  } catch (e) {
    db.execSync("ROLLBACK");
    throw e;
  }
}
