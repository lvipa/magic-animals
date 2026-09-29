/** Development-only fixed-frame review. Never included as a production route. */
import { useEffect, useMemo, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { StudioEnvironment } from '../scenes/StudioLighting';
import { makeAuthoredCat, animateAuthoredCat, revealAuthoredCat, disposeAuthoredCat } from '../characters/authoredCat';
import * as THREE from 'three';

function Frame({ action, phase, angle, reveal, groom, normals, flat }: { action: string; phase: number; angle: number; reveal: number; groom: boolean; normals: boolean; flat: boolean }) {
  const cat = useMemo(() => makeAuthoredCat(), []);
  const { camera, invalidate } = useThree();
  useEffect(() => {
    if (!flat || !cat) return;
    const previous: [THREE.Mesh, THREE.Material | THREE.Material[]][] = [];
    const temporary: THREE.Material[] = [];
    cat.traverse(node => {
      if (!(node instanceof THREE.Mesh) || !node.name.startsWith('CAT_BodyConnected')) return;
      previous.push([node,node.material]);
      const material = new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.FrontSide});
      temporary.push(material); node.material = material;
    });
    invalidate();
    return () => { previous.forEach(([node,material]) => { node.material=material; }); temporary.forEach(m => m.dispose()); };
  }, [cat,flat,invalidate]);
  useEffect(() => {
    const previous: [THREE.MeshStandardMaterial, THREE.Texture | null][] = [];
    cat?.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) if (material instanceof THREE.MeshStandardMaterial && material.name.includes('fur')) {
        previous.push([material,material.normalMap]);
        if (!normals) { material.normalMap = null; material.needsUpdate = true; }
      }
    });
    invalidate();
    return () => previous.forEach(([material,map]) => { material.normalMap = map; material.needsUpdate = true; });
  }, [cat,normals,invalidate]);
  useEffect(() => {
    const radians = angle * Math.PI / 180;
    camera.position.set(Math.sin(radians) * 4.6, 1.1, Math.cos(radians) * 4.6);
    camera.lookAt(0, .13, 0);
    if (cat) {
      animateAuthoredCat(cat, 0, action);
      const clip = cat.userData.clips.get(action);
      cat.userData.mixer.stopAllAction();
      if (clip) cat.userData.mixer.clipAction(clip).reset().stopFading().setEffectiveWeight(1).play();
      cat.userData.mixer.setTime(phase * (clip?.duration ?? 1));
      revealAuthoredCat(cat, reveal);
      cat.traverse(node => { if (node.name.startsWith('Groom_')) node.visible = groom && reveal >= .55; });
    }
    invalidate();
  }, [cat, action, phase, angle, reveal, groom, camera, invalidate]);
  useEffect(() => () => { if (cat) disposeAuthoredCat(cat); }, [cat]);
  return cat ? <primitive object={cat} position={[0, -.75, 0]} scale={1.55} /> : null;
}
export default function CatReview() {
  const [action, setAction] = useState('idle'), [angle, setAngle] = useState(0);
  const [phase, setPhase] = useState(.25), [reveal, setReveal] = useState(1);
  const [groom, setGroom] = useState(true);
  const [normals, setNormals] = useState(true);
  const [flat, setFlat] = useState(false);
  return <main className="parent-page">
    <h1>CAT · WebGL review candidate</h1>
    <p>Fixed camera, exported GLB, production materials. Art approval pending.</p>
    <label>Angle <select value={angle} onChange={e => setAngle(Number(e.target.value))}>
      {[0,45,90,135,180,225,270,315].map(v => <option key={v} value={v}>{v}°</option>)}
    </select></label>{' '}
    <label>Clip phase <select value={phase} onChange={e => setPhase(Number(e.target.value))}>
      {[.02,.25,.5,.75].map(v => <option key={v} value={v}>{v}</option>)}
    </select></label>{' '}
    <label>Reveal <select value={reveal} onChange={e => setReveal(Number(e.target.value))}>
      {[0,.2,.55,1].map(v => <option key={v} value={v}>{v}</option>)}
    </select></label>
    {' '}<label><input type="checkbox" checked={groom} onChange={e => setGroom(e.target.checked)} />Silhouette groom</label>
    {' '}<label><input type="checkbox" checked={normals} onChange={e => setNormals(e.target.checked)} />Fur normal maps</label>
    {' '}<label><input type="checkbox" checked={flat} onChange={e => setFlat(e.target.checked)} />Unlit body diagnostic</label>
    <div className="gallery-controls">{['idle','happy','wave','jump','run','sleep','roar'].map(v =>
      <button key={v} aria-pressed={action === v} onClick={() => setAction(v)}>{v}</button>)}</div>
    <div className="gallery-stage" style={{ height: 620 }}>
      <Canvas camera={{position:[0,1.1,4.6],fov:33}} dpr={1.5} frameloop="demand" gl={{alpha:true,antialias:true}}>
        <StudioEnvironment />
        <hemisphereLight args={['#fff0df','#687384',.6]} />
        <directionalLight position={[-3,4,5]} intensity={1.65} color="#ffedda" />
        <directionalLight position={[3,1,3]} intensity={.45} color="#cdd8f5" />
        <directionalLight position={[2,3,-3]} intensity={1.25} color="#e6cbf1" />
        <Frame action={action} phase={phase} angle={angle} reveal={reveal} groom={groom} normals={normals} flat={flat} />
      </Canvas>
    </div>
  </main>;
}
