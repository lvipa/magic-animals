import { useEffect, useRef, useState } from 'react';
import { VideoSongPlayer } from './VideoSongPlayer';
export function OfficialSongVideo({ player }: { player: VideoSongPlayer }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const unsubscribe = player.subscribe(() => setError(player.error));
    void player
      .attach(frame.current!)
      .catch(() => setError(player.error || 'Проверь доступ к YouTube.'));
    return () => {
      unsubscribe();
      player.dispose();
    };
  }, [player]);
  return (
    <section className="sing-official-video" aria-label="Полная официальная песня">
      <iframe
        ref={frame}
        title={`${player.song.title} · Super Simple Songs`}
        src={`https://www.youtube-nocookie.com/embed/${player.song.video}?enablejsapi=1&playsinline=1&rel=0&origin=${encodeURIComponent(location.origin)}`}
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
      {error && (
        <p role="alert">
          {error}{' '}
          <a href={player.song.recording.sourcePage} target="_blank" rel="noreferrer">
            Открыть источник
          </a>
        </p>
      )}
    </section>
  );
}
