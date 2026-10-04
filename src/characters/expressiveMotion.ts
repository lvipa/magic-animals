import * as THREE from 'three';
import type { Character } from './catalog';
type Control = { bone: THREE.Bone; x: THREE.Vector3; y: THREE.Vector3; z: THREE.Vector3 };
const turn = new THREE.Quaternion();
type Arm = { upper: THREE.Bone; fore: THREE.Bone; paw: THREE.Bone; side: number };
type Expressions = {
  controls: Control[];
  content: THREE.Object3D;
  arms: Arm[];
  head: THREE.Object3D;
  chest: THREE.Object3D;
  hip: THREE.Object3D;
};
const shoulder = new THREE.Vector3(),
  elbow = new THREE.Vector3(),
  wrist = new THREE.Vector3();
const target = new THREE.Vector3(),
  direction = new THREE.Vector3(),
  bend = new THREE.Vector3();
const aimedElbow = new THREE.Vector3(),
  current = new THREE.Vector3(),
  desired = new THREE.Vector3();
const point = new THREE.Vector3(),
  belly = new THREE.Vector3(),
  face = new THREE.Vector3(),
  hipPoint = new THREE.Vector3();
const parentRotation = new THREE.Quaternion(),
  delta = new THREE.Quaternion(),
  local = new THREE.Quaternion();
function aim(bone: THREE.Bone, endpoint: THREE.Bone, destination: THREE.Vector3) {
  bone.getWorldPosition(current);
  endpoint.getWorldPosition(desired);
  desired.sub(current).normalize();
  current.negate().add(destination).normalize();
  delta.setFromUnitVectors(desired, current);
  bone.parent!.getWorldQuaternion(parentRotation);
  local.copy(parentRotation).invert().multiply(delta).multiply(parentRotation);
  bone.quaternion.premultiply(local);
  bone.updateWorldMatrix(true, true);
}
function reach(arm: Arm, content: THREE.Object3D, point: THREE.Vector3) {
  content.updateWorldMatrix(true, true);
  arm.upper.getWorldPosition(shoulder);
  arm.fore.getWorldPosition(elbow);
  arm.paw.getWorldPosition(wrist);
  const upperLength = shoulder.distanceTo(elbow),
    foreLength = elbow.distanceTo(wrist);
  target.copy(point);
  content.localToWorld(target);
  direction.copy(target).sub(shoulder);
  const distance = THREE.MathUtils.clamp(
    direction.length(),
    Math.abs(upperLength - foreLength) + 0.001,
    (upperLength + foreLength) * 0.98,
  );
  direction.normalize();
  target.copy(shoulder).addScaledVector(direction, distance);
  const along =
    (distance * distance + upperLength * upperLength - foreLength * foreLength) / (2 * distance);
  const height = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));
  bend.set(arm.side, -0.3, 0.15).transformDirection(content.matrixWorld);
  bend.addScaledVector(direction, -bend.dot(direction));
  if (bend.lengthSq() < 1e-6) bend.set(0, 0, 1).cross(direction);
  bend.normalize();
  aimedElbow.copy(shoulder).addScaledVector(direction, along).addScaledVector(bend, height);
  aim(arm.upper, arm.fore, aimedElbow);
  aim(arm.fore, arm.paw, target);
}
export function collectExpressiveControls(content: THREE.Object3D) {
  content.updateMatrixWorld(true);
  const result: Control[] = [];
  content.traverse((bone) => {
    if (
      !(bone instanceof THREE.Bone) ||
      !/^(head|chest|upper_arm_[LR]|forearm_[LR]|paw_[LR])$/.test(bone.name)
    )
      return;
    const inverse = bone.getWorldQuaternion(new THREE.Quaternion()).invert();
    result.push({
      bone,
      x: new THREE.Vector3(1, 0, 0).applyQuaternion(inverse),
      y: new THREE.Vector3(0, 1, 0).applyQuaternion(inverse),
      z: new THREE.Vector3(0, 0, 1).applyQuaternion(inverse),
    });
  });
  const arms: Arm[] = [];
  for (const [side, sign] of [
    ['L', 1],
    ['R', -1],
  ] as const) {
    const upper = content.getObjectByName(`upper_arm_${side}`),
      fore = content.getObjectByName(`forearm_${side}`),
      paw = content.getObjectByName(`paw_${side}`);
    if (upper instanceof THREE.Bone && fore instanceof THREE.Bone && paw instanceof THREE.Bone)
      arms.push({ upper, fore, paw, side: sign });
  }
  return {
    controls: result,
    content,
    arms,
    head: content.getObjectByName('head')!,
    chest: content.getObjectByName('chest')!,
    hip: content.getObjectByName('root')!,
  };
}
export function animateExpression(
  expression: Expressions,
  kind: Character,
  time: number,
  action: string,
) {
  for (const control of expression.controls) {
    const { bone, x, y, z } = control;
    const rotate = (axis: THREE.Vector3, angle: number) =>
      bone.quaternion.multiply(turn.setFromAxisAngle(axis, angle));
    if (action === 'tired' || action === 'sad') {
      if (bone.name === 'head') {
        rotate(x, action === 'tired' ? 0.23 : 0.12);
        rotate(z, (action === 'tired' ? 0.09 : -0.07) + Math.sin(time * 1.1) * 0.025);
      }
      if (bone.name === 'chest') rotate(x, 0.06);
    } else if (action === 'hungry') {
      if (bone.name === 'head') rotate(x, 0.1 + Math.sin(time * 1.7) * 0.03);
    } else if (action === 'thirsty') {
      if (bone.name === 'head') rotate(x, -0.06 + Math.sin(time * 1.5) * 0.025);
    } else if (action === 'sing') {
      if (bone.name === 'head') {
        rotate(z, Math.sin(time * 4) * 0.08);
        rotate(y, Math.sin(time * 2) * 0.05);
      }
      if (bone.name === 'chest') rotate(z, Math.sin(time * 4) * 0.035);
    }
    if (kind === 'elephant' && action === 'thirsty' && bone.name === 'head') rotate(y, 0.03);
  }
  if (action === 'hungry' || action === 'thirsty') {
    const { content, head, chest, hip, arms } = expression;
    content.updateWorldMatrix(true, true);
    content.worldToLocal(chest.getWorldPosition(belly));
    belly.lerp(content.worldToLocal(hip.getWorldPosition(hipPoint)), 0.4);
    content.worldToLocal(head.getWorldPosition(face));
    for (const arm of arms) {
      if (action === 'thirsty' && arm.side === 1) continue;
      point.set(
        arm.side * (action === 'hungry' ? 0.095 + Math.sin(time * 2) * 0.008 : 0.1),
        action === 'hungry' ? belly.y : face.y - 0.015,
        action === 'hungry' ? 0.205 : 0.3,
      );
      reach(arm, content, point);
    }
  }
  if (action.startsWith('music-')) {
    const { content, head, hip, arms } = expression;
    content.updateWorldMatrix(true, true);
    content.worldToLocal(head.getWorldPosition(face));
    content.worldToLocal(hip.getWorldPosition(hipPoint));
    for (const arm of arms) {
      if (action === 'music-clap') {
        point.set(arm.side * (0.065 + (1 + Math.sin(time * 7)) * 0.045), face.y - 0.29, 0.25);
      } else if (action === 'music-shoulders') {
        content.worldToLocal(arm.upper.getWorldPosition(point));
        point.x += arm.side * 0.025;
        point.y += 0.03;
        point.z += 0.1;
      } else if (action === 'music-knees' || action === 'music-toes') {
        point.set(arm.side * 0.12, hipPoint.y - (action === 'music-toes' ? 0.35 : 0.18), 0.19);
      } else {
        const height =
          action === 'music-head'
            ? 0.19
            : action === 'music-ears'
              ? 0.16
              : action === 'music-eyes'
                ? 0.08
                : action === 'music-mouth'
                  ? -0.08
                  : -0.025;
        point.set(arm.side * (action === 'music-ears' ? 0.24 : 0.11), face.y + height, 0.19);
      }
      reach(arm, content, point);
    }
  }
}
