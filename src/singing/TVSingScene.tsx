import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SingStage } from './SingStage';
import { SingLyrics } from './SingLyrics';
import { getSong, songDuration, songPhase, type SingSnapshot } from './song';
import './sing.css';

/** TV follows the controller clock; song sound stays on the phone in v1. */
export function TVSingScene({ snapshot, now }: { snapshot: SingSnapshot; now: () => number }) {
  const definition = getSong(snapshot.song)!;
  const song = useMemo(
    () =>
      definition.video && snapshot.duration
        ? { ...definition, duration: snapshot.duration }
        : definition,
    [definition, snapshot.duration],
  );
  const [time, setTime] = useState(snapshot.time);
  const current = useRef(snapshot.time);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const t = Math.min(
        songDuration(snapshot.mode, song),
        snapshot.time + (snapshot.playing ? Math.max(0, now() - snapshot.sentAt) / 1000 : 0),
      );
      current.current = t;
      setTime(t);
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [snapshot, now, song]);
  // Gentle performance motion only; no phoneme/voice accuracy is claimed.
  const mouth = useCallback(() => {
    const p = songPhase(current.current, snapshot.mode, song);
    return snapshot.playing && snapshot.guide && !p.turn && !p.celebrating && !p.done && !p.intro
      ? Math.max(0, Math.sin(current.current * Math.PI * 4)) * 0.35
      : 0;
  }, [snapshot, song]);
  const p = songPhase(time, snapshot.mode, song);
  if (song.video && !(snapshot.beat ?? 0))
    return (
      <section className="sing-tv sing-tv-watching" aria-label="Песня на телевизоре">
        <span>{song.icon}</span>
        <h1>{song.title}</h1>
        <p>Подпевайте видео на телефоне.</p>
        <p>Потом нажмите «Повторяем с другом» — он покажет движения здесь!</p>
      </section>
    );
  return (
    <section className="sing-tv" aria-label="Песня на телевизоре">
      <h1>
        {song.video
          ? '🐾 Повторяй за другом!'
          : p.done
            ? '🌟 Спасибо за концерт!'
            : p.turn
              ? '🎤 Your turn!'
              : '🎶 Sing with Milo'}
      </h1>
      <SingStage
        key={song.id}
        song={song}
        time={time}
        mode={snapshot.mode}
        playing={snapshot.playing}
        stars={snapshot.stars}
        mouthLevel={mouth}
        choice={snapshot.choice ?? 0}
        beat={snapshot.beat ?? 0}
      />
      <SingLyrics song={song} time={time} mode={snapshot.mode} choice={snapshot.choice ?? 0} />
    </section>
  );
}
