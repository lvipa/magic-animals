import type { SongDefinition } from './song';
export type ActivityCue = { time: number; choice: number };
const key = (song: SongDefinition) => `milo-video-cues-v1:${song.video}`;
export function validCues(value: unknown, song: SongDefinition): value is ActivityCue[] {
  return (
    Array.isArray(value) &&
    value.length <= 1000 &&
    value.every(
      (cue) =>
        cue &&
        Number.isFinite(cue.time) &&
        cue.time >= 0 &&
        cue.time < song.duration &&
        Number.isInteger(cue.choice) &&
        cue.choice >= 0 &&
        cue.choice < song.lines.length,
    )
  );
}
export function loadCues(song: SongDefinition): ActivityCue[] {
  try {
    const cues: unknown = JSON.parse(localStorage.getItem(key(song)) ?? '[]');
    return validCues(cues, song) ? [...cues].sort((a, b) => a.time - b.time) : [];
  } catch {
    return [];
  }
}
export function saveCues(song: SongDefinition, cues: ActivityCue[]) {
  if (!validCues(cues, song)) throw new Error('Invalid cue sheet');
  localStorage.setItem(key(song), JSON.stringify(cues));
}
export function markedChoice(cues: ActivityCue[], time: number, fallback: number) {
  let choice = fallback;
  for (const cue of cues) if (cue.time <= time) choice = cue.choice;
  return choice;
}
