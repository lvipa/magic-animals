import { describe, it, expect, vi, afterEach } from 'vitest';
import { useGame } from './store';
describe('minimal local storage', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('persists completed animals and settings without camera data or transient state', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => values.set(k, v),
      removeItem: (k: string) => values.delete(k),
    });
    useGame.setState({ state: 'FIND_CAT', available: [], completed: false });
    useGame.getState().send({ type: 'TARGET_FOUND', id: 'cat' });
    useGame.getState().setQuality('LOW');
    useGame.getState().setVolume(0.45);
    const saved = JSON.parse(values.get('magic-animals')!).state;
    expect(saved.available).toEqual(['cat']);
    expect(saved.quality).toBe('LOW');
    expect(saved.volume).toBe(0.45);
    expect(Object.keys(saved).sort()).toEqual(['available', 'completed', 'quality', 'volume']);
  });
  it('keeps game playable when persistence is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('full');
      },
      removeItem: () => {},
    });
    expect(() => useGame.getState().send({ type: 'RESET' })).not.toThrow();
    expect(useGame.getState().state).toBe('WELCOME');
  });
  it('supports independent fallback modes and reset', () => {
    useGame.getState().setMode('CAMERA_MODE');
    expect(useGame.getState().mode).toBe('CAMERA_MODE');
    useGame.getState().setMode('3D_MODE');
    useGame.getState().send({ type: 'PLAY' });
    useGame.getState().send({ type: 'CAMERA_READY' });
    expect(useGame.getState().state).toBe('INTRO');
    useGame.getState().send({ type: 'RESET' });
    expect(useGame.getState().state).toBe('WELCOME');
  });
});
