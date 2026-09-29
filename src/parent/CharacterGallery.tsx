import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import { StudioEnvironment } from '../scenes/StudioLighting';
import { characterIds, characterDetails } from '../characters/catalog';
import { audio } from '../audio/AudioManager';
import { getTVBridge } from '../tv/WebSocketTVBridge';
import { characterActionCue, learningActions } from '../audio/characterVoices';
import { cueTexts } from '../audio/generated';
import {
  animateCharacter,
  disposeCharacter,
  makeCharacter,
  type Character,
} from '../characters/models';

const characters = [...characterIds];
function GalleryActors({ selected, action }: { selected: Character | 'all'; action: string }) {
  const width = useThree((state) => state.viewport.width);
  const fit = selected === 'all' ? Math.min(1, width / 6.5) : 1;
  return (
    <>
      {characters
        .filter((id) => selected === 'all' || selected === id)
        .map((id, i) => (
          <Model
            key={id}
            kind={id}
            x={selected === 'all' ? ((i % 4) - 1.5) * 1.48 * fit : 0}
            y={selected === 'all' ? (i < 4 ? 0.43 : -1.02) : -0.75}
            scale={selected === 'all' ? 0.94 * fit : 1.55}
            action={action}
            lowDetail={selected === 'all'}
          />
        ))}
    </>
  );
}
function Model({
  kind,
  x,
  y,
  action,
  scale,
  lowDetail,
}: {
  kind: Character;
  x: number;
  y: number;
  action: string;
  scale: number;
  lowDetail: boolean;
}) {
  const model = useMemo(() => makeCharacter(kind), [kind]);
  useEffect(() => {
    if (model.userData.authored) {
      model.userData.lowDetail = lowDetail;
      // Keep only one groom layer visible when eight characters share the stage.
      model.traverse((node) => {
        if (node.name.includes('Groom_HIGH')) node.visible = !lowDetail;
        if (node.name.includes('Groom_LOW')) node.visible = lowDetail;
      });
    }
  }, [model, lowDetail]);
  useEffect(() => () => disposeCharacter(model), [model]);
  useFrame(({ clock }) => animateCharacter(model, clock.elapsedTime, action));
  return (
    <group position={[x, y, 0]} scale={scale}>
      <primitive object={model} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0.02]} scale={[0.4, 0.27, 1]}>
        <circleGeometry args={[1, 40]} />
        <meshBasicMaterial color="#102737" transparent opacity={0.24} depthWrite={false} />
      </mesh>
    </group>
  );
}
export default function CharacterGallery({ playground = false }: { playground?: boolean }) {
  const [selected, setSelected] = useState<Character | 'all'>(playground ? 'bunny' : 'all');
  const [action, setAction] = useState('idle');
  const [lesson, setLesson] = useState<{ kind: 'animal' | 'action'; target: string } | null>(null);
  const [feedback, setFeedback] = useState('');
  const bridge = useMemo(() => getTVBridge(), []);
  const connection = useSyncExternalStore(bridge.subscribe, bridge.getStatus);
  const speak = (cue: string, clear = true) => {
    audio.unlockAudio();
    if (clear) audio.stop();
    if (bridge.shouldSpeakOnTV()) bridge.sendEvent('AUDIO_CUE', { cue });
    else audio.say(cue);
  };
  const questionCue = (kind: 'animal' | 'action', target: string) => kind === 'animal'
    ? `find-${characterDetails[target as Character].word.toLowerCase()}` : `ask-${target}`;
  const startLesson = (kind: 'animal' | 'action') => {
    const options = kind === 'animal' ? characters : [...learningActions];
    const available = options.filter((value) => value !== lesson?.target);
    const target = available[Math.floor(Math.random() * available.length)];
    setLesson({ kind, target }); setFeedback('Listen carefully…'); setAction('idle');
    if (kind === 'animal') setSelected('all');
    else if (selected === 'all') setSelected('cat');
    speak(questionCue(kind, target));
  };
  const answerLesson = (kind: 'animal' | 'action', answer: string) => {
    if (!lesson || lesson.kind !== kind) return false;
    if (answer === lesson.target) {
      setFeedback(kind === 'animal' ? `Yes! ${characterDetails[answer as Character].word}!` : `Great! ${answer.toUpperCase()}!`);
      speak(kind === 'animal' ? `well-done-${characterDetails[answer as Character].word.toLowerCase()}` : 'great');
      setLesson(null);
      if (kind === 'animal') setAction('happy');
    } else {
      setFeedback('Try again. Listen to Foxy!');
      speak('try-again'); speak(questionCue(lesson.kind, lesson.target), false);
    }
    return true;
  };
  useEffect(() => {
    if (playground)
      bridge.sendEvent('FRIEND_SCENE', { id: selected === 'all' ? null : selected, action });
  }, [bridge, playground, selected, action, connection.state]);
  useEffect(
    () => () => {
      if (playground) bridge.sendEvent('FRIEND_SCENE', { id: null, action: 'idle' });
    },
    [bridge, playground],
  );
  useEffect(() => () => audio.stop(), []);
  return (
    <main className="parent-page character-gallery">
      <Link to={playground ? '/' : '/parent'}>{playground ? '← Back to game' : '← Parent'}</Link>
      <div className="gallery-heading">
        <div>
          <p className="eyebrow">MEET YOUR LITTLE FRIENDS</p>
          <h1>{playground ? 'More little friends!' : 'Made for a little magic.'}</h1>
        </div>
        <p>
          Eight original 3D characters.
          <br />
          Drag to turn. Tap a mood to play.
        </p>
      </div>
      <div className="gallery-controls" aria-label="Characters">
        {(['all', ...characters] as const).map((id) => (
          <button
            key={id}
            aria-pressed={selected === id}
            onClick={() => {
              setSelected(id);
              if (id !== 'all' && answerLesson('animal', id)) return;
              if (playground && id !== 'all') {
                speak(characterActionCue(id, 'idle'));
              }
            }}
          >
            {id === 'all'
              ? 'All friends'
              : playground
                ? `${characterDetails[id].icon} ${characterDetails[id].word}`
                : id.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="gallery-stage">
        <Canvas
          camera={{ position: [0, 1.1, selected === 'all' ? 6.8 : 4.6], fov: 33 }}
          dpr={[1, 1.5]}
          gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
        >
          <StudioEnvironment />
          <hemisphereLight args={['#fff0df', '#687384', .6]} />
          <directionalLight position={[-3, 4, 5]} intensity={1.65} color="#ffedda" />
          <directionalLight position={[3, 1, 3]} intensity={.45} color="#cdd8f5" />
          <directionalLight position={[2, 3, -3]} intensity={1.25} color="#e6cbf1" />
          <GalleryActors selected={selected} action={action} />
          {selected !== 'all' && <ContactShadows position={[0,-.751,0]} opacity={.38} scale={4} blur={2.8} far={2.5} resolution={256} frames={30} color="#101826" />}
          <OrbitControls
            target={[0, selected === 'all' ? 0.27 : 0.13, 0]}
            enablePan={false}
            minDistance={2.4}
            maxDistance={8}
            minPolarAngle={0.45}
            maxPolarAngle={1.75}
          />
        </Canvas>
      </div>
      <div className="gallery-names">
        {characters
          .filter((id) => selected === 'all' || selected === id)
          .map((id) =>
            playground ? (
              <span key={id}>
                {characterDetails[id].name} · {characterDetails[id].word}
              </span>
            ) : (
              <a key={id} href={`/models/${id}.glb`} download>
                {characterDetails[id].name} · {characterDetails[id].word}
                <small>Download GLB ↓</small>
              </a>
            ),
          )}
      </div>
      <div className="gallery-controls" aria-label="Animation">
        {['idle', 'happy', 'wave', 'jump', 'run', 'sleep', 'roar'].map((mood) => (
          <button key={mood} aria-pressed={action === mood} onClick={() => {
            setAction(mood);
            if (!answerLesson('action', mood)) speak(characterActionCue(selected === 'all' ? 'foxy' : selected, mood));
          }}>
            {mood}
          </button>
        ))}
      </div>
      {playground && <section className="listening-play" aria-label="English listening games">
        <h2>Listen, find & move!</h2>
        <div className="gallery-controls">
          <button onClick={() => startLesson('animal')}>Listen & find a friend</button>
          <button onClick={() => startLesson('action')}>Listen & choose a move</button>
          {selected !== 'all' && <button onClick={() => { setAction('roar'); speak(`call-${selected}`); }}>My sound 🔊</button>}
          {lesson && <button onClick={() => speak(questionCue(lesson.kind, lesson.target))}>Hear again 🔊</button>}
        </div>
        <p aria-live="polite">{feedback || cueTexts[characterActionCue(selected === 'all' ? 'foxy' : selected, action)]}</p>
      </section>}
      {playground && <p>3D play · Tap a friend, then choose a move.</p>}
    </main>
  );
}
