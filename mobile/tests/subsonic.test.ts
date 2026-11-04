import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Api } from "../src/api";

let server: Server;
let base = "";

const song = (id: string, title: string) => ({
  id,
  title,
  artist: "Artist",
  album: "Album",
  albumId: "al1",
  artistId: "ar1",
  duration: 120,
  coverArt: "al1",
});

beforeAll(async () => {
  server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      if (url.pathname === "/rest/stream") {
        response.writeHead(200, {
          "Content-Type": "audio/mpeg",
          "Content-Length": "1024",
          ETag: '"stream-v1"',
        });
        response.end(request.method === "HEAD" ? undefined : "audio");
        return;
      }
      if (url.pathname === "/rest/getCoverArt") {
        response.writeHead(200, { "Content-Type": "image/png" });
        response.end("image");
        return;
      }
      const endpoint = url.pathname.replace("/rest/", "");
      const data: Record<string, unknown> = {
        "subsonic-response": { status: "ok", version: "1.16.1" },
      };
      const envelope = data["subsonic-response"] as Record<string, unknown>;
      if (endpoint === "getAlbumList2")
        envelope.albumList2 = { album: [{ id: "al1" }] };
      if (endpoint === "getAlbum")
        envelope.album = {
          song: [song("s1", "First"), song("s2", "Second")],
        };
      if (endpoint === "search3")
        envelope.searchResult3 = { song: [song("s2", "Second")] };
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(data));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no address");
  base = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

describe("standard Subsonic client", () => {
  const api = () =>
    new Api({ server: base, username: "user", password: "synthetic" });

  it("logs in, loads the catalogue and searches", async () => {
    const client = api();
    expect((await client.rest("ping")).status).toBe("ok");
    expect((await client.songs()).map((s) => s.title)).toEqual([
      "First",
      "Second",
    ]);
    expect((await client.search("Second")).map((s) => s.id)).toEqual(["s2"]);
  });

  it("builds authenticated stream and artwork URLs", async () => {
    const client = api();
    const media = client.media("s2");
    expect(media.uri).toContain(base + "/rest/stream?");
    expect(media.uri).toContain("id=s2");
    expect(media.uri).toContain("u=user");
    expect(media.headers.Authorization).toMatch(/^Basic /);
    expect(await client.mediaInfo("s2")).toEqual({
      size: 1024,
      etag: '"stream-v1"',
    });
    const artwork = client.artwork("al1");
    expect(artwork.uri).toContain(base + "/rest/getCoverArt?");
    expect(artwork.uri).toContain("id=al1");
  });
});
