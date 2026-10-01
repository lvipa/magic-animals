import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { CAT_MODEL_URL } from './catAsset';
import { CAST_MODEL_URLS } from './castAssets';
import type { Character } from './catalog';

const assets = new Map<Character, GLTF>();
const pending = new Map<Character, Promise<void>>();
const revisions = new Map<Character, number>();
const listeners = new Set<() => void>();
let activeLoads = 0;
const waitingLoads: Array<() => void> = [];
export const characterAssetErrors = new Map<Character, string>();
export const characterModelUrl = (id: Character) =>
  id === 'cat' ? CAT_MODEL_URL : CAST_MODEL_URLS[id];
export const subscribeCharacterAssets = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const characterAssetRevision = (id: Character) => revisions.get(id) ?? 0;
export const catAssetStatus = { ready: false, error: '' };
export function loadAuthoredCharacter(id: Character): Promise<void> {
  if (assets.has(id)) return Promise.resolve();
  const previous = pending.get(id);
  if (previous) return previous;
  const loading = load(id);
  pending.set(id, loading);
  return loading;
}
export const loadAuthoredCat = () => loadAuthoredCharacter('cat');
async function load(id: Character) {
  if (activeLoads >= 2) await new Promise<void>((resolve) => waitingLoads.push(resolve));
  activeLoads++;
  const draco = new DRACOLoader().setDecoderPath('/draco/').setWorkerLimit(1);
  try {
    const asset = await new GLTFLoader().setDRACOLoader(draco).loadAsync(characterModelUrl(id));
    assets.set(id, asset);
    characterAssetErrors.delete(id);
    if (id === 'cat') {
      catAssetStatus.ready = true;
      catAssetStatus.error = '';
    }
  } catch {
    const error = `${id.toUpperCase()} model could not be loaded. Please reload when connected.`;
    characterAssetErrors.set(id, error);
    if (id === 'cat') catAssetStatus.error = error;
  } finally {
    draco.dispose();
    activeLoads--;
    waitingLoads.shift()?.();
    revisions.set(id, characterAssetRevision(id) + 1);
    listeners.forEach((listener) => listener());
  }
}
export const makeAuthoredCat = () => makeAuthoredCharacter('cat');
export function makeAuthoredCharacter(kind: Character): THREE.Group | null {
  const asset = assets.get(kind);
  if (!asset) return null;
  const root = new THREE.Group();
  const content = clone(asset.scene);
  root.add(content);
  const mixer = new THREE.AnimationMixer(content);
  const clips = new Map(asset.animations.map((clip) => [clip.name, clip]));
  const revealUniform = { value: 1 };
  const ownedMaterials: THREE.Material[] = [];
  let landmarks = { reveal_head: 0.27, reveal_foot: -0.72, reveal_paw_x: 0.44, reveal_paw_y: -0.1 };
  content.traverse((node) => {
    if (typeof node.userData.reveal_head === 'number')
      landmarks = { ...landmarks, ...node.userData };
  });
  const lowDetail =
    location.pathname === '/tv' ||
    /SmartTV|Tizen|Web0S/i.test(navigator.userAgent) ||
    (navigator.hardwareConcurrency ?? 8) < 4;
  content.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      // A glTF mesh with several materials becomes a Group in GLTFLoader.
      // Its authoring extras live on that parent, not on the primitive children.
      let sourceNode: THREE.Object3D | null = node;
      while (sourceNode && !sourceNode.userData.part) sourceNode = sourceNode.parent;
      if (sourceNode) node.userData.part = sourceNode.userData.part;
      node.castShadow = true;
      node.receiveShadow = false;
      if (['body', 'fur'].includes(node.userData.part)) {
        // Preserve the game's paws/head/body reveal with one connected mesh.
        // Rest height remains stable as skeletal animation bends the character.
        const source = Array.isArray(node.material) ? node.material : [node.material];
        const local = source.map((original) => {
          const material = original.clone();
          material.onBeforeCompile = (shader: Parameters<THREE.Material['onBeforeCompile']>[0]) => {
            shader.uniforms.catReveal = revealUniform;
            shader.vertexShader = shader.vertexShader
              .replace('#include <common>', '#include <common>\nvarying vec3 catRestPosition;')
              .replace(
                '#include <begin_vertex>',
                '#include <begin_vertex>\ncatRestPosition = position;',
              );
            shader.fragmentShader = shader.fragmentShader
              .replace(
                '#include <common>',
                '#include <common>\nvarying vec3 catRestPosition;\nuniform float catReveal;',
              )
              .replace(
                'void main() {',
                `void main() {\nbool isPaw = catRestPosition.y < ${landmarks.reveal_foot.toFixed(5)} || (catRestPosition.y < ${landmarks.reveal_paw_y.toFixed(5)} && abs(catRestPosition.x) > ${landmarks.reveal_paw_x.toFixed(5)});\nfloat requiredReveal = isPaw ? 0.2 : catRestPosition.y > ${landmarks.reveal_head.toFixed(5)} ? 0.55 : 0.85;\nif (catReveal < requiredReveal) discard;`,
              );
          };
          material.customProgramCacheKey = () => `milo-connected-reveal-v8-${kind}`;
          ownedMaterials.push(material);
          return material;
        });
        node.material = Array.isArray(node.material) ? local : local[0];
      }
      // Eye reflection remains crisp while fur and woven fabric stay matte.
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.envMapIntensity = /Eye|iris|Pupil|cornea/i.test(material.name) ? 1.1 : 0.65;
          if (material.name === 'Individual groom fibers') material.side = THREE.FrontSide;
        }
      }
    }
  });
  root.userData = {
    kind,
    designVersion: 8,
    authored: true,
    content,
    mixer,
    clips,
    lowDetail,
    previousTime: null,
    action: '',
    reveal: 1,
    revealUniform,
    ownedMaterials,
  };
  revealAuthoredCat(root, 1);
  animateAuthoredCat(root, 0, 'idle');
  return root;
}
export function revealAuthoredCat(root: THREE.Group, progress: number) {
  root.userData.reveal = progress;
  root.userData.revealUniform.value = progress;
  (root.userData.content as THREE.Object3D).traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const part = node.userData.part;
    node.visible = progress >= (part === 'paws' ? 0.2 : part === 'head' ? 0.55 : 0.85);
    if (part === 'body' || part === 'fur') node.visible = progress >= 0.2;
    if (node.name.includes('Groom_HIGH')) node.visible &&= !root.userData.lowDetail;
    if (node.name.includes('Groom_LOW')) node.visible &&= Boolean(root.userData.lowDetail);
  });
}
export function animateAuthoredCat(root: THREE.Group, time: number, action: string) {
  const data = root.userData;
  const mixer = data.mixer as THREE.AnimationMixer;
  const clipName = ['happy', 'wave', 'jump', 'run', 'sleep', 'roar'].includes(action)
    ? action
    : action === 'point'
      ? 'wave'
      : ['meow', 'woof', 'surprised'].includes(action)
        ? 'roar'
        : ['dance', 'laugh', 'play'].includes(action)
          ? 'happy'
          : 'idle';
  if (data.action !== clipName) {
    const clips = data.clips as Map<string, THREE.AnimationClip>;
    const clip = clips.get(clipName);
    if (clip) {
      const previous = data.playing as THREE.AnimationAction | undefined;
      const next = mixer.clipAction(clip).reset().play();
      if (previous) {
        previous.fadeOut(0.2);
        next.fadeIn(0.2);
      }
      data.playing = next;
    }
    data.action = clipName;
  }
  const dt = data.previousTime === null ? 0 : Math.max(0, Math.min(0.1, time - data.previousTime));
  mixer.update(dt);
  data.previousTime = time;
  const content = data.content as THREE.Object3D;
  content.rotation.y = ['spin', 'chase tail'].includes(action) ? time * 2.8 : 0;
  content.rotation.z =
    action === 'fall'
      ? -0.9
      : action === 'roll'
        ? Math.sin(time * 2.3) * 0.8
        : action === 'scared'
          ? Math.sin(time * 18) * 0.015
          : 0;
  content.position.y = ['fall', 'roll'].includes(action) ? 0.22 : 0;
  content.scale.y = action === 'sit' ? 0.92 : 1;
}
export function disposeAuthoredCat(root: THREE.Group) {
  const mixer = root.userData.mixer as THREE.AnimationMixer;
  mixer.stopAllAction();
  mixer.uncacheRoot(root.userData.content as THREE.Object3D);
  const skeletons = new Set<THREE.Skeleton>();
  (root.userData.content as THREE.Object3D).traverse((node) => {
    if (node instanceof THREE.SkinnedMesh) skeletons.add(node.skeleton);
  });
  skeletons.forEach((skeleton) => skeleton.dispose());
  (root.userData.ownedMaterials as THREE.Material[]).forEach((material) => material.dispose());
  // Clones own their rig; immutable geometry/textures belong to the shared asset cache.
}
