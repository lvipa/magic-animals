import type { SingMode, SongDefinition } from './song';

type EmbeddedPlayer = {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allow: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
};
type YouTubeAPI = {
  Player: new (
    element: HTMLElement,
    options: {
      events: {
        onReady: () => void;
        onStateChange: (event: { data: number }) => void;
        onError: () => void;
        onAutoplayBlocked: () => void;
      };
    },
  ) => EmbeddedPlayer;
};
declare global {
  interface Window {
    YT?: YouTubeAPI;
    onYouTubeIframeAPIReady?: () => void;
  }
}
let apiRequest: Promise<YouTubeAPI> | undefined;
function youtubeAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiRequest)
    apiRequest = new Promise<YouTubeAPI>((resolve, reject) => {
      const tag = document.createElement('script');
      const timeout = window.setTimeout(() => {
        tag.remove();
        apiRequest = undefined;
        reject(new Error('YouTube недоступен'));
      }, 12000);
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        window.clearTimeout(timeout);
        resolve(window.YT!);
      };
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.onerror = () => {
        window.clearTimeout(timeout);
        apiRequest = undefined;
        reject(new Error('YouTube недоступен'));
      };
      document.head.append(tag);
    });
  return apiRequest;
}

/** Official visible embed: original full video, no extraction, overlays or replacement audio. */
export class VideoSongPlayer {
  private embedded?: EmbeddedPlayer;
  private ready?: Promise<void>;
  private listeners = new Set<() => void>();
  private generation = 0;
  private operation = 0;
  private readyTimeout?: number;
  private cancelReady?: () => void;
  private polling?: number;
  private position = 0;
  private finished = false;
  private disposed = false;
  error = '';
  mode: SingMode = 'together';
  guide = true;
  constructor(readonly song: SongDefinition) {}
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private changed() {
    this.listeners.forEach((listener) => listener());
  }
  attach(frame: HTMLIFrameElement) {
    this.dispose();
    this.disposed = false;
    this.error = '';
    const generation = ++this.generation;
    this.ready = youtubeAPI().then(
      (api) =>
        new Promise<void>((resolve, reject) => {
          if (this.disposed || generation !== this.generation) {
            resolve();
            return;
          }
          const current = () => !this.disposed && generation === this.generation;
          this.cancelReady = resolve;
          this.readyTimeout = window.setTimeout(() => {
            if (!current()) return;
            this.error = 'Видео не загрузилось. Проверь доступ к YouTube.';
            this.changed();
            reject(new Error(this.error));
          }, 12000);
          this.embedded = new api.Player(frame, {
            events: {
              onReady: () => {
                if (!current()) return;
                window.clearTimeout(this.readyTimeout);
                this.cancelReady = undefined;
                resolve();
                this.changed();
                // Native iframe controls also seek while paused. Keep the app clock
                // current even when React's playing animation loop is stopped.
                this.polling = window.setInterval(() => {
                  if (current()) this.changed();
                }, 150);
              },
              onStateChange: ({ data }) => {
                if (!current()) return;
                this.finished = data === 0;
                if (data === 1) this.error = '';
                this.changed();
              },
              onError: () => {
                if (!current()) return;
                window.clearTimeout(this.readyTimeout);
                this.error = 'Видео недоступно. Можно открыть источник для взрослых.';
                this.changed();
                reject(new Error(this.error));
              },
              onAutoplayBlocked: () => {
                if (!current()) return;
                this.operation++;
                this.error = 'Нажми ▶ прямо на видео, чтобы начать песню.';
                this.changed();
              },
            },
          });
        }),
    );
    void this.ready.catch(() => {
      /* visible error and source link */
    });
    return this.ready;
  }
  get duration() {
    return Math.min(this.song.duration, this.embedded?.getDuration() || this.song.duration);
  }
  get time() {
    return this.finished
      ? this.duration
      : Math.min(this.duration, this.embedded?.getCurrentTime() ?? this.position);
  }
  get isPlaying() {
    return this.embedded?.getPlayerState() === 1;
  }
  get ended() {
    return this.finished;
  }
  setGuide(_value: boolean) {
    this.guide = true;
  }
  async play(_mode: SingMode, position = this.time) {
    const operation = ++this.operation;
    const generation = this.generation;
    await this.ready;
    if (
      this.disposed ||
      !this.embedded ||
      operation !== this.operation ||
      generation !== this.generation
    )
      return false;
    this.finished = false;
    this.error = '';
    this.embedded.seekTo(position, true);
    this.embedded.playVideo();
    return operation === this.operation;
  }
  pause() {
    this.operation++;
    this.position = this.time;
    this.embedded?.pauseVideo();
  }
  seek(position: number, _mode?: SingMode) {
    this.pause();
    this.finished = false;
    this.position = position;
    this.embedded?.seekTo(position, true);
  }
  mouthLevel = () => (this.isPlaying ? Math.max(0, Math.sin(this.time * 8)) * 0.3 : 0);
  dispose() {
    this.disposed = true;
    this.generation++;
    this.operation++;
    window.clearTimeout(this.readyTimeout);
    window.clearInterval(this.polling);
    this.cancelReady?.();
    this.cancelReady = undefined;
    this.embedded?.destroy();
    this.embedded = undefined;
  }
}
