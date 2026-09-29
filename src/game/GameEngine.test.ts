import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameEngine, type SceneState } from './GameEngine';
import type { GameState } from './machine';
import type { TVBridge, TVEvent } from '../tv/TVBridge';
import type { TransferPlan } from '../tv/protocol';
describe('timeline and recognition boundary', () => {
  afterEach(() => vi.useRealTimers());
  function setup(state: GameState) {
    const send = vi.fn(),
      say = vi.fn(),
      show = vi.fn<(s: SceneState) => void>();
    const engine = new GameEngine({
      getState: () => state,
      send,
      audio: { say, stop: vi.fn() },
      show,
    });
    return { engine, send, say, show };
  }
  it('reveals paws then head then the full cat after an actual found event', () => {
    vi.useFakeTimers();
    const { engine, show, send } = setup('CAT_FOUND');
    engine.enter('CAT_FOUND');
    expect(show.mock.lastCall?.[0].reveal).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(show.mock.lastCall?.[0].reveal).toBe(0.25);
    vi.advanceTimersByTime(300);
    expect(show.mock.lastCall?.[0].reveal).toBe(0.6);
    vi.advanceTimersByTime(300);
    expect(show.mock.lastCall?.[0].reveal).toBe(1);
    vi.advanceTimersByTime(2500);
    expect(send).toHaveBeenCalledWith({ type: 'APPEAR_DONE' });
  });
  it('never creates a target found event from a timeout', () => {
    vi.useFakeTimers();
    const { engine, send } = setup('FIND_CAT');
    engine.enter('FIND_CAT');
    vi.advanceTimersByTime(120000);
    expect(send).not.toHaveBeenCalled();
  });
  it('only accepts the requested target in AR mode', () => {
    const { engine, send } = setup('FIND_CAT');
    engine.targetFound('dog');
    expect(send).not.toHaveBeenCalled();
    engine.targetFound('cat');
    expect(send).toHaveBeenCalledWith({ type: 'TARGET_FOUND', id: 'cat' });
  });
  it('cancels scheduled progress on leaving a scene', () => {
    vi.useFakeTimers();
    const { engine, send } = setup('CAT_FOUND');
    engine.enter('CAT_FOUND');
    engine.cancel();
    vi.advanceTimersByTime(20000);
    expect(send).not.toHaveBeenCalled();
  });
  it('lets interaction time finish without tapping', () => {
    vi.useFakeTimers();
    const { engine, send } = setup('CAT_PLAY');
    engine.enter('CAT_PLAY');
    vi.advanceTimersByTime(5500);
    expect(send).toHaveBeenCalledWith({ type: 'PLAY_DONE' });
  });
  it('plays a different free play reaction on recognized cards', () => {
    vi.useFakeTimers();
    const { engine, show } = setup('FREE_PLAY');
    engine.enter('FREE_PLAY');
    engine.targetFound('dog');
    expect(show.mock.lastCall?.[0].animal).toBe('dog');
    expect(show.mock.lastCall?.[0].reveal).toBe(1);
    engine.targetFound('lion');
    expect(show.mock.lastCall?.[0].animal).toBe('lion');
    engine.dispose();
  });
  it('keeps a 17.5 second celebration', () => {
    vi.useFakeTimers();
    const { engine, send } = setup('FINALE');
    engine.enter('FINALE');
    vi.advanceTimersByTime(17499);
    expect(send).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(send).toHaveBeenCalledWith({ type: 'FINALE_DONE' });
  });
  it('hides on iPad only after a TV transfer commit and restores on connection loss', async () => {
    vi.useFakeTimers();
    let listener: (event: TVEvent, payload?: unknown) => void = () => {};
    const tv: TVBridge = {
      connect: async () => {},
      disconnect: vi.fn(),
      sendEvent: vi.fn(),
      onEvent: (fn) => {
        listener = fn;
        return () => {};
      },
      isReady: () => true,
      serverTime: () => Date.now(),
      requestTransfer: async (id) => ({ id, transferId: 'ready-cat', revealAt: Date.now() + 900 }),
    };
    const show = vi.fn<(s: SceneState) => void>();
    const engine = new GameEngine({
      getState: () => 'CAT_PLAY',
      send: vi.fn(),
      show,
      audio: { say: vi.fn(), stop: vi.fn() },
      tv,
    });
    engine.enter('CAT_PLAY');
    await vi.advanceTimersByTimeAsync(4000);
    expect(show.mock.lastCall?.[0].reveal).toBe(1);
    await vi.advanceTimersByTimeAsync(899);
    expect(show.mock.lastCall?.[0].reveal).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(show.mock.lastCall?.[0].reveal).toBe(0);
    listener('CONNECTION_CHANGED', { ready: false });
    expect(show.mock.lastCall?.[0].reveal).toBe(1);
    engine.dispose();
    expect(tv.disconnect).not.toHaveBeenCalled();
  });
  it('cancels a late TV acknowledgement after leaving the animal scene', async () => {
    vi.useFakeTimers();
    let finish: (plan: TransferPlan) => void = () => {};
    const cancelTransfer = vi.fn();
    const tv: TVBridge = {
      connect: async () => {},
      disconnect: vi.fn(),
      sendEvent: vi.fn(),
      onEvent: () => () => {},
      isReady: () => true,
      serverTime: () => Date.now(),
      cancelTransfer,
      requestTransfer: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    };
    let state: GameState = 'CAT_PLAY';
    const show = vi.fn<(s: SceneState) => void>();
    const engine = new GameEngine({
      getState: () => state,
      send: vi.fn(),
      show,
      audio: { say: vi.fn(), stop: vi.fn() },
      tv,
    });
    engine.enter(state);
    await vi.advanceTimersByTimeAsync(4000);
    state = 'WELCOME';
    engine.enter(state);
    finish({ id: 'cat', transferId: 'late-cat', revealAt: Date.now() + 900 });
    await Promise.resolve();
    expect(cancelTransfer).toHaveBeenCalledWith('late-cat');
    expect(show.mock.lastCall?.[0].animal).toBeNull();
    engine.dispose();
  });
});
