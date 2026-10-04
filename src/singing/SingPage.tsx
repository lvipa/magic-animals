import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { KidNav } from '../play/KidNav';
import FullscreenButton from '../components/FullscreenButton';
import { audio } from '../audio/AudioManager';
import { getTVBridge } from '../tv/WebSocketTVBridge';
import { SongPlayer } from './SongPlayer';
import { Microphone } from './Microphone';
import { VideoSongPlayer } from './VideoSongPlayer';
import { OfficialSongVideo } from './OfficialSongVideo';
import { MusicActivity } from './MusicActivity';
import { activityOptions, automaticActivityChoice, farmFriends } from './activities';
import { loadCues, markedChoice, saveCues, type ActivityCue } from './VideoTiming';
import {
  phraseBeginning,
  song as defaultSong,
  songs,
  songPhase,
  type SingMode,
  type SingSnapshot,
} from './song';
import { SingLyrics, SingStage } from './SingStage';
import './sing.css';

const modes = [
  { id: 'together', icon: '🎶', label: 'Пой вместе', detail: 'Milo поёт, а ты подпеваешь' },
  { id: 'echo', icon: '🎤', label: 'Повтори', detail: 'Послушай строку и спой сам' },
  { id: 'concert', icon: '🌟', label: 'Без вокала', detail: 'Поёшь сам под музыку' },
] as const;
export default function SingPage() {
  const [song, setSong] = useState(defaultSong);
  const [picker, setPicker] = useState(true);
  const [choice, setChoice] = useState(0),
    [beat, setBeat] = useState(0);
  const player = useMemo(
      () => (song.video ? new VideoSongPlayer(song) : new SongPlayer(song)),
      [song],
    ),
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
  const [offlineSaving, setOfflineSaving] = useState(false);
  const [offlineInfo, setOfflineInfo] = useState('');
  const [cues, setCues] = useState<ActivityCue[]>(() => loadCues(defaultSong));
  const [marking, setMarking] = useState(false);
  const [timingInfo, setTimingInfo] = useState('');
  const alive = useRef(true),
    request = useRef(0),
    voiced = useRef(0),
    completed = useRef(false);
  const state = useRef({ mode, time, playing, guide, stars, choice, beat });
  state.current = { mode, time, playing, guide, stars, choice, beat };
  const publish = useCallback(() => {
    const s = state.current;
    bridge.sendEvent('SING_SCENE', {
      song: song.id,
      ...s,
      time: player.time,
      sentAt: bridge.serverTime(),
      active: true,
      ...(song.video ? { duration: player.duration } : {}),
    } satisfies SingSnapshot);
  }, [bridge, player, song]);
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
      if (songPhase(time, mode, song).done) setStars([]);
    }
    const id = ++request.current;
    audio.stop();
    setError('');
    setLoading(true);
    try {
      player.setGuide(withGuide);
      if ((await player.play(nextMode, position)) && alive.current && id === request.current) {
        setTime(position);
        if (!(player instanceof VideoSongPlayer)) setPlaying(true);
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
  }, [player, mic, pause, bridge, song]);
  useEffect(() => {
    if (!(player instanceof VideoSongPlayer)) return;
    return player.subscribe(() => {
      setPlaying(player.isPlaying);
      setTime(player.time);
      setError(player.error);
      if (!player.ended && player.time < player.duration - 1) completed.current = false;
      if (player.ended && !completed.current) {
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
    });
  }, [player]);
  useEffect(() => {
    publish();
    const timer = setInterval(publish, 2000);
    return () => clearInterval(timer);
  }, [publish, mode, playing, guide, stars, connection.state, choice, beat]);
  useEffect(() => {
    if (!playing) return;
    let raf = 0,
      last = 0;
    const tick = (now: number) => {
      const t = player.time,
        phase = songPhase(t, mode, song.video ? { ...song, duration: player.duration } : song);
      if (now - last > 70) {
        setTime(t);
        setLevel(micOn && phase.turn ? mic.level() : 0);
        last = now;
      }
      if (micOn && phase.turn) {
        voiced.current = mic.level() > 0.08 ? voiced.current + 1 : Math.max(0, voiced.current - 1);
        if (voiced.current > 18) addStar(phase.line);
      } else voiced.current = 0;
      if (phase.done || player.ended) {
        pause();
        setTime(player.duration);
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
  }, [playing, mode, player, mic, micOn, addStar, pause, song]);
  const displayedSong = song.video ? { ...song, duration: player.duration } : song;
  const phase = songPhase(time, mode, displayedSong);
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
  const chooseSong = (s: typeof song) => {
    pause();
    mic.stop();
    setMicOn(false);
    setSong(s);
    setTime(0);
    setMode('together');
    setGuide(true);
    setStars([]);
    setChoice(0);
    setBeat(0);
    setError('');
    setPicker(false);
    setCues(loadCues(s));
    setMarking(false);
    setTimingInfo('');
    completed.current = false;
    window.scrollTo({ top: 0 });
  };
  const chooseActivity = (index: number) => {
    setChoice(index);
    setBeat((n) => Math.min(100000, n + 1));
    addStar(Math.min(index, song.lines.length - 1));
    if (marking) {
      const at = Math.round(player.time * 100) / 100;
      setCues((previous) =>
        [...previous.filter((cue) => Math.abs(cue.time - at) > 0.15), { time: at, choice: index }]
          .sort((a, b) => a.time - b.time)
          .slice(0, 1000),
      );
      return;
    }
    if (song.video) {
      const at =
        cues.find((cue) => cue.choice === index)?.time ??
        (song.activity === 'farm' ? farmFriends[index].at : song.lines[index].start);
      completed.current = false;
      if (playing) void play(at);
      else {
        player.seek(at, mode);
        setTime(at);
      }
    }
  };
  useEffect(() => {
    if (!song.video || marking) return;
    const options = activityOptions(song);
    if (options.length)
      setChoice(
        cues.length ? markedChoice(cues, time, 0) : automaticActivityChoice(song, time, phase.line),
      );
  }, [song, playing, phase.line, time, cues, marking]);
  const restart = () => {
    pause();
    player.seek(0, mode);
    setTime(0);
    setStars([]);
    setChoice(0);
    setBeat(0);
    completed.current = false;
    void play(0);
  };
  const saveAudio = async () => {
    setOfflineSaving(true);
    setOfflineInfo('Сохраняем Twinkle и ABC…');
    try {
      const cache = await caches.open('milo-music-full-v4');
      for (const s of songs.filter((s) => !s.video))
        for (const url of [s.mix, s.instrumental]) {
          if (await cache.match(url)) continue;
          const response = await fetch(url);
          if (!response.ok || !response.headers.get('content-type')?.startsWith('audio/'))
            throw new Error('Download failed');
          await cache.put(url, response);
        }
      setOfflineInfo('Twinkle и ABC сохранены. Они работают без YouTube после установки PWA.');
    } catch {
      setOfflineInfo('Не удалось сохранить всё. Проверь интернет и свободное место.');
    } finally {
      setOfflineSaving(false);
    }
  };
  return (
    <main className={`sing-page ${song.video && !picker ? 'sing-video-page' : ''}`}>
      <header className="sing-header">
        {picker ? (
          <Link to="/" aria-label="На главную">
            🏠
          </Link>
        ) : (
          <button
            aria-label="Выбрать другую песенку"
            onClick={() => {
              pause();
              mic.stop();
              setMicOn(false);
              setPicker(true);
            }}
          >
            ← 🎵
          </button>
        )}
        <div>
          <small>MAGIC ANIMALS · MUSIC</small>
          <h1>Sing with Milo</h1>
        </div>
        <FullscreenButton compact />
      </header>
      {picker ? (
        <>
          <h2 className="sing-library-title">Что будем петь? 🎶</h2>
          <div className="sing-song-picker" role="group" aria-label="Выбери песенку">
            {songs.map((s) => (
              <button key={s.id} aria-pressed={song.id === s.id} onClick={() => chooseSong(s)}>
                <span>{s.icon}</span>
                <strong>
                  {s.title === 'Twinkle, Twinkle, Little Star' ? 'Twinkle Star' : s.title}
                </strong>
                <small>{s.label}</small>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="sing-heading">
            <div>
              <span>
                {song.icon} {song.label}
              </span>
              <h2>{song.title}</h2>
            </div>
            <span className="sing-earned" aria-label={`${stars.length} звёзд`}>
              ★ {stars.length}/{song.lines.length}
            </span>
          </div>
          {!guide && (
            <div className="sing-vocal-status">
              🎼 Поёшь ты <button onClick={() => changeMode('together')}>🎙️ Вернуть пение</button>
            </div>
          )}
          {player instanceof VideoSongPlayer && (
            <OfficialSongVideo
              key={`video-${song.id}`}
              player={player}
              onAudio={() => chooseSong(defaultSong)}
            />
          )}
          <SingStage
            key={`stage-${song.id}`}
            song={displayedSong}
            time={time}
            mode={mode}
            playing={playing}
            stars={stars}
            mouthLevel={player.mouthLevel}
            level={level}
            choice={choice}
            beat={beat}
            onStar={(line) => {
              if (playing && !phase.intro && !phase.done && line === phase.line) addStar(line);
            }}
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
            <button aria-label="Сначала" onClick={restart}>
              ↺
            </button>
            {!song.video && (
              <button
                aria-label="Ещё строку"
                disabled={loading}
                onClick={() => {
                  completed.current = false;
                  void play(phraseBeginning(time, mode, song));
                }}
              >
                ↻
              </button>
            )}
          </div>
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
          <MusicActivity song={song} choice={choice} onChoose={chooseActivity} />
          <SingLyrics song={displayedSong} time={time} mode={mode} choice={choice} />
          <progress
            className="sing-progress"
            aria-label="Ход песни"
            value={time}
            max={player.duration}
          />
          {!song.video && (
            <div className="sing-participation">
              <button
                disabled={!playing || phase.intro || phase.done || (!phase.turn && mode === 'echo')}
                onClick={() => addStar(phase.line)}
              >
                ⭐ Спел!
              </button>
            </div>
          )}
          {phase.done && (
            <section className="sing-finish">
              <span>🌟</span>
              <h2>Твоя звёздная сцена!</h2>
              <p>Мы спели {song.title}! Выбери картинку — повтори строку.</p>
              {!song.video && (
                <div>
                  {song.lines.map((line, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        changeMode('together');
                        void play(song.lines[i].start, 'together', true);
                      }}
                    >
                      {line.icon} {line.key}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => {
                  pause();
                  setPicker(true);
                }}
              >
                🎵 Другая песенка
              </button>
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
            <button aria-expanded={adult} onClick={() => setAdult(!adult)}>
              ⚙ Для взрослых
            </button>
          </div>
          {adult && (
            <section className="sing-adult">
              <h2>Звук и микрофон</h2>
              <button disabled={offlineSaving} onClick={() => void saveAudio()}>
                {offlineSaving ? 'Сохраняем…' : '⬇ Сохранить Twinkle и ABC заранее'}
              </button>
              {offlineInfo && <p role="status">{offlineInfo}</p>}
              {!song.video && (
                <div className="sing-mode-picker" role="group" aria-label="Режим пения">
                  {modes.map((m) => (
                    <button
                      key={m.id}
                      aria-pressed={mode === m.id}
                      onClick={() => changeMode(m.id)}
                    >
                      <span>{m.icon}</span>
                      {m.label}
                      <small>{m.detail}</small>
                    </button>
                  ))}
                </div>
              )}
              {song.video ? (
                <>
                  <p>
                    Полное официальное видео Super Simple Songs. Требуется YouTube; его реклама и
                    доступность управляются платформой. Игровые подсказки приблизительные. Режимы
                    «Повтори» и «Без вокала» доступны у аудиопесен.
                  </p>
                  <details className="sing-timing-tools">
                    <summary>Подстроить движения под это исполнение</summary>
                    <p>
                      Для точной разметки нажми «Начать разметку», запусти видео и нажимай картинки
                      в момент нужных слов. Можно отметить повторяющиеся движения по всей песне.
                      Затем сохрани: метки останутся на этом устройстве и будут работать при
                      повторах и перемотке.
                    </p>
                    <button
                      onClick={() => {
                        pause();
                        player.seek(0);
                        setTime(0);
                        setCues([]);
                        setMarking(true);
                        setTimingInfo('Разметка включена. Запусти видео и отмечай движения.');
                      }}
                    >
                      Начать разметку
                    </button>
                    {marking && (
                      <button
                        disabled={!cues.length}
                        onClick={() => {
                          try {
                            saveCues(song, cues);
                            setMarking(false);
                            setTimingInfo('Метки сохранены. Движения следуют времени видео.');
                          } catch {
                            setTimingInfo('Не удалось сохранить метки на устройстве.');
                          }
                        }}
                      >
                        Сохранить метки ({cues.length})
                      </button>
                    )}
                    {!!cues.length && !marking && (
                      <button
                        onClick={() => {
                          try {
                            saveCues(song, []);
                            setCues([]);
                            setTimingInfo('Восстановлены исходные подсказки.');
                          } catch {
                            setTimingInfo('Не удалось сбросить метки.');
                          }
                        }}
                      >
                        Сбросить метки
                      </button>
                    )}
                    {timingInfo && <p role="status">{timingInfo}</p>}
                  </details>
                </>
              ) : (
                <>
                  <label>
                    <input
                      type="checkbox"
                      checked={guide}
                      onChange={(e) => {
                        changeMode(e.target.checked ? 'together' : 'concert');
                      }}
                    />{' '}
                    Певческий вокал (смена режима начинает песню сначала)
                  </label>
                  <button disabled={micPending} onClick={() => void toggleMic()}>
                    {micPending
                      ? 'Разрешаем микрофон…'
                      : micOn
                        ? '🎤 Выключить микрофон'
                        : '🎤 Включить микрофон'}
                  </button>
                  <p>
                    Микрофон реагирует на звук в режиме «Повтори», когда музыка молчит. Он не
                    проверяет слова или ноты. Запись не сохраняется и не отправляется. Без микрофона
                    нажимай «Спел!».
                  </p>
                  {micInfo && <p role="status">{micInfo}</p>}
                </>
              )}
              <p>
                {connection.state === 'ready'
                  ? 'TV подключён: слова и Milo появятся на большом экране. Звук этой песенки идёт с телефона.'
                  : 'На телевизоре открой /tv, подключи телефон по QR или коду, затем вернись сюда.'}
              </p>
              <details>
                <summary>Запись и авторы песни</summary>
                <p>
                  Запись: {song.recording.author}. Поём под оригинальный аккомпанемент этой записи.
                  {!song.video &&
                    'Режим «Без вокала» использует отдельное инструментальное исполнение того же музыканта.'}
                </p>
                <a href={song.recording.sourcePage} target="_blank" rel="noreferrer">
                  Источник вокала
                </a>{' '}
                ·{' '}
                <a href={song.recording.licenseURL} target="_blank" rel="noreferrer">
                  {song.recording.license}
                </a>
                <p>
                  {!song.video && (
                    <a href={song.mix.replace('mix.mp3', 'credits.json')}>Запись и источники</a>
                  )}
                  {' · '}
                  <a
                    href="https://kolibelnie-pesni.com/media/twinkle-twinkle-little-star"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Пример, выбранный родителем
                  </a>
                </p>
              </details>
            </section>
          )}
        </>
      )}
      <KidNav inFlow={Boolean(song.video && !picker)} />
    </main>
  );
}
