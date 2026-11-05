import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

/**
 * Tauri's HTTP transport bypasses browser CORS without changing server
 * security. A plain browser preview falls back to the normal fetch.
 */
export const appFetch: typeof fetch =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
    ? (tauriFetch as typeof fetch)
    : (...args) => fetch(...args);
