/** Local development tool. Imported GLBs stay in this browser tab. */
import { useEffect, useMemo, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { StudioEnvironment } from '../scenes/StudioLighting';
import miloReference from '../../assets/characters/cat/concepts/milo-rig-pose-v1.png';

type Candidate = { gltf: GLTF; center: THREE.Vector3; scale: number; triangles: number; meshes: number; skinned: number };

function disposeCandidate(candidate: Candidate) {
  candidate.gltf.scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose();
      material.dispose();
    }
  });
}

function ImportedModel({ candidate, angle, clipName, playing }: { candidate: Candidate; angle: number; clipName: string; playing: boolean }) {
  const { camera, invalidate } = useThree();
  const mixer = useMemo(() => new THREE.AnimationMixer(candidate.gltf.scene), [candidate]);
  useEffect(() => {
    const radians = angle * Math.PI / 180;
    camera.position.set(Math.sin(radians) * 5.4, .35, Math.cos(radians) * 5.4);
    camera.lookAt(0, 0, 0);
    invalidate();
  }, [angle, camera, invalidate]);
  useEffect(() => {
    mixer.stopAllAction();
    const clip = candidate.gltf.animations.find(item => item.name === clipName);
    if (clip) mixer.clipAction(clip).reset().play();
    return () => { mixer.stopAllAction(); };
  }, [candidate, clipName, mixer]);
  useFrame((_, delta) => { if (playing) mixer.update(Math.min(delta, .1)); });
  useEffect(() => () => { mixer.stopAllAction(); mixer.uncacheRoot(candidate.gltf.scene); }, [candidate, mixer]);
  return <group scale={candidate.scale} position={candidate.center.clone().multiplyScalar(-candidate.scale)}>
    <primitive object={candidate.gltf.scene} />
  </group>;
}

export default function CatImportReview() {
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [angle, setAngle] = useState(0);
  const [clipName, setClipName] = useState('');
  const [playing, setPlaying] = useState(true);
  useEffect(() => () => { if (candidate) disposeCandidate(candidate); }, [candidate]);

  async function openFile(file?: File) {
    if (!file) return;
    setError(''); setLoading(true);
    try {
      if (!file.name.toLowerCase().endsWith('.glb')) throw new Error('Choose a binary .glb file.');
      const draco = new DRACOLoader().setDecoderPath('/draco/').setWorkerLimit(1);
      let gltf: GLTF;
      try { gltf = await new GLTFLoader().setDRACOLoader(draco).parseAsync(await file.arrayBuffer(), ''); }
      finally { draco.dispose(); }
      const initialClip = gltf.animations.find(clip => clip.name === 'idle') ?? gltf.animations[0];
      let poseMixer: THREE.AnimationMixer | undefined;
      if (initialClip) {
        poseMixer = new THREE.AnimationMixer(gltf.scene);
        poseMixer.clipAction(initialClip).play();
        poseMixer.setTime(0);
      }
      gltf.scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(gltf.scene, true);
      if (poseMixer) { poseMixer.stopAllAction(); poseMixer.uncacheRoot(gltf.scene); }
      const size = box.getSize(new THREE.Vector3());
      if (box.isEmpty() || !Number.isFinite(size.length()) || size.length() === 0) throw new Error('The GLB has no visible 3D mesh.');
      let triangles = 0, meshes = 0, skinned = 0;
      gltf.scene.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        meshes++;
        if (object instanceof THREE.SkinnedMesh) skinned++;
        const geometry = object.geometry;
        triangles += Math.floor((geometry.index?.count ?? geometry.attributes.position?.count ?? 0) / 3);
      });
      setCandidate({ gltf, center: box.getCenter(new THREE.Vector3()), scale: 1.8 / Math.max(size.x, size.y, size.z), triangles, meshes, skinned });
      setFileName(file.name);
      setClipName(gltf.animations[0]?.name ?? '');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not open GLB.'); }
    finally { setLoading(false); }
  }

  return <main className="parent-page" style={{ maxWidth: 1380, margin: '0 auto' }}>
    <h1>Milo · local 3D candidate review</h1>
    <p>Import a candidate GLB to compare its shape with the approved Milo. The file stays in this tab; this route exists only in development.</p>
    <label>Candidate GLB <input type="file" accept=".glb,model/gltf-binary" onChange={event => void openFile(event.target.files?.[0])} /></label>
    {loading && <p>Opening model…</p>}
    {error && <p role="alert">{error}</p>}
    {candidate && <p>{fileName} · {candidate.triangles.toLocaleString()} triangles · {candidate.meshes} meshes · {candidate.skinned} skinned meshes · {candidate.gltf.animations.length} clips</p>}
    <div className="cat-import-review">
      <div>
        <div className="gallery-controls">
          <label>Angle <select value={angle} onChange={event => setAngle(Number(event.target.value))}>{[0,45,90,135,180,225,270,315].map(value => <option key={value} value={value}>{value}°</option>)}</select></label>
          {candidate && candidate.gltf.animations.length > 0 && <label>Clip <select value={clipName} onChange={event => setClipName(event.target.value)}>{candidate.gltf.animations.map(clip => <option key={clip.name}>{clip.name}</option>)}</select></label>}
          {candidate && candidate.gltf.animations.length > 0 && <button onClick={() => setPlaying(value => !value)}>{playing ? 'Pause' : 'Play'}</button>}
        </div>
        <div className="gallery-stage" style={{ height: 620 }}>
          <Canvas camera={{ position: [0,.35,5.4], fov: 33 }} dpr={1.5} gl={{ alpha: true, antialias: true }}>
            <StudioEnvironment />
            <hemisphereLight args={['#fff0df','#687384',.6]} />
            <directionalLight position={[-3,4,5]} intensity={1.65} color="#ffedda" />
            <directionalLight position={[3,1,3]} intensity={.45} color="#cdd8f5" />
            <directionalLight position={[2,3,-3]} intensity={1.25} color="#e6cbf1" />
            {candidate && <ImportedModel candidate={candidate} angle={angle} clipName={clipName} playing={playing} />}
            <OrbitControls enablePan={false} minDistance={2.5} maxDistance={8} />
          </Canvas>
        </div>
      </div>
      <figure>
        <img src={miloReference} alt="Approved Milo front reference in a rigging pose" />
        <figcaption>Approved Milo · front A-pose reference</figcaption>
      </figure>
    </div>
  </main>;
}
