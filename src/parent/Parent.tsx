import { Link, useNavigate } from 'react-router-dom';
import { useGame, type Mode, type Quality } from '../storage/store';
import { audio } from '../audio/AudioManager';
import { animals } from '../config/animals';
import { useRuntime } from '../tracking/runtime';
export default function Parent() {
  const s = useGame(),
    r = useRuntime(),
    navigate = useNavigate();
  return (
    <main className="parent-page">
      <Link to="/">← Back to game</Link>
      <h1>Parent Mode</h1>
      <p>Eight paper friends. Scan any card, or play Foxy's three-chapter adventure.</p>
      <div className="parent-grid">
        <Link to="/camera-test">Camera test</Link>
        <Link to="/marker-test">Marker test</Link>
        <Link to="/characters">Meet the characters</Link>
        <Link to="/parent/tv">Connect TV</Link>
        <Link to="/parent/audio">Listen to Foxy</Link>
        <Link to="/install">Install help</Link>
        <Link to="/offline-status">Offline status</Link>
        <a href="/printables/cards.html" target="_blank" rel="noreferrer">
          Print cards
        </a>
        <button
          onClick={() => {
            audio.unlockAudio();
            audio.setVolume(s.volume);
            audio.say('hello');
          }}
        >
          Audio test
        </button>
        <button onClick={() => s.setDebug(!s.debug)}>Debug: {s.debug ? 'ON' : 'OFF'}</button>
        <button
          onClick={() => {
            s.send({ type: 'SKIP' });
            navigate('/');
          }}
        >
          Skip current step
        </button>
        <button
          onClick={() => {
            s.send({ type: 'FREE_PLAY' });
            navigate('/');
          }}
        >
          Free play
        </button>
        <button
          onClick={() => {
            s.send({ type: 'RESET' });
            navigate('/');
          }}
        >
          Reset game
        </button>
        {animals.map((a) => (
          <button
            key={a.id}
            onClick={() => {
              audio.unlockAudio();
              s.send({ type: 'FREE_PLAY' });
              if (s.mode === 'AR_MODE') s.setMode('CAMERA_MODE');
              s.forceAnimal(a.id);
              navigate('/');
            }}
          >
            Force {a.word}
          </button>
        ))}
      </div>
      <div className="settings">
        <label>
          Quality
          <select value={s.quality} onChange={(e) => s.setQuality(e.target.value as Quality)}>
            {['AUTO', 'HIGH', 'MEDIUM', 'LOW'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          Play mode
          <select
            value={s.mode}
            onChange={(e) => {
              s.setMode(e.target.value as Mode);
              s.send({ type: 'RESET' });
            }}
          >
            {['AR_MODE', 'CAMERA_MODE', '3D_MODE'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          Volume
          <input
            type="range"
            min="0"
            max="1"
            step=".05"
            value={s.volume}
            onChange={(e) => {
              s.setVolume(Number(e.target.value));
              audio.setVolume(Number(e.target.value));
            }}
          />
        </label>
      </div>
      <section className="parent-note">
        <h2>Camera privacy</h2>
        <p>
          Camera frames are processed on this device. No images, video, face recognition, or
          analytics are collected.
        </p>
        {r.error && <p className="parent-error">Last diagnostic: {r.error}</p>}
        <p>
          Camera is needed for Magic Mode. If it is unavailable, choose Camera Mode or 3D Mode.
          Force buttons use explicit camera placement; they do not validate image recognition.
        </p>
      </section>
      <button
        onClick={() => {
          s.setParent(false);
          navigate('/');
        }}
      >
        Exit parent mode
      </button>
    </main>
  );
}
