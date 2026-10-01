import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loadAuthoredCharacter } from '../src/characters/authoredCat';
import {
  makeCharacter,
  animateCharacter,
  revealCharacter,
  disposeCharacter,
} from '../src/characters/models';
import { characterIds, type Character } from '../src/characters/catalog';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(1280, 800);
renderer.setClearColor('#547784');
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const room = new RoomEnvironment();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(room, 0.04).texture;
scene.add(new THREE.HemisphereLight(0xfff0df, 0x687384, 0.6));
for (const [position, intensity, color] of [
  [[-3, 4, 5], 1.65, 0xffedda],
  [[3, 1, 3], 0.45, 0xcdd8f5],
  [[2, 3, -3], 1.25, 0xe6cbf1],
] as const) {
  const light = new THREE.DirectionalLight(color, intensity);
  light.position.set(...position);
  scene.add(light);
}
const camera = new THREE.PerspectiveCamera(33, 1280 / 800, 0.01, 100);
camera.position.set(0, 1.05, 6.8);
camera.lookAt(0, 0.15, 0);
const models = new Map<Character, THREE.Group>();
const pose = (model: THREE.Group, action: string, time: number) => {
  const mixer = model.userData.mixer as THREE.AnimationMixer;
  mixer.stopAllAction();
  model.userData.action = '';
  model.userData.previousTime = null;
  animateCharacter(model, 0, action);
  const playing = model.userData.playing as THREE.AnimationAction;
  playing.stopFading();
  playing.setEffectiveWeight(1);
  playing.time = time;
  mixer.update(0);
  model.updateMatrixWorld(true);
  model.traverse((node) => {
    if (node instanceof THREE.SkinnedMesh) node.skeleton.update();
  });
};
function bone(model: THREE.Group, name: string) {
  const node = model.getObjectByName(name);
  if (!node) throw Error(`Missing bone ${name}`);
  return node.getWorldPosition(new THREE.Vector3());
}
const report: unknown[] = [];
for (const [index, id] of characterIds.entries()) {
  console.log('Loading authored character', id);
  await loadAuthoredCharacter(id);
  const model = makeCharacter(id);
  if (!model.userData.authored) throw Error(`${id}: production asset unavailable`);
  scene.add(model);
  models.set(id, model);
  revealCharacter(model, 1);
  pose(model, 'idle', 0);
  const rest = new THREE.Box3().setFromObject(model);
  if (Math.abs(rest.min.y) > 0.04 || Math.abs(rest.max.y - 1.15) > 0.05)
    throw Error(`${id}: invalid ground/height ${rest.min.y}, ${rest.max.y}`);
  const paw = bone(model, 'paw_R');
  let sample:
    { mesh: THREE.SkinnedMesh; index: number; position: THREE.Vector3; weight: number } | undefined;
  model.traverse((node) => {
    if (!(node instanceof THREE.SkinnedMesh) || node.userData.part !== 'body') return;
    const pawIndex = node.skeleton.bones.findIndex((bone) => bone.name === 'paw_R');
    const indices = node.geometry.attributes.skinIndex,
      weights = node.geometry.attributes.skinWeight;
    for (let i = 0; i < node.geometry.attributes.position.count; i++) {
      let weight = 0;
      for (let component = 0; component < 4; component++)
        if (indices.getComponent(i, component) === pawIndex)
          weight += weights.getComponent(i, component);
      if (!sample || weight > sample.weight) {
        const position = node
          .getVertexPosition(i, new THREE.Vector3())
          .applyMatrix4(node.matrixWorld);
        sample = { mesh: node, index: i, position, weight };
      }
    }
  });
  if (!sample || sample.weight < 0.5) throw Error(`${id}: no body surface bound to the paw`);
  pose(model, 'wave', 0.7);
  const wave = paw.distanceTo(bone(model, 'paw_R'));
  if (wave < 0.13) throw Error(`${id}: wave does not move a real paw`);
  const moved = sample.mesh
    .getVertexPosition(sample.index, new THREE.Vector3())
    .applyMatrix4(sample.mesh.matrixWorld);
  const surfaceMotion = moved.distanceTo(sample.position);
  if (surfaceMotion < 0.07)
    throw Error(
      `${id}: skin motion ${surfaceMotion}, paw weight ${sample.weight}, mesh ${sample.mesh.name}`,
    );
  pose(model, 'run', 0.2);
  const foot = bone(model, 'foot_L');
  pose(model, 'run', 0.6);
  const run = foot.distanceTo(bone(model, 'foot_L'));
  if (run < 0.025) throw Error(`${id}: run does not move a real foot`);
  let meshes = 0,
    unweighted = 0;
  model.traverse((node) => {
    if (!(node instanceof THREE.SkinnedMesh)) return;
    meshes++;
    const skin = node.geometry.attributes.skinWeight;
    for (let i = 0; i < skin.count; i++) {
      const sum = skin.getX(i) + skin.getY(i) + skin.getZ(i) + skin.getW(i);
      if (!Number.isFinite(sum) || Math.abs(sum - 1) > 0.02) unweighted++;
    }
  });
  if (unweighted) throw Error(`${id}: invalid skin weights ${unweighted}`);
  report.push({
    id,
    skinnedMeshes: meshes,
    wavePawDistance: wave,
    waveSkinDistance: surfaceMotion,
    runFootDistance: run,
    height: rest.max.y - rest.min.y,
  });
  console.log('PASS browser skin and pose', id);
  pose(model, 'idle', 0);
  model.position.set(((index % 4) - 1.5) * 1.5, index < 4 ? 0.35 : -1.1, 0);
  model.userData.lowDetail = true;
  revealCharacter(model, 1);
}
renderer.render(scene, camera);
Object.assign(window, {
  castReport: report,
  showCast: () => {
    camera.position.set(0, 1.05, 6.8);
    camera.lookAt(0, 0.15, 0);
    characterIds.forEach((id, index) => {
      const m = models.get(id)!;
      m.visible = true;
      m.position.set(((index % 4) - 1.5) * 1.5, index < 4 ? 0.35 : -1.1, 0);
      pose(m, 'idle', 0);
    });
    renderer.render(scene, camera);
  },
  showCharacter: (id: Character, action: string, time: number, angle = 0) => {
    models.forEach((m) => (m.visible = false));
    const m = models.get(id)!;
    m.visible = true;
    m.position.set(0, 0, 0);
    pose(m, action, time);
    m.userData.lowDetail = false;
    revealCharacter(m, 1);
    camera.position.set(Math.sin(angle) * 2.9, 0.68, Math.cos(angle) * 2.9);
    camera.lookAt(0, 0.6, 0);
    renderer.render(scene, camera);
  },
  disposeCast: () => {
    models.forEach(disposeCharacter);
    renderer.dispose();
    pmrem.dispose();
    room.dispose();
  },
});
