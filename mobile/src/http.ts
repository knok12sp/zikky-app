/** Native fetch. Desktop/web uses the Tauri HTTP transport to avoid CORS. */
export const appFetch: typeof fetch = (...args) => fetch(...args);
