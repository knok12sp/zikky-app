import { useQuery, QueryFunctionContext } from "@tanstack/react-query";
import { useSession } from "./session";
import { read, write } from "./db";
import { Song, Playlist, parseSongs, parsePlaylists } from "./api";
export function useSongs(sort = "title") {
  const { session } = useSession();
  return useQuery<Song[]>({
    queryKey: [session!.scope, "songs", sort],
    queryFn: async ({ signal }) => {
      const songs = await session!.api.songs("", sort, signal);
      write(session!.scope, "songs:" + sort, songs);
      return songs;
    },
    initialData: () => {
      const cached = read<unknown>(session!.scope, "songs:" + sort, undefined);
      try {
        return cached === undefined ? undefined : parseSongs(cached);
      } catch {
        return undefined;
      }
    },
    initialDataUpdatedAt: 0,
  });
}
export function usePlaylists(enabled = true) {
  const { session } = useSession();
  return useQuery<Playlist[]>({
    queryKey: [session!.scope, "playlists"],
    enabled,
    queryFn: async ({ signal }) => {
      const data = await session!.api.rest("getPlaylists", {}, signal);
      const playlists = parsePlaylists(data.playlists?.playlist);
      write(session!.scope, "playlists", playlists);
      return playlists;
    },
    initialData: () => {
      const cached = read<unknown>(session!.scope, "playlists", undefined);
      try {
        return cached === undefined ? undefined : parsePlaylists(cached);
      } catch {
        return undefined;
      }
    },
    initialDataUpdatedAt: 0,
  });
}
