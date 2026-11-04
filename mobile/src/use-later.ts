import { useEffect, useState } from "react";
import { useSession } from "./session";
import { laterSongs, watchLater } from "./listen-later";
export function useLater() {
  const { session } = useSession();
  const scope = session!.scope;
  const [songs, setSongs] = useState(() => laterSongs(scope));
  useEffect(() => {
    const update = () => setSongs(laterSongs(scope));
    const stop = watchLater(scope, update);
    update();
    return stop;
  }, [scope]);
  return songs;
}
