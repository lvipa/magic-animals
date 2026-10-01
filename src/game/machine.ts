import { storyAnimals, type AnimalId } from '../config/animals';
export type GameState =
  | 'BOOT'
  | 'WELCOME'
  | 'CAMERA_PERMISSION'
  | 'INTRO'
  | `FIND_${Uppercase<AnimalId>}`
  | `${Uppercase<AnimalId>}_FOUND`
  | `${Uppercase<AnimalId>}_PLAY`
  | 'FINALE'
  | 'COMPLETE'
  | 'FREE_PLAY';
export type GameEvent =
  | {
      type:
        | 'READY'
        | 'PLAY'
        | 'CAMERA_READY'
        | 'INTRO_DONE'
        | 'APPEAR_DONE'
        | 'PLAY_DONE'
        | 'FINALE_DONE'
        | 'RESET'
        | 'HOME'
        | 'FREE_PLAY'
        | 'SKIP';
    }
  | { type: 'TARGET_FOUND'; id: AnimalId };
const ordered = storyAnimals.map((a) => a.id);
export function transition(state: GameState, event: GameEvent): GameState {
  if (event.type === 'HOME') return 'WELCOME';
  if (event.type === 'RESET') return 'WELCOME';
  if (event.type === 'FREE_PLAY') return 'FREE_PLAY';
  if (event.type === 'SKIP') {
    if (state === 'INTRO') return 'FIND_CAT';
    if (state === 'CAMERA_PERMISSION') return 'INTRO';
    if (state.endsWith('_FOUND')) return state.replace('_FOUND', '_PLAY') as GameState;
    if (state === 'FINALE') return 'COMPLETE';
  }
  if (event.type === 'READY' && state === 'BOOT') return 'WELCOME';
  if (event.type === 'PLAY' && state === 'WELCOME') return 'CAMERA_PERMISSION';
  if (event.type === 'CAMERA_READY' && state === 'CAMERA_PERMISSION') return 'INTRO';
  if (event.type === 'INTRO_DONE' && state === 'INTRO') return 'FIND_CAT';
  if (event.type === 'TARGET_FOUND' && state === `FIND_${event.id.toUpperCase()}`)
    return `${event.id.toUpperCase()}_FOUND` as GameState;
  if (event.type === 'APPEAR_DONE' && state.endsWith('_FOUND'))
    return state.replace('_FOUND', '_PLAY') as GameState;
  if (
    (event.type === 'PLAY_DONE' || event.type === 'SKIP') &&
    state !== 'FREE_PLAY' &&
    (state.endsWith('_PLAY') || state.startsWith('FIND_'))
  ) {
    const id = (
      state.startsWith('FIND_') ? state.slice(5) : state.split('_')[0]
    ).toLowerCase() as AnimalId;
    const next = ordered.indexOf(id) + 1;
    return next < ordered.length ? (`FIND_${ordered[next].toUpperCase()}` as GameState) : 'FINALE';
  }
  if (event.type === 'FINALE_DONE' && state === 'FINALE') return 'COMPLETE';
  return state;
}
export function requestedAnimal(state: GameState): AnimalId | null {
  if (!state.startsWith('FIND_')) return null;
  return state.slice(5).toLowerCase() as AnimalId;
}
export function starCount(state: GameState) {
  if (['FINALE', 'COMPLETE', 'FREE_PLAY'].includes(state)) return 3;
  const idx = ordered.findIndex((id) => state.includes(id.toUpperCase()));
  return Math.max(0, idx + (state.startsWith('FIND_') ? 0 : 1));
}
