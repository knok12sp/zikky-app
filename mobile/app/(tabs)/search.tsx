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
import { Chip, SectionTitle, Card, EmptyState } from "../../src/kit";
import { spacing, type } from "../../src/theme";

export default function Search() {
  const { colors } = useTheme();
  const { session } = useSession();
  const player = usePlayback();
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
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
  const waiting = query !== text.trim();
  const remote = useQuery({
    queryKey: [session!.scope, "search", query],
    enabled: query.length >= 2 && !waiting,
    queryFn: ({ signal }) => session!.api.search(query, signal),
  });
  const saved = (library.data ?? []).filter((s) => matchesSong(s, text));
  const results =
    query.length >= 2 && !waiting ? (remote.data ?? saved) : saved;
  function remember(value = text.trim()) {
    if (!value) return;
    const h = [value, ...history.filter((q) => q !== value)].slice(0, 20);
    setHistory(h);
    write(session!.scope, "search-history", h);
  }
  const header = (
    <View style={{ gap: spacing.md }}>
      <Field
        label="Artist, title or version"
        value={text}
        onChange={setText}
        maxLength={256}
        onSubmit={() => remember()}
      />
      <Text style={[type.meta, { color: colors.faint }]}>
        Searches the music on your server. Nothing downloads to this phone
        unless you choose it explicitly.
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
      {text.trim().length === 1 && (
        <Text style={[type.meta, { color: colors.muted }]}>
          Keep typing — server search needs at least two characters.
        </Text>
      )}
      {query.length >= 2 && (waiting || remote.isFetching) && (
        <Busy label="Searching the server" />
      )}
      {query.length >= 2 && remote.isError && !waiting && (
        <Card style={{ borderColor: colors.danger, gap: spacing.sm }}>
          <Text style={[type.meta, { color: colors.danger }]}>
            {remote.error.message}
          </Text>
          <Row>
            <Chip title="Retry search" onPress={() => void remote.refetch()} />
          </Row>
        </Card>
      )}
      {library.isPending && <Busy label="Reading library" />}
      {library.isError && (
        <Card style={{ borderColor: colors.danger, gap: spacing.sm }}>
          <Text style={[type.meta, { color: colors.danger }]}>
            {library.error.message} Cached results are shown where available.
          </Text>
          <Row>
            <Chip
              title="Retry library"
              onPress={() => void library.refetch()}
            />
          </Row>
        </Card>
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
          query.length >= 2 && (waiting || remote.isFetching)
            ? "Searching…"
            : "No matching songs. Try a different artist, title or version."
        }
        onPlay={(index) => {
          remember();
          void player.select(results, index);
        }}
      />
    </Page>
  );
}
