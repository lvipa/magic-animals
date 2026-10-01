import { Link } from 'react-router-dom';
import { useAdventure, worlds, type World } from './adventure';
import { WorldBackdrop } from './WorldBackdrop';
import { KidNav } from './KidNav';
import { audio } from '../audio/AudioManager';
export function WorldPicker() {
  const world = useAdventure((s) => s.world),
    setWorld = useAdventure((s) => s.setWorld);
  return (
    <div className="world-picker" role="group" aria-label="Выбери мир">
      {(Object.keys(worlds) as World[]).map((id) => (
        <button
          key={id}
          aria-pressed={world === id}
          onClick={() => {
            setWorld(id);
            audio.unlockAudio();
            audio.stop();
            audio.say(`world-${id}`);
          }}
        >
          <span>{worlds[id].icon}</span>
          {worlds[id].label}
        </button>
      ))}
    </div>
  );
}
export default function Worlds() {
  const world = useAdventure((s) => s.world);
  return (
    <main className="parent-page worlds-page">
      <h1>Куда отправимся?</h1>
      <p>Выбери место для всей команды.</p>
      <WorldPicker />
      <div className="world-preview">
        <WorldBackdrop world={world} />
        <strong>{worlds[world].english}</strong>
      </div>
      <div className="gallery-controls">
        <Link className="kid-link" to="/hunt">
          🔎 Найти друзей
        </Link>
        <Link className="kid-link" to="/friends">
          🐾 Играть и учиться
        </Link>
      </div>
      <KidNav />
    </main>
  );
}
