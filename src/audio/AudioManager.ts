import { Howl, Howler } from 'howler';
import { cueDurations, cueTexts, cueGroups } from './generated';
import { characterIds, type Character } from '../characters/catalog';

export const spoken = cueTexts;
export type Cue = keyof typeof spoken;
export const isAnimalSound = (cue: string) => cueGroups[cue] === 'animals';
export const audioPath = (cue: Cue, format = 'mp3') =>
  `/audio/${cueGroups[cue] ?? 'words'}/${cue}.${format}`;
export const audioFiles = (Object.keys(spoken) as Cue[]).flatMap((cue) => [
  audioPath(cue),
  audioPath(cue, 'wav'),
]);

export class AudioManager {
  private analyser: AnalyserNode | null = null;
  private samples = new Uint8Array(256);
  private mouthLevel = 0;
  private lastMouthSample = 0;
  private sounds = new Map<Cue, Howl>();
  private speech: Cue | null = null;
  private queue: Cue[] = [];
  private effect: Cue | null = null;
  private get(cue: Cue) {
    let sound = this.sounds.get(cue);
    if (!sound) {
      sound = new Howl({
        src: [audioPath(cue), audioPath(cue, 'wav')],
        volume: isAnimalSound(cue) ? 0.8 : 1,
        preload: true,
        onend: () => {
          if (this.speech === cue) {
            this.speech = null;
            this.next();
          }
        },
        onloaderror: () => {
          if (this.speech === cue) {
            this.speech = null;
            this.next();
          }
        },
      });
      this.sounds.set(cue, sound);
    }
    return sound;
  }
  unlockAudio() {
    this.get('hello');
    void Howler.ctx?.resume();
    if (!this.analyser && Howler.ctx && Howler.masterGain) {
      this.analyser = Howler.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      Howler.masterGain.connect(this.analyser);
    }
    // Remaining clips load on demand; the service worker caches them offline.
  }
  setVolume(value: number) {
    Howler.volume(Math.max(0, Math.min(1, value)));
  }
  duration(cue: string) {
    return cueDurations[cue] ?? 1;
  }
  mouthLevelFor(character: Character) {
    const effect = this.effect && this.sounds.get(this.effect)?.playing() ? this.effect : null;
    const cue = effect ?? this.speech;
    if (!cue || !this.analyser) return 0;
    const speaker = characterIds.find((id) => cue.startsWith(`character-${id}-`) || cue === `call-${id}` || cue === id || cue === `a-${id}`)
      ?? ({ meow: 'cat', woof: 'dog', roar: 'lion' } as Record<string, Character>)[cue] ?? 'foxy';
    if (speaker !== character) return 0;
    const now = performance.now();
    if (now - this.lastMouthSample >= 16) {
      this.analyser.getByteTimeDomainData(this.samples);
      let sum = 0;
      for (const sample of this.samples) sum += ((sample - 128) / 128) ** 2;
      const target = Math.min(1, Math.max(0, (Math.sqrt(sum / this.samples.length) - .008) * 7));
      this.mouthLevel += (target - this.mouthLevel) * (target > this.mouthLevel ? .6 : .35);
      this.lastMouthSample = now;
    }
    return this.mouthLevel;
  }
  say(value: Cue | string) {
    if (!Object.prototype.hasOwnProperty.call(spoken, value)) return;
    const cue = value as Cue;
    if (isAnimalSound(cue)) {
      if (this.effect) this.sounds.get(this.effect)?.stop();
      this.effect = cue;
      this.get(cue).play();
      return;
    }
    // Finish a spoken word before the next phrase. Repeated taps do not pile up speech.
    if (cue === this.speech || this.queue.includes(cue)) return;
    if (this.queue.length >= 3) this.queue.shift();
    this.queue.push(cue);
    this.next();
  }
  private next() {
    if (this.speech) return;
    const cue = this.queue.shift();
    if (!cue) return;
    this.speech = cue;
    this.get(cue).play();
  }
  stop() {
    this.queue = [];
    this.speech = null;
    this.effect = null;
    this.mouthLevel = 0;
    this.sounds.forEach((sound) => sound.stop());
  }
}
export const audio = new AudioManager();
