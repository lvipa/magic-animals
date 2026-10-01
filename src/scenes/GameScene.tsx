import { Component, useEffect, useMemo, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import {
  animateCharacter,
  disposeCharacter,
  makeCharacter,
  revealCharacter,
  type Character,
} from '../characters/models';
import { animateMagic, makeMagic } from './magic';
import { storyAnimals, type AnimalId } from '../config/animals';
import type { SceneState } from '../game/GameEngine';
import type { Mode } from '../storage/store';
import { useQuality } from '../hooks/useQuality';
import { FrameMeter } from './FrameMeter';
import { StudioEnvironment } from './StudioLighting';
import { useCastLayout } from './CastLayout';
export function Actor({
  kind,
  action = 'idle',
  reveal = 1,
  position = [0, 0, 0],
  scale = 1,
  onTap,
}: {
  kind: Character;
  action?: string;
  reveal?: number;
  position?: [number, number, number];
  scale?: number;
  onTap?: () => void;
}) {
  const model = useMemo(() => makeCharacter(kind), [kind]);
  useEffect(() => {
    revealCharacter(model, reveal);
  }, [model, reveal]);
  useEffect(() => () => disposeCharacter(model), [model]);
  useFrame(({ clock }) => animateCharacter(model, clock.elapsedTime, action));
  return (
    <primitive
      object={model}
      position={position}
      scale={scale}
      onPointerDown={(e: { stopPropagation: () => void }) => {
        e.stopPropagation();
        onTap?.();
      }}
    />
  );
}
export function Magic({ count }: { count: number }) {
  const group = useMemo(() => makeMagic(count), [count]);
  useEffect(() => {
    group.visible = true;
    return () => disposeCharacter(group);
  }, [group]);
  useFrame(({ clock }) => animateMagic(group, clock.elapsedTime));
  return <primitive object={group} scale={3} position={[0, -0.3, 0]} />;
}
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <div className="no-webgl">🦊 ✨</div> : this.props.children;
  }
}
function FinaleActors({ scene, onTap }: { scene: SceneState; onTap: (id: AnimalId) => void }) {
  const layout = useCastLayout(storyAnimals.length + 1);
  return (
    <>
      <Actor kind="foxy" action={scene.foxy} position={layout.position(0)} scale={layout.scale} />
      {storyAnimals.map((animal, index) => (
        <Actor
          key={animal.id}
          kind={animal.id}
          action={
            scene.action === 'dance'
              ? index === 0
                ? 'happy'
                : index === 1
                  ? 'jump'
                  : 'dance'
              : 'idle'
          }
          position={layout.position(index + 1)}
          scale={layout.scale}
          onTap={() => onTap(animal.id)}
        />
      ))}
    </>
  );
}
function PlayActors({
  scene,
  mode,
  onTap,
}: {
  scene: SceneState;
  mode: Mode;
  onTap: (id: AnimalId) => void;
}) {
  const { width, height } = useThree((state) => state.viewport);
  return (
    <>
      <Actor
        kind="foxy"
        action={scene.foxy}
        position={[-Math.min(1.65, width * 0.34), -0.7, 0]}
        scale={Math.min(0.78, width / 3.3)}
      />
      {mode !== 'AR_MODE' && scene.animal && (
        <Actor
          key={scene.animal}
          kind={scene.animal}
          action={scene.action}
          reveal={scene.reveal}
          position={[0, -0.6, 0]}
          scale={Math.min(1.5, width / 1.45, (height * 0.48) / 1.45)}
          onTap={() => onTap(scene.animal!)}
        />
      )}
    </>
  );
}
export function GameScene({
  scene,
  welcome,
  mode,
  onTap,
}: {
  scene: SceneState;
  welcome: boolean;
  mode: Mode;
  onTap: (id: AnimalId) => void;
}) {
  const quality = useQuality();
  return (
    <div
      className={`scene-overlay ${welcome ? 'scene-welcome' : ''} ${scene.finale ? 'scene-finale' : ''}`}
    >
      <SceneBoundary>
        <Canvas
          camera={{ position: [0, 1.1, 5.2], fov: 40 }}
          dpr={quality.pixelRatio}
          gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
          fallback={<div className="no-webgl">🦊 ✨</div>}
        >
          <StudioEnvironment />
          <hemisphereLight args={['#fff4e7', '#819eae', 1.5]} />
          <directionalLight position={[-3, 4, 5]} intensity={2.8} color="#fff1dd" />
          <directionalLight position={[3, 2, -3]} intensity={1.7} color="#b2e4f3" />
          {welcome ? (
            <Float speed={1} rotationIntensity={0.08} floatIntensity={0.12}>
              <Actor kind="foxy" action="lookAround" position={[0, -0.95, 0]} scale={1.55} />
            </Float>
          ) : scene.finale ? (
            <FinaleActors scene={scene} onTap={onTap} />
          ) : (
            <PlayActors scene={scene} mode={mode} onTap={onTap} />
          )}
          {scene.effects && <Magic count={quality.particles} />}
          <FrameMeter enabled={welcome || mode !== 'AR_MODE'} />
        </Canvas>
      </SceneBoundary>
    </div>
  );
}
