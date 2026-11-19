import { useState, useEffect, useCallback } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Page, Field, Row, Busy, useTheme } from "../../src/ui";
import { SongList } from "../../src/components";
import { useSession } from "../../src/session";
import { read, write } from "../../src/db";
import { useSongs } from "../../src/data";
import { usePlayback } from "../../src/playback";
import { matchesSong, stringList } from "../../src/library";
import { Segmented, Chip, SectionTitle, EmptyState } from "../../src/kit";
import { radius, spacing, type } from "../../src/theme";

export default function Search() {
  const { colors } = useTheme();
  const { session } = useSession();
  const player = usePlayback();
  const [mode, setMode] = useState<"library" | "online">("library"),
    [text, setText] = useState(""),
    [query, setQuery] = useState("");
  const [history, setHistory] = useState<string[]>(() =>
    stringList(read(session!.scope, "search-history", [])),
  );
  useFocusEffect(
    useCallback(() => {
      setHistory(stringList(read(session!.scope, "search-history", [])));
    }, [session!.scope]),
  );
  const library = useSongs();
  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), 350);
    return () => clearTimeout(t);
  }, [text]);
  const waiting = mode === "online" && query !== text.trim();
  const online = useQuery({
    queryKey: [session!.scope, "search", mode, query],
    enabled: mode === "online" && query.length >= 2 && !waiting,
    queryFn: ({ signal }) => session!.api.search(query, signal),
  });
  const saved = (library.data ?? []).filter((s) => matchesSong(s, text));
  const results =
    mode === "online" ? (waiting ? [] : (online.data ?? [])) : saved;
  function remember(value = text.trim()) {
    if (!value) return;
    const h = [value, ...history.filter((q) => q !== value)].slice(0, 20);
    setHistory(h);
    write(session!.scope, "search-history", h);
  }
  const header = (
    <View style={{ gap: spacing.md }}>
      <Segmented
        options={[
          { key: "library", title: "My library" },
          { key: "online", title: "Online" },
        ]}
        value={mode}
        onChange={setMode}
      />
      <Field
        label="Artist, title or version"
        value={text}
        onChange={setText}
        maxLength={256}
        onSubmit={() => remember()}
      />
      <Text style={[type.meta, { color: colors.faint }]}>
        {mode === "library"
          ? "Instant search across everything saved on your server."
          : "Searches beyond your saved library. Results play only when you choose one, and nothing downloads to this phone."}
      </Text>
      {!text.trim() && (
        <View style={{ gap: spacing.sm }}>
          <SectionTitle
            title="Recent searches"
            action={history.length ? "Clear" : undefined}
            onAction={() => {
              setHistory([]);
              write(session!.scope, "search-history", []);
            }}
          />
          {history.length ? (
            <Row>
              {history.map((q) => (
                <Chip key={q} title={q} onPress={() => setText(q)} />
              ))}
            </Row>
          ) : (
            <Text style={[type.meta, { color: colors.muted }]}>
              Your recent searches will appear here.
            </Text>
          )}
        </View>
      )}
      {mode === "online" && text.trim().length === 1 && (
        <Text style={[type.meta, { color: colors.muted }]}>
          Keep typing — online search needs at least two characters.
        </Text>
      )}
      {mode === "online" && (waiting || online.isFetching) && (
        <Busy label="Searching online" />
      )}
      {mode === "online" && online.isError && !waiting && (
        <View
          style={{
            gap: spacing.sm,
            borderWidth: 1,
            borderRadius: radius.sm,
            borderColor: colors.danger,
            backgroundColor: colors.dangerSoft,
            padding: spacing.md,
          }}
        >
          <Text style={[type.meta, { color: colors.danger }]}>
            {online.error.message}
          </Text>
          <Row>
            <Chip
              title="Retry online search"
              onPress={() => online.refetch()}
            />
            <Chip
              title={`Show saved-library results (${saved.length})`}
              onPress={() => setMode("library")}
            />
          </Row>
        </View>
      )}
      {mode === "library" && library.isPending && (
        <Busy label="Reading library" />
      )}
      {mode === "library" && library.isError && (
        <View
          style={{
            gap: spacing.sm,
            borderWidth: 1,
            borderRadius: radius.sm,
            borderColor: colors.danger,
            backgroundColor: colors.dangerSoft,
            padding: spacing.md,
          }}
        >
          <Text style={[type.meta, { color: colors.danger }]}>
            {library.error.message} Cached library results are shown where
            available.
          </Text>
          <Row>
            <Chip title="Retry library" onPress={() => library.refetch()} />
          </Row>
        </View>
      )}
      {!text.trim() && !history.length && (
        <EmptyState
          icon="search"
          title="Find anything"
          message="Search by artist, song, album or a version you remember."
        />
      )}
    </View>
  );
  return (
    <Page title="Search" scroll={false}>
      <SongList
        songs={results}
        header={header}
        emptyText={
          waiting || (mode === "online" && online.isFetching)
            ? "Searching…"
            : mode === "online" && query.length < 2
              ? "Choose an online track deliberately to play or save it."
              : "No matching songs. Try a different artist, title or version."
        }
        onPlay={(index) => {
          remember();
          void player.select(
            mode === "online" ? [results[index]!] : results,
            mode === "online" ? 0 : index,
          );
        }}
      />
    </Page>
  );
}
