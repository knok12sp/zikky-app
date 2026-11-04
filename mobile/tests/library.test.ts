import { expect, it } from "vitest";
import { matchesSong, collectionSongs } from "../src/library";
const songs = [
  {
    id: "one",
    title: "Bože",
    artist: "Artist",
    album: "Album",
    albumId: "album",
    artistId: "artist",
    duration: 180,
  },
  {
    id: "two",
    title: "Two",
    artist: "Artist",
    album: "Album",
    albumId: "album",
    artistId: "artist",
    duration: 180,
  },
];
it("matches artist/title words in any order and handles accents and repeated spaces", () => {
  expect(matchesSong(songs[0]!, " Artist   boze ")).toBe(true);
  expect(matchesSong(songs[0]!, "Remix")).toBe(false);
});
it("keeps offline album, artist and playlist queues limited to complete phone copies", () => {
  for (const kind of ["album", "artist", "playlist"]) {
    const id = kind === "playlist" ? "playlist" : kind;
    expect(
      collectionSongs(songs, kind, id, new Set(["one"])).map((s) => s.id),
    ).toEqual(["one"]);
    expect(collectionSongs(songs, kind, id)).toHaveLength(2);
  }
});
