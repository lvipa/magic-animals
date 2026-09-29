import { beforeEach, describe, expect, it, vi } from 'vitest';

const clips = vi.hoisted(
  () =>
    new Map<
      string,
      { play: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; end: () => void }
    >(),
);
vi.mock('howler', () => ({
  Howler: { ctx: { resume: vi.fn() }, volume: vi.fn() },
  Howl: class {
    play = vi.fn();
    stop = vi.fn();
    constructor(options: { src: string[]; onend: () => void }) {
      clips.set(options.src[0], { play: this.play, stop: this.stop, end: options.onend });
    }
  },
}));
import { AudioManager, audioPath } from './AudioManager';

describe('recorded voice playback', () => {
  beforeEach(() => clips.clear());
  it('finishes a word before the next phrase and deduplicates repeated taps', () => {
    const manager = new AudioManager();
    manager.say('cat');
    manager.say('a-cat');
    manager.say('a-cat');
    expect(clips.has(audioPath('a-cat'))).toBe(false);
    const cat = clips.get(audioPath('cat'))!;
    expect(cat.stop).not.toHaveBeenCalled();
    cat.end();
    expect(clips.get(audioPath('a-cat'))!.play).toHaveBeenCalledTimes(1);
  });
  it('plays cartoon calls separately and cancels queued speech on scene exit', () => {
    const manager = new AudioManager();
    manager.say('dog');
    manager.say('woof');
    manager.say('a-dog');
    const dog = clips.get(audioPath('dog'))!;
    expect(dog.stop).not.toHaveBeenCalled();
    expect(clips.get(audioPath('woof'))!.play).toHaveBeenCalledOnce();
    manager.stop();
    dog.end();
    expect(clips.has(audioPath('a-dog'))).toBe(false);
    expect(dog.stop).toHaveBeenCalledOnce();
  });
});
