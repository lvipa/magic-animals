import * as THREE from 'three';
import type { Character } from './catalog';
export type { Character } from './catalog';
import {
  makeAuthoredCharacter,
  animateAuthoredCat,
  revealAuthoredCat,
  disposeAuthoredCat,
} from './authoredCat';

export function makeCharacter(kind: Character) {
  const model = makeAuthoredCharacter(kind);
  if (model) return model;
  const empty = new THREE.Group();
  empty.userData = { kind, unavailable: true };
  return empty;
}
export function revealCharacter(root: THREE.Group, progress: number) {
  if (root.userData.authored) revealAuthoredCat(root, progress);
}
export function animateCharacter(root: THREE.Group, time: number, action = 'idle') {
  if (root.userData.authored) animateAuthoredCat(root, time, action);
}
export function disposeCharacter(group: THREE.Group) {
  if (group.userData.authored) {
    disposeAuthoredCat(group);
    return;
  }
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
