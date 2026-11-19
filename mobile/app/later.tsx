import { useState } from "react";
import { View } from "react-native";
import { Page, Label, Action, Field, Row } from "../src/ui";
import { SongList } from "../src/components";
import { useLater } from "../src/use-later";
import { usePlayback } from "../src/playback";
import { useSession } from "../src/session";
import { removeLater } from "../src/listen-later";
import { matchesSong } from "../src/library";
import { BackButton, SectionTitle } from "../src/kit";
import { router } from "expo-router";
export default function Later() {
  const all = useLater();
  const [filter, setFilter] = useState("");
  const player = usePlayback();
  const { session } = useSession();
  const songs = all.filter((song) => matchesSong(song, filter));
  return (
    <Page title="" scroll={false}>
      <SongList
        songs={songs}
        header={
          <>
            <Row>
              <BackButton onPress={() => router.back()} />
              <View style={{ flex: 1 }}>
                <Label variant="title">Listen later</Label>
                <Label variant="meta" muted>
                  Bookmarks, not downloads
                </Label>
              </View>
              <Label variant="micro" muted>
                {all.length} saved
              </Label>
            </Row>
            <Label variant="meta" muted>
              Saved here as a bookmark only. No audio is stored on this phone
              when you add one.
            </Label>
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
            : "Find something in Online search, then choose Save for later from its menu."
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
