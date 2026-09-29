import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { audio, spoken, isAnimalSound, type Cue } from '../audio/AudioManager';
import { useGame } from '../storage/store';
export default function AudioStudio() {
  const [selected, setSelected] = useState<Cue | null>(null);
  useEffect(() => () => audio.stop(), []);
  const play = (cue: Cue) => {
    audio.unlockAudio();
    audio.setVolume(useGame.getState().volume);
    audio.stop();
    audio.say(cue);
    setSelected(cue);
  };
  return (
    <main className="parent-page">
      <Link to="/parent">← Parent</Link>
      <p className="eyebrow">A FRIENDLY VOICE FOR LITTLE EARS</p>
      <h1>Foxy’s voice.</h1>
      <p>Playful cartoon voices. Clear American English and soft animal calls.</p>
      <div className="parent-note">
        <h2>Listen to the learning words</h2>
        <p>CAT /kæt/ · DOG /dɑːɡ/ · LION /ˈlaɪən/</p>
        <p>The voice is AI generated. All recordings play locally, including offline.</p>
      </div>
      <div className="parent-grid">
        {(Object.keys(spoken) as Cue[]).map((cue) => (
          <button key={cue} aria-pressed={selected === cue} onClick={() => play(cue)}>
            {isAnimalSound(cue) ? `♫ ${spoken[cue]}` : `▶ ${spoken[cue]}`}
          </button>
        ))}
      </div>
      <button
        onClick={() => {
          audio.stop();
          setSelected(null);
        }}
      >
        Stop sound
      </button>
    </main>
  );
}
