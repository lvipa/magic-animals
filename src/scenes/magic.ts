import * as THREE from 'three';
export function makeMagic(count = 18) {
  const group = new THREE.Group();
  group.visible = false;
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5;
    const r = i % 2 ? 0.025 : 0.06;
    const x = Math.sin(angle) * r,
      y = Math.cos(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  for (let i = 0; i < count; i++) {
    const material = new THREE.MeshBasicMaterial({
      color: ['#ffd979', '#a3e1dd', '#ffaac8'][i % 3],
      transparent: true,
      opacity: i % 4 === 0 ? 0.4 : 0.75,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const shapeGeometry =
      i % 4 === 0
        ? new THREE.TorusGeometry(0.06, 0.005, 4, 16)
        : i % 4 === 1
          ? new THREE.PlaneGeometry(0.035, 0.075)
          : geometry;
    const star = new THREE.Mesh(shapeGeometry, material);
    star.userData.phase = i * 2.399;
    group.add(star);
  }
  return group;
}
export function animateMagic(group: THREE.Group, time: number) {
  group.children.forEach((star, i) => {
    const phase = star.userData.phase as number;
    const rise = (time * 0.22 + i * 0.071) % 1;
    star.position.set(
      Math.cos(phase) * (0.15 + rise * 0.45),
      rise * 0.8 - 0.2,
      Math.sin(phase) * 0.25 + 0.25,
    );
    star.rotation.z = time + phase;
    star.scale.setScalar(0.3 + Math.sin(rise * Math.PI));
  });
}
