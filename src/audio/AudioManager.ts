import { Howl, Howler } from 'howler';
import { cueDurations, cueTexts, cueGroups } from './generated';

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
    // Remaining clips load on demand; the service worker caches them offline.
  }
  setVolume(value: number) {
    Howler.volume(Math.max(0, Math.min(1, value)));
  }
  duration(cue: string) {
    return cueDurations[cue] ?? 1;
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
    this.sounds.forEach((sound) => sound.stop());
  }
}
export const audio = new AudioManager();
