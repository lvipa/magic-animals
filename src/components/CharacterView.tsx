import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { type Character } from '../characters/models';
import { useCharacterModel } from '../characters/useCharacterModel';
export function CharacterView({
  kind = 'foxy',
  interactive = false,
}: {
  kind?: Character;
  interactive?: boolean;
}) {
  const model = useCharacterModel(kind);
  return (
    <Canvas
      camera={{ position: [0, 1.1, 2.6], fov: 42 }}
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: false }}
    >
      <ambientLight intensity={2} />
      <directionalLight position={[2, 4, 3]} intensity={1.8} />
      <primitive object={model} position={[0, -0.5, 0]} scale={1.5} />
      {interactive && <OrbitControls enableZoom={false} enablePan={false} />}
    </Canvas>
  );
}
