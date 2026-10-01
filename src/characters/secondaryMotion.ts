import * as THREE from 'three';
import type { Character } from './catalog';
export type SecondaryControl = { bone: THREE.Bone; rest: THREE.Quaternion };
const rotation = new THREE.Quaternion();
const euler = new THREE.Euler();
export function collectSecondaryControls(content: THREE.Object3D) {
  const controls: SecondaryControl[] = [];
  content.traverse((node) => {
    if (node instanceof THREE.Bone && /^(ear_[LR]|trunk_(base|tip))$/.test(node.name))
      controls.push({ bone: node, rest: node.quaternion.clone() });
  });
  return controls;
}
export function animateSecondaryControls(controls: SecondaryControl[], kind: Character, time: number, action: string) {
  const energy = action === 'sleep' ? .15 : ['happy', 'jump', 'run'].includes(action) ? 1.5 : 1;
  const amount = kind === 'dog' ? .09 : kind === 'bunny' ? .07 : .045;
  for (const { bone, rest } of controls) {
    const side = bone.name.endsWith('L') ? 1 : -1;
    const phase = time * (action === 'run' ? 7 : 2.2) + side * .7;
    if (bone.name.startsWith('ear_')) {
      euler.set(Math.sin(phase) * amount * energy, 0,
        side * ((action === 'sleep' ? .16 : 0) + Math.sin(phase * .7) * amount * energy));
    } else {
      const tip = bone.name === 'trunk_tip';
      euler.set(Math.sin(time * 1.8 + (tip ? .6 : 0)) * (tip ? .12 : .06) * energy,
        Math.sin(time * 1.3) * .025, action === 'wave' || action === 'happy' ? .07 : 0);
    }
    rotation.setFromEuler(euler);
    bone.quaternion.copy(rest).multiply(rotation);
  }
}
