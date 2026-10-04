import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { KidNav } from '../play/KidNav';
import FullscreenButton from '../components/FullscreenButton';
import { audio } from '../audio/AudioManager';
import { getTVBridge } from '../tv/WebSocketTVBridge';
import { SongPlayer } from './SongPlayer';
import { Microphone } from './Microphone';
import {
  phraseBeginning,
  phraseStarts,
  song,
  songDuration,
  songPhase,
  type SingMode,
  type SingSnapshot,
} from './song';
import { SingLyrics, SingStage } from './SingStage';
import './sing.css';

const modes = [
  { id: 'together', icon: '🎶', label: 'Пой вместе', detail: 'Milo поёт, а ты подпеваешь' },
  { id: 'echo', icon: '🎤', label: 'Повтори', detail: 'Послушай строку и спой сам' },
  { id: 'concert', icon: '🌟', label: 'Мой концерт', detail: 'Твой голос и музыка' },
] as const;
export default function SingPage() {
  const player = useMemo(() => new SongPlayer(), []),
    mic = useMemo(() => new Microphone(), []);
  const bridge = useMemo(() => getTVBridge(), []);
  const connection = useSyncExternalStore(bridge.subscribe, bridge.getStatus);
  const [mode, setMode] = useState<SingMode>('together'),
    [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false),
    [loading, setLoading] = useState(false),
    [guide, setGuide] = useState(true);
  const [stars, setStars] = useState<number[]>([]),
    [micOn, setMicOn] = useState(false),
    [micPending, setMicPending] = useState(false);
  const [level, setLevel] = useState(0),
    [error, setError] = useState(''),
    [micInfo, setMicInfo] = useState('');
  const [adult, setAdult] = useState(false),
    [concerts, setConcerts] = useState(() => {
      try {
        return Number(localStorage.getItem('sing-milo-concerts-v1')) || 0;
      } catch {
        return 0;
      }
    });
  const alive = useRef(true),
    request = useRef(0),
    voiced = useRef(0),
    completed = useRef(false);
  const state = useRef({ mode, time, playing, guide, stars });
  state.current = { mode, time, playing, guide, stars };
  const publish = useCallback(() => {
    const s = state.current;
    bridge.sendEvent('SING_SCENE', {
      song: song.id,
      ...s,
      time: player.time,
      sentAt: bridge.serverTime(),
      active: true,
    } satisfies SingSnapshot);
  }, [bridge, player]);
  const pause = useCallback(() => {
    request.current++;
    player.pause();
    setLoading(false);
    setTime(player.time);
    setPlaying(false);
  }, [player]);
  const addStar = useCallback(
    (line: number) => setStars((s) => (s.includes(line) ? s : [...s, line])),
    [],
  );
  const play = async (position = time, nextMode = mode, withGuide = guide) => {
    if (position === 0) {
      completed.current = false;
      if (songPhase(time, mode).done) setStars([]);
    }
    const id = ++request.current;
    audio.stop();
    setError('');
    setLoading(true);
    try {
      player.setGuide(withGuide);
      if ((await player.play(nextMode, position)) && alive.current && id === request.current) {
        setTime(position);
        setPlaying(true);
      }
    } catch {
      if (alive.current && id === request.current)
        setError('Музыка не загрузилась. Попробуй ещё раз.');
    } finally {
      if (alive.current && id === request.current) setLoading(false);
    }
  };
  useEffect(() => {
    alive.current = true;
    const hidden = () => {
      if (document.hidden) {
        pause();
        mic.stop();
        setMicOn(false);
      }
    };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      alive.current = false;
      document.removeEventListener('visibilitychange', hidden);
      player.dispose();
      mic.stop();
      bridge.sendEvent('SING_SCENE', {
        song: song.id,
        mode: 'together',
        time: 0,
        playing: false,
        guide: true,
        stars: [],
        sentAt: bridge.serverTime(),
        active: false,
      });
    };
  }, [player, mic, pause, bridge]);
  useEffect(() => {
    publish();
    const timer = setInterval(publish, 2000);
    return () => clearInterval(timer);
  }, [publish, mode, playing, guide, stars, connection.state]);
  useEffect(() => {
    if (!playing) return;
    let raf = 0,
      last = 0;
    const tick = (now: number) => {
      const t = player.time,
        phase = songPhase(t, mode);
      if (now - last > 70) {
        setTime(t);
        setLevel(micOn && phase.turn ? mic.level() : 0);
        last = now;
      }
      if (micOn && phase.turn) {
        voiced.current = mic.level() > 0.08 ? voiced.current + 1 : Math.max(0, voiced.current - 1);
        if (voiced.current > 18) addStar(phase.line);
      } else voiced.current = 0;
      if (phase.done) {
        pause();
        setTime(songDuration(mode));
        if (!completed.current) {
          completed.current = true;
          setConcerts((n) => {
            try {
              localStorage.setItem('sing-milo-concerts-v1', String(n + 1));
            } catch {
              /* optional */
            }
            return n + 1;
          });
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, mode, player, mic, micOn, addStar, pause]);
  const phase = songPhase(time, mode);
  const changeMode = (next: SingMode) => {
    pause();
    player.seek(0, next);
    player.setGuide(next !== 'concert');
    setGuide(next !== 'concert');
    setMode(next);
    setTime(0);
    setStars([]);
    completed.current = false;
  };
  const toggleMic = async () => {
    if (micOn) {
      mic.stop();
      setMicOn(false);
      return;
    }
    setMicPending(true);
    setMicInfo('');
    try {
      if ((await mic.enable()) && alive.current) setMicOn(true);
    } catch {
      mic.stop();
      if (alive.current) setMicInfo('Микрофон недоступен. Можно петь без него и нажимать «Спел!»');
    } finally {
      if (alive.current) setMicPending(false);
    }
  };
  return (
    <main className="sing-page">
      <header className="sing-header">
        <Link to="/" aria-label="На главную">
          ←
        </Link>
        <div>
          <small>MAGIC ANIMALS · MUSIC</small>
          <h1>Sing with Milo</h1>
        </div>
        <FullscreenButton />
      </header>
      <div className="sing-heading">
        <div>
          <span>⭐ Песня о маленькой звезде</span>
          <h2>{song.title}</h2>
        </div>
        <span className="sing-earned" aria-label={`${stars.length} звёзд`}>
          ★ {stars.length}/6
        </span>
      </div>
      <div className="sing-mode-picker" role="group" aria-label="Режим пения">
        {modes.map((m) => (
          <button key={m.id} aria-pressed={mode === m.id} onClick={() => changeMode(m.id)}>
            <span>{m.icon}</span>
            {m.label}
            <small>{m.detail}</small>
          </button>
        ))}
      </div>
      <SingStage
        time={time}
        mode={mode}
        playing={playing}
        stars={stars}
        mouthLevel={player.mouthLevel}
        level={level}
        onStar={(line) => {
          if (playing && line === phase.line) addStar(line);
        }}
      />
      <div className="sing-status" role="status">
        {loading
          ? '🎵 Готовим песенку…'
          : phase.done
            ? '🎉 Спасибо за твой концерт!'
            : !playing
              ? time > 0
                ? '⏸ Продолжим, когда будешь готов'
                : '🎶 Нажми «Петь», и начнём!'
              : phase.turn
                ? '🎤 Теперь твоя очередь!'
                : mode === 'concert'
                  ? '🌟 Сцена твоя!'
                  : phase.celebrating
                    ? '✨ Молодец, что попробовал!'
                    : '🎶 Подпевай Milo!'}
      </div>
      <SingLyrics time={time} mode={mode} />
      <progress
        className="sing-progress"
        aria-label="Ход песни"
        value={time}
        max={songDuration(mode)}
      />
      <div className="sing-controls">
        <button
          className="sing-primary"
          disabled={loading}
          onClick={() => (playing ? pause() : void play(phase.done ? 0 : time))}
        >
          {playing
            ? '⏸ Пауза'
            : loading
              ? '🎵 Загрузка…'
              : phase.done
                ? '🎶 Ещё концерт!'
                : time > 0
                  ? '▶ Продолжить'
                  : '▶ Петь!'}
        </button>
        <button
          disabled={loading}
          onClick={() => {
            completed.current = false;
            void play(phraseBeginning(time, mode));
          }}
        >
          ↻ Ещё строку
        </button>
        <button
          disabled={!playing || (!phase.turn && mode === 'echo')}
          onClick={() => addStar(phase.line)}
        >
          ⭐ Спел!
        </button>
      </div>
      {phase.done && (
        <section className="sing-finish">
          <span>🌟</span>
          <h2>Твоя звёздная сцена!</h2>
          <p>Мы спели песню о звезде. Тапни звёздочку — вспомни слово.</p>
          <div>
            {song.lines.map((line, i) => (
              <button
                key={i}
                onClick={() => {
                  changeMode('together');
                  void play(phraseStarts[i], 'together', true);
                }}
              >
                {line.icon} {line.key}
              </button>
            ))}
          </div>
        </section>
      )}
      {error && (
        <p role="alert">
          {error} <button onClick={() => void play()}>Повторить загрузку</button>
        </p>
      )}
      <div className="sing-footer">
        <span>🎟 Концертов: {concerts}</span>
        <Link to="/connect-tv">📺 Подключить TV</Link>
        <button
          onClick={() => {
            pause();
            player.seek(0, mode);
            setTime(0);
            setStars([]);
            completed.current = false;
          }}
        >
          ↺ Сначала
        </button>
        <button aria-expanded={adult} onClick={() => setAdult(!adult)}>
          ⚙ Для взрослых
        </button>
      </div>
      {adult && (
        <section className="sing-adult">
          <h2>Звук и микрофон</h2>
          <label>
            <input
              type="checkbox"
              checked={guide}
              onChange={(e) => {
                setGuide(e.target.checked);
                player.setGuide(e.target.checked);
              }}
            />{' '}
            Голос подсказки
          </label>
          <button disabled={micPending} onClick={() => void toggleMic()}>
            {micPending
              ? 'Разрешаем микрофон…'
              : micOn
                ? '🎤 Выключить микрофон'
                : '🎤 Включить микрофон'}
          </button>
          <p>
            Микрофон реагирует на звук в режиме «Повтори», когда музыка молчит. Он не проверяет
            слова или ноты. Запись не сохраняется и не отправляется. Без микрофона нажимай «Спел!».
          </p>
          {micInfo && <p role="status">{micInfo}</p>}
          <p>
            {connection.state === 'ready'
              ? 'TV подключён: слова и Milo появятся на большом экране. Звук этой песенки идёт с телефона.'
              : 'На телевизоре открой /tv, подключи телефон по QR или коду, затем вернись сюда.'}
          </p>
          <details>
            <summary>Запись и авторы песни</summary>
            <p>
              Используется живое пение Derrick Coetzee (CC0) с сохранёнными тембром, дыханием и
              интонацией. Jane Taylor — слова; традиционная французская мелодия; новое сопровождение
              — Magic Animals.
            </p>
            <a
              href="https://commons.wikimedia.org/wiki/File:Twinkle_Twinkle_Little_Star_-_sung_with_full_lyrics.ogg"
              target="_blank"
              rel="noreferrer"
            >
              Источник вокала
            </a>{' '}
            ·{' '}
            <a
              href="https://creativecommons.org/publicdomain/zero/1.0/"
              target="_blank"
              rel="noreferrer"
            >
              CC0 1.0
            </a>
            <p>
              <a href="/music/twinkle-v2-natural/credits.json">Подробные сведения об обработке</a>
            </p>
          </details>
        </section>
      )}
      <KidNav />
    </main>
  );
}
