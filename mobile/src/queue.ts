import { Song, parseSong } from "./api";
export type Entry = { key: string; song: Song };
export type Queue = {
  entries: Entry[];
  original: string[];
  index: number;
  shuffle: boolean;
  repeat: "none" | "all" | "single";
  position: number;
};
export const emptyQueue = (): Queue => ({
  entries: [],
  original: [],
  index: 0,
  shuffle: false,
  repeat: "none",
  position: 0,
});
let serial = 0;
export function entry(song: Song): Entry {
  return { key: `${Date.now()}-${++serial}`, song };
}
export function collection(songs: Song[], index = 0): Queue {
  const entries = songs.map(entry);
  return {
    ...emptyQueue(),
    entries,
    original: entries.map((e) => e.key),
    index: Math.max(0, Math.min(index, entries.length - 1)),
  };
}
export function shuffleQueue(q: Queue, random = Math.random): Queue {
  if (q.shuffle) {
    const current = q.entries[q.index]?.key;
    const byKey = new Map(q.entries.map((e) => [e.key, e]));
    const entries = q.original
      .map((k) => byKey.get(k))
      .filter((e): e is Entry => !!e);
    return {
      ...q,
      entries,
      index: Math.max(
        0,
        entries.findIndex((e) => e.key === current),
      ),
      shuffle: false,
    };
  }
  const current = q.entries[q.index];
  const rest = q.entries.filter((_, i) => i !== q.index);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [rest[i], rest[j]] = [rest[j]!, rest[i]!];
  }
  return {
    ...q,
    entries: current ? [current, ...rest] : rest,
    index: 0,
    shuffle: true,
  };
}
export function insert(q: Queue, song: Song, next: boolean): Queue {
  const e = entry(song),
    entries = [...q.entries];
  entries.splice(next ? q.index + 1 : entries.length, 0, e);
  const original = [...q.original];
  const current = original.indexOf(q.entries[q.index]?.key ?? "");
  original.splice(next ? current + 1 : original.length, 0, e.key);
  return { ...q, entries, original };
}
export function remove(q: Queue, index: number): Queue {
  const removed = q.entries[index];
  if (!removed) return q;
  const entries = q.entries.filter((_, i) => i !== index);
  return {
    ...q,
    entries,
    original: q.original.filter((k) => k !== removed.key),
    index: Math.max(
      0,
      Math.min(q.index - (index < q.index ? 1 : 0), entries.length - 1),
    ),
    position: index === q.index ? 0 : q.position,
  };
}
export function move(q: Queue, index: number, to: number): Queue {
  if (
    !Number.isInteger(index) ||
    !Number.isInteger(to) ||
    index < 0 ||
    index >= q.entries.length ||
    to < 0 ||
    to >= q.entries.length
  )
    return q;
  const current = q.entries[q.index]?.key;
  const entries = [...q.entries];
  const [e] = entries.splice(index, 1);
  if (!e) return q;
  entries.splice(to, 0, e);
  return {
    ...q,
    entries,
    index: Math.max(
      0,
      entries.findIndex((e) => e.key === current),
    ),
    original: q.shuffle ? q.original : entries.map((e) => e.key),
  };
}
export function nextIndex(q: Queue, automatic: boolean): number | null {
  if (!q.entries.length) return null;
  if (automatic && q.repeat === "single") return q.index;
  if (q.index + 1 < q.entries.length) return q.index + 1;
  return q.repeat === "all" ? 0 : null;
}

export function restoreQueue(value: unknown): Queue {
  if (!value || typeof value !== "object") return emptyQueue();
  const q = value as Queue;
  if (
    typeof q.shuffle !== "boolean" ||
    !["none", "all", "single"].includes(q.repeat) ||
    !Number.isFinite(q.position) ||
    q.position < 0
  )
    return emptyQueue();
  const parse = (candidate: unknown) => {
    const e = candidate as Entry;
    if (!e || typeof e.key !== "string" || !e.key) throw Error();
    return { ...e, song: parseSong(e.song) };
  };
  let entries: Entry[];
  let recovered = false;
  try {
    if (!Array.isArray(q.entries)) throw Error();
    entries = q.entries.map(parse);
  } catch {
    // One incompatible entry after an upgrade must not throw away the whole queue.
    recovered = true;
    entries = [];
    if (Array.isArray(q.entries)) {
      for (const candidate of q.entries) {
        try {
          entries.push(parse(candidate));
        } catch {
          /* skip the unreadable entry */
        }
      }
    }
  }
  if (!entries.length) return emptyQueue();
  const keys = entries.map((e) => e.key);
  const keySet = new Set(keys);
  if (keySet.size !== keys.length) return emptyQueue();
  let original = q.original;
  if (recovered) {
    const kept = Array.isArray(original) ? original.filter((k) => keySet.has(k)) : [];
    original = kept.length === keys.length ? kept : keys;
  }
  const index = recovered
    ? Number.isInteger(q.index) && q.index >= 0
      ? Math.min(q.index, entries.length - 1)
      : 0
    : q.index;
  if (
    !Array.isArray(original) ||
    original.length !== keys.length ||
    new Set(original).size !== keys.length ||
    original.some((k) => !keySet.has(k)) ||
    !Number.isInteger(index) ||
    index < 0 ||
    index > Math.max(0, entries.length - 1)
  )
    return emptyQueue();
  return {
    entries,
    original,
    index,
    shuffle: q.shuffle,
    repeat: q.repeat,
    position: q.position,
  };
}
