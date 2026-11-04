import * as SecureStore from "expo-secure-store";
export type TransferCheckpoint = {
  version: 1;
  url: string;
  authorization: string;
  resumeData: string;
  bytes: number;
  total: number;
  etag: string;
  automatic: boolean;
};
const locks = new Map<string, Promise<void>>();
const secureOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};
function locked<T>(scope: string, work: () => Promise<T>): Promise<T> {
  const next = (locks.get(scope) ?? Promise.resolve()).then(work);
  const tail = next.then(
    () => {},
    () => {},
  );
  locks.set(scope, tail);
  void tail.then(() => {
    if (locks.get(scope) === tail) locks.delete(scope);
  });
  return next;
}
function key(scope: string, id: string) {
  const encoded = Array.from(new TextEncoder().encode(id), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `transfer.${scope}.${encoded}`;
}
function indexKey(scope: string) {
  return `transfer-index.${scope}`;
}
async function readIndex(scope: string): Promise<string[]> {
  const saved = await SecureStore.getItemAsync(indexKey(scope));
  if (!saved) return [];
  let ids: unknown;
  try {
    ids = JSON.parse(saved);
  } catch {
    throw new Error("Secure transfer index could not be opened.");
  }
  if (
    !Array.isArray(ids) ||
    ids.length > 5000 ||
    ids.some((id) => typeof id !== "string" || id.length > 256)
  )
    throw new Error("Secure transfer index could not be opened.");
  return ids;
}
export async function checkpointIds(scope: string) {
  return locked(scope, () => readIndex(scope));
}
export async function readCheckpoint(
  scope: string,
  id: string,
): Promise<TransferCheckpoint | null> {
  const saved = await SecureStore.getItemAsync(key(scope, id));
  if (!saved) return null;
  try {
    const value = JSON.parse(saved);
    if (
      value.version !== 1 ||
      typeof value.url !== "string" ||
      typeof value.authorization !== "string" ||
      typeof value.resumeData !== "string" ||
      !value.resumeData ||
      value.resumeData.length > 2 * 1024 * 1024 ||
      !Number.isSafeInteger(value.bytes) ||
      value.bytes < 0 ||
      !Number.isSafeInteger(value.total) ||
      value.total <= 128 ||
      value.bytes > value.total ||
      typeof value.etag !== "string" ||
      !value.etag ||
      typeof value.automatic !== "boolean"
    )
      return null;
    return value;
  } catch {
    return null;
  }
}
export async function saveCheckpoint(
  scope: string,
  id: string,
  checkpoint: TransferCheckpoint,
) {
  if (
    !checkpoint.resumeData ||
    checkpoint.resumeData.length > 2 * 1024 * 1024 ||
    checkpoint.bytes < 0 ||
    checkpoint.bytes > checkpoint.total
  )
    throw new Error("Native transfer checkpoint could not be stored safely.");
  // Native resume data can contain Authorization headers; never put it in SQLite or exports.
  await locked(scope, async () => {
    const ids = await readIndex(scope);
    if (!ids.includes(id) && ids.length >= 5000)
      throw new Error("Too many paused transfer checkpoints.");
    // Index first: a crash may leave an empty entry, never an untracked credential record.
    if (!ids.includes(id))
      await SecureStore.setItemAsync(
        indexKey(scope),
        JSON.stringify([...ids, id]),
        secureOptions,
      );
    await SecureStore.setItemAsync(
      key(scope, id),
      JSON.stringify(checkpoint),
      secureOptions,
    );
  });
}
export async function clearCheckpoint(scope: string, id: string) {
  await locked(scope, async () => {
    await SecureStore.deleteItemAsync(key(scope, id));
    const ids = await readIndex(scope);
    if (ids.includes(id))
      await SecureStore.setItemAsync(
        indexKey(scope),
        JSON.stringify(ids.filter((item) => item !== id)),
        secureOptions,
      );
  });
}
export async function clearCheckpoints(scope: string) {
  await locked(scope, async () => {
    for (const id of await readIndex(scope))
      await SecureStore.deleteItemAsync(key(scope, id));
    await SecureStore.deleteItemAsync(indexKey(scope));
  });
}
