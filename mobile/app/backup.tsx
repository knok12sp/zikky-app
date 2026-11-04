import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { View } from "react-native";
import { File } from "expo-file-system";
import * as FS from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Page, Action, Label, report, confirm, useTheme } from "../src/ui";
import { useSession } from "../src/session";
import { usePlayback } from "../src/playback";
import { completedSongs, watchDownloads } from "../src/offline";
import {
  createBackup,
  parseBackup,
  prepareRestore,
  maxBackupBytes,
  type Backup,
} from "../src/backup";
import { db, write } from "../src/db";
import { laterKey, notifyLater } from "../src/listen-later";
import { collectionDownloads } from "../src/download-policy";
import { Card, SectionTitle, Banner, BackButton } from "../src/kit";
export default function BackupScreen() {
  const { session } = useSession();
  const player = usePlayback();
  const theme = useTheme();
  const [working, setWorking] = useState(false),
    [status, setStatus] = useState(""),
    [loaded, setLoaded] = useState<Backup | null>(null);
  const [, tick] = useState(0);
  useEffect(() => watchDownloads(() => tick((value) => value + 1)), []);
  useEffect(() => () => controller.current?.abort(), []);
  const pending = useRef(false);
  const controller = useRef<AbortController | null>(null);
  async function run(fn: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setWorking(true);
    setStatus("");
    try {
      await fn();
    } catch (e) {
      report(e);
    } finally {
      pending.current = false;
      setWorking(false);
      controller.current = null;
    }
  }
  async function exportFile(includeLibrary: boolean) {
    if (!(await Sharing.isAvailableAsync()))
      throw new Error("File sharing is unavailable on this device.");
    const abort = new AbortController();
    controller.current = abort;
    const backup = await createBackup(
      session!.api,
      session!.scope,
      player.queue,
      completedSongs(session!.offline.list()),
      includeLibrary,
      abort.signal,
      (done, total) =>
        setStatus(`Reading playlist metadata: ${done} of ${total}`),
    );
    abort.signal.throwIfAborted();
    const dir = `${FS.cacheDirectory}${session!.scope}/backups/`;
    await FS.makeDirectoryAsync(dir, { intermediates: true });
    const path = dir + `zikky-${backup.createdAt.replace(/[:.]/g, "-")}.json`;
    await FS.writeAsStringAsync(path, JSON.stringify(backup, null, 2));
    await Sharing.shareAsync(path, {
      mimeType: "application/json",
      UTI: "public.json",
      dialogTitle: "Save Zikky metadata backup",
    });
    setStatus(
      "Share sheet closed. Keep the JSON file in a safe place. Audio files and credentials are not included.",
    );
  }
  async function openFile() {
    const picked = await File.pickFileAsync({
      mimeTypes: ["application/json", "text/plain"],
    });
    if (picked.canceled || !picked.result) return;
    const size = picked.result.size;
    if (
      size === null ||
      !Number.isSafeInteger(size) ||
      size <= 0 ||
      size > maxBackupBytes
    )
      throw new Error(
        "Backup must be a readable JSON file no larger than 10 MB.",
      );
    const backup = parseBackup(await picked.result.text());
    prepareRestore(backup, session!.scope, session!.api.credentials.server);
    setLoaded(backup);
    setStatus("Backup validated. Review its contents before restoring.");
  }
  async function restore() {
    if (!loaded) return;
    const next = prepareRestore(
      loaded,
      session!.scope,
      session!.api.credentials.server,
    );
    player.pause();
    db.withTransactionSync(() => {
      write(session!.scope, laterKey, next.listenLater);
      write(session!.scope, "wifi-only", next.settings.wifiOnly);
      write(
        session!.scope,
        "pause-background",
        next.settings.pauseOnBackground,
      );
      write(session!.scope, "queue", next.queue);
      write("device", "appearance", next.settings.appearance);
    });
    notifyLater(session!.scope);
    session!.offline.setWifiOnly(next.settings.wifiOnly, false);
    session!.offline.setPauseOnBackground(next.settings.pauseOnBackground);
    theme.setMode(next.settings.appearance);
    await player.restore(next.queue);
    setStatus(
      "Bookmarks merged, settings restored and queue restored paused. No audio was downloaded; server favorites and playlists remain on your server.",
    );
  }
  const missing = loaded
    ? collectionDownloads(loaded.downloadedTracks, session!.offline.list())
        .missing
    : [];
  return (
    <Page
      title="Backup & recovery"
      subtitle="Metadata only. Audio and credentials stay out."
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <BackButton onPress={() => router.back()} />
      </View>
      <Card inset>
        <Label variant="meta" muted>
          Export bookmarks, settings, your paused queue and a list of phone
          downloads. Full metadata export also includes favorite and
          user-playlist snapshots from the server. Passwords, resume tokens and
          audio files are excluded.
        </Label>
      </Card>

      <SectionTitle title="Export" />
      <Card padding={0}>
        <View style={{ padding: 16, gap: 10 }}>
          <Action
            title="Export full metadata backup"
            variant="primary"
            disabled={working}
            onPress={() => run(() => exportFile(true))}
          />
          <Action
            title="Export phone metadata only (offline)"
            variant="secondary"
            disabled={working}
            onPress={() => run(() => exportFile(false))}
          />
          <Action
            title="Open backup JSON"
            variant="secondary"
            disabled={working}
            onPress={() => run(openFile)}
          />
        </View>
      </Card>
      {working && controller.current && (
        <Action
          title="Cancel metadata export"
          variant="ghost"
          onPress={() => controller.current?.abort()}
        />
      )}
      {!!status && <Banner title={status} />}
      {loaded && (
        <>
          <SectionTitle title="Review backup" />
          <Card>
            <Label variant="meta" muted>
              {new Date(loaded.createdAt).toLocaleString()}
            </Label>
            <Label>
              {loaded.listenLater.length} bookmarks ·{" "}
              {loaded.queue.entries.length} queue entries ·{" "}
              {loaded.downloadedTracks.length} previous phone downloads
            </Label>
            <Label variant="meta" muted>
              {loaded.library
                ? `${loaded.library.favorites.length} favorite snapshots · ${loaded.library.playlists.length} playlist snapshots`
                : "No server snapshots in this file"}
            </Label>
            <View style={{ height: 12 }} />
            <Label variant="meta" muted>
              Restoration merges bookmarks and replaces local settings and
              queue. Server favorites and playlists reconnect from your
              permanent server library. Snapshots are retained for reference,
              not automatically imported.
            </Label>
          </Card>
          <Action
            title="Restore phone metadata"
            variant="primary"
            disabled={working}
            onPress={() =>
              confirm(
                "Restore phone metadata?",
                "Merge bookmarks and replace this phone’s settings and queue? Playback pauses. No server changes or audio downloads are made.",
                () => void run(restore),
              )
            }
          />
          <Action
            title={`Review previous phone downloads (${missing.length} missing)`}
            variant="secondary"
            disabled={working || !missing.length}
            onPress={() =>
              run(async () => {
                const saved = new Set(
                  (await session!.api.songs()).map((song) => song.id),
                );
                const available = missing.filter((song) => saved.has(song.id));
                if (!available.length) {
                  setStatus(
                    "None of these missing phone copies are still saved on this server. Removed tracks will not be reimported.",
                  );
                  return;
                }
                confirm(
                  "Download previous phone copies?",
                  `Explicitly download ${available.length} still-saved tracks? ${missing.length - available.length} removed/missing tracks are skipped.`,
                  () => {
                    session!.offline.enqueue(available);
                    router.push("/downloads");
                  },
                );
              })
            }
          />
          {loaded.library?.playlists.map((playlist) => (
            <Label key={playlist.id} variant="meta">
              {playlist.name} · {playlist.songs.length} tracks (snapshot)
            </Label>
          ))}
        </>
      )}
    </Page>
  );
}
