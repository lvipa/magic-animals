export type SingMode = 'together' | 'echo' | 'concert';
export const echoPhraseDuration = 12;
export const song = {
  id: 'twinkle-v1',
  title: 'Twinkle, Twinkle, Little Star',
  vocal: '/music/twinkle-v1/vocal.mp3',
  instrumental: '/music/twinkle-v1/instrumental.mp3',
  lines: [
    {
      words: ['Twinkle,', 'twinkle,', 'little', 'star,'],
      meaning: 'Мерцай, мерцай, маленькая звезда',
      icon: '⭐',
      key: 'star',
      translation: 'звезда',
      beats: [0, 1, 2, 3],
    },
    {
      words: ['How', 'I', 'wonder', 'what', 'you', 'are!'],
      meaning: 'Как мне интересно, что ты такое!',
      icon: '🤔',
      key: 'wonder',
      translation: 'удивляться',
      beats: [0, 0.5, 1, 2, 2.5, 3],
    },
    {
      words: ['Up', 'above', 'the', 'world', 'so', 'high,'],
      meaning: 'Так высоко над всем миром',
      icon: '🌍',
      key: 'high',
      translation: 'высоко',
      beats: [0, 0.5, 1.5, 2, 2.5, 3],
    },
    {
      words: ['Like', 'a', 'diamond', 'in', 'the', 'sky.'],
      meaning: 'Как бриллиант в небе',
      icon: '💎',
      key: 'sky',
      translation: 'небо',
      beats: [0, 0.5, 1, 2, 2.5, 3],
    },
    {
      words: ['Twinkle,', 'twinkle,', 'little', 'star,'],
      meaning: 'Мерцай, мерцай, маленькая звезда',
      icon: '⭐',
      key: 'little',
      translation: 'маленький',
      beats: [0, 1, 2, 3],
    },
    {
      words: ['How', 'I', 'wonder', 'what', 'you', 'are!'],
      meaning: 'Как мне интересно, что ты такое!',
      icon: '✨',
      key: 'twinkle',
      translation: 'мерцать',
      beats: [0, 0.5, 1, 2, 2.5, 3],
    },
  ],
} as const;
export function songDuration(mode: SingMode) {
  return mode === 'echo' ? echoPhraseDuration * 6 : 26;
}
export function songPhase(time: number, mode: SingMode) {
  const t = Math.max(0, Math.min(songDuration(mode), time));
  const done = t >= songDuration(mode);
  const line =
    mode === 'echo'
      ? Math.min(5, Math.floor(t / echoPhraseDuration))
      : Math.min(5, Math.max(0, Math.floor((t - 1) / 4)));
  const local = mode === 'echo' ? t % echoPhraseDuration : Math.max(0, t - (1 + line * 4));
  const turn = mode === 'echo' && local >= 4 && local < 11.5;
  const celebrating = mode === 'echo' && local >= 11.5;
  const phraseTime = turn ? Math.min(4, local - 4) : local;
  const word = song.lines[line].beats.reduce(
    (result, beat, i) => (phraseTime >= beat ? i : result),
    -1,
  );
  return { line, local, word, turn, celebrating, done, intro: mode !== 'echo' && t < 1 };
}
export function phraseBeginning(time: number, mode: SingMode) {
  const { line } = songPhase(time, mode);
  return mode === 'echo' ? line * echoPhraseDuration : 1 + line * 4;
}
export function songSegments(mode: SingMode) {
  if (mode !== 'echo') return [{ at: 0, offset: 0, duration: 26, vocal: true }];
  // Child response is deliberately silent: the microphone must not reward
  // the accompaniment or a TV speaker as though it were the child's voice.
  return song.lines.flatMap((_, line) => [
    { at: line * echoPhraseDuration, offset: 1 + line * 4, duration: 4, vocal: true },
  ]);
}
export interface SingSnapshot {
  song: 'twinkle-v1';
  mode: SingMode;
  time: number;
  playing: boolean;
  guide: boolean;
  stars: number[];
  sentAt: number;
  active: boolean;
}
export function isSingSnapshot(value: unknown): value is SingSnapshot {
  const s = value as SingSnapshot | null;
  return (
    !!s &&
    s.song === song.id &&
    ['together', 'echo', 'concert'].includes(s.mode) &&
    Number.isFinite(s.time) &&
    s.time >= 0 &&
    s.time <= songDuration(s.mode) &&
    typeof s.playing === 'boolean' &&
    typeof s.guide === 'boolean' &&
    typeof s.active === 'boolean' &&
    Number.isFinite(s.sentAt) &&
    Array.isArray(s.stars) &&
    s.stars.length <= 6 &&
    s.stars.every((n) => Number.isInteger(n) && n >= 0 && n < 6)
  );
}
