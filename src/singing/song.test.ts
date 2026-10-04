import { describe, expect, it } from 'vitest';
import {
  isSingSnapshot,
  phraseBeginning,
  phraseDuration,
  songDuration,
  songPhase,
  songSegments,
} from './song';
describe('Singing rounds', () => {
  it('leaves every child response silent, including the last one', () => {
    const segments = songSegments('echo');
    expect(segments).toHaveLength(6);
    for (let line = 0; line < 6; line++) {
      const end = line * 12 + phraseDuration(line);
      expect(songPhase(end, 'echo')).toMatchObject({ line, turn: true });
      expect(segments.every((s) => s.at + s.duration <= end || s.at >= line * 12 + 11.5)).toBe(
        true,
      );
      expect(songPhase(line * 12 + 11.7, 'echo')).toMatchObject({ line, celebrating: true });
    }
    expect(songPhase(72, 'echo').done).toBe(true);
  });
  it('repeats the current phrase rather than resetting the entire song', () => {
    expect(phraseBeginning(16, 'echo')).toBe(12);
    expect(phraseBeginning(16, 'together')).toBe(14.6);
    expect(songPhase(25.9, 'concert').line).toBe(5);
    expect(songDuration('concert')).toBe(28.1);
  });
  it('rejects invalid remote commands and non-finite clock values', () => {
    const state = {
      song: 'twinkle-v2-natural',
      mode: 'echo',
      time: 5,
      playing: true,
      guide: true,
      stars: [0],
      sentAt: 123,
      active: true,
    };
    expect(isSingSnapshot(state)).toBe(true);
    for (const patch of [
      { time: NaN },
      { time: 73 },
      { stars: [6] },
      { stars: ['0'] },
      { mode: 'invalid' },
      { song: 'https://elsewhere/audio.mp3' },
      { sentAt: Infinity },
      { active: 1 },
    ])
      expect(isSingSnapshot({ ...state, ...patch })).toBe(false);
  });
});
