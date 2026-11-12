/** One audio player at a time: music and audiobooks pause each other. */
export type AudioOwner = "music" | "book" | null;

let owner: AudioOwner = null;
const listeners = new Set<(owner: AudioOwner) => void>();

export function claimAudio(next: AudioOwner) {
  owner = next;
  for (const listener of listeners) listener(next);
}

export function audioOwner() {
  return owner;
}

export function onAudioOwnerChange(listener: (owner: AudioOwner) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
