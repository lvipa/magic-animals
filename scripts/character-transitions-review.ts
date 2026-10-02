import * as THREE from 'three';
import { loadAuthoredCharacter } from '../src/characters/authoredCat';
import { makeCharacter, animateCharacter, disposeCharacter } from '../src/characters/models';
import { characterIds } from '../src/characters/catalog';

const reports = [];
for (const id of characterIds) {
  await loadAuthoredCharacter(id);
  const model = makeCharacter(id);
  if (!model.userData.authored) throw Error(`${id}: model unavailable`);
  const head = model.getObjectByName('head')!;
  const bones: THREE.Bone[] = [];
  model.traverse((node) => {
    if (node instanceof THREE.Bone) bones.push(node);
  });
  let time = 0;
  const step = (action: string, frames: number) => {
    for (let i = 0; i < frames; i++) {
      time += 1 / 60;
      animateCharacter(model, time, action);
      model.updateMatrixWorld(true);
    }
  };
  step('idle', 60);
  const idle = head.quaternion.clone();
  const drift: Record<string, number> = {};
  for (const action of ['hungry', 'thirsty', 'tired', 'sad', 'sing']) {
    step(action, 1200); // 20 seconds catches accumulation invisible in still-pose reviews.
    drift[action] = head.quaternion.angleTo(idle);
    if (!Number.isFinite(drift[action]) || drift[action] > 0.5)
      throw Error(`${id}/${action}: runaway head ${drift[action]} radians`);
    if (action === 'tired' && drift[action] < 0.1)
      throw Error(`${id}: tired pose failed to move the head`);
  }
  step('sleep', 180);
  const sleeping = head.getWorldQuaternion(new THREE.Quaternion());
  const before = bones.map((bone) => bone.quaternion.clone());
  step('thirsty', 1);
  const firstFrame = Math.max(...bones.map((bone, i) => bone.quaternion.angleTo(before[i])));
  const headFirstFrame = head.getWorldQuaternion(new THREE.Quaternion()).angleTo(sleeping);
  if (firstFrame > 0.04 || headFirstFrame > 0.06)
    throw Error(`${id}: sleep → thirsty snapped ${firstFrame}/${headFirstFrame}`);
  // Repeated taps interrupt a blend; each starts from the actually displayed pose.
  for (const action of ['hungry', 'sad', 'thirsty', 'tired', 'sleep', 'wave']) {
    const previous = head.getWorldQuaternion(new THREE.Quaternion());
    step(action, 1);
    const angle = head.getWorldQuaternion(new THREE.Quaternion()).angleTo(previous);
    if (angle > 0.06) throw Error(`${id}: interrupted ${action} snapped ${angle}`);
  }
  step('idle', 180);
  const restored = head.quaternion.angleTo(idle);
  if (restored > 0.08) throw Error(`${id}: head failed to return to idle ${restored}`);
  reports.push({ id, drift, firstFrame, headFirstFrame, restored });
  console.log('PASS continuous production rig', id);
  disposeCharacter(model);
}
Object.assign(window, { transitionReport: reports });
