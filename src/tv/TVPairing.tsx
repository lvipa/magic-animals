import { useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { getTVBridge } from './WebSocketTVBridge';
export default function TVPairing() {
  const bridge = getTVBridge(),
    status = useSyncExternalStore(bridge.subscribe, bridge.getStatus);
  const [code, setCode] = useState(new URLSearchParams(location.search).get('code') ?? '');
  return (
    <main className="parent-page tv-pairing">
      <Link to="/">← Back to game</Link>
      <p className="eyebrow">A BIGGER PLACE FOR LITTLE FRIENDS</p>
      <h1>Play on the big screen.</h1>
      <ol>
        <li>
          Open <strong>{location.origin}/tv</strong> in the TV browser.
        </li>
        <li>
          Choose <strong>START TV</strong>.
        </li>
        <li>Scan the QR with your phone camera, or enter the TV code below.</li>
      </ol>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          bridge.pair(code);
        }}
      >
        <label htmlFor="tv-code">Enter the 6-digit TV code</label>
        <input
          id="tv-code"
          inputMode="numeric"
          autoComplete="off"
          pattern="[0-9]{6}"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          placeholder="123456"
          required
        />
        <button disabled={status.state === 'connecting'}>Connect TV</button>
      </form>
      <section className="parent-note" aria-live="polite">
        <h2>
          {status.state === 'ready'
            ? 'TV connected ✓'
            : status.state === 'waiting'
              ? 'Paired — waiting for the TV'
              : status.state === 'reconnecting'
                ? 'Reconnecting…'
                : 'Ready to connect'}
        </h2>
        <p>
          {status.message ||
            (status.state === 'ready'
              ? 'Return to the game. Your friends will appear on the TV.'
              : 'Keep both screens open on the same game address.')}
        </p>
        {status.code && (
          <p>
            Session code: <strong>{status.code}</strong>
          </p>
        )}
      </section>
      {status.state === 'ready' && (
        <section className="parent-note">
          <h2>Where should Foxy speak?</h2>
          <div className="gallery-controls">
            <button
              aria-pressed={status.audioTarget === 'ipad'}
              onClick={() => bridge.setAudioTarget('ipad')}
            >
              Speak on iPad
            </button>
            <button
              aria-pressed={status.audioTarget === 'tv'}
              disabled={!status.tvSoundReady}
              onClick={() => bridge.setAudioTarget('tv')}
            >
              Speak on TV
            </button>
          </div>
          <p>
            {status.tvSoundReady
              ? 'One screen speaks at a time. If the TV disconnects, the voice returns to the iPad.'
              : 'Choose Enable sound on the TV first. Until then, Foxy speaks on the iPad.'}
          </p>
        </section>
      )}
      <div className="gallery-controls">
        <Link className="tv-return" to="/">
          Back to game
        </Link>
        <button onClick={() => bridge.disconnect()}>Disconnect TV</button>
        <a href="/tv" target="_blank" rel="noreferrer">
          Open TV screen on this computer
        </a>
      </div>
      <p>When connected, choose Back to game. No account or password is needed.</p>
    </main>
  );
}
