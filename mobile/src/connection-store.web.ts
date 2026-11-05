import { invoke } from "@tauri-apps/api/core";

/**
 * Desktop credentials live in the OS keyring through Tauri. A browser preview
 * keeps them in memory for this session only; nothing is written to
 * localStorage.
 */
let sessionConnection: string | null = null;
const tauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const timeout = <T>(task: Promise<T>, fallback: T) =>
  Promise.race([
    task,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), 2500)),
  ]);

export async function loadConnection() {
  if (!tauri()) return sessionConnection;
  try {
    return (
      (await timeout(invoke<string | null>("load_connection"), null)) ?? null
    );
  } catch {
    return sessionConnection;
  }
}

export async function saveConnection(value: string) {
  sessionConnection = value;
  if (tauri()) {
    try {
      await timeout(invoke("save_connection", { value }), undefined);
    } catch {
      // No usable keyring: keep working for this session without persistence.
    }
  }
}

export async function clearConnection() {
  sessionConnection = null;
  if (tauri()) {
    try {
      await timeout(invoke("clear_connection"), undefined);
    } catch {
      /* No saved keyring entry is already signed out. */
    }
  }
}
