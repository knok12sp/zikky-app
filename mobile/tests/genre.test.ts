import { expect, it } from "vitest";
import { genreGroups, collectionSongs } from "../src/library";
import { parseSong } from "../src/api";
const song = { id: "1", title: "Song", artist: "Artist", duration: 12 };
it("groups genre labels case-insensitively and keeps unlabelled songs accessible", () => {
  const songs = [
    { ...song, genre: "Rock" },
    { ...song, id: "2", genre: "rock" },
    { ...song, id: "3" },
  ];
  expect(genreGroups(songs)).toEqual([
    { id: "rock", name: "Rock", count: 2 },
    { id: "", name: "Unlabelled", count: 1 },
  ]);
  expect(collectionSongs(songs, "genre", "rock")).toHaveLength(2);
  expect(collectionSongs(songs, "genre", "")).toEqual([songs[2]]);
});
it("validates genre metadata while accepting old servers without it", () => {
  expect(parseSong(song).genre).toBeUndefined();
  expect(() => parseSong({ ...song, genre: 4 })).toThrow();
});
