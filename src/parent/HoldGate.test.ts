import { describe, it, expect, vi } from 'vitest';
import { HoldGate } from './HoldGate';
describe('parent hold gate', () => {
  it('requires the entire hold and cancels early release', () => {
    vi.useFakeTimers();
    const gate = new HoldGate(),
      done = vi.fn();
    gate.start(3000, done);
    vi.advanceTimersByTime(2999);
    expect(done).not.toHaveBeenCalled();
    gate.cancel();
    vi.advanceTimersByTime(1);
    expect(done).not.toHaveBeenCalled();
    gate.start(3000, done);
    vi.advanceTimersByTime(3000);
    expect(done).toHaveBeenCalledOnce();
    gate.start(2000, done);
    vi.advanceTimersByTime(1999);
    expect(done).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(done).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
