import { song, songDuration, songSegments, type SingMode } from './song';

/** Both stems and karaoke use one AudioContext clock, including pause/seek. */
export class SongPlayer {
  private context: AudioContext | null = null;
  private buffers: AudioBuffer[] = [];
  private loading: Promise<void> | null = null;
  private sources: AudioBufferSourceNode[] = [];
  private vocalGain: GainNode | null = null;
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
  unlock() {
    this.disposed = false;
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(this.context.destination);
      this.vocalGain = this.context.createGain();
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 256;
      this.vocalGain.connect(this.analyser);
      this.analyser.connect(this.master);
    }
    return this.context.resume();
  }
  async load() {
    if (this.buffers.length === 2) return;
    if (!this.loading) {
      this.loading = Promise.all(
        [song.vocal, song.instrumental].map(async (url) => {
          const response = await fetch(url);
          if (!response.ok) throw new Error('Не удалось загрузить музыку. Проверь подключение.');
          return this.context!.decodeAudioData(await response.arrayBuffer());
        }),
      )
        .then((buffers) => {
          if (!this.disposed) this.buffers = buffers;
        })
        .finally(() => {
          this.loading = null;
        });
    }
    await this.loading;
  }
  get time() {
    return Math.min(
      songDuration(this.mode),
      this.offset + (this.running ? Math.max(0, this.context!.currentTime - this.anchor) : 0),
    );
  }
  setGuide(value: boolean) {
    this.guide = value;
    if (this.vocalGain) this.vocalGain.gain.value = value ? 0.85 : 0;
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
    this.offset = Math.max(0, Math.min(songDuration(mode), position));
    this.anchor = this.context!.currentTime + 0.04;
    this.running = true;
    this.setGuide(this.guide);
    this.setMuted(this.muted);
    for (const segment of songSegments(mode)) {
      const skipped = Math.max(0, this.offset - segment.at);
      if (skipped >= segment.duration) continue;
      for (const stem of [0, 1]) {
        if (stem === 0 && !segment.vocal) continue;
        const source = this.context!.createBufferSource();
        source.buffer = this.buffers[stem];
        source.connect(stem === 0 ? this.vocalGain! : this.master!);
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
    this.offset = Math.max(0, Math.min(songDuration(mode), position));
  }
  mouthLevel = () => {
    if (!this.running || !this.guide || !this.analyser) return 0;
    this.analyser.getByteTimeDomainData(this.samples);
    const sum = this.samples.reduce((n, sample) => n + ((sample - 128) / 128) ** 2, 0);
    return Math.min(1, Math.sqrt(sum / this.samples.length) * 5);
  };
  dispose() {
    this.disposed = true;
    this.pause();
    void this.context?.close();
    this.context = null;
    this.master = null;
    this.vocalGain = null;
    this.analyser = null;
  }
}
