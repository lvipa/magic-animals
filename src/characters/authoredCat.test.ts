import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { disposeAuthoredCat } from './authoredCat';

it('releases a cloned rig without disposing the shared model geometry or source material', () => {
  const geometry = new THREE.BufferGeometry();
  const sourceMaterial = new THREE.MeshStandardMaterial();
  const ownedMaterial = sourceMaterial.clone();
  const skeleton = new THREE.Skeleton([new THREE.Bone()]);
  skeleton.computeBoneTexture();
  const disposeGeometry = vi.spyOn(geometry, 'dispose');
  const disposeSource = vi.spyOn(sourceMaterial, 'dispose');
  const disposeOwned = vi.spyOn(ownedMaterial, 'dispose');
  const disposeSkeleton = vi.spyOn(skeleton, 'dispose');
  const content = new THREE.Group(),
    root = new THREE.Group();
  for (let i = 0; i < 2; i++) {
    const mesh = new THREE.SkinnedMesh(geometry, ownedMaterial);
    mesh.skeleton = skeleton;
    content.add(mesh);
  }
  root.add(content);
  root.userData = {
    content,
    mixer: new THREE.AnimationMixer(content),
    ownedMaterials: [ownedMaterial],
  };
  disposeAuthoredCat(root);
  expect(disposeGeometry).not.toHaveBeenCalled();
  expect(disposeSource).not.toHaveBeenCalled();
  expect(disposeOwned).toHaveBeenCalledOnce();
  expect(disposeSkeleton).toHaveBeenCalledOnce();
  expect(skeleton.boneTexture).toBeNull();
});
