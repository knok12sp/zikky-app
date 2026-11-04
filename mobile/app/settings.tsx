import { useEffect, useState } from "react";
import { router } from "expo-router";
import { View } from "react-native";
import * as FS from "expo-file-system/legacy";
import {
  Page,
  Label,
  Action,
  Row,
  Field,
  useTheme,
  report,
  confirm,
} from "../src/ui";
import { Card, SectionTitle, Chip, Banner, BackButton } from "../src/kit";
import { useSession, queryClient } from "../src/session";
import { usePlayback } from "../src/playback";
import { db, clearCachedMetadata } from "../src/db";
import { watchDownloads } from "../src/offline";
export default function Settings() {
  const { session, logout, updateAddresses } = useSession();
  const player = usePlayback();
  const { mode, setMode, colors } = useTheme();
  const [result, setResult] = useState("");
  const [wifi, setWifi] = useState(session!.offline.wifiOnly);
  const [safeBackground, setSafeBackground] = useState(
    session!.offline.pauseOnBackground,
  );
  useEffect(
    () =>
      watchDownloads(() => {
        setWifi(session!.offline.wifiOnly);
        setSafeBackground(session!.offline.pauseOnBackground);
      }),
    [session],
  );
  const [alternates, setAlternates] = useState(
    (session!.api.credentials.alternateServers ?? []).join("\n"),
  );
  const [connecting, setConnecting] = useState(false);
  return (
    <Page title="">
      <Row>
        <BackButton />
        <View style={{ flex: 1 }}>
          <Label variant="title">Settings</Label>
          <Label muted variant="meta">
            Connection, playback and this phone
          </Label>
        </View>
      </Row>
      <SectionTitle title="Connection" />
      <Card>
        <View style={{ gap: 4 }}>
          <Label variant="meta" muted>
            Active address
          </Label>
          <Label variant="meta">{session!.api.activeServer}</Label>
          <Label variant="meta" muted>
            {session!.api.addresses.join("  ·  ")}
          </Label>
        </View>
        <View style={{ height: 16 }} />
        <Field
          label="Alternate server addresses (one per line)"
          value={alternates}
          onChange={setAlternates}
          multiline
        />
        <View style={{ height: 12 }} />
        <Action
          title={connecting ? "Testing addresses…" : "Test and save addresses"}
          variant="primary"
          disabled={connecting}
          onPress={async () => {
            setConnecting(true);
            try {
              await updateAddresses(alternates);
              setResult(
                "Addresses saved. Phone downloads and queue are preserved.",
              );
            } catch (e) {
              report(e);
            } finally {
              setConnecting(false);
            }
          }}
        />
        <View style={{ height: 8 }} />
        <Action
          title="Test current connection"
          variant="ghost"
          onPress={() =>
            void session!.api
              .rest("ping")
              .then(() =>
                setResult(
                  `Connection passed. Active address: ${session!.api.activeServer}`,
                ),
              )
              .catch(report)
          }
        />
      </Card>
      <Label muted variant="meta">
        If the active address stops responding, requests try the next one
        automatically. The first address stays fixed so phone downloads remain
        linked to this account.
      </Label>
      {!!result && <Banner title={result} />}

      <SectionTitle title="Appearance" />
      <Row>
        {["system", "dark", "light"].map((m) => (
          <Chip
            key={m}
            title={m === mode ? "✓ " + m : m}
            active={m === mode}
            onPress={() => setMode(m)}
          />
        ))}
      </Row>

      <SectionTitle title="Downloads & storage" />
      <Card padding={0}>
        <View style={{ padding: 16, gap: 10 }}>
          <Row>
            <Chip
              title={
                wifi ? "Downloads: Wi-Fi only" : "Downloads: allow cellular"
              }
              icon="wifi"
              active={wifi}
              onPress={() => {
                session!.offline.setWifiOnly(!wifi);
                setWifi(!wifi);
              }}
            />
          </Row>
          <Label muted variant="meta">
            Wi-Fi only gates the next phone download. Streaming uses the active
            connection.
          </Label>
          <Chip
            title={
              safeBackground
                ? "Leaving app: pause safely and resume"
                : "Leaving app: allow native transfer"
            }
            active={safeBackground}
            onPress={() => {
              session!.offline.setPauseOnBackground(!safeBackground);
              setSafeBackground(!safeBackground);
            }}
          />
          <Label muted variant="meta">
            Safe mode checkpoints an active phone transfer when the app leaves
            the foreground and resumes when you return. Android background
            continuation is not guaranteed on every device.
          </Label>
        </View>
        <View style={{ height: 1, backgroundColor: colors.border }} />
        <Action
          title="Manage phone downloads"
          variant="row"
          icon="phone"
          onPress={() => router.push("/downloads")}
        />
        <Action
          title="Backup & recovery"
          variant="row"
          icon="downloaded"
          onPress={() => router.push("/backup")}
        />
        <Action
          title="Clear temporary cache"
          variant="row"
          icon="trash"
          onPress={() =>
            void (async () => {
              if (FS.cacheDirectory) {
                await FS.deleteAsync(FS.cacheDirectory + session!.scope, {
                  idempotent: true,
                });
              }
              setResult(
                "Temporary cache cleared. Explicit offline copies remain.",
              );
            })().catch(report)
          }
        />
        <Action
          title="Remove cached metadata and search history"
          variant="row"
          icon="trash"
          onPress={() =>
            confirm(
              "Clear local metadata?",
              "Queue and phone downloads remain.",
              () => {
                clearCachedMetadata(session!.scope);
                void queryClient
                  .cancelQueries({ queryKey: [session!.scope] })
                  .then(() =>
                    queryClient.resetQueries({ queryKey: [session!.scope] }),
                  );
                setResult("Metadata cache removed.");
              },
            )
          }
        />
      </Card>

      <SectionTitle title="Playback" />
      <Card>
        <Label muted variant="meta">
          Background audio is enabled. Disconnecting headphones pauses playback
          through the native engine. Shuffle, repeat and the sleep timer live in
          Now playing.
        </Label>
        <View style={{ height: 12 }} />
        <Action
          title="Open playback settings"
          variant="secondary"
          icon="play"
          onPress={() => router.push("/player")}
        />
      </Card>

      <SectionTitle title="Account" />
      <Card padding={0}>
        <Action
          title="Sign out, keep phone downloads"
          variant="row"
          onPress={() =>
            confirm(
              "Sign out?",
              "Playback stops. Secure credentials are removed. Sign in to the same server and account to use retained downloads.",
              () => {
                player.pause();
                void logout().catch(report);
              },
            )
          }
        />
        <Action
          title="Remove all account data from this phone"
          variant="row"
          danger
          onPress={() =>
            confirm(
              "Remove account data?",
              "Removes credentials, bookmarks, downloads, queue and metadata from this phone. Server music remains.",
              () =>
                void (async () => {
                  await player.clear();
                  await session!.offline.stop();
                  await session!.offline.removeAll();
                  if (FS.cacheDirectory)
                    await FS.deleteAsync(FS.cacheDirectory + session!.scope, {
                      idempotent: true,
                    });
                  db.runSync("DELETE FROM kv WHERE scope=?", session!.scope);
                  await logout();
                })().catch(report),
            )
          }
        />
      </Card>
      <Label muted variant="micro">
        Removing anything from this phone never deletes music from your server.
        Favourites, playlists and your library stay on the server.
      </Label>
    </Page>
  );
}
