import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { audioFiles } from '../audio/AudioManager';
import { characterIds } from '../characters/catalog';
import { imageTargetsUrl, markerBase } from '../config/arCards';
import { characterModelUrl } from '../characters/authoredCat';
export function Install() {
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  const standalone = matchMedia('(display-mode: standalone)').matches;
  return (
    <main className="parent-page">
      <Link to="/parent">← Parent</Link>
      <h1>Install Magic Animals</h1>
      <p>
        {standalone
          ? 'Already running as a standalone game.'
          : ios
            ? 'On this iPad or iPhone:'
            : 'On your iPad or iPhone, open the HTTPS game URL in Safari:'}
      </p>
      <ol className="install-steps">
        <li>
          Open in <strong>Safari</strong>
        </li>
        <li>
          Tap <strong>Share</strong> ↑
        </li>
        <li>
          Choose <strong>Add to Home Screen</strong>
        </li>
        <li>
          Tap <strong>Add</strong>
        </li>
        <li>
          Open the <strong>Magic Animals</strong> icon
        </li>
      </ol>
      <p>Allow camera access after PLAY. Set the device volume to a comfortable level.</p>
    </main>
  );
}
export function Offline() {
  const [checks, setChecks] = useState<Record<string, string>>({}),
    [controlled, setControlled] = useState(false);
  useEffect(() => {
    let disposed = false;
    const run = async () => {
      if (!('serviceWorker' in navigator) || !('caches' in window)) {
        setChecks({
          'GAME ENGINE': 'NO SERVICE WORKER',
          MODELS: 'UNVERIFIED',
          AUDIO: 'UNVERIFIED',
          MARKERS: 'UNVERIFIED',
        });
        return;
      }
      setControlled(Boolean(navigator.serviceWorker.controller));
      const keys = await caches.keys();
      const precache = keys.filter((k) => k.includes('precache'));
      const cached = async (path: string) => {
        for (const key of precache) {
          const cache = await caches.open(key);
          if (await cache.match(path, { ignoreSearch: true })) return true;
        }
        return false;
      };
      const groups: Record<string, string[]> = {
        'GAME ENGINE': ['/index.html'],
        MODELS: [
          ...characterIds.map(characterModelUrl),
          '/draco/draco_wasm_wrapper.js',
          '/draco/draco_decoder.wasm',
        ],
        AUDIO: audioFiles,
        MARKERS: [imageTargetsUrl, ...characterIds.map((id) => `${markerBase}/${id}.png`)],
      };
      for (const [name, paths] of Object.entries(groups)) {
        const ready = (await Promise.all(paths.map(cached))).every(Boolean);
        if (!disposed) setChecks((s) => ({ ...s, [name]: ready ? 'READY' : 'NOT CACHED' }));
      }
    };
    void run();
    return () => {
      disposed = true;
    };
  }, []);
  return (
    <main className="parent-page">
      <Link to="/parent">← Parent</Link>
      <h1>Offline status</h1>
      <p>
        Service Worker:{' '}
        {controlled ? 'CONTROLLING THIS PAGE' : 'Load the production build and reload once'}
      </p>
      <div className="offline-checks">
        {['GAME ENGINE', 'MODELS', 'AUDIO', 'MARKERS'].map((k) => (
          <div key={k}>
            <strong>{k}</strong>
            <span>{checks[k] ?? 'CHECKING'}</span>
          </div>
        ))}
      </div>
      <p>All friends use Milo-family GLBs with skeletons, facial controls and short fur.</p>
      <p>
        READY means assets are present in this build's precache. To verify a relaunch, disconnect
        Wi-Fi and reopen the Home Screen icon. Safari can evict storage under pressure.
      </p>
    </main>
  );
}
