import { useState } from "react";
import { View } from "react-native";
import { Page, Label, Action, Field } from "../src/ui";
import { SongList } from "../src/components";
import { useLater } from "../src/use-later";
import { usePlayback } from "../src/playback";
import { useSession } from "../src/session";
import { removeLater } from "../src/listen-later";
import { matchesSong } from "../src/library";
import { Card, BackButton, SectionTitle } from "../src/kit";
import { router } from "expo-router";
export default function Later() {
  const all = useLater();
  const [filter, setFilter] = useState("");
  const player = usePlayback();
  const { session } = useSession();
  const songs = all.filter((song) => matchesSong(song, filter));
  return (
    <Page
      title="Listen later"
      subtitle="Bookmarks, not downloads"
      scroll={false}
    >
      <SongList
        songs={songs}
        header={
          <>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <BackButton onPress={() => router.back()} />
              <Label variant="micro" muted>
                {all.length} SAVED
              </Label>
            </View>
            <Card inset>
              <Label variant="meta" muted>
                Saved here as a bookmark only. No audio is stored on this phone
                when you add one.
              </Label>
            </Card>
            <Field
              label="Filter bookmarks"
              value={filter}
              onChange={setFilter}
              placeholder="Filter by title, artist or album"
              maxLength={256}
            />
            <SectionTitle title="Saved tracks" />
          </>
        }
        emptyText={
          all.length
            ? "No bookmarks match this filter."
            : "Search your library, then choose Save for later from a track's menu."
        }
        onPlay={(index) => player.select([songs[index]!], 0)}
        extra={(song) => (
          <View style={{ alignItems: "flex-end", paddingBottom: 4 }}>
            <Action
              title="Remove bookmark"
              label={`Remove ${song.title} from Listen later`}
              variant="ghost"
              onPress={() => removeLater(session!.scope, song.id)}
            />
          </View>
        )}
      />
    </Page>
  );
}
