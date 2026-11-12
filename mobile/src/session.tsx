import React, { createContext, useContext, useState, useEffect } from "react";
import { loadConnection, saveConnection, clearConnection } from "./connection-store";
import * as Crypto from "expo-crypto";
import { Api, Credentials, normalizeServers } from "./api";
import { Offline } from "./offline";
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
  onlineManager,
} from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";
import { AppState } from "react-native";
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
});
export type Session = { api: Api; scope: string; offline: Offline };
const Context = createContext<{
  session: Session | null;
  loading: boolean;
  restoreError: string;
  login: (c: Credentials) => Promise<void>;
  logout: () => Promise<void>;
  updateAddresses: (alternates: string) => Promise<void>;
}>({
  session: null,
  loading: true,
  restoreError: "",
  login: async () => {},
  logout: async () => {},
  updateAddresses: async () => {},
});
export const useSession = () => useContext(Context);
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(true);
  const [restoreError, setRestoreError] = useState("");
  async function prepare(c: Credentials) {
    if (
      !c ||
      typeof c.server !== "string" ||
      typeof c.username !== "string" ||
      !c.username ||
      typeof c.password !== "string" ||
      !c.password ||
      (c.alternateServers !== undefined && !Array.isArray(c.alternateServers))
    )
      throw new Error("Invalid saved connection.");
    normalizeServers([c.server, ...(c.alternateServers ?? [])]);
    const scope = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      JSON.stringify([c.server, c.username]),
    );
    const api = new Api(c);
    const offline = new Offline(
      scope,
      api,
      AppState.currentState == null || AppState.currentState === "active",
    );
    try {
      await offline.init();
    } catch (e) {
      await offline.stop();
      throw e;
    }
    return { api, scope, offline };
  }
  useEffect(() => {
    const net = NetInfo.addEventListener((state) =>
      onlineManager.setOnline(state.isConnected !== false),
    );
    // A locked or unavailable OS keyring must never block the sign-in screen.
    const failsafe = setTimeout(() => setLoading(false), 3000);
    loadConnection()
      .then(async (value) => {
        if (value) setSession(await prepare(JSON.parse(value)));
      })
      .catch(() =>
        setRestoreError(
          "Saved connection could not be restored. Sign in again. Existing phone downloads are retained.",
        ),
      )
      .finally(() => {
        clearTimeout(failsafe);
        setLoading(false);
      });
    const sub = AppState.addEventListener("change", (state) =>
      focusManager.setFocused(state === "active"),
    );
    return () => {
      sub.remove();
      net();
    };
  }, []);
  async function login(c: Credentials) {
    const api = new Api(c);
    await api.rest("ping");
    const saved = { ...c, preferredServer: api.activeServer };
    const next = await prepare(saved);
    try {
      await saveConnection(JSON.stringify(saved));
    } catch (e) {
      await next.offline.stop();
      throw e;
    }
    setRestoreError("");
    setSession(next);
  }
  async function updateAddresses(alternates: string) {
    if (!session) return;
    const addresses = normalizeServers([
      session.api.credentials.server,
      ...alternates.split(/[\n,]/),
    ]);
    const credentials = {
      ...session.api.credentials,
      alternateServers: addresses.slice(1),
    };
    const candidate = new Api(credentials);
    await candidate.rest("ping");
    const saved = { ...credentials, preferredServer: candidate.activeServer };
    await saveConnection(JSON.stringify(saved));
    // Keep the same API instance: playback and the download worker share this connection.
    Object.assign(session.api.credentials, saved);
    session.api.preferServer(candidate.activeServer);
    setSession({ ...session });
  }
  useEffect(() => {
    if (!session) return;
    const net = NetInfo.addEventListener(() => void session.offline.pump());
    const sub = AppState.addEventListener("change", (s) => {
      void session.offline.onAppState(s).catch(() => {});
    });
    return () => {
      net();
      sub.remove();
    };
  }, [session]);
  async function logout() {
    try {
      await session?.offline.stop();
    } catch {
      /* A failing local cleanup must never keep the account signed in. */
    }
    await queryClient.cancelQueries().catch(() => {});
    await clearConnection().catch(() => {});
    queryClient.clear();
    setSession(null);
  }
  return (
    <QueryClientProvider client={queryClient}>
      <Context.Provider
        value={{
          session,
          loading,
          restoreError,
          login,
          logout,
          updateAddresses,
        }}
      >
        {children}
      </Context.Provider>
    </QueryClientProvider>
  );
}
