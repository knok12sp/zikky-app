/** Browser/desktop key-value store. Non-secret cache and queue data only. */
const prefix = "zikky:";
const keyFor = (scope: string, key: string) => `${prefix}${scope}:${key}`;
function storage() {
  return typeof window === "undefined" ? null : window.localStorage;
}
export function read<T>(scope: string, key: string, fallback: T): T {
  try {
    const value = storage()?.getItem(keyFor(scope, key));
    return value == null ? fallback : (JSON.parse(value) as T);
  } catch {
    return fallback;
  }
}
export function write(scope: string, key: string, value: unknown) {
  try {
    storage()?.setItem(keyFor(scope, key), JSON.stringify(value));
  } catch {
    /* Storage full or unavailable: cached data is optional. */
  }
}
export function clearCachedMetadata(scope: string) {
  const store = storage();
  if (!store) return;
  for (let i = store.length - 1; i >= 0; i--) {
    const key = store.key(i);
    if (!key?.startsWith(`${prefix}${scope}:`)) continue;
    const name = key.slice(prefix.length + scope.length + 1);
    if (
      name.startsWith("songs:") ||
      name.startsWith("playlist:") ||
      ["playlists", "search-history", "local-played"].includes(name)
    )
      store.removeItem(key);
  }
}
