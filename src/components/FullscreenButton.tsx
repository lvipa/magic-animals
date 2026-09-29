import { useEffect, useState } from 'react';

export default function FullscreenButton() {
  const [active, setActive] = useState(Boolean(document.fullscreenElement));
  const [error, setError] = useState('');
  useEffect(() => {
    const changed = () => setActive(Boolean(document.fullscreenElement));
    const key = (event: KeyboardEvent) => {
      if (document.fullscreenElement && ['Escape', 'BrowserBack', 'GoBack'].includes(event.key)) {
        event.preventDefault();
        void document.exitFullscreen().catch(() => {});
      }
    };
    document.addEventListener('fullscreenchange', changed);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('fullscreenchange', changed);
      document.removeEventListener('keydown', key);
    };
  }, []);
  return (
    <button
      title={error || 'Esc to exit · F11 for browser fullscreen'}
      onClick={async () => {
        try {
          if (document.fullscreenElement) await document.exitFullscreen();
          else if (document.documentElement.requestFullscreen)
            await document.documentElement.requestFullscreen();
          else setError('Use the browser fullscreen controls.');
        } catch {
          setError('Use Esc, F11 or the TV Back button.');
        }
      }}
    >
      {active ? 'Exit full screen ✕' : 'Full screen'}
    </button>
  );
}
