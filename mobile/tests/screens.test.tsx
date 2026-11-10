import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { Api, type Song } from "../src/api";
import type { Download } from "../src/offline";
import { collection } from "../src/queue";
import * as FS from "expo-file-system/legacy";
const state = vi.hoisted(() => ({
  session: null as any,
  player: null as any,
  params: {} as Record<string, string>,
  saved: new Map<string, any>(),
  downloads: [] as Download[],
  queryClient: null as any,
  login: vi.fn(async () => {}),
  logout: vi.fn(async () => {}),
  updateAddresses: vi.fn(async () => {}),
  push: vi.fn(),
  back: vi.fn(),
  alert: vi.fn(),
  pickedFile: null as any,
  exported: "",
}));
vi.mock("react-native", () => {
  const host = (name: string) => (props: any) =>
    React.createElement(name, props, props.children);
  return {
    View: host("View"),
    Text: host("Text"),
    TextInput: host("TextInput"),
    Image: host("Image"),
    Pressable: host("Pressable"),
    ScrollView: host("ScrollView"),
    KeyboardAvoidingView: host("KeyboardAvoidingView"),
    ActivityIndicator: host("ActivityIndicator"),
    RefreshControl: host("RefreshControl"),
    Modal: ({ visible, children }: any) => (visible ? children : null),
    FlatList: ({
      data = [],
      renderItem,
      ListHeaderComponent,
      ListEmptyComponent,
      refreshControl,
      ...props
    }: any) =>
      React.createElement(
        "FlatList",
        props,
        ListHeaderComponent,
        refreshControl,
        data.length
          ? data.map((item: any, index: number) => (
              <React.Fragment key={index}>
                {renderItem({ item, index })}
              </React.Fragment>
            ))
          : ListEmptyComponent,
      ),
    StyleSheet: { create: (s: any) => s },
    useWindowDimensions: () => ({ width: 1280, height: 900 }),
    useColorScheme: () => "dark",
    Platform: { OS: "ios" },
    Alert: { alert: (...args: any[]) => state.alert(...args) },
  };
});
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children, ...props }: any) =>
    React.createElement("safe-area", props, children),
  SafeAreaProvider: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ bottom: 34, top: 44 }),
}));
vi.mock("expo-router", () => ({
  router: {
    push: (...args: any[]) => state.push(...args),
    back: () => state.back(),
    setParams: vi.fn(),
  },
  useLocalSearchParams: () => state.params,
  usePathname: () => "/",
  useFocusEffect: (callback: () => void) =>
    React.useEffect(callback, [callback]),
  Stack: () => null,
}));
vi.mock("@react-native-community/slider", () => ({
  default: (props: any) => React.createElement("slider", props),
}));
vi.mock("expo-status-bar", () => ({ StatusBar: () => null }));
vi.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children, ...props }: any) =>
    React.createElement("linear-gradient", props, children),
}));
vi.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///cache/",
  documentDirectory: "file:///documents/",
  deleteAsync: vi.fn(async () => {}),
  makeDirectoryAsync: vi.fn(async () => {}),
  writeAsStringAsync: vi.fn(async (_path: string, value: string) => {
    state.exported = value;
  }),
}));
vi.mock("expo-file-system", () => ({
  File: class {
    static async pickFileAsync() {
      return { canceled: !state.pickedFile, result: state.pickedFile };
    }
  },
}));
vi.mock("expo-secure-store", () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 7,
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(async () => {}),
  deleteItemAsync: vi.fn(async () => {}),
}));
vi.mock("expo-sharing", () => ({
  isAvailableAsync: vi.fn(async () => true),
  shareAsync: vi.fn(async () => {}),
}));
vi.mock("@react-native-community/netinfo", () => ({
  default: { fetch: vi.fn(async () => ({ isConnected: true, type: "wifi" })) },
}));
vi.mock("../src/db", () => ({
  read: (_scope: string, key: string, fallback: unknown) =>
    state.saved.get(key) ?? fallback,
  write: (_scope: string, key: string, value: unknown) =>
    state.saved.set(key, value),
  db: { runSync: vi.fn(), withTransactionSync: (fn: () => void) => fn() },
  clearCachedMetadata: vi.fn(),
}));
vi.mock("../src/session", () => ({
  useSession: () => ({
    session: state.session,
    login: state.login,
    logout: state.logout,
    updateAddresses: state.updateAddresses,
    loading: false,
  }),
  get queryClient() {
    return state.queryClient;
  },
  SessionProvider: ({ children }: any) => (
    <QueryClientProvider client={state.queryClient}>
      {children}
    </QueryClientProvider>
  ),
}));
vi.mock("../src/playback", () => ({
  usePlayback: () => state.player,
  PlaybackProvider: ({ children }: any) => children,
}));
import Layout from "../app/_layout";
import Home from "../app/(tabs)/index";
import Library from "../app/(tabs)/library";
import Search from "../app/(tabs)/search";
import Collection from "../app/collection";
import Downloads from "../app/downloads";
import Settings from "../app/settings";
import Player from "../app/player";
import { Art, SongList } from "../src/components";
import { ThemeProvider } from "../src/ui";
import Later from "../app/later";
import BackupScreen from "../app/backup";
import { saveLater } from "../src/listen-later";
import { createBackup } from "../src/backup";
import * as Sharing from "expo-sharing";
const songs: Song[] = [
  {
    id: "one",
    title: "First",
    artist: "Artist",
    album: "Album",
    albumId: "album",
    artistId: "artist",
    duration: 120,
    onServer: true,
    audioReady: true,
  },
  {
    id: "two",
    title: "Second",
    artist: "Artist",
    album: "Album",
    albumId: "album",
    artistId: "artist",
    duration: 120,
    onServer: true,
    audioReady: true,
  },
];
let tree: ReactTestRenderer | undefined;
async function mount(screen: React.ReactNode) {
  if (tree) await act(async () => tree!.unmount());
  await act(async () => {
    tree = create(
      <QueryClientProvider client={state.queryClient}>
        <ThemeProvider>{screen}</ThemeProvider>
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 10));
  });
}
function button(title: string) {
  return tree!.root
    .findAllByType("Pressable" as any)
    .find((n) => n.props.accessibilityLabel === title)!;
}
function field(label: string) {
  return tree!.root
    .findAllByType("TextInput" as any)
    .find((n) => n.props.accessibilityLabel === label)!;
}
async function press(title: string) {
  expect(button(title), title).toBeTruthy();
  await act(async () => {
    button(title).props.onPress();
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 10));
  });
}
function content() {
  return JSON.stringify(tree!.toJSON());
}
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  state.saved.clear();
  state.downloads = [];
  state.params = {};
  state.pickedFile = null;
  state.exported = "";
  state.queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const api = new Api({
    server: "https://home.test",
    alternateServers: ["https://remote.test"],
    username: "test",
    password: "synthetic",
  });
  vi.spyOn(api, "songs").mockResolvedValue(songs);
  vi.spyOn(api, "search").mockResolvedValue([
    { ...songs[0]!, title: "Search result", onServer: true },
  ]);
  vi.spyOn(api, "smart").mockResolvedValue(songs);
  vi.spyOn(api, "request").mockResolvedValue({ version: 1, jobs: [] });
  vi.spyOn(api, "rest").mockImplementation(async (endpoint) =>
    endpoint === "getPlaylists"
      ? {
          playlists: {
            playlist: [{ id: "playlist", name: "My playlist", songCount: 2 }],
          },
        }
      : endpoint === "getPlaylist"
        ? { playlist: { entry: songs } }
        : { starred2: { song: songs } },
  );
  state.session = {
    scope: "account",
    api,
    offline: {
      list: () => state.downloads,
      local: (id: string) =>
        state.downloads.some((d) => d.id === id && d.state === "complete")
          ? `file:///offline/${id}.mp3`
          : undefined,
      artwork: (id: string) => `file:///offline/${id}.jpg`,
      enqueue: vi.fn(),
      setGenre: vi.fn(),
      pump: vi.fn(),
      cancel: vi.fn(),
      remove: vi.fn(async (id) => {
        state.downloads = state.downloads.filter((d) => d.id !== id);
      }),
      removeAll: vi.fn(async () => {
        state.downloads = [];
      }),
      wifiOnly: true,
      setWifiOnly: vi.fn(),
      pauseOnBackground: true,
      setPauseOnBackground: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(async () => {}),
    },
  };
  state.player = {
    queue: collection(songs),
    status: {
      currentIndex: 0,
      playing: false,
      currentTime: 0,
      duration: 120,
      isLoaded: true,
    },
    busy: "",
    error: "",
    select: vi.fn(async () => {}),
    toggle: vi.fn(),
    next: vi.fn(),
    previous: vi.fn(),
    seek: vi.fn(),
    shuffle: vi.fn(),
    repeat: vi.fn(),
    retry: vi.fn(),
    clear: vi.fn(),
    skip: vi.fn(),
    remove: vi.fn(),
    move: vi.fn(),
    pause: vi.fn(),
    refreshSources: vi.fn(),
    sleepFor: vi.fn(),
    sleepAfterCurrent: vi.fn(),
    sleepAfterTrack: false,
    restore: vi.fn(async () => {}),
    enqueue: vi.fn(async () => {}),
  };
});
afterEach(async () => {
  if (tree) await act(async () => tree!.unmount());
  tree = undefined;
  state.queryClient.clear();
});
it("connects with both configured addresses and entered secure credentials", async () => {
  state.session = null;
  await mount(<Layout />);
  await act(async () => {
    field(
      "Server addresses (up to four; first stays primary)",
    ).props.onChangeText(
      "http://music.example.test:8787\nhttp://backup.example.test:8787",
    );
    field("Username").props.onChangeText("test");
    field("Password").props.onChangeText("synthetic");
  });
  await press("Test connection and sign in");
  expect(state.login).toHaveBeenCalledWith({
    server: "http://music.example.test:8787",
    alternateServers: ["http://backup.example.test:8787"],
    username: "test",
    password: "synthetic",
  });
});
it("home navigation and library browsing do not acquire audio", async () => {
  await mount(<Home />);
  await press("Recently added");
  expect(state.push).toHaveBeenCalledWith(
    expect.objectContaining({
      pathname: "/collection",
      params: expect.objectContaining({ id: "smart_recent" }),
    }),
  );
});
it("carries Offline only from library groups into album navigation", async () => {
  state.downloads = [
    {
      id: "one",
      song: JSON.stringify(songs[0]),
      state: "complete",
      bytes: 1000,
      total: 1000,
      error: "",
    },
  ];
  await mount(<Library />);
  await press("Albums");
  await press("Offline only");
  await press("Album · Artist");
  expect(state.push).toHaveBeenLastCalledWith(
    expect.objectContaining({
      params: expect.objectContaining({ kind: "album", offline: "1" }),
    }),
  );
});
it("plays only downloaded album tracks when opening an offline collection", async () => {
  state.params = { kind: "album", id: "album", name: "Album", offline: "1" };
  state.downloads = [
    {
      id: "one",
      song: JSON.stringify(songs[0]),
      state: "complete",
      bytes: 1000,
      total: 1000,
      error: "",
    },
  ];
  await mount(<Collection />);
  await press("Play");
  expect(state.player.select).toHaveBeenCalledWith([songs[0]], 0);
  expect(content()).not.toContain("Play Second");
});
it("does not expose playlist mutation controls for an offline subset", async () => {
  state.params = {
    kind: "playlist",
    id: "playlist",
    name: "My playlist",
    offline: "1",
  };
  state.saved.set("playlist:playlist", songs);
  await mount(<Collection />);
  expect(button("Rename")).toBeUndefined();
  expect(button("Remove from playlist")).toBeUndefined();
  expect(state.session.api.rest).not.toHaveBeenCalledWith(
    "createPlaylist",
    expect.anything(),
  );
});
it("keeps discovery playback to the deliberately selected result", async () => {
  state.params = { kind: "playlist", id: "smart_discover", name: "Discovery" };
  await mount(<Collection />);
  expect(button("Play").props.disabled).toBe(true);
  await press("Play Second, Artist");
  expect(state.player.select).toHaveBeenCalledWith([songs[1]], 0);
});
it("searches the server after the debounce and clears stale results", async () => {
  await mount(<Search />);
  await act(async () =>
    field("Artist, title or version").props.onChangeText("old"),
  );
  await act(async () => {
    await new Promise((r) => setTimeout(r, 380));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 10));
  });
  expect(state.session.api.search).toHaveBeenCalledWith(
    "old",
    expect.anything(),
  );
  await act(async () =>
    field("Artist, title or version").props.onChangeText("new"),
  );
  expect(button("Play Search result, Artist")).toBeUndefined();
});
it("removing a local copy preserves the listening queue", async () => {
  state.downloads = [
    {
      id: "one",
      song: JSON.stringify(songs[0]),
      state: "complete",
      bytes: 1000,
      total: 1000,
      error: "",
    },
  ];
  await mount(<Downloads />);
  await press("Remove phone copy");
  expect(state.session.offline.remove).toHaveBeenCalledWith("one");
  expect(state.player.clear).not.toHaveBeenCalled();
  expect(state.player.refreshSources).toHaveBeenCalled();
});
it("handles corrupt stored download metadata without crashing the downloads page", async () => {
  state.downloads = [
    {
      id: "one",
      song: "not-json",
      state: "complete",
      bytes: 1000,
      total: 1000,
      error: "",
    },
  ];
  await mount(<Downloads />);
  expect(content()).toContain("Track metadata unavailable");
  expect(button("Play offline")).toBeUndefined();
  await press("Remove phone copy");
  expect(state.session.offline.remove).toHaveBeenCalledWith("one");
});
it("saves alternative addresses directly from Settings", async () => {
  await mount(<Settings />);
  await act(async () =>
    field("Alternate server addresses (one per line)").props.onChangeText(
      "https://backup.test",
    ),
  );
  await press("Test and save addresses");
  expect(state.updateAddresses).toHaveBeenCalledWith("https://backup.test");
  expect(state.logout).not.toHaveBeenCalled();
});
it("now playing uses the restored queue index, exposes seeking and sets the sleep timer", async () => {
  state.player.queue = collection(songs, 1);
  state.player.status.currentIndex = 0;
  await mount(<Player />);
  expect(content()).toContain("Second");
  expect(
    tree!.root
      .findAllByType("Pressable" as any)
      .filter((n) => n.props.accessibilityLabel === "More player options"),
  ).toHaveLength(1);
  await act(async () =>
    tree!.root.findByType("slider" as any).props.onSlidingComplete(42),
  );
  expect(state.player.seek).toHaveBeenCalledWith(42);
  await press("Sleep timer");
  await press("15 min");
  expect(state.player.sleepFor).toHaveBeenCalledWith(15);
});
it("artwork falls back from a missing phone image to an authenticated server route", async () => {
  state.downloads = [
    {
      id: "one",
      song: JSON.stringify(songs[0]),
      state: "complete",
      bytes: 1000,
      total: 1000,
      error: "",
    },
  ];
  await mount(<Art song={songs[0]!} />);
  expect(tree!.root.findByType("Image" as any).props.source.uri).toContain(
    "file:",
  );
  await act(async () => tree!.root.findByType("Image" as any).props.onError());
  const source = tree!.root.findByType("Image" as any).props.source;
  expect(source.uri).toContain("https://home.test/rest/getCoverArt?");
  expect(source.uri).toContain("id=one");
  expect(source.headers.Authorization).toContain("Basic ");
});
it("track menus keep phone download explicit and prevent duplicate playlist taps", async () => {
  await mount(<SongList songs={songs} />);
  await press("Options for First, Artist");
  expect(button("Download to this phone")).toBeTruthy();
  let finish!: (value: unknown) => void;
  state.session.api.rest.mockImplementation((endpoint: string) =>
    endpoint === "updatePlaylist"
      ? new Promise((resolve) => {
          finish = resolve;
        })
      : Promise.resolve({}),
  );
  const action = button("My playlist");
  await act(async () => {
    action.props.onPress();
    action.props.onPress();
  });
  expect(
    state.session.api.rest.mock.calls.filter(
      ([name]: string[]) => name === "updatePlaylist",
    ),
  ).toHaveLength(1);
  await act(async () => finish({}));
});
it("recovers from corrupt metadata and history caches without crashing browsing", async () => {
  state.saved.set("songs:title", { invalid: true });
  state.saved.set("search-history", { invalid: true });
  await mount(<Search />);
  expect(content()).toContain("Play First, Artist");
});
it("appearance and Wi-Fi-only settings update real local state and their selected controls", async () => {
  await mount(<Settings />);
  await press("light");
  expect(state.saved.get("appearance")).toBe("light");
  expect(button("✓ light").props.accessibilityState.selected).toBe(true);
  await press("Downloads: Wi-Fi only");
  expect(state.session.offline.setWifiOnly).toHaveBeenCalledWith(false);
  expect(button("Downloads: allow cellular")).toBeTruthy();
});
it("favoriting a song changes metadata without acquiring audio", async () => {
  await mount(<SongList songs={songs} />);
  await press("Options for First, Artist");
  await press("Add favorite");
  expect(state.session.api.rest).toHaveBeenCalledWith("star", { id: "one" });
  expect(state.session.offline.enqueue).not.toHaveBeenCalled();
});
it("playlist moves and removals use standard Subsonic operations", async () => {
  state.params = { kind: "playlist", id: "playlist", name: "My playlist" };
  await mount(<Collection />);
  await press("Move down");
  expect(state.session.api.rest).toHaveBeenCalledWith("createPlaylist", {
    playlistId: "playlist",
    songId: ["two", "one"],
  });
  await press("Remove from playlist");
  expect(state.session.api.rest).toHaveBeenCalledWith("updatePlaylist", {
    playlistId: "playlist",
    songIndexToRemove: "0",
  });
});
it("removing account data clears only its files and cache before logging out", async () => {
  await mount(<Settings />);
  await press("Remove all account data from this phone");
  const confirm = state.alert.mock.calls
    .at(-1)![2]
    .find((action: { text: string }) => action.text === "Confirm");
  await act(async () => confirm.onPress());
  expect(state.session.offline.stop).toHaveBeenCalled();
  expect(state.session.offline.removeAll).toHaveBeenCalled();
  expect(FS.deleteAsync).toHaveBeenCalledWith("file:///cache/account", {
    idempotent: true,
  });
  expect(state.logout).toHaveBeenCalled();
});
it("sorts album groups by their visible names rather than the first track title", async () => {
  state.session.api.songs.mockResolvedValue([
    { ...songs[0], title: "A track", album: "Zulu", albumId: "zulu" },
    { ...songs[1], title: "Z track", album: "Alpha", albumId: "alpha" },
  ]);
  await mount(<Library />);
  await press("Albums");
  const groups = tree!.root
    .findAllByType("Pressable" as any)
    .map((n) => n.props.accessibilityLabel)
    .filter((label: string) =>
      ["Zulu · Artist", "Alpha · Artist"].includes(label),
    );
  expect(groups).toEqual(["Alpha · Artist", "Zulu · Artist"]);
});
it("saving and browsing Listen later never acquires or downloads audio", async () => {
  const online = { ...songs[0]!, onServer: false, audioReady: false };
  await mount(<SongList songs={[online]} />);
  await press("Options for First, Artist");
  await press("Save for later");
  expect(state.saved.get("listen-later")).toEqual([online]);
  expect(state.session.offline.enqueue).not.toHaveBeenCalled();
  await mount(<Home />);
  expect(button("Listen later · 1")).toBeTruthy();
  await press("Listen later · 1");
  expect(state.push).toHaveBeenCalledWith("/later");
  await mount(<Later />);
  expect(button("Play First, Artist")).toBeTruthy();
  expect(state.player.select).not.toHaveBeenCalled();
});
it("Listen later plays only the selected bookmark and removal affects no server music", async () => {
  saveLater("account", songs[0]!);
  saveLater("account", songs[1]!);
  await mount(<Later />);
  await press("Play First, Artist");
  expect(state.player.select).toHaveBeenCalledWith([songs[0]], 0);
  await press("Remove First from Listen later");
  expect(state.saved.get("listen-later").map((song: Song) => song.id)).toEqual([
    "two",
  ]);
});
it("collection completion controls exclude completed and already queued phone copies", async () => {
  state.params = { kind: "album", id: "album", name: "Album" };
  state.downloads = [
    {
      id: "one",
      song: JSON.stringify(songs[0]),
      state: "complete",
      bytes: 1000,
      total: 1000,
      error: "",
    },
  ];
  await mount(<Collection />);
  expect(content()).toContain("unique tracks on this phone");
  await press("Download missing tracks (1)");
  const action = state.alert.mock.calls
    .at(-1)![2]
    .find((item: any) => item.text === "Confirm");
  await act(async () => action.onPress());
  expect(state.session.offline.enqueue).toHaveBeenCalledWith([songs[1]]);
  expect(state.player.select).not.toHaveBeenCalled();
});
it("phone backup export works without server calls and shares credential-free JSON", async () => {
  saveLater("account", songs[0]!);
  await mount(<BackupScreen />);
  await press("Export phone metadata only (offline)");
  const exported = JSON.parse(state.exported);
  expect(exported.format).toBe("zikky-metadata");
  expect(exported.listenLater).toHaveLength(1);
  expect(exported.library).toBeNull();
  expect(state.exported).not.toContain("synthetic");
  expect(Sharing.shareAsync).toHaveBeenCalledWith(
    expect.stringContaining("/account/backups/zikky-"),
    expect.objectContaining({ mimeType: "application/json" }),
  );
  expect(state.session.api.rest).not.toHaveBeenCalled();
});
it("backup restore imports local metadata paused and never recreates offline copies or server playlists", async () => {
  const backup = await createBackup(
    state.session.api,
    "account",
    state.player.queue,
    [songs[0]!],
    false,
  );
  const json = JSON.stringify(backup);
  state.pickedFile = {
    size: new TextEncoder().encode(json).length,
    text: async () => json,
  };
  await mount(<BackupScreen />);
  await press("Open backup JSON");
  await press("Restore phone metadata");
  const action = state.alert.mock.calls
    .at(-1)![2]
    .find((item: any) => item.text === "Confirm");
  await act(async () => action.onPress());
  expect(state.player.restore).toHaveBeenCalled();
  expect(state.session.offline.setWifiOnly).toHaveBeenCalledWith(true, false);
  expect(state.session.offline.enqueue).not.toHaveBeenCalled();
  expect(state.session.api.rest).not.toHaveBeenCalled();
});
it("previous-download recovery skips removed server tracks instead of reimporting history", async () => {
  const removed = {
    ...songs[0]!,
    id: "deliberately-removed",
    title: "Removed",
  };
  const backup = await createBackup(
    state.session.api,
    "account",
    state.player.queue,
    [songs[0]!, removed],
    false,
  );
  const json = JSON.stringify(backup);
  state.pickedFile = { size: json.length, text: async () => json };
  await mount(<BackupScreen />);
  await press("Open backup JSON");
  await press("Review previous phone downloads (2 missing)");
  const action = state.alert.mock.calls
    .at(-1)![2]
    .find((item: any) => item.text === "Confirm");
  await act(async () => action.onPress());
  expect(state.session.offline.enqueue).toHaveBeenCalledWith([songs[0]]);
});
it("the finish-current-song timer is available from Now playing", async () => {
  await mount(<Player />);
  await press("Sleep timer");
  await press("Finish track");
  expect(state.player.sleepAfterCurrent).toHaveBeenCalledOnce();
});

import { DesktopPlayer } from "../src/desktop/DesktopPlayer";
import { CreatePlaylist, TrackActions } from "../src/desktop/TrackActions";
import { GenreEditor } from "../src/genre";

it("desktop artwork fills the player without a framed foreground cover", async () => {
  state.player.queue = collection([songs[0]!]);
  await mount(<DesktopPlayer onClose={() => {}} onQueue={() => {}} />);
  const art = tree!.root.findAllByType(Art);
  expect(art).toHaveLength(1);
  expect(art[0]!.props.fill).toBe(true);
  expect(art[0]!.props.blurRadius).toBeUndefined();
});
it("desktop favorite state does not leak into the next song", async () => {
  await mount(<DesktopPlayer onClose={() => {}} onQueue={() => {}} />);
  await press("Add favorite");
  expect(button("Remove favorite")).toBeTruthy();
  state.player.queue = { ...state.player.queue, index: 1 };
  await act(async () =>
    tree!.update(
      <QueryClientProvider client={state.queryClient}>
        <ThemeProvider>
          <DesktopPlayer onClose={() => {}} onQueue={() => {}} />
        </ThemeProvider>
      </QueryClientProvider>,
    ),
  );
  expect(button("Add favorite")).toBeTruthy();
});
it("saves a genre label and lets it be cleared", async () => {
  await mount(<GenreEditor song={songs[0]!} />);
  await act(async () =>
    field("Genre label").props.onChangeText("  Heavy   Metal  "),
  );
  await press("Save genre");
  expect(state.session.api.rest).toHaveBeenCalledWith("setGenre", {
    id: "one",
    genre: "Heavy Metal",
  });
  expect(content()).toContain("Genre saved");
  expect(state.session.offline.setGenre).toHaveBeenCalledWith(
    "one",
    "Heavy Metal",
  );
  await act(async () => field("Genre label").props.onChangeText(""));
  await press("Save genre");
  expect(state.session.api.rest).toHaveBeenCalledWith("setGenre", {
    id: "one",
    genre: "",
  });
});
it("desktop playlist creation trims names and blocks repeated submissions", async () => {
  let finish!: () => void;
  state.session.api.rest.mockImplementation((endpoint: string) =>
    endpoint === "createPlaylist"
      ? new Promise<void>((resolve) => {
          finish = resolve;
        })
      : Promise.resolve({}),
  );
  await mount(<CreatePlaylist song={songs[0]!} />);
  expect(button("Create playlist").props.disabled).toBe(true);
  await act(async () =>
    field("New playlist name").props.onChangeText("  Road trip  "),
  );
  const submit = button("Create playlist").props.onPress;
  await act(async () => {
    submit();
    submit();
  });
  expect(state.session.api.rest).toHaveBeenCalledTimes(1);
  expect(state.session.api.rest).toHaveBeenCalledWith("createPlaylist", {
    name: "Road trip",
    songId: ["one"],
  });
  await act(async () => finish());
  expect(content()).toContain("Playlist created");
});
it("desktop track options add to an existing playlist without playing the song", async () => {
  await mount(<TrackActions song={songs[0]!} />);
  await press("Options for First");
  await press("Add to My playlist");
  expect(state.session.api.rest).toHaveBeenCalledWith("updatePlaylist", {
    playlistId: "playlist",
    songIdToAdd: "one",
  });
  expect(state.player.select).not.toHaveBeenCalled();
});
