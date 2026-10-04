import { describe, expect, it } from 'vitest';
import { songs } from './song';
import { markedChoice, validCues } from './VideoTiming';
describe('Full video cue sheets', () => {
  const body = songs.find((song) => song.activity === 'body')!;
  it('repeats gestures at explicitly marked times and rewinds to the earlier gesture', () => {
    const cues = [
      { time: 4.2, choice: 0 },
      { time: 5.7, choice: 1 },
      { time: 29.4, choice: 0 },
    ];
    expect(markedChoice(cues, 30, 0)).toBe(0);
    expect(markedChoice(cues, 7, 0)).toBe(1);
    expect(markedChoice(cues, 0, 0)).toBe(0);
  });
  it('rejects invalid local marks and bounds all choices to the current video', () => {
    expect(validCues([{ time: 2, choice: 7 }], body)).toBe(true);
    for (const cue of [
      { time: NaN, choice: 0 },
      { time: -1, choice: 0 },
      { time: 601, choice: 0 },
      { time: 2, choice: 8 },
      { time: 2, choice: 1.5 },
    ])
      expect(validCues([cue], body)).toBe(false);
  });
});
