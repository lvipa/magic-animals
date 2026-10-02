import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { audio } from '../audio/AudioManager';
import { animals, animalById } from '../config/animals';
import { GameEngine, initialScene } from './GameEngine';
import { requestedAnimal, starCount } from './machine';
import { useGame } from '../storage/store';
import { useRuntime } from '../tracking/runtime';
import { ParentGate } from '../components/ParentGate';
import { CameraFeed } from '../components/CameraFeed';
import { ARStage } from '../components/ARStage';
import { GameScene } from '../scenes/GameScene';
import { DebugOverlay } from '../components/DebugOverlay';
import { getTVBridge } from '../tv/WebSocketTVBridge';
import { KidNav } from '../play/KidNav';
import { HuntPanel } from '../play/HuntPanel';
import { WorldBackdrop } from '../play/WorldBackdrop';
import { useAdventure } from '../play/adventure';
import { learningActions } from '../play/lessons';
export default function Game({ hunt = false }: { hunt?: boolean }) {
  const world = useAdventure((s) => s.world);
  const roundFound = useAdventure((s) => s.found);
  const blockedCard = useRef<import('../config/animals').AnimalId | null>(null);
  const state = useGame((s) => s.state),
    mode = useGame((s) => s.mode),
    send = useGame((s) => s.send),
    setMode = useGame((s) => s.setMode),
    parent = useGame((s) => s.parent),
    debug = useGame((s) => s.debug),
    available = useGame((s) => s.available);
  const [scene, setScene] = useState(initialScene),
    [cameraChoice, setCameraChoice] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    if (hunt) {
      audio.unlockAudio();
      send({ type: 'FREE_PLAY' });
    }
  }, [hunt, send]);
  const engine = useMemo(
    () =>
      new GameEngine({
        getState: () => useGame.getState().state,
        send,
        audio: {
          say: (cue) => {
            if (getTVBridge().shouldSpeakOnTV()) audio.stop();
            else audio.say(cue);
          },
          stop: () => audio.stop(),
          duration: (cue) => audio.duration(cue),
        },
        show: setScene,
        tv: getTVBridge(),
      }),
    [send],
  );
  useEffect(() => {
    engine.enter(state);
    return () => engine.cancel();
  }, [engine, state]);
  useEffect(() => () => engine.dispose(), [engine]);
  useEffect(() => {
    const forced = useGame.getState().forcedAnimal;
    if (forced) {
      engine.targetFound(forced);
      useGame.getState().forceAnimal(null);
    }
  }, [engine]);
  useEffect(() => {
    const change = () => {
      if (document.hidden) engine.pause();
      else engine.enter(useGame.getState().state);
    };
    document.addEventListener('visibilitychange', change);
    return () => document.removeEventListener('visibilitychange', change);
  }, [engine]);
  const cameraError = useCallback(
    (error: unknown) => {
      const name = error instanceof DOMException ? error.name : '';
      if (['NotAllowedError', 'NotFoundError', 'SecurityError'].includes(name)) {
        setMode('3D_MODE');
        setCameraChoice(true);
      } else setMode('CAMERA_MODE');
      engine.attachAR(null);
    },
    [engine, setMode],
  );
  const feedError = useCallback(() => {
    setMode('3D_MODE');
    setCameraChoice(useGame.getState().state === 'CAMERA_PERMISSION');
  }, [setMode]);
  const visible = useRuntime((s) => s.visible);
  useEffect(() => {
    if (mode !== 'AR_MODE') blockedCard.current = null;
    if (!visible) {
      // Ignore brief tracking dropouts while the same card is still held up.
      const timer = window.setTimeout(() => {
        blockedCard.current = null;
      }, 600);
      return () => window.clearTimeout(timer);
    }
  }, [visible, mode]);
  const foundCount = hunt ? roundFound.length : available.length;
  const step = requestedAnimal(state),
    welcome = state === 'WELCOME',
    active = !welcome;
  const start = () => {
    audio.unlockAudio();
    audio.setVolume(useGame.getState().volume);
    setCameraChoice(false);
    send({ type: 'PLAY' });
    if (mode !== 'AR_MODE') send({ type: 'CAMERA_READY' });
  };
  const ready = () => {
    if (useGame.getState().state === 'CAMERA_PERMISSION') send({ type: 'CAMERA_READY' });
  };
  const scanAnyCard = () => {
    audio.unlockAudio();
    audio.setVolume(useGame.getState().volume);
    setCameraChoice(false);
    send({ type: 'FREE_PLAY' });
  };
  const foundCard = (id: import('../config/animals').AnimalId) => {
    if (hunt && mode === 'AR_MODE' && blockedCard.current === id) return;
    blockedCard.current = null;
    if (hunt) {
      const adventure = useAdventure.getState();
      if (!adventure.found.includes(id)) adventure.collect(id);
    }
    engine.targetFound(id);
  };
  const interact = (id: import('../config/animals').AnimalId) => {
    if (hunt && scene.animal === id) {
      audio.unlockAudio();
      engine.demonstrate(learningActions[Math.floor(Math.random() * learningActions.length)]);
    } else engine.interact(id);
  };
  const playAgain = () => {
    engine.attachAR(null);
    send({ type: 'RESET' });
    setMode('AR_MODE');
    setCameraChoice(false);
  };
  useEffect(() => {
    if (active && mode === 'CAMERA_MODE' && state === 'CAMERA_PERMISSION')
      send({ type: 'CAMERA_READY' });
  }, [active, mode, state, send]);
  return (
    <main
      className={`game mode-${mode} ${hunt ? 'hunt-game' : ''} ${welcome ? 'welcome-game' : ''}`}
    >
      {mode === '3D_MODE' && <WorldBackdrop world={world} />}
      <div className="sky-glow" />
      {active && mode === 'AR_MODE' && (
        <ARStage
          onFound={foundCard}
          onTap={interact}
          onFailure={cameraError}
          onReady={(provider) => {
            engine.attachAR(provider);
            ready();
          }}
        />
      )}
      {active && mode === 'CAMERA_MODE' && <CameraFeed onError={feedError} />}
      <GameScene scene={scene} welcome={welcome || cameraChoice} mode={mode} onTap={interact} />
      <div className="game-ui">
        <div className="brand">
          MAGIC <strong>ANIMALS</strong>
          <small>A LITTLE PAPER MAGIC</small>
        </div>
        {welcome ? (
          <div className="welcome">
            <div className="welcome-copy">
              <span className="eyebrow">HELLO, LITTLE EXPLORER</span>
              <h1>
                Paper cards.
                <br />
                <em>Real magic.</em>
              </h1>
              <p>Найди всю команду и учись вместе с друзьями!</p>
              <button
                className="welcome-free kid-hunt-start"
                onClick={() => {
                  audio.unlockAudio();
                  navigate('/hunt');
                  audio.say('hunt-start');
                }}
              >
                🔎 НАЙТИ 8 ДРУЗЕЙ
              </button>
              <button className="welcome-free" onClick={() => navigate('/connect-tv')}>
                Connect TV · QR / code
              </button>
              <button aria-label="PLAY" className="play-button" onClick={start}>
                PLAY <span aria-hidden="true">▶</span>
              </button>
              <button className="welcome-free scan-any-card" onClick={scanAnyCard}>
                SCAN ANY CARD · 8 friends
              </button>
              <a
                className="welcome-free"
                href="/printables/cards.html"
                target="_blank"
                rel="noreferrer"
              >
                Print 8 cards
              </a>
            </div>
            <div className="paper-friends">
              {animals.slice(0, 3).map((a) => (
                <img key={a.id} src={a.thumbnail} alt="" />
              ))}
            </div>
            <div className="welcome-bottom">
              <span>✦ CAT</span>
              <span>✦ DOG</span>
              <span>✦ BABY LION</span>
            </div>
          </div>
        ) : cameraChoice ? (
          <div className="camera-choice">
            <h2>Foxy is ready to play!</h2>
            <button
              className="large-button"
              onClick={() => {
                setCameraChoice(false);
                ready();
              }}
            >
              PLAY WITHOUT CAMERA
            </button>
          </div>
        ) : (
          <>
            <div className="hud">
              <div
                className="stars"
                aria-label={
                  state === 'FREE_PLAY'
                    ? `${foundCount} of 8 friends found`
                    : `${starCount(state)} of 3 friends found`
                }
              >
                {state === 'FREE_PLAY'
                  ? `${foundCount} / 8`
                  : [0, 1, 2].map((i) => <span key={i}>{i < starCount(state) ? '★' : '☆'}</span>)}
              </div>
              {step && <img className="animal-badge" src={animalById[step].thumbnail} alt={step} />}
            </div>
            {state === 'CAMERA_PERMISSION' ? (
              <div className="loading-magic">
                ✦<p>Waking up the magic…</p>
              </div>
            ) : (
              <div className="speech">
                <div className="foxy-chip">Foxy says</div>
                <div>{scene.caption}</div>
                <small>
                  {scene.effects
                    ? '✦ ✨ ✦'
                    : state.endsWith('_PLAY')
                      ? 'Tap your new friend'
                      : step
                        ? 'Show the paper card'
                        : ''}
                </small>
              </div>
            )}
            {mode !== 'AR_MODE' && !cameraChoice && state !== 'COMPLETE' && state !== 'FINALE' && (
              <div className="fallback-controls">
                <p>{mode === 'CAMERA_MODE' ? 'Tap a friend to place it' : 'Choose a friend'}</p>
                {animals.map((a) => (
                  <button
                    key={a.id}
                    aria-label={`Play with ${a.word}`}
                    onClick={() => foundCard(a.id)}
                  >
                    <img src={a.thumbnail} alt="" />
                    {a.word}
                  </button>
                ))}
              </div>
            )}
            {state === 'COMPLETE' && (
              <div className="complete">
                <h2>Friends forever! ✨</h2>
                <button className="large-button" onClick={playAgain}>
                  PLAY AGAIN
                </button>
                <button
                  className="large-button secondary"
                  onClick={() => send({ type: 'FREE_PLAY' })}
                >
                  FREE PLAY
                </button>
                <button className="large-button secondary" onClick={() => navigate('/friends')}>
                  MORE FRIENDS 🐰
                </button>
              </div>
            )}
            {state === 'FREE_PLAY' && !hunt && (
              <div className="free-note">
                {mode === 'AR_MODE' ? 'Scan any of the 8 cards' : 'Tap any friend'} ✨
              </div>
            )}
            {mode !== 'AR_MODE' && (
              <div className="mode-label">{mode === 'CAMERA_MODE' ? 'Camera play' : '3D play'}</div>
            )}
            {debug && parent && <DebugOverlay />}
          </>
        )}
      </div>
      {hunt && (
        <>
          <div className="hunt-mode-controls gallery-controls">
            <button
              aria-pressed={mode === 'AR_MODE'}
              onClick={() => {
                setCameraChoice(false);
                setMode('AR_MODE');
              }}
            >
              📷 Карточки
            </button>
            <button
              aria-pressed={mode === '3D_MODE'}
              onClick={() => {
                setCameraChoice(false);
                setMode('3D_MODE');
              }}
            >
              🐾 Без камеры
            </button>
            <a
              href="/printables/cards.html"
              target="_blank"
              rel="noreferrer"
              aria-label="Распечатать карточки"
            >
              🖨
            </a>
          </div>
          <HuntPanel
            active={scene.animal}
            demonstrate={(action) => engine.demonstrate(action)}
            resetScene={() => {
              const tracking = useRuntime.getState();
              blockedCard.current = mode === 'AR_MODE' && tracking.visible ? tracking.target : null;
              engine.restartSearch();
            }}
          />
        </>
      )}
      <KidNav />
      <ParentGate />
      {parent && (
        <button className="parent-link" onClick={() => navigate('/parent')}>
          ⚙ Parent
        </button>
      )}
      {visible && step && (
        <div className="target-heart" aria-hidden="true">
          ✦
        </div>
      )}
    </main>
  );
}
