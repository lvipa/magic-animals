import { readFileSync } from 'node:fs';
export const animalIds = ['cat', 'dog', 'lion', 'foxy', 'bunny', 'bear', 'panda', 'elephant'];
const songLimits = JSON.parse(
  readFileSync(new URL('../public/music/song-limits.json', import.meta.url), 'utf8'),
);
const states = [
  'BOOT',
  'WELCOME',
  'CAMERA_PERMISSION',
  'INTRO',
  'FINALE',
  'COMPLETE',
  'FREE_PLAY',
  ...animalIds.flatMap((id) => [
    `FIND_${id.toUpperCase()}`,
    `${id.toUpperCase()}_FOUND`,
    `${id.toUpperCase()}_PLAY`,
  ]),
];
const moods = [
  'idle',
  'lookAround',
  'point',
  'happy',
  'surprised',
  'scared',
  'laugh',
  'dance',
  'fall',
];
const actions = [
  ...moods,
  'jump',
  'play',
  'spin',
  'chase tail',
  'run',
  'sit',
  'sleep',
  'roll',
  'wave',
  'roar',
  'woof',
  'meow',
  'sing',
  'tired',
  'hungry',
  'thirsty',
  'sad',
];
const legacyCues = [
  'rabbit',
  'bear',
  'panda',
  'elephant',
  'hello',
  'intro',
  'great',
  'friends',
  'cat',
  'dog',
  'lion',
  'a-cat',
  'a-dog',
  'a-lion',
  'find-cat',
  'find-dog',
  'find-lion',
  'meow',
  'woof',
  'roar',
];
const cues = [
  ...new Set([
    ...legacyCues,
    ...JSON.parse(
      readFileSync(new URL('../public/audio/manifest.json', import.meta.url), 'utf8'),
    ).clips.map((clip) => clip.cue),
  ]),
];
const worlds = ['meadow', 'space', 'forest', 'trampoline'];
export function sceneSnapshot(value) {
  const s = value?.scene;
  if (
    !states.includes(value?.state) ||
    !s ||
    typeof s.caption !== 'string' ||
    s.caption.length > 120 ||
    !(s.animal === null || animalIds.includes(s.animal)) ||
    !Number.isFinite(s.reveal) ||
    s.reveal < 0 ||
    s.reveal > 1 ||
    !actions.includes(s.action) ||
    !moods.includes(s.foxy) ||
    typeof s.effects !== 'boolean' ||
    typeof s.finale !== 'boolean' ||
    (s.world !== undefined && !worlds.includes(s.world)) ||
    (value.paused !== undefined && typeof value.paused !== 'boolean')
  )
    return null;
  return {
    state: value.state,
    paused: value.paused ?? false,
    scene: {
      caption: s.caption,
      animal: s.animal,
      reveal: s.reveal,
      action: s.action,
      foxy: s.foxy,
      effects: s.effects,
      finale: s.finale,
      ...(s.world !== undefined ? { world: s.world } : {}),
    },
  };
}
export function gameEvent(event, payload) {
  if (event === 'SING_SCENE') {
    const s = payload;
    const limit = s && Object.hasOwn(songLimits, s.song) ? songLimits[s.song] : null;
    return !!limit &&
      ['together', 'echo', 'concert'].includes(s.mode) &&
      (!limit.video || s.mode === 'together') &&
      (s.duration === undefined ||
        (limit.video &&
          Number.isFinite(s.duration) &&
          s.duration > 0 &&
          s.duration <= limit.duration)) &&
      (s.choice === undefined ||
        (Number.isInteger(s.choice) && s.choice >= 0 && s.choice < limit.lines)) &&
      (s.beat === undefined || (Number.isInteger(s.beat) && s.beat >= 0 && s.beat <= 100000)) &&
      Number.isFinite(s.time) &&
      s.time >= 0 &&
      s.time <=
        (limit.video && s.duration
          ? s.duration
          : s.mode === 'echo'
            ? limit.echo
            : s.mode === 'concert'
              ? (limit.concert ?? limit.duration)
              : limit.duration) +
          0.001 &&
      typeof s.playing === 'boolean' &&
      typeof s.guide === 'boolean' &&
      typeof s.active === 'boolean' &&
      Number.isFinite(s.sentAt) &&
      Array.isArray(s.stars) &&
      s.stars.length <= limit.lines &&
      s.stars.every((n) => Number.isInteger(n) && n >= 0 && n < limit.lines)
      ? {
          song: s.song,
          mode: s.mode,
          time: s.time,
          playing: s.playing,
          guide: s.guide,
          active: s.active,
          sentAt: s.sentAt,
          stars: [...new Set(s.stars)],
          ...(s.duration !== undefined ? { duration: s.duration } : {}),
          ...(s.choice !== undefined ? { choice: s.choice } : {}),
          ...(s.beat !== undefined ? { beat: s.beat } : {}),
        }
      : null;
  }
  if (event === 'FRIEND_SCENE')
    return (payload?.id === null ||
      ['foxy', ...animalIds, 'bunny', 'bear', 'panda', 'elephant'].includes(payload?.id)) &&
      actions.includes(payload?.action) &&
      (payload.world === undefined || worlds.includes(payload.world)) &&
      (payload.caption === undefined ||
        (typeof payload.caption === 'string' && payload.caption.length <= 120))
      ? {
          id: payload.id,
          action: payload.action,
          ...(payload.world !== undefined ? { world: payload.world } : {}),
          ...(payload.caption !== undefined ? { caption: payload.caption } : {}),
        }
      : null;
  if (event === 'AUDIO_ROUTE')
    return ['ipad', 'tv'].includes(payload?.target) ? { target: payload.target } : null;
  if (event === 'SCENE_SYNC') return sceneSnapshot(payload);
  if (event === 'AUDIO_CUE') return cues.includes(payload?.cue) ? { cue: payload.cue } : null;
  if (event === 'ANIMAL_FOUND') return animalIds.includes(payload?.id) ? { id: payload.id } : null;
  if (event === 'SCENE_CHANGE')
    return states.includes(payload?.state) ? { state: payload.state } : null;
  if (['GAME_STARTED', 'FINALE', 'CELEBRATION'].includes(event)) return {};
  return null;
}
