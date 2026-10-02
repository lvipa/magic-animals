import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { CAT_MODEL_URL } from './catAsset';
import { CAST_MODEL_URLS } from './castAssets';
import type { Character } from './catalog';
import { collectSecondaryControls, animateSecondaryControls } from './secondaryMotion';
import { audio } from '../audio/AudioManager';
import { collectExpressiveControls, animateExpression } from './expressiveMotion';
import { PoseLayer } from './poseLayer';

const assets = new Map<Character, GLTF>();
const pending = new Map<Character, Promise<void>>();
const revisions = new Map<Character, number>();
const listeners = new Set<() => void>();
let activeLoads = 0;
const waitingLoads: Array<{ id: Character; resolve: () => void }> = [];
export type CharacterLoadStatus = {
  phase: 'queued' | 'downloading' | 'decoding' | 'ready' | 'error';
  loaded: number;
  total: number;
};
export const characterLoadStatus = new Map<Character, CharacterLoadStatus>();
let sharedLoader: GLTFLoader | undefined;
function publishStatus(id: Character, status: CharacterLoadStatus) {
  characterLoadStatus.set(id, status);
  revisions.set(id, characterAssetRevision(id) + 1);
  listeners.forEach((listener) => listener());
}
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
export function loadAuthoredCharacter(id: Character, priority = true): Promise<void> {
  if (assets.has(id)) return Promise.resolve();
  const previous = pending.get(id);
  if (previous) {
    const index = waitingLoads.findIndex((item) => item.id === id);
    if (priority && index > 0) waitingLoads.unshift(...waitingLoads.splice(index, 1));
    return previous;
  }
  const loading = load(id, priority);
  pending.set(id, loading);
  return loading;
}
export const loadAuthoredCat = () => loadAuthoredCharacter('cat');
async function load(id: Character, priority: boolean) {
  characterAssetErrors.delete(id);
  publishStatus(id, { phase: 'queued', loaded: 0, total: 0 });
  // Transfer a reserved slot directly to the next waiter, so a new request
  // cannot overtake it and exceed the two-download limit.
  if (activeLoads >= 2)
    await new Promise<void>((resolve) => {
      const item = { id, resolve };
      if (priority) waitingLoads.unshift(item);
      else waitingLoads.push(item);
    });
  else activeLoads++;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 60000);
  try {
    publishStatus(id, { phase: 'downloading', loaded: 0, total: 0 });
    const response = await fetch(characterModelUrl(id), { signal: controller.signal });
    if (!response.ok) throw new Error('Model download failed');
    const total = Number(response.headers.get('content-length')) || 0;
    const chunks: Uint8Array[] = [];
    let loaded = 0,
      lastUpdate = 0;
    const reader = response.body?.getReader();
    if (reader) {
      let chunk = await reader.read();
      while (!chunk.done) {
        const value = chunk.value;
        chunks.push(value);
        loaded += value.length;
        if (performance.now() - lastUpdate > 200) {
          publishStatus(id, { phase: 'downloading', loaded, total });
          lastUpdate = performance.now();
        }
        chunk = await reader.read();
      }
    } else {
      const bytes = new Uint8Array(await response.arrayBuffer());
      chunks.push(bytes);
      loaded = bytes.length;
    }
    window.clearTimeout(timeout);
    const buffer = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }
    publishStatus(id, { phase: 'decoding', loaded, total: loaded });
    sharedLoader ??= new GLTFLoader().setDRACOLoader(
      new DRACOLoader().setDecoderPath('/draco/').setWorkerLimit(1),
    );
    const asset = await sharedLoader.parseAsync(buffer.buffer, '/models/');
    assets.set(id, asset);
    characterAssetErrors.delete(id);
    if (id === 'cat') {
      catAssetStatus.ready = true;
      catAssetStatus.error = '';
    }
    publishStatus(id, { phase: 'ready', loaded, total: loaded });
  } catch {
    // A 200 response can still contain an incomplete/invalid GLB. Evict only
    // this immutable asset so Try again can reach the server next time.
    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((key) => key === 'animals-models-v1' || key.includes('precache'))
            .map(async (key) =>
              (await caches.open(key)).delete(characterModelUrl(id), { ignoreSearch: true }),
            ),
        );
      } catch {
        /* Storage may be unavailable; the visible retry still works online. */
      }
    }
    const error = `${id.toUpperCase()} could not load. Check your connection and try again.`;
    characterAssetErrors.set(id, error);
    if (id === 'cat') catAssetStatus.error = error;
    publishStatus(id, { phase: 'error', loaded: 0, total: 0 });
  } finally {
    window.clearTimeout(timeout);
    pending.delete(id);
    const next = waitingLoads.shift();
    if (next) next.resolve();
    else activeLoads--;
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
    /iPad|iPhone|Android/i.test(navigator.userAgent) ||
    (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1) ||
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
    secondaryControls: collectSecondaryControls(content),
    expressiveControls: collectExpressiveControls(content),
    poseLayer: new PoseLayer(content),
    mouths: [] as Array<{ mesh: THREE.Mesh; index: number }>,
    tiredLids: [] as Array<{ mesh: THREE.Mesh; index: number }>,
  };
  content.traverse((node) => {
    if (node instanceof THREE.Mesh && node.morphTargetDictionary?.mouthOpen !== undefined)
      root.userData.mouths.push({ mesh: node, index: node.morphTargetDictionary.mouthOpen });
    if (node instanceof THREE.Mesh && node.morphTargetDictionary) {
      for (const [name, index] of Object.entries(node.morphTargetDictionary))
        if (name.startsWith('blinkHalf_')) root.userData.tiredLids.push({ mesh: node, index });
    }
  });
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
  const poseLayer = data.poseLayer as PoseLayer;
  poseLayer.begin(action);
  const clipName = ['happy', 'wave', 'jump', 'run', 'sleep', 'roar'].includes(action)
    ? action
    : action === 'point'
      ? 'wave'
      : ['meow', 'woof', 'surprised'].includes(action)
        ? 'roar'
        : ['dance', 'laugh', 'play', 'sing'].includes(action)
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
  poseLayer.captureBase();
  animateSecondaryControls(data.secondaryControls, data.kind, time, action);
  animateExpression(data.expressiveControls, data.kind, time, action);
  if (action === 'tired') {
    for (const { mesh, index } of data.tiredLids as Array<{ mesh: THREE.Mesh; index: number }>)
      if (mesh.morphTargetInfluences)
        mesh.morphTargetInfluences[index] = Math.max(mesh.morphTargetInfluences[index], 0.65);
  }
  const speaking = audio.mouthLevelFor(data.kind);
  for (const { mesh, index } of data.mouths as Array<{ mesh: THREE.Mesh; index: number }>) {
    if (mesh.morphTargetInfluences)
      mesh.morphTargetInfluences[index] = Math.max(
        mesh.morphTargetInfluences[index],
        speaking * 0.85,
      );
  }
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
  poseLayer.finish(dt);
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
