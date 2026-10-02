import * as THREE from 'three';

type Transform = {
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
  scale: THREE.Vector3;
};
const transform = (node: THREE.Object3D): Transform => ({
  position: node.position.clone(),
  rotation: node.quaternion.clone(),
  scale: node.scale.clone(),
});
const read = (pose: Transform, node: THREE.Object3D) => {
  pose.position.copy(node.position);
  pose.rotation.copy(node.quaternion);
  pose.scale.copy(node.scale);
};
const write = (node: THREE.Object3D, pose: Transform) => {
  node.position.copy(pose.position);
  node.quaternion.copy(pose.rotation);
  node.scale.copy(pose.scale);
};

/** Separates the evaluated GLB pose from procedural expressions and the displayed pose. */
export class PoseLayer {
  private bones: Array<{
    node: THREE.Object3D;
    base: Transform;
    displayed: Transform;
    from: Transform;
  }> = [];
  private morphs: Array<{ node: THREE.Mesh; base: number[]; displayed: number[]; from: number[] }> =
    [];
  private action: string | null = null;
  private elapsed = 0.45;

  constructor(content: THREE.Object3D) {
    content.traverse((node) => {
      if (node === content || node instanceof THREE.Bone)
        this.bones.push({
          node,
          base: transform(node),
          displayed: transform(node),
          from: transform(node),
        });
      if (node instanceof THREE.Mesh && node.morphTargetInfluences)
        this.morphs.push({
          node,
          base: [...node.morphTargetInfluences],
          displayed: [...node.morphTargetInfluences],
          from: [...node.morphTargetInfluences],
        });
    });
  }

  begin(action: string) {
    if (this.action !== null && this.action !== action) {
      for (const { from, displayed } of this.bones) {
        from.position.copy(displayed.position);
        from.rotation.copy(displayed.rotation);
        from.scale.copy(displayed.scale);
      }
      for (const pose of this.morphs) pose.from.splice(0, pose.from.length, ...pose.displayed);
      this.elapsed = 0;
    }
    this.action = action;
    // PropertyMixer may skip a write for a constant/unchanged animation track.
    // Never feed last frame's IK or head tilt back into that evaluated base.
    for (const { node, base } of this.bones) write(node, base);
    for (const { node, base } of this.morphs)
      base.forEach((value, i) => {
        node.morphTargetInfluences![i] = value;
      });
  }

  captureBase() {
    for (const { node, base } of this.bones) read(base, node);
    for (const { node, base } of this.morphs)
      node.morphTargetInfluences!.forEach((value, i) => {
        base[i] = value;
      });
  }

  finish(dt: number) {
    this.elapsed = Math.min(0.45, this.elapsed + dt);
    const fraction = this.elapsed / 0.45;
    const blend = fraction * fraction * (3 - 2 * fraction);
    for (const { node, from, displayed } of this.bones) {
      node.position.lerpVectors(from.position, node.position, blend);
      displayed.rotation.copy(node.quaternion);
      node.quaternion.slerpQuaternions(from.rotation, displayed.rotation, blend);
      node.scale.lerpVectors(from.scale, node.scale, blend);
      read(displayed, node);
    }
    for (const { node, from, displayed } of this.morphs)
      node.morphTargetInfluences!.forEach((value, i, values) => {
        values[i] = from[i] + (value - from[i]) * blend;
        displayed[i] = values[i];
      });
  }
}
