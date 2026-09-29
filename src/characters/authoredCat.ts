import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

let asset: GLTF | null = null;
export const catAssetStatus = { ready: false, error: '' };
export async function loadAuthoredCat() {
  const draco = new DRACOLoader().setDecoderPath('/draco/').setWorkerLimit(1);
  try {
    asset = await new GLTFLoader().setDRACOLoader(draco).loadAsync('/models/cat-studio.glb?v=rig6');
    catAssetStatus.ready = true;
  } catch {
    catAssetStatus.error = 'CAT asset unavailable; using the bundled fallback.';
  } finally { draco.dispose(); }
}
export function makeAuthoredCat(): THREE.Group | null {
  if (!asset) return null;
  const root = new THREE.Group();
  const content = clone(asset.scene);
  root.add(content);
  const mixer = new THREE.AnimationMixer(content);
  const clips = new Map(asset.animations.map((clip) => [clip.name, clip]));
  const lowDetail = location.pathname === '/tv' || /SmartTV|Tizen|Web0S/i.test(navigator.userAgent) || (navigator.hardwareConcurrency ?? 8) < 4;
  content.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.castShadow = true;
      node.receiveShadow = false;
      // Eye reflection remains crisp while fur and woven fabric stay matte.
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.envMapIntensity = /Eye|iris|Pupil|cornea/i.test(material.name) ? .85 : .25;
          if (material.name === 'Individual groom fibers') material.side = THREE.FrontSide;
        }
      }
    }
  });
  root.userData = { kind: 'cat', designVersion: 6, authored: true, content, mixer, clips, lowDetail, previousTime: null, action: '', reveal: 1 };
  revealAuthoredCat(root, 1);
  animateAuthoredCat(root, 0, 'idle');
  return root;
}
export function revealAuthoredCat(root: THREE.Group, progress: number) {
  root.userData.reveal = progress;
  (root.userData.content as THREE.Object3D).traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const part = node.userData.part;
    node.visible = progress >= (part === 'paws' ? .2 : part === 'head' ? .55 : .85);
    if (node.name.includes('Groom_HIGH')) node.visible &&= !root.userData.lowDetail;
    if (node.name.includes('Groom_LOW')) node.visible &&= Boolean(root.userData.lowDetail);
  });
}
export function animateAuthoredCat(root: THREE.Group, time: number, action: string) {
  const data = root.userData;
  const mixer = data.mixer as THREE.AnimationMixer;
  const clipName = ['happy','wave','jump','run','sleep','roar'].includes(action) ? action : ['dance','laugh','play'].includes(action) ? 'happy' : 'idle';
  if (data.action !== clipName) {
    const clips = data.clips as Map<string, THREE.AnimationClip>;
    const clip = clips.get(clipName);
    if (clip) {
      const previous = data.playing as THREE.AnimationAction | undefined;
      const next = mixer.clipAction(clip).reset().play();
      if (previous) { previous.fadeOut(.2); next.fadeIn(.2); }
      data.playing = next;
    }
    data.action = clipName;
  }
  const dt = data.previousTime === null ? 0 : Math.max(0, Math.min(.1, time - data.previousTime));
  mixer.update(dt);
  data.previousTime = time;
  const head = (data.content as THREE.Object3D).getObjectByName('head');
  if (head && data.headTilt) head.rotateX(data.headTilt as number);
  const content = data.content as THREE.Object3D;
  content.rotation.y = ['spin','chase tail'].includes(action) ? time * 2.8 : 0;
}
export function disposeAuthoredCat(root: THREE.Group) {
  const mixer = root.userData.mixer as THREE.AnimationMixer;
  mixer.stopAllAction();
  mixer.uncacheRoot(root.userData.content as THREE.Object3D);
  // Clones own their rig; immutable geometry/textures belong to the shared asset cache.
}
