import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { animateAuthoredCat, disposeAuthoredCat } from './authoredCat';
import { PoseLayer } from './poseLayer';
import { collectExpressiveControls } from './expressiveMotion';
vi.mock('../audio/AudioManager', () => ({ audio: { mouthLevelFor: () => 0 } }));

it('does not accumulate head/chest rotations on constant idle tracks and blends interrupted actions', () => {
  const content = new THREE.Group(),
    root = new THREE.Group();
  const hip = new THREE.Bone(),
    chest = new THREE.Bone(),
    head = new THREE.Bone();
  hip.name = 'root';
  chest.name = 'chest';
  head.name = 'head';
  content.add(hip);
  hip.add(chest);
  chest.add(head);
  root.add(content);
  const tracks = [head, chest, hip].map(
    (bone) =>
      new THREE.QuaternionKeyframeTrack(
        `${bone.name}.quaternion`,
        [0, 1],
        [0, 0, 0, 1, 0, 0, 0, 1],
      ),
  );
  const idle = new THREE.AnimationClip('idle', 1, tracks);
  const sleep = new THREE.AnimationClip('sleep', 1, [
    new THREE.QuaternionKeyframeTrack(
      'root.quaternion',
      [0, 1],
      [0, 0, Math.sin(0.6), Math.cos(0.6), 0, 0, Math.sin(0.6), Math.cos(0.6)],
    ),
  ]);
  root.userData = {
    kind: 'cat',
    content,
    mixer: new THREE.AnimationMixer(content),
    clips: new Map([
      ['idle', idle],
      ['sleep', sleep],
    ]),
    action: '',
    previousTime: null,
    poseLayer: new PoseLayer(content),
    secondaryControls: [],
    expressiveControls: collectExpressiveControls(content),
    tiredLids: [],
    mouths: [],
  };
  let time = 0;
  const step = (action: string, frames: number) => {
    for (let i = 0; i < frames; i++) {
      time += 1 / 60;
      animateAuthoredCat(root, time, action);
    }
  };
  for (const action of ['tired', 'sad', 'hungry', 'thirsty']) {
    step(action, 1200);
    expect(head.quaternion.angleTo(new THREE.Quaternion())).toBeLessThan(0.3);
    expect(chest.quaternion.angleTo(new THREE.Quaternion())).toBeLessThan(0.1);
  }
  step('sleep', 120);
  const asleep = hip.quaternion.clone();
  expect(asleep.angleTo(new THREE.Quaternion())).toBeGreaterThan(1);
  step('thirsty', 1);
  expect(asleep.angleTo(hip.quaternion)).toBeLessThan(0.03);
  step('hungry', 1); // interrupt the wake-up before its transition finishes
  expect(asleep.angleTo(hip.quaternion)).toBeLessThan(0.04);
  step('hungry', 60);
  expect(hip.quaternion.angleTo(new THREE.Quaternion())).toBeLessThan(0.001);
  step('idle', 60);
  expect(head.quaternion.angleTo(new THREE.Quaternion())).toBeLessThan(0.001);
});

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
