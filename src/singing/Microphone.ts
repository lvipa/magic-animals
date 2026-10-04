/** Voice activity only. No recording, speech recognition, or network requests. */
export class Microphone {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private samples = new Float32Array(512);
  private generation = 0;
  async enable() {
    this.stop();
    const generation = ++this.generation;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: false,
    });
    if (generation !== this.generation) {
      stream.getTracks().forEach((track) => track.stop());
      return false;
    }
    this.stream = stream;
    this.context = new AudioContext();
    await this.context.resume();
    if (generation !== this.generation || !this.context) return false;
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 512;
    this.context.createMediaStreamSource(stream).connect(this.analyser);
    return true;
  }
  level() {
    if (!this.analyser) return 0;
    this.analyser.getFloatTimeDomainData(this.samples);
    return Math.min(
      1,
      Math.sqrt(this.samples.reduce((n, x) => n + x * x, 0) / this.samples.length) * 8,
    );
  }
  stop() {
    this.generation++;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.analyser = null;
    void this.context?.close();
    this.context = null;
  }
}
