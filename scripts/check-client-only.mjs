/** Fail CI when server implementation, deployment files, or local secrets are tracked. */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve, basename } from "node:path";

export function forbiddenPath(path) {
  const name = basename(path);
  return /(^|\/)(backend|musicbridge|music-data)(\/|$)/i.test(path)
    || /(^|\/)(docker-compose[^/]*\.ya?ml|compose\.ya?ml|Dockerfile[^/]*|server-delete\.ts|manage\.html)$/i.test(path)
    || (name.startsWith(".env") && name !== ".env.example")
    || /\.(db|sqlite3?|pem|key|keystore|jks|p12|p8|mobileprovision)$/i.test(path);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
  const forbidden = tracked.filter(forbiddenPath);
  if (forbidden.length) {
    console.error("Client-only repository contains forbidden paths:\n" + forbidden.join("\n"));
    process.exitCode = 1;
  } else console.log("Client-only repository boundary passed.");
}
