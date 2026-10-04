import catalog from './catalog.json';
import previousCatalog from './legacyCatalog.json';
import { song as legacy, phraseStarts, phraseEnds } from './legacySong';
export type SingMode = 'together' | 'echo' | 'concert';
export interface SongLine {
  words: string[];
  times: number[];
  start: number;
  end: number;
  meaning: string;
  icon: string;
  key: string;
  translation: string;
}
export interface SongDefinition {
  id: string;
  title: string;
  label: string;
  icon: string;
  theme: string;
  duration: number;
  mix: string;
  instrumental: string;
  lines: SongLine[];
  concert?: { duration: number; phrases: { start: number; end: number; times: number[] }[] };
  recording: { author: string; license: string; licenseURL: string; sourcePage: string };
  legacyStems?: boolean;
  video?: string;
  character?: 'cat' | 'bunny' | 'dog' | 'foxy';
  cueTiming?: boolean;
  activity?: 'stars' | 'farm' | 'bus' | 'moves' | 'body' | 'letters' | 'spider';
}
export const songs = catalog as SongDefinition[];
const previousSongs: SongDefinition[] = previousCatalog;
export const song = songs[0];
const legacySong: SongDefinition = {
  id: legacy.id,
  title: legacy.title,
  label: 'Песня о звезде',
  icon: '⭐',
  theme: 'space',
  duration: 28.1,
  mix: legacy.vocal,
  instrumental: legacy.instrumental,
  legacyStems: true,
  recording: {
    author: 'Derrick Coetzee',
    license: 'CC0',
    licenseURL: 'https://creativecommons.org/publicdomain/zero/1.0/',
    sourcePage:
      'https://commons.wikimedia.org/wiki/File:Twinkle_Twinkle_Little_Star_-_sung_with_full_lyrics.ogg',
  },
  lines: legacy.lines.map((l, i) => ({
    ...l,
    words: [...l.words],
    start: phraseStarts[i],
    end: phraseEnds[i],
    times: l.beats.map((b) => phraseStarts[i] + (b / 4) * (phraseEnds[i] - phraseStarts[i])),
  })),
};
export const getSong = (id: string) =>
  songs.find((s) => s.id === id) ??
  previousSongs.find((s) => s.id === id) ??
  (id === legacySong.id ? legacySong : undefined);
export const phrase = (line: number, mode: SingMode, selected = song) =>
  mode === 'concert' && selected.concert ? selected.concert.phrases[line] : selected.lines[line];
export const phraseDuration = (line: number, selected = song) =>
  selected.lines[line].end - selected.lines[line].start;
const echoLength = (line: number, selected: SongDefinition) =>
  selected.legacyStems ? 12 : phraseDuration(line, selected) * 2 + 1;
const echoBeginning = (line: number, selected: SongDefinition) =>
  selected.lines.slice(0, line).reduce((n, _, i) => n + echoLength(i, selected), 0);
export function songDuration(mode: SingMode, selected = song) {
  return mode === 'echo'
    ? echoBeginning(selected.lines.length, selected)
    : mode === 'concert' && selected.concert
      ? selected.concert.duration
      : selected.duration;
}
export function songPhase(time: number, mode: SingMode, selected = song) {
  const t = Math.max(0, Math.min(songDuration(mode, selected), time));
  let line = 0;
  selected.lines.forEach((_, i) => {
    if (t >= (mode === 'echo' ? echoBeginning(i, selected) : phrase(i, mode, selected).start))
      line = i;
  });
  const p = phrase(line, mode, selected);
  const local = Math.max(0, t - (mode === 'echo' ? echoBeginning(line, selected) : p.start));
  const duration = p.end - p.start;
  const responseEnd = echoLength(line, selected) - 0.5;
  const turn = mode === 'echo' && local + 1e-6 >= duration && local < responseEnd;
  const celebrating = mode === 'echo' && local >= responseEnd;
  const phraseTime = p.start + (turn ? Math.min(duration, local - duration) : local);
  const word = p.times.reduce((result, start, i) => (phraseTime >= start ? i : result), -1);
  return {
    line,
    local,
    word,
    turn,
    celebrating,
    done: t >= songDuration(mode, selected),
    intro: mode !== 'echo' && t < phrase(0, mode, selected).start,
  };
}
export function phraseBeginning(time: number, mode: SingMode, selected = song) {
  const { line } = songPhase(time, mode, selected);
  return mode === 'echo' ? echoBeginning(line, selected) : phrase(line, mode, selected).start;
}
export function songSegments(mode: SingMode, selected = song) {
  if (mode !== 'echo')
    return [{ at: 0, offset: 0, duration: songDuration(mode, selected), vocal: true }];
  // Sample the actual recorded phrase. The child's response stays silent.
  return selected.lines.map((p, line) => ({
    at: echoBeginning(line, selected),
    offset: p.start,
    duration: p.end - p.start,
    vocal: true,
  }));
}
export interface SingSnapshot {
  song: string;
  mode: SingMode;
  time: number;
  playing: boolean;
  guide: boolean;
  stars: number[];
  sentAt: number;
  active: boolean;
  duration?: number;
  choice?: number;
  beat?: number;
}
export function isSingSnapshot(value: unknown): value is SingSnapshot {
  const s = value as SingSnapshot | null;
  const selected = s && getSong(s.song);
  return (
    !!s &&
    !!selected &&
    ['together', 'echo', 'concert'].includes(s.mode) &&
    (!selected.video || s.mode === 'together') &&
    Number.isFinite(s.time) &&
    s.time >= 0 &&
    s.time <=
      (selected.video && s.duration ? s.duration : songDuration(s.mode, selected)) + 0.001 &&
    (s.duration === undefined ||
      (!!selected.video &&
        Number.isFinite(s.duration) &&
        s.duration > 0 &&
        s.duration <= selected.duration)) &&
    (s.choice === undefined ||
      (Number.isInteger(s.choice) && s.choice >= 0 && s.choice < selected.lines.length)) &&
    (s.beat === undefined || (Number.isInteger(s.beat) && s.beat >= 0 && s.beat <= 100000)) &&
    typeof s.playing === 'boolean' &&
    typeof s.guide === 'boolean' &&
    typeof s.active === 'boolean' &&
    Number.isFinite(s.sentAt) &&
    Array.isArray(s.stars) &&
    s.stars.length <= selected.lines.length &&
    s.stars.every((n) => Number.isInteger(n) && n >= 0 && n < selected.lines.length)
  );
}
