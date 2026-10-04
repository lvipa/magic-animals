import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Actor, Magic } from '../scenes/GameScene';
import { animalById, storyAnimals, type AnimalId } from '../config/animals';
import { initialScene } from '../game/GameEngine';
import { audio } from '../audio/AudioManager';
import { WebSocketTVBridge } from './WebSocketTVBridge';
import type { TransferPlan, TVSnapshot } from './protocol';
import FullscreenButton from '../components/FullscreenButton';
import { StudioEnvironment } from '../scenes/StudioLighting';
import { characterDetails, type Character } from '../characters/catalog';
import PairingQR from './PairingQR';
import { useCastLayout } from '../scenes/CastLayout';
import { WorldBackdrop } from '../play/WorldBackdrop';
import { isWorld, type World } from '../play/adventure';
import { isSingSnapshot, type SingSnapshot } from '../singing/song';
import { TVSingScene } from '../singing/TVSingScene';
import { DisplayResolution } from '../scenes/DisplayResolution';
type FriendScene = { id: Character | null; action: string; world?: World; caption?: string };

const initial: TVSnapshot = {
  state: 'WELCOME',
  scene: { ...initialScene, caption: 'A little magic is on its way.' },
  paused: false,
  released: [],
  sequence: -1,
};
function PresentationReady({ onReady }: { onReady: (ready: boolean) => void }) {
  const gl = useThree((s) => s.gl),
    didRender = useRef(false);
  useFrame(() => {
    if (!didRender.current) {
      didRender.current = true;
      onReady(true);
    }
  });
  useEffect(() => {
    const lost = () => onReady(false),
      restored = () => {
        didRender.current = false;
      };
    gl.domElement.addEventListener('webglcontextlost', lost);
    gl.domElement.addEventListener('webglcontextrestored', restored);
    return () => {
      gl.domElement.removeEventListener('webglcontextlost', lost);
      gl.domElement.removeEventListener('webglcontextrestored', restored);
    };
  }, [gl, onReady]);
  return null;
}
function Portal({
  plan,
  now,
  position,
}: {
  plan: TransferPlan;
  now: () => number;
  position: [number, number, number];
}) {
  const ring = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ring.current) return;
    const progress = (now() - plan.revealAt + 900) / 2800;
    ring.current.visible = progress >= 0 && progress < 1;
    ring.current.scale.setScalar(Math.sin(Math.max(0, Math.min(1, progress)) * Math.PI) * 0.7);
    ring.current.rotation.z += 0.025;
  });
  return (
    <group position={position}>
      <group ref={ring}>
        <mesh>
          <torusGeometry args={[0.53, 0.045, 8, 48]} />
          <meshBasicMaterial color="#ffe292" transparent opacity={0.8} />
        </mesh>
        <mesh rotation={[0, 0, 0.4]}>
          <torusGeometry args={[0.63, 0.016, 5, 40]} />
          <meshBasicMaterial color="#91e4dc" />
        </mesh>
      </group>
    </group>
  );
}
function FallbackStage({
  snapshot,
  friend,
  onReady,
}: {
  snapshot: TVSnapshot;
  friend?: FriendScene | null;
  onReady: (ready: boolean) => void;
}) {
  useEffect(() => {
    onReady(true);
  }, [onReady]);
  const ids = snapshot.scene.finale
    ? storyAnimals.map((a) => a.id)
    : [
        ...new Set([
          ...snapshot.released,
          ...(snapshot.scene.animal ? [snapshot.scene.animal] : []),
        ]),
      ];
  return (
    <div className="tv-flat-stage">
      {friend?.id ? (
        <span className="tv-flat-foxy">{characterDetails[friend.id].icon}</span>
      ) : (
        <>
          <span className="tv-flat-foxy">🦊</span>
          {ids.map((id) => (
            <img key={id} src={animalById[id].image} alt={id} />
          ))}
        </>
      )}
      <small>Simple picture mode</small>
    </div>
  );
}
class TVRenderBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
function TVActors({
  snapshot,
  transfers,
  now,
}: {
  snapshot: TVSnapshot;
  transfers: TransferPlan[];
  now: () => number;
}) {
  const scene = snapshot.scene;
  const ids: Character[] = [
    ...new Set<Character>([
      'foxy',
      ...(scene.finale ? storyAnimals.map((a) => a.id) : snapshot.released),
      ...(scene.animal ? [scene.animal] : []),
    ]),
  ];
  const layout = useCastLayout(ids.length);
  return (
    <>
      {ids.map((id, index) => (
        <Actor
          key={id}
          kind={id}
          position={layout.position(index)}
          scale={layout.scale}
          reveal={id === scene.animal && !snapshot.released.includes(id) ? scene.reveal : 1}
          action={
            snapshot.paused
              ? 'idle'
              : scene.finale
                ? id === 'dog'
                  ? 'jump'
                  : 'happy'
                : id === scene.animal
                  ? scene.action
                  : id === 'foxy'
                    ? scene.foxy
                    : 'idle'
          }
        />
      ))}
      {transfers.map((plan) => {
        const index = ids.indexOf(plan.id);
        if (index < 0) return null;
        const position = layout.position(index);
        position[1] += 0.58 * layout.scale;
        position[2] = 0.02;
        return <Portal key={plan.transferId} plan={plan} now={now} position={position} />;
      })}
      {scene.effects && !snapshot.paused && <Magic count={12} />}
    </>
  );
}
function TVScene({
  snapshot,
  friend,
  transfers,
  now,
  onReady,
}: {
  snapshot: TVSnapshot;
  friend: FriendScene | null;
  transfers: TransferPlan[];
  now: () => number;
  onReady: (ready: boolean) => void;
}) {
  const fallback = <FallbackStage snapshot={snapshot} friend={friend} onReady={onReady} />;
  return (
    <div className="tv-stage">
      <WorldBackdrop
        world={
          isWorld(friend?.world)
            ? friend.world
            : isWorld(snapshot.scene.world)
              ? snapshot.scene.world
              : 'meadow'
        }
      />
      <TVRenderBoundary fallback={fallback}>
        <Canvas
          camera={{ position: [0, 1.0, 5.6], fov: 38 }}
          dpr={1.5}
          gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
          fallback={fallback}
        >
          <StudioEnvironment />
          <DisplayResolution />
          <hemisphereLight args={['#fff4e7', '#819eae', 1.5]} />
          <directionalLight position={[-3, 4, 5]} intensity={2.8} color="#fff1dd" />
          <directionalLight position={[3, 2, -3]} intensity={1.7} color="#b2e4f3" />
          {friend?.id ? (
            <Actor kind={friend.id} position={[0, -1, 0]} scale={1.7} action={friend.action} />
          ) : (
            <TVActors snapshot={snapshot} transfers={transfers} now={now} />
          )}
          <PresentationReady onReady={onReady} />
        </Canvas>
      </TVRenderBoundary>
    </div>
  );
}
export default function TVPage() {
  const bridge = useMemo(() => new WebSocketTVBridge('tv'), []);
  const status = useSyncExternalStore(bridge.subscribe, bridge.getStatus);
  const [started, setStarted] = useState(false),
    [friend, setFriend] = useState<FriendScene | null>(null),
    [snapshot, setSnapshot] = useState(initial),
    [transfers, setTransfers] = useState<TransferPlan[]>([]),
    [sound, setSound] = useState(false);
  const audioEnabled = useRef(false),
    ready = useRef(false),
    timers = useRef(new Map<string, ReturnType<typeof setTimeout>>()),
    expiry = useRef(new Set<ReturnType<typeof setTimeout>>());
  const [sing, setSing] = useState<SingSnapshot | null>(null);
  const now = useCallback(() => bridge.serverTime(), [bridge]);
  const onReady = useCallback(
    (value: boolean) => {
      ready.current = value;
      bridge.setPresentationReady(value && !document.hidden);
    },
    [bridge],
  );
  const clearTransfers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
    expiry.current.forEach(clearTimeout);
    expiry.current.clear();
    setTransfers([]);
  }, []);
  useEffect(() => {
    const scheduledTimers = timers.current,
      expiryTimers = expiry.current;
    const off = bridge.onMessage((msg) => {
      if (msg.kind === 'joined') setStarted(true);
      if (msg.kind === 'snapshot') {
        if (!msg.snapshot.paused) setSing(null);
        setSnapshot(msg.snapshot);
        if (!msg.snapshot.paused) setFriend(null);
        if (msg.snapshot.paused) audio.stop();
      }
      if (msg.kind === 'event' && msg.event === 'FRIEND_SCENE') {
        setFriend(msg.payload as FriendScene);
        setSing(null);
      }
      if (msg.kind === 'event' && msg.event === 'SING_SCENE' && isSingSnapshot(msg.payload)) {
        setSing(msg.payload.active ? msg.payload : null);
        audio.stop();
      }
      if (msg.kind === 'event' && msg.event === 'AUDIO_CUE' && audioEnabled.current) {
        const cue = (msg.payload as { cue?: string }).cue;
        if (cue) audio.say(cue);
      }
      if (msg.kind === 'transfer-prepare') bridge.acknowledgeTransfer(msg.transfer.transferId);
      if (msg.kind === 'transfer-commit' && !timers.current.has(msg.transfer.transferId)) {
        const plan = msg.transfer;
        setTransfers((s) => [...s.filter((t) => t.transferId !== plan.transferId), plan]);
        const timer = setTimeout(
          () => {
            timers.current.delete(plan.transferId);
            setSnapshot((s) => ({
              ...s,
              released: [...new Set<AnimalId>([...s.released, plan.id])],
            }));
            const end = setTimeout(() => {
              expiry.current.delete(end);
              setTransfers((s) => s.filter((t) => t.transferId !== plan.transferId));
            }, 2000);
            expiry.current.add(end);
          },
          Math.max(0, plan.revealAt - bridge.serverTime()),
        );
        timers.current.set(plan.transferId, timer);
      }
      if (msg.kind === 'transfer-cancelled') {
        const timer = timers.current.get(msg.transferId);
        if (timer) clearTimeout(timer);
        timers.current.delete(msg.transferId);
        setTransfers((s) => s.filter((t) => t.transferId !== msg.transferId));
      }
      if (msg.kind === 'presence' && (!msg.tvReady || !msg.controllerPresent)) {
        setSing(null);
        clearTransfers();
        audio.stop();
      }
      if (msg.kind === 'presence' && msg.audioTarget === 'ipad') audio.stop();
      if (msg.kind === 'error' && msg.code === 'SESSION_ENDED') {
        setStarted(false);
        setSnapshot(initial);
        setFriend(null);
        clearTransfers();
      }
    });
    void bridge.connect();
    const visible = () => {
      bridge.setPresentationReady(ready.current && !document.hidden);
      if (document.hidden) audio.stop();
    };
    document.addEventListener('visibilitychange', visible);
    const keys = (event: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      const buttons = [
        ...document.querySelectorAll<HTMLButtonElement>('.tv-page button:not([disabled])'),
      ];
      if (!buttons.length) return;
      event.preventDefault();
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement),
        direction = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1;
      buttons[(index + direction + buttons.length) % buttons.length]?.focus();
    };
    document.addEventListener('keydown', keys);
    return () => {
      off();
      document.removeEventListener('visibilitychange', visible);
      document.removeEventListener('keydown', keys);
      scheduledTimers.forEach(clearTimeout);
      expiryTimers.forEach(clearTimeout);
      bridge.close();
      audio.stop();
    };
  }, [bridge, clearTransfers]);
  const toggleSound = () => {
    audio.unlockAudio();
    audioEnabled.current = !audioEnabled.current;
    setSound(audioEnabled.current);
    bridge.setSoundReady(audioEnabled.current);
    if (!audioEnabled.current) audio.stop();
  };
  const start = () => {
    setSing(null);
    audio.unlockAudio();
    audioEnabled.current = true;
    setSound(true);
    bridge.setSoundReady(true);
    audio.setVolume(0.75);
    clearTransfers();
    setSnapshot(initial);
    setFriend(null);
    setStarted(true);
    bridge.createRoom();
  };
  const waiting = !status.controllerPresent;
  return (
    <main className="tv-page">
      <div className="tv-sky">
        <span>✦</span>
        <span>✧</span>
        <span>✦</span>
      </div>
      <div className="tv-hill tv-hill-back" />
      <div className="tv-hill" />
      <div className="brand">
        MAGIC <strong>ANIMALS</strong>
        <small>YOUR FRIENDS, ON THE BIG SCREEN</small>
      </div>
      {!sing && (
        <TVScene
          snapshot={snapshot}
          friend={friend}
          transfers={transfers}
          now={now}
          onReady={onReady}
        />
      )}
      {sing && status.controllerPresent && <TVSingScene snapshot={sing} now={now} />}
      {!started ? (
        <section className="tv-welcome">
          <p className="eyebrow">THE MAGIC HAS ROOM TO GROW</p>
          <h1>
            A bigger world.
            <br />
            <em>Little friends.</em>
          </h1>
          <button autoFocus className="large-button" onClick={start}>
            START TV
          </button>
          <p>Use your iPad to find the paper animals.</p>
        </section>
      ) : waiting ? (
        <section className="tv-code-panel">
          <p>Scan with your phone or iPad camera</p>
          <PairingQR code={status.code} />
          <strong className="tv-address">{location.origin}/connect-tv</strong>
          <p>Or enter this TV code on that page</p>
          <div className="tv-code" aria-label="TV pairing code">
            {status.code || '······'}
          </div>
          <small>
            {status.message ||
              (status.state === 'reconnecting' ? 'Reconnecting…' : 'Enter this code on the iPad.')}
          </small>
        </section>
      ) : sing ? null : (
        <>
          <div className="tv-stars" aria-label={`${snapshot.released.length} friends on TV`}>
            {[0, 1, 2].map((i) => (
              <span key={i}>{i < snapshot.released.length ? '★' : '☆'}</span>
            ))}
          </div>
          <div className="tv-caption" aria-live="polite">
            {friend?.id
              ? friend.caption || `${characterDetails[friend.id].word}!`
              : snapshot.paused
                ? 'Foxy is taking a little break.'
                : snapshot.scene.caption || 'Ready for a little magic.'}
          </div>
        </>
      )}
      {started && (
        <nav className="tv-controls">
          <span>
            {status.state === 'ready'
              ? 'iPad connected ✓'
              : status.state === 'reconnecting'
                ? 'Reconnecting…'
                : 'Waiting for iPad'}
            {status.code && ` · ${status.code}`}
          </span>
          <button onClick={toggleSound}>{sound ? 'Sound ON' : 'Enable sound'}</button>
          <FullscreenButton />
          <button onClick={start}>New code</button>
        </nav>
      )}
    </main>
  );
}
