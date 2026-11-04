import { useEffect, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { router } from "expo-router";
import { Page, Action, Row, confirm, report, useTheme } from "../src/ui";
import { useSession } from "../src/session";
import { watchDownloads, downloadSong } from "../src/offline";
import { usePlayback } from "../src/playback";
import { Art } from "../src/components";
import {
  BackButton,
  Banner,
  Card,
  EmptyState,
  IconButton,
  ProgressBar,
} from "../src/kit";
import { Icon } from "../src/icon";
import { radius, spacing, type } from "../src/theme";

const STATE_TEXT: Record<string, string> = {
  queued: "Waiting to download",
  acquiring: "Preparing on server",
  transferring: "Downloading to phone",
  pausing: "Pausing",
  paused: "Paused",
  "paused-background": "Paused in background",
  complete: "Available offline",
  failed: "Download failed",
  interrupted: "Interrupted",
  cancelled: "Cancelled",
};

export default function Downloads() {
  const { colors } = useTheme();
  const { session } = useSession();
  const player = usePlayback();
  const [, tick] = useState(0);
  useEffect(() => watchDownloads(() => tick((x) => x + 1)), []);
  const list = session!.offline.list();
  const failed = list
    .filter((d) => ["failed", "interrupted"].includes(d.state))
    .flatMap((d) => {
      const song = downloadSong(d);
      return song ? [song] : [];
    });
  const complete = list.filter((d) => d.state === "complete");
  const bytes = complete.reduce((sum, d) => sum + d.bytes, 0);
  async function remove(id?: string) {
    const affected = player.queue.entries.some(
      (e) => (!id || e.song.id === id) && session!.offline.local(e.song.id),
    );
    const current = player.queue.entries[player.queue.index]?.song.id;
    const resume = player.status.playing && !!id && current !== id;
    if (affected) player.pause();
    if (id) await session!.offline.remove(id);
    else await session!.offline.removeAll();
    if (affected) await player.refreshSources(resume);
  }
  const header = (
    <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}
      >
        <BackButton />
        <View style={{ flex: 1 }}>
          <Text style={[type.title, { color: colors.text }]}>
            On this phone
          </Text>
          <Text style={[type.meta, { color: colors.muted }]}>
            Deliberate offline copies
          </Text>
        </View>
      </View>

      <Card inset padding={spacing.lg} style={{ gap: spacing.sm }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="phone" size={20} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[type.numeric, { color: colors.text, fontSize: 20 }]}>
              {complete.length} {complete.length === 1 ? "track" : "tracks"}
            </Text>
            <Text
              style={[
                type.micro,
                { color: colors.faint, textTransform: "uppercase" },
              ]}
            >
              {(bytes / 1048576).toFixed(1)} MB stored on this phone
            </Text>
          </View>
        </View>
        <Text style={[type.meta, { color: colors.muted }]}>
          These files live on your phone. Removing one never deletes the server
          copy, and your library is untouched.
        </Text>
      </Card>

      <Text style={[type.meta, { color: colors.muted }]}>
        {session!.offline.wifiOnly
          ? "Downloads wait for Wi-Fi. Change this in Settings."
          : "Phone downloads can use cellular data."}
      </Text>
      <Text style={[type.micro, { color: colors.faint }]}>
        {session!.offline.pauseOnBackground
          ? "Safe background recovery is on: active transfers pause when you leave and resume when you return."
          : "Native background sessions are allowed. Continuation after suspension or termination is not guaranteed."}{" "}
        Paused checkpoints resume where supported. Changed files, routes or
        credentials restart safely.
      </Text>
      {!!session!.offline.lastError && (
        <Banner
          tone="danger"
          title="Downloads need attention"
          message={session!.offline.lastError}
        />
      )}
      <Row>
        <Action
          title="Start queued downloads"
          icon="download"
          disabled={!list.some((d) => d.state === "queued")}
          onPress={() => session!.offline.pump()}
        />
        {!!failed.length && (
          <Action
            title={`Retry ${failed.length} failed downloads`}
            onPress={() => session!.offline.enqueue(failed)}
          />
        )}
        <Action
          title="Remove all phone downloads"
          danger
          disabled={!list.length}
          onPress={() =>
            confirm(
              "Remove all phone downloads?",
              "Server copies and your listening queue remain. Playback using these files pauses.",
              () => void remove().catch(report),
            )
          }
        />
      </Row>
      {!!list.length && (
        <Text
          style={[
            type.micro,
            { color: colors.faint, textTransform: "uppercase" },
          ]}
        >
          Download details
        </Text>
      )}
    </View>
  );
  return (
    <Page title="" scroll={false}>
      <FlatList
        data={list}
        keyExtractor={(d) => d.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 28 }}
        ListEmptyComponent={
          <EmptyState
            icon="download"
            title="No downloads yet"
            message="Use a track's menu and choose Download to this phone. Streaming does not download anything automatically."
          />
        }
        renderItem={({ item }) => {
          const song = downloadSong(item);
          const transferable = ["queued", "acquiring", "transferring"].includes(
            item.state,
          );
          const isComplete = item.state === "complete";
          const progress =
            item.total > 0 ? Math.min(1, item.bytes / item.total) : 0;
          return (
            <Card
              padding={spacing.md}
              style={{
                marginBottom: spacing.sm,
                borderColor:
                  item.state === "failed" ? colors.danger : colors.border,
              }}
            >
              <View style={{ flexDirection: "row", gap: spacing.md }}>
                {song ? (
                  <Art song={song} size={48} radius={9} />
                ) : (
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 9,
                      backgroundColor: colors.surfaceInset,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name="note" size={18} color={colors.faint} />
                  </View>
                )}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    numberOfLines={1}
                    style={[
                      type.body,
                      { color: colors.text, fontWeight: "600" },
                    ]}
                  >
                    {song?.title ?? "Track metadata unavailable"}
                  </Text>
                  {!!song && (
                    <Text
                      numberOfLines={1}
                      style={[type.meta, { color: colors.muted }]}
                    >
                      {song.artist}
                    </Text>
                  )}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: isComplete
                          ? colors.accent
                          : item.state === "failed"
                            ? colors.danger
                            : colors.faint,
                      }}
                    />
                    <Text
                      style={[
                        type.micro,
                        {
                          color: isComplete ? colors.accent : colors.faint,
                          textTransform: "uppercase",
                        },
                      ]}
                    >
                      {STATE_TEXT[item.state] ?? item.state} ·{" "}
                      {(item.bytes / 1048576).toFixed(1)} MB
                      {item.total > 0
                        ? ` of ${(item.total / 1048576).toFixed(1)} MB`
                        : ""}
                    </Text>
                  </View>
                </View>
              </View>
              {!isComplete && item.total > 0 && (
                <View style={{ paddingTop: 8 }}>
                  <ProgressBar value={progress} height={3} />
                </View>
              )}
              {!!item.error && (
                <Text style={[type.meta, { color: colors.danger }]}>
                  {item.error}
                </Text>
              )}
              <Row>
                {isComplete && song && (
                  <Action
                    title="Play offline"
                    icon="play"
                    onPress={() => player.select([song], 0)}
                  />
                )}
                <Action
                  title={
                    isComplete
                      ? "Remove phone copy"
                      : "Remove from download queue"
                  }
                  icon="trash"
                  danger
                  onPress={() => remove(item.id)}
                />
                {song &&
                  ["failed", "interrupted", "cancelled"].includes(
                    item.state,
                  ) && (
                    <Action
                      title="Retry download"
                      onPress={() => session!.offline.enqueue([song])}
                    />
                  )}
                {["paused", "paused-background"].includes(item.state) && (
                  <Action
                    title="Resume download"
                    onPress={() => session!.offline.resume(item.id)}
                  />
                )}
                {item.state === "transferring" && (
                  <Action
                    title="Pause download"
                    onPress={() => session!.offline.pause(item.id)}
                  />
                )}
                {(transferable ||
                  ["paused", "paused-background"].includes(item.state)) && (
                  <Action
                    title="Cancel transfer"
                    onPress={() => session!.offline.cancel(item.id)}
                  />
                )}
              </Row>
            </Card>
          );
        }}
      />
    </Page>
  );
}
