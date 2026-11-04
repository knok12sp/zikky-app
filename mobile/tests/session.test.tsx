import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  saved: null as string | null,
  failStore: false,
  initFailure: false,
  workers: [] as any[],
}));
vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async () => state.saved),
  setItemAsync: vi.fn(async (_key: string, value: string) => {
    if (state.failStore) throw Error("Secure storage unavailable");
    state.saved = value;
  }),
  deleteItemAsync: vi.fn(async () => {
    state.saved = null;
  }),
}));
vi.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "sha256" },
  digestStringAsync: async (_algorithm: string, value: string) =>
    "scope:" + value,
}));
vi.mock("@react-native-community/netinfo", () => ({
  default: { addEventListener: () => () => {} },
}));
vi.mock("react-native", () => ({
  AppState: { addEventListener: () => ({ remove: () => {} }) },
}));
vi.mock("../src/offline", () => ({
  Offline: class {
    init = vi.fn(async () => {
      if (state.initFailure) throw Error("Storage failed");
    });
    stop = vi.fn(async () => {});
    pump = vi.fn();
    constructor(
      readonly scope: string,
      readonly api: unknown,
    ) {
      state.workers.push(this);
    }
  },
}));
import { Api } from "../src/api";
import { SessionProvider, useSession, queryClient } from "../src/session";
const credentials = {
  server: "https://home.test",
  alternateServers: ["https://remote.test"],
  username: "test",
  password: "synthetic",
};
let session: ReturnType<typeof useSession>;
let tree: ReactTestRenderer;
function Probe() {
  session = useSession();
  return null;
}
async function mount() {
  await act(async () => {
    tree = create(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
  });
}
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  state.saved = null;
  state.failStore = false;
  state.initFailure = false;
  state.workers = [];
  vi.spyOn(Api.prototype, "rest").mockResolvedValue({});
  vi.spyOn(Api.prototype, "request").mockResolvedValue({ version: 1 });
});
afterEach(async () => {
  await act(async () => tree.unmount());
  queryClient.clear();
  vi.restoreAllMocks();
});
it("restores a saved session without requiring network connectivity", async () => {
  state.saved = JSON.stringify(credentials);
  vi.mocked(Api.prototype.request).mockRejectedValue(Error("Offline"));
  await mount();
  expect(session.session?.api.credentials.username).toBe("test");
  expect(Api.prototype.request).not.toHaveBeenCalled();
  expect(session.restoreError).toBe("");
});
it("keeps the same account scope, worker and API object when editing alternate addresses", async () => {
  state.saved = JSON.stringify(credentials);
  await mount();
  const original = session.session!;
  await act(async () => {
    await session.updateAddresses("https://backup.test\nhttps://remote.test");
  });
  expect(session.session?.scope).toBe(original.scope);
  expect(session.session?.api).toBe(original.api);
  expect(session.session?.offline).toBe(original.offline);
  expect(original.api.addresses).toEqual([
    credentials.server,
    "https://backup.test",
    "https://remote.test",
  ]);
  expect(JSON.parse(state.saved!).alternateServers).toEqual([
    "https://backup.test",
    "https://remote.test",
  ]);
});
it("does not replace a working connection if testing or saving new routes fails", async () => {
  state.saved = JSON.stringify(credentials);
  await mount();
  const original = state.saved;
  state.failStore = true;
  await act(async () => {
    await expect(
      session.updateAddresses("https://backup.test"),
    ).rejects.toThrow("Secure storage");
  });
  expect(session.session?.api.addresses).toEqual([
    credentials.server,
    "https://remote.test",
  ]);
  expect(state.saved).toBe(original);
});
it("does not save credentials or establish a session if local storage initialization fails", async () => {
  await mount();
  state.initFailure = true;
  await act(async () => {
    await expect(session.login(credentials)).rejects.toThrow("Storage failed");
  });
  expect(state.saved).toBeNull();
  expect(session.session).toBeNull();
  expect(state.workers[0].stop).toHaveBeenCalled();
});
it("surfaces a corrupt saved connection and retains local files for recovery", async () => {
  state.saved = JSON.stringify({ server: 123 });
  await mount();
  expect(session.session).toBeNull();
  expect(session.restoreError).toContain("retained");
  expect(state.workers).toHaveLength(0);
});
it("logout stops the worker and removes credentials", async () => {
  state.saved = JSON.stringify(credentials);
  await mount();
  const worker = session.session!.offline;
  await act(async () => {
    await session.logout();
  });
  expect(worker.stop).toHaveBeenCalled();
  expect(state.saved).toBeNull();
  expect(session.session).toBeNull();
});
