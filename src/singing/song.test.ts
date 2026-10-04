import { describe, expect, it } from 'vitest';
import limits from '../../public/music/song-limits.json';
import {
  songs,
  isSingSnapshot,
  phraseBeginning,
  songDuration,
  songPhase,
  songSegments,
} from './song';

describe('Recorded singing library', () => {
  for (const song of songs) {
    if (song.video) {
      it(`${song.title}: accepts bounded official-video time and activity choices only`, () => {
        const s = {
          song: song.id,
          mode: 'together',
          time: 45,
          duration: 180,
          playing: true,
          guide: true,
          stars: [0],
          choice: 1,
          beat: 2,
          sentAt: 123,
          active: true,
        };
        expect(isSingSnapshot(s)).toBe(true);
        for (const patch of [
          { duration: Infinity },
          { duration: 601 },
          { time: 181 },
          { choice: -1 },
          { choice: song.lines.length },
          { beat: -1 },
          { beat: 100001 },
          { mode: 'echo' },
        ])
          expect(isSingSnapshot({ ...s, ...patch })).toBe(false);
      });
      continue;
    }
    it(`${song.title}: recorded phrases leave enough silence for every child answer`, () => {
      const segments = songSegments('echo', song);
      expect(segments).toHaveLength(song.lines.length);
      for (let i = 0; i < segments.length; i++) {
        const s = segments[i],
          end = s.at + s.duration;
        expect(songPhase(end, 'echo', song)).toMatchObject({ line: i, turn: true });
        const next = segments[i + 1]?.at ?? songDuration('echo', song);
        expect(next - end).toBeGreaterThanOrEqual(s.duration + 0.99);
        expect(songPhase(next - 0.25, 'echo', song).celebrating).toBe(true);
        expect(phraseBeginning(end + 0.1, 'echo', song)).toBe(s.at);
      }
      expect(songPhase(songDuration('echo', song), 'echo', song).done).toBe(true);
    });
    it(`${song.title}: words match line bounds and TV limits agree with the player`, () => {
      const limit = limits[song.id as keyof typeof limits];
      expect(songDuration('together', song)).toBe(limit.duration);
      expect(songDuration('echo', song)).toBeCloseTo(limit.echo, 3);
      expect(songDuration('concert', song)).toBeCloseTo(
        'concert' in limit ? limit.concert! : limit.duration,
        3,
      );
      for (const line of song.lines) {
        expect(line.times.length).toBe(line.words.length);
        expect(line.times.every((t) => t >= line.start && t < line.end)).toBe(true);
        expect(line.times).toEqual([...line.times].sort((a, b) => a - b));
      }
      const state = {
        song: song.id,
        mode: 'together',
        time: 0,
        playing: true,
        guide: true,
        stars: [0],
        sentAt: 123,
        active: true,
      };
      expect(isSingSnapshot(state)).toBe(true);
      for (const patch of [
        { song: 'https://elsewhere/audio.mp3' },
        { song: '__proto__' },
        { time: NaN },
        { time: song.duration + 1 },
        { stars: [song.lines.length] },
        { stars: ['0'] },
        { sentAt: Infinity },
        { active: 1 },
      ])
        expect(isSingSnapshot({ ...state, ...patch })).toBe(false);
    });
  }
  it('keeps an already connected previous-release TV compatible', () => {
    expect(
      isSingSnapshot({
        song: 'twinkle-v2-natural',
        mode: 'echo',
        time: 72,
        playing: false,
        guide: true,
        stars: [],
        sentAt: 123,
        active: true,
      }),
    ).toBe(true);
  });
});
