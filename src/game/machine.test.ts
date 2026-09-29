import { describe, it, expect } from 'vitest';
import { transition, requestedAnimal, starCount, type GameState } from './machine';
describe('finite game machine', () => {
  it('moves CAT → DOG → LION → finale → complete', () => {
    let state: GameState = 'BOOT';
    state = transition(state, { type: 'READY' });
    state = transition(state, { type: 'PLAY' });
    state = transition(state, { type: 'CAMERA_READY' });
    state = transition(state, { type: 'INTRO_DONE' });
    for (const id of ['cat', 'dog', 'lion'] as const) {
      expect(requestedAnimal(state)).toBe(id);
      state = transition(state, { type: 'TARGET_FOUND', id });
      expect(state).toBe(`${id.toUpperCase()}_FOUND`);
      state = transition(state, { type: 'APPEAR_DONE' });
      state = transition(state, { type: 'PLAY_DONE' });
    }
    expect(state).toBe('FINALE');
    expect(transition(state, { type: 'FINALE_DONE' })).toBe('COMPLETE');
  });
  it('does not punish or progress on another animal', () => {
    expect(transition('FIND_CAT', { type: 'TARGET_FOUND', id: 'dog' })).toBe('FIND_CAT');
  });
  it('ignores duplicate detections and invalid events', () => {
    expect(transition('CAT_FOUND', { type: 'TARGET_FOUND', id: 'cat' })).toBe('CAT_FOUND');
    expect(transition('WELCOME', { type: 'FINALE_DONE' })).toBe('WELCOME');
  });
  it('resets every state', () => {
    for (const state of ['FINALE', 'FREE_PLAY', 'CAT_FOUND', 'COMPLETE'] as const)
      expect(transition(state, { type: 'RESET' })).toBe('WELCOME');
  });
  it('skips a find, appearance, interaction, intro, or finale', () => {
    expect(transition('FIND_CAT', { type: 'SKIP' })).toBe('FIND_DOG');
    expect(transition('CAT_FOUND', { type: 'SKIP' })).toBe('CAT_PLAY');
    expect(transition('DOG_PLAY', { type: 'SKIP' })).toBe('FIND_LION');
    expect(transition('INTRO', { type: 'SKIP' })).toBe('FIND_CAT');
    expect(transition('FINALE', { type: 'SKIP' })).toBe('COMPLETE');
  });
  it('free play accepts all cards without mission progression', () => {
    for (const id of ['cat', 'dog', 'lion'] as const)
      expect(transition('FREE_PLAY', { type: 'TARGET_FOUND', id })).toBe('FREE_PLAY');
  });
  it('awards stars as animals emerge', () => {
    expect(starCount('FIND_CAT')).toBe(0);
    expect(starCount('CAT_PLAY')).toBe(1);
    expect(starCount('FIND_LION')).toBe(2);
    expect(starCount('COMPLETE')).toBe(3);
  });
});
