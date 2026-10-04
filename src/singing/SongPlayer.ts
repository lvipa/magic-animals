import {
  song as defaultSong,
  songDuration,
  songSegments,
  type SingMode,
  type SongDefinition,
} from './song';

/** Both stems and karaoke use one AudioContext clock, including pause/seek. */
export class SongPlayer {
  private context: AudioContext | null = null;
  private buffers: Array<AudioBuffer | undefined> = [];
  private loading = new Map<number, Promise<void>>();
  private download: AbortController | null = null;
  private sources: AudioBufferSourceNode[] = [];
  private vocalGain: GainNode | null = null;
  private backingGain: GainNode | null = null;
  private master: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private samples = new Uint8Array(256);
  private anchor = 0;
  private offset = 0;
  private running = false;
  private disposed = false;
  private generation = 0;
  mode: SingMode = 'together';
  guide = true;
  muted = false;
  get duration() {
    return songDuration(this.mode, this.song);
  }
  get isPlaying() {
    return this.running;
  }
  get ended() {
    return this.running && this.time >= this.duration;
  }
  constructor(readonly song: SongDefinition = defaultSong) {}
  unlock() {
    this.disposed = false;
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(this.context.destination);
      this.vocalGain = this.context.createGain();
      this.backingGain = this.context.createGain();
      this.backingGain.connect(this.master);
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 256;
      this.vocalGain.connect(this.analyser);
      this.analyser.connect(this.master);
    }
    return this.context.resume();
  }
  async load() {
    const stems = this.song.legacyStems ? [0, 1] : [this.guide ? 0 : 1];
    await Promise.all(
      stems.map(async (stem) => {
        if (this.buffers[stem]) return;
        if (!this.loading.has(stem)) {
          const context = this.context!;
          this.download ??= new AbortController();
          const signal = this.download.signal;
          const loading = (async () => {
            const url = stem === 0 ? this.song.mix : this.song.instrumental;
            const response = await fetch(url, { signal });
            if (!response.ok) throw new Error('Не удалось загрузить музыку. Проверь подключение.');
            const buffer = await context.decodeAudioData(await response.arrayBuffer());
            if (!this.disposed) this.buffers[stem] = buffer;
          })().finally(() => {
            this.loading.delete(stem);
          });
          this.loading.set(stem, loading);
        }
        await this.loading.get(stem);
      }),
    );
  }
  get time() {
    return Math.min(
      songDuration(this.mode, this.song),
      this.offset + (this.running ? Math.max(0, this.context!.currentTime - this.anchor) : 0),
    );
  }
  setGuide(value: boolean) {
    this.guide = value;
    if (this.vocalGain) this.vocalGain.gain.value = value ? 0.85 : 0;
    // The sung mix already has accompaniment. Never play two backing tracks.
    if (this.backingGain) this.backingGain.gain.value = this.song.legacyStems || !value ? 0.85 : 0;
  }
  setMuted(value: boolean) {
    this.muted = value;
    if (this.master) this.master.gain.value = value ? 0 : 0.8;
  }
  async play(mode: SingMode, position = this.time) {
    this.pause();
    const generation = ++this.generation;
    await this.unlock();
    await this.load();
    if (this.disposed || generation !== this.generation) return false;
    this.mode = mode;
    this.offset = Math.max(0, Math.min(songDuration(mode, this.song), position));
    this.anchor = this.context!.currentTime + 0.04;
    this.running = true;
    this.setGuide(this.guide);
    this.setMuted(this.muted);
    for (const segment of songSegments(mode, this.song)) {
      const skipped = Math.max(0, this.offset - segment.at);
      if (skipped >= segment.duration) continue;
      for (const stem of this.song.legacyStems ? [0, 1] : [this.guide ? 0 : 1]) {
        if (stem === 0 && !segment.vocal) continue;
        const source = this.context!.createBufferSource();
        source.buffer = this.buffers[stem]!;
        source.connect(stem === 0 ? this.vocalGain! : this.backingGain!);
        const available = Math.min(
          segment.duration - skipped,
          source.buffer.duration - segment.offset - skipped,
        );
        if (available <= 0) continue;
        source.start(
          this.anchor + Math.max(0, segment.at - this.offset),
          segment.offset + skipped,
          available,
        );
        this.sources.push(source);
      }
    }
    return true;
  }
  pause() {
    this.generation++;
    this.offset = this.time;
    this.running = false;
    this.sources.forEach((source) => {
      source.stop();
      source.disconnect();
    });
    this.sources = [];
  }
  seek(position: number, mode = this.mode) {
    this.pause();
    this.mode = mode;
    this.offset = Math.max(0, Math.min(songDuration(mode, this.song), position));
  }
  mouthLevel = () => {
    if (!this.running || !this.guide || !this.analyser) return 0;
    this.analyser.getByteTimeDomainData(this.samples);
    const sum = this.samples.reduce((n, sample) => n + ((sample - 128) / 128) ** 2, 0);
    return Math.min(1, Math.sqrt(sum / this.samples.length) * 5);
  };
  dispose() {
    this.disposed = true;
    this.download?.abort();
    this.pause();
    void this.context?.close();
    this.context = null;
    this.master = null;
    this.vocalGain = null;
    this.backingGain = null;
    this.analyser = null;
    this.buffers = [];
  }
}
