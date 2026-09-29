import * as THREE from 'three';
import type { Character } from './catalog';
export type { Character } from './catalog';
import { makeCharacter as makeToyCharacter } from './toyFactory';
import { makeAuthoredCat, animateAuthoredCat, revealAuthoredCat, disposeAuthoredCat } from './authoredCat';
export function makeCharacter(kind: Character) {
  if (kind !== 'cat') return makeToyCharacter(kind);
  const cat = makeAuthoredCat();
  if (cat) return cat;
  // A missing production asset must not silently substitute a primitive CAT.
  const empty = new THREE.Group();
  empty.userData = { kind: 'cat', unavailable: true };
  return empty;
}

interface MovingNodes {
  rig: THREE.Group;
  head: THREE.Group;
  body: THREE.Group;
  paws: THREE.Group;
  tail: THREE.Group;
  eyes: THREE.Object3D[];
  pupils: THREE.Object3D[];
  closedEyes: THREE.Object3D[];
  ears: THREE.Object3D[];
  arms: THREE.Object3D[];
  feet: THREE.Object3D[];
  mouth: THREE.Group;
  smile: THREE.Group;
}
export function revealCharacter(root: THREE.Group, progress: number) {
  if (root.userData.unavailable) return;
  if (root.userData.authored) { revealAuthoredCat(root, progress); return; }
  const n = root.userData.nodes as MovingNodes;
  n.rig.visible = progress >= 0.2;
  n.head.visible = progress >= 0.55;
  n.body.visible = n.tail.visible = progress >= 0.85;
  root.userData.reveal = progress;
}

export function animateCharacter(root: THREE.Group, time: number, action = 'idle') {
  if (root.userData.unavailable) return;
  if (root.userData.authored) { animateAuthoredCat(root, time, action); return; }
  const n = root.userData.nodes as MovingNodes;
  const phase =
    time +
    { cat: 0.7, dog: 1.6, lion: 2.5, foxy: 0, bunny: 1.1, bear: 2.1, panda: 3.2, elephant: 3.8 }[
      root.userData.kind as Character
    ];
  const excited = ['happy', 'jump', 'play', 'dance', 'laugh'].includes(action);
  const running = action === 'run',
    asleep = action === 'sleep';
  const bounce = excited ? Math.max(0, Math.sin(phase * 5)) : 0;
  n.rig.position.set(
    running ? Math.sin(phase * 2) * 0.25 : 0,
    bounce * 0.1 + Math.sin(phase * 2.3) * 0.006,
    0,
  );
  n.rig.rotation.set(0, Math.sin(phase * 0.9) * 0.12, excited ? Math.sin(phase * 3) * 0.075 : 0);
  n.rig.scale.set(
    1 + bounce * 0.025,
    action === 'sit' || asleep ? 0.86 : 1 - bounce * 0.03,
    1 + bounce * 0.025,
  );
  n.body.scale.setScalar(1 + Math.sin(phase * 2.3) * 0.012);
  n.head.rotation.set(
    (root.userData.headTilt as number) ?? 0,
    Math.sin(phase * 0.8) * 0.1,
    Math.sin(phase * 1.1) * 0.04,
  );
  n.head.scale.setScalar(action === 'surprised' || action === 'roar' ? 1.025 : 1);
  n.tail.rotation.set(
    Math.sin(phase * 2.3) * 0.09,
    Math.sin(phase * (root.userData.kind === 'dog' ? 7 : 2.5)) * 0.3,
    Math.sin(phase * 2) * 0.06,
  );
  const blinkPhase = phase % 4.4;
  const blink = asleep
    ? 0.075
    : blinkPhase < 0.16
      ? 1 - 0.92 * Math.sin((blinkPhase / 0.16) * Math.PI)
      : 1;
  n.eyes.forEach((eye, i) => {
    const closed = asleep || (excited && Math.sin(phase * 2) > 0.15);
    eye.visible = !closed;
    n.closedEyes[i].visible = closed;
    eye.scale.y = blink;
    n.pupils[i].position.x = Math.sin(phase * 0.8) * 0.002;
  });
  n.ears.forEach((ear, i) => {
    ear.rotation.z =
      (i === 0 ? 1 : -1) *
        (root.userData.kind === 'cat' || root.userData.kind === 'foxy' ? 0.18 : 0) +
      Math.sin(phase * 2.1 + i) * 0.035;
  });
  n.arms.forEach((arm, i) => {
    arm.rotation.z =
      (i === 0 ? -1 : 1) * ((root.userData.kind === 'cat' ? 0.025 : 0.1) + bounce * 0.32);
    arm.rotation.x = running ? Math.sin(phase * 10 + i * Math.PI) * 0.65 : 0;
  });
  n.feet.forEach((foot, i) => {
    foot.rotation.x = running ? Math.sin(phase * 10 + i * Math.PI) * 0.55 : 0;
    foot.position.y =
      0.079 + (running ? Math.max(0, Math.sin(phase * 10 + i * Math.PI)) * 0.065 : 0);
  });
  n.mouth.visible =
    !root.userData.hasTrunk && ['roar', 'surprised', 'woof', 'meow'].includes(action);
  n.smile.visible = !root.userData.hasTrunk && action !== 'surprised';
  n.mouth.scale.y = action === 'roar' ? 1 + Math.sin(phase * 8) * 0.12 : 1;
  if (action === 'wave' || action === 'point') {
    n.arms[1].rotation.z = action === 'point' ? 1.8 : 2.25 + Math.sin(phase * 6) * 0.22;
    n.arms[1].rotation.x = -0.22;
  }
  if (action === 'lookAround') n.head.rotation.y = Math.sin(phase * 0.9) * 0.42;
  if (action === 'spin' || action === 'chase tail') n.rig.rotation.y = phase * 2.8;
  if (running) {
    n.rig.position.y += Math.abs(Math.sin(phase * 10)) * 0.045;
    n.rig.rotation.y = Math.cos(phase * 2) * 0.35;
  }
  if (asleep || action === 'sit') n.head.rotation.z = 0.13;
  if (action === 'roll') {
    n.rig.rotation.z = phase * 2.3;
    n.rig.position.y = 0.22;
  }
  if (action === 'scared') {
    n.rig.position.y = -0.12;
    n.rig.scale.y = 0.86;
    n.arms[0].rotation.z = -0.9;
    n.arms[1].rotation.z = 0.9;
  }
  if (action === 'fall') {
    n.rig.rotation.z = 1.35;
    n.rig.position.y = -0.16;
  }
}

export function disposeCharacter(group: THREE.Group) {
  if (group.userData.authored) { disposeAuthoredCat(group); return; }
  const geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    (Array.isArray(object.material) ? object.material : [object.material]).forEach((m) =>
      materials.add(m),
    );
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
}
