import * as THREE from 'three';
import type { Character } from './models';

type Point = [number, number, number];
const palette = {
  cat: { fur: '#baada4', detail: '#8d7c79', cream: '#fff0df', pink: '#de939e' },
  dog: { fur: '#a5cdd4', detail: '#719eae', cream: '#f9f1e4', pink: '#e6adb6' },
  lion: { fur: '#f0cf82', detail: '#c79464', cream: '#fff2d6', pink: '#dfa9a0' },
  foxy: { fur: '#edaa76', detail: '#d58b60', cream: '#fff2e0', pink: '#e9aca6' },
  bunny: { fur: '#f3e5df', detail: '#d4bcc7', cream: '#fff5ef', pink: '#e9a9bd' },
  bear: { fur: '#be9576', detail: '#906b56', cream: '#f5d5af', pink: '#dfa5a0' },
  panda: { fur: '#f0efe6', detail: '#535966', cream: '#fff7ef', pink: '#e4a5ad' },
  elephant: { fur: '#a6bbd8', detail: '#7d94b8', cream: '#dfe9f4', pink: '#dcaab9' },
};

/** Small clay toys: a clean silhouette and shallow features fitted to the face. */
export function makeCharacter(id: Character): THREE.Group {
  const root = new THREE.Group();
  root.userData.kind = id;
  root.userData.designVersion = 4;
  const p = palette[id];
  const material = (color: string) =>
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.72,
      metalness: 0,
      sheen: 0.65,
      sheenRoughness: 0.8,
      sheenColor: new THREE.Color(color).multiplyScalar(0.4),
    });
  const fur = material(p.fur),
    detail = material(p.detail),
    cream = material(p.cream),
    pink = material(p.pink);
  const ink = material('#453d4c');
  const white = new THREE.MeshBasicMaterial({ color: '#fffaf4' });
  const sphere = new THREE.SphereGeometry(1, 24, 16);
  const tinySphere = new THREE.SphereGeometry(1, 12, 8);
  const oval = (
    parent: THREE.Object3D,
    mat: THREE.Material,
    pos: Point,
    size: Point,
    geometry = sphere,
  ) => {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(...pos);
    mesh.scale.set(...size);
    parent.add(mesh);
    return mesh;
  };
  const group = (name: string, parent: THREE.Object3D, pos: Point = [0, 0, 0]) => {
    const node = new THREE.Group();
    node.name = name;
    node.position.set(...pos);
    parent.add(node);
    return node;
  };
  const stroke = (parent: THREE.Object3D, points: Point[], radius: number, mat: THREE.Material) => {
    const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, radius, 6, false), mat);
    parent.add(mesh);
    // Rounded ends keep whiskers and smiles from looking like cut metal wires.
    oval(parent, mat, points[0], [radius, radius, radius], tinySphere);
    oval(parent, mat, points[points.length - 1], [radius, radius, radius], tinySphere);
    return mesh;
  };
  const rig = group('rig', root);
  const body = group('body', rig);
  const paws = group('paws', rig);
  const head = group('head', rig, [0, 0.77, 0.01]);
  const seated = id === 'cat';
  const radius: Point = [id === 'foxy' ? 0.352 : id === 'elephant' ? 0.36 : 0.345, 0.325, 0.285];
  const hoodie = material('#a875b2');
  const coat = id === 'cat' ? hoodie : fur;

  oval(body, coat, [0, 0.32, -0.012], [seated ? 0.218 : 0.242, 0.285, 0.19]);
  if (id !== 'cat') oval(body, cream, [0, 0.3, 0.157], [0.12, 0.176, 0.026]);
  else {
    stroke(
      body,
      [
        [0, 0.1, 0.184],
        [0, 0.31, 0.195],
        [0, 0.52, 0.126],
      ],
      0.004,
      material('#d6b1dd'),
    );
    oval(head, hoodie, [0, 0.022, -0.047], [0.37, 0.352, 0.3]);
    const hoodRim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.065, 10, 64), hoodie);
    hoodRim.scale.set(0.36, 0.341, 0.42);
    hoodRim.position.z = 0.04;
    head.add(hoodRim);
  }
  const headGeometry = new THREE.SphereGeometry(1, 48, 32);
  const vertices = headGeometry.getAttribute('position'),
    colors: number[] = [];
  const furColor = new THREE.Color(p.fur),
    creamColor = new THREE.Color(p.cream);
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i) * radius[0],
      y = vertices.getY(i) * radius[1];
    const distance =
      id === 'foxy'
        ? Math.min(
            Math.hypot((x - 0.125) / 0.2, (y + 0.115) / 0.125),
            Math.hypot((x + 0.125) / 0.2, (y + 0.115) / 0.125),
          )
        : Math.hypot(x / 0.17, (y + 0.105) / 0.108);
    const weight =
      (1 - THREE.MathUtils.smoothstep(distance, 0.75, 1.06)) *
      THREE.MathUtils.smoothstep(vertices.getZ(i), 0.3, 0.65);
    const color = furColor.clone().lerp(creamColor, weight);
    colors.push(color.r, color.g, color.b);
  }
  headGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const face = new THREE.Mesh(
    headGeometry,
    new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.72,
      metalness: 0,
      sheen: 0.5,
      sheenRoughness: 0.85,
      sheenColor: new THREE.Color('#bdaaa2'),
    }),
  );
  face.scale.set(...radius);
  head.add(face);

  // Project facial details onto the head, rather than stacking protruding eyeballs/muzzles.
  const faceZ = (x: number, y: number, offset = 0.008) =>
    radius[2] * Math.sqrt(Math.max(0.08, 1 - (x / radius[0]) ** 2 - (y / radius[1]) ** 2)) + offset;
  const facePoint = (x: number, y: number, offset = 0.009): Point => [x, y, faceZ(x, y, offset)];
  const faceStroke = (
    parent: THREE.Object3D,
    points: [number, number][],
    width: number,
    mat = ink,
  ) =>
    stroke(
      parent,
      points.map(([x, y]) => facePoint(x, y)),
      width,
      mat,
    );
  const facePatch = (
    mat: THREE.Material,
    x: number,
    y: number,
    width: number,
    height: number,
    depth = 0.012,
  ) => {
    const patch = oval(head, mat, facePoint(x, y, 0.002), [width, height, depth]);
    patch.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(
        x / radius[0] ** 2,
        y / radius[1] ** 2,
        faceZ(x, y, 0) / radius[2] ** 2,
      ).normalize(),
    );
    return patch;
  };

  if (id === 'lion') {
    // One softly scalloped cushion, no overlapping pointed tufts around the face.
    const shape = new THREE.Shape();
    for (let i = 0; i < 144; i++) {
      const a = (i / 144) * Math.PI * 2,
        r = 0.405 + 0.014 * Math.cos(a * 8);
      if (i === 0) shape.moveTo(Math.sin(a) * r, Math.cos(a) * r);
      else shape.lineTo(Math.sin(a) * r, Math.cos(a) * r);
    }
    shape.closePath();
    const mane = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, {
        depth: 0.065,
        bevelEnabled: true,
        bevelThickness: 0.035,
        bevelSize: 0.032,
        bevelSegments: 5,
        steps: 1,
      }),
      detail,
    );
    mane.position.set(0, -0.015, -0.105);
    head.add(mane);
  }

  const earShape = new THREE.Shape();
  earShape.moveTo(-0.102, 0);
  earShape.bezierCurveTo(-0.112, 0.048, -0.071, 0.169, -0.023, 0.188);
  earShape.bezierCurveTo(0.013, 0.205, 0.08, 0.119, 0.106, 0.018);
  earShape.quadraticCurveTo(0, -0.025, -0.102, 0);
  const earGeometry = new THREE.ExtrudeGeometry(earShape, {
    depth: 0.036,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.021,
    bevelSegments: 5,
    steps: 1,
    curveSegments: 12,
  });
  for (const side of [-1, 1]) {
    const ear = group(side < 0 ? 'ear-left' : 'ear-right', head, [
      side * 0.239,
      id === 'dog' ? 0.15 : 0.225,
      -0.016,
    ]);
    if (id === 'elephant') {
      oval(ear, fur, [side * 0.1, -0.035, -0.05], [0.18, 0.228, 0.08]).rotation.z = side * 0.14;
      oval(ear, pink, [side * 0.11, -0.035, 0.021], [0.115, 0.155, 0.019]).rotation.z = side * 0.14;
    } else if (id === 'bunny') {
      oval(ear, fur, [side * 0.015, 0.135, 0], [0.077, 0.255, 0.058]).rotation.z = -side * 0.12;
      oval(ear, pink, [side * 0.015, 0.14, 0.051], [0.039, 0.186, 0.011]).rotation.z = -side * 0.12;
    } else if (id === 'bear' || id === 'panda') {
      oval(ear, id === 'panda' ? detail : fur, [0, 0.025, -0.018], [0.095, 0.095, 0.064]);
      oval(ear, pink, [0, 0.026, 0.044], [0.042, 0.042, 0.011]);
    } else if (id === 'dog') {
      oval(ear, detail, [side * 0.07, -0.119, -0.012], [0.091, 0.176, 0.065]).rotation.z =
        side * 0.16;
    } else if (id === 'lion') {
      oval(ear, fur, [0, 0.025, 0.018], [0.074, 0.075, 0.05]);
      oval(ear, pink, [0, 0.026, 0.064], [0.034, 0.036, 0.009]);
    } else {
      ear.rotation.z = -side * 0.18;
      ear.add(new THREE.Mesh(earGeometry, fur));
      const inner = new THREE.Mesh(earGeometry, pink);
      inner.scale.set(0.62, 0.61, 0.18);
      inner.position.set(0, 0.024, 0.065);
      ear.add(inner);
    }

    if (seated) oval(body, fur, [side * 0.188, 0.115, -0.015], [0.118, 0.12, 0.14]);
    const foot = group(side < 0 ? 'foot-left' : 'foot-right', paws, [
      side * (seated ? 0.215 : 0.155),
      0.079,
      seated ? 0.025 : 0.06,
    ]);
    oval(foot, id === 'panda' ? detail : fur, [0, 0, 0.024], [0.105, 0.073, 0.127]);
    if (seated) {
      // Small, rounded bean pads; no sharp toe grooves.
      oval(foot, pink, [0, 0.002, 0.154], [0.038, 0.033, 0.008]);
      for (const x of [-0.038, 0, 0.038]) oval(foot, pink, [x, 0.043, 0.12], [0.013, 0.015, 0.009]);
    } else oval(foot, cream, [0, 0.007, 0.153], [0.061, 0.033, 0.013]);

    const arm = group(side < 0 ? 'left-arm' : 'right-arm', body, [
      side * (seated ? 0.11 : 0.213),
      0.444,
      seated ? 0.105 : 0,
    ]);
    arm.rotation.z = side * (seated ? 0.025 : 0.1);
    oval(
      arm,
      id === 'panda' ? detail : coat,
      [side * 0.013, seated ? -0.17 : -0.112, 0.013],
      [seated ? 0.053 : 0.071, seated ? 0.2 : 0.159, 0.067],
    );
    oval(
      arm,
      id === 'panda' ? detail : seated ? fur : cream,
      [side * 0.014, seated ? -0.379 : -0.247, 0.035],
      [0.067, 0.054, 0.077],
    );

    if (id === 'panda') facePatch(detail, side * 0.12, 0.067, 0.114, 0.131, 0.014);
    // Shallow eyes follow the face: large pupils and restrained white rims.
    const eye = group(
      side < 0 ? 'eye-left' : 'eye-right',
      head,
      facePoint(side * 0.115, 0.067, 0.02),
    );
    oval(eye, cream, [0, 0, 0], [0.089, 0.099, 0.03]);
    const pupil = group('pupil', eye, [0, -0.004, 0.042]);
    const iris = material(
      id === 'cat' || id === 'elephant' ? '#408bad' : id === 'bunny' ? '#a97d9f' : '#6f948b',
    );
    oval(pupil, iris, [0, 0, 0], [0.06, 0.071, 0.011]);
    oval(pupil, ink, [0, -0.002, 0.014], [0.037, 0.049, 0.008]);
    oval(pupil, white, [-0.019, 0.032, 0.026], [0.014, 0.016, 0.004]);
    oval(pupil, white, [0.021, -0.025, 0.026], [0.005, 0.006, 0.002]);
    eye.rotation.y = side * 0.17;
    const closed = group(side < 0 ? 'closed-eye-left' : 'closed-eye-right', head);
    faceStroke(
      closed,
      [
        [side * 0.112 - 0.027, 0.032],
        [side * 0.112 - 0.018, 0.047],
        [side * 0.112, 0.052],
        [side * 0.112 + 0.019, 0.045],
        [side * 0.112 + 0.027, 0.032],
      ],
      0.007,
    );
    closed.visible = false;
    eye.visible = true;
    faceStroke(
      head,
      [
        [side * 0.115 - 0.049, 0.187],
        [side * 0.115, 0.199],
        [side * 0.115 + 0.049, 0.185],
      ],
      0.006,
      detail,
    );
    facePatch(pink, side * 0.183, -0.055, 0.032, 0.017, 0.006);
    if (id === 'cat') {
      for (const [y, end] of [
        [-0.083, -0.063],
        [-0.123, -0.13],
      ] as const)
        faceStroke(
          head,
          [
            [side * 0.164, y],
            [side * 0.224, (y + end) / 2],
            [side * 0.282, end],
          ],
          0.0035,
          cream,
        );
    }
  }

  // A small heart-shaped nose and a quiet, permanent smile.
  const noseShape = new THREE.Shape();
  noseShape.moveTo(0, -0.015);
  noseShape.bezierCurveTo(-0.011, -0.009, -0.028, 0.005, -0.018, 0.013);
  noseShape.bezierCurveTo(-0.01, 0.021, -0.003, 0.013, 0, 0.012);
  noseShape.bezierCurveTo(0.004, 0.015, 0.011, 0.022, 0.019, 0.013);
  noseShape.bezierCurveTo(0.028, 0.004, 0.011, -0.01, 0, -0.015);
  const nose = new THREE.Mesh(
    new THREE.ExtrudeGeometry(noseShape, {
      depth: 0.003,
      bevelEnabled: true,
      bevelSize: 0.0025,
      bevelThickness: 0.0025,
      bevelSegments: 3,
      curveSegments: 10,
    }),
    id === 'dog' || id === 'foxy' ? ink : pink,
  );
  nose.position.set(...facePoint(0, -0.073, 0.021));
  head.add(nose);
  const smile = group('smile', head);
  const mouthInk = ink;
  faceStroke(
    smile,
    [
      [0, -0.091],
      [0, -0.114],
    ],
    0.0035,
    mouthInk,
  );
  faceStroke(
    smile,
    [
      [-0.038, -0.112],
      [-0.026, -0.128],
      [-0.012, -0.13],
      [0, -0.117],
      [0.012, -0.13],
      [0.026, -0.128],
      [0.038, -0.112],
    ],
    0.0045,
    mouthInk,
  );
  const mouth = group('mouth-open', head, facePoint(0, -0.139, 0.012));
  oval(mouth, pink, [0, 0, 0], [0.019, 0.016, 0.003]);
  mouth.visible = false;
  if (id === 'elephant') {
    stroke(
      head,
      [
        [0, -0.066, 0.301],
        [0, -0.14, 0.346],
        [0.014, -0.236, 0.352],
        [0.068, -0.251, 0.334],
        [0.085, -0.211, 0.316],
      ],
      0.049,
      fur,
    );
    nose.visible = false;
    smile.visible = false;
    mouth.visible = false;
    root.userData.hasTrunk = true;
  }
  if (id === 'bunny') {
    oval(body, material('#d8a3b9'), [0, 0.517, 0], [0.15, 0.025, 0.12]);
    oval(body, material('#e9becb'), [0.06, 0.455, 0.17], [0.035, 0.065, 0.015]);
  }
  if (id === 'bear') {
    const scarf = material('#779d97');
    oval(body, scarf, [0, 0.532, 0], [0.155, 0.029, 0.125]);
    oval(body, scarf, [-0.072, 0.451, 0.165], [0.04, 0.076, 0.017]).rotation.z = 0.15;
  }
  if (id === 'foxy') {
    const scarf = material('#7ab8b3');
    oval(body, scarf, [0, 0.535, 0.011], [0.157, 0.027, 0.12]);
    oval(body, scarf, [0.075, 0.457, 0.167], [0.041, 0.072, 0.015]).rotation.z = -0.2;
  }
  if (id === 'dog') {
    const collar = material('#e0b785');
    oval(body, collar, [0, 0.528, 0], [0.151, 0.02, 0.12]);
    oval(body, cream, [0, 0.486, 0.162], [0.025, 0.03, 0.01]);
  }

  // Continuous rounded tail: no rings, needle tips or disconnected stripes.
  const tail = group('tail', rig, [0.171, 0.184, -0.12]);
  const points: Point[] =
    id === 'foxy'
      ? [
          [0, 0, 0],
          [0.17, 0.005, -0.08],
          [0.31, 0.16, -0.08],
          [0.34, 0.37, -0.05],
          [0.26, 0.47, -0.018],
        ]
      : id === 'cat'
        ? [
            [0, 0, 0],
            [0.18, 0.01, -0.02],
            [0.31, 0.13, -0.015],
            [0.36, 0.32, 0.015],
            [0.33, 0.39, 0.015],
          ]
        : id === 'lion'
          ? [
              [0, 0, 0],
              [0.18, 0, -0.055],
              [0.28, 0.1, -0.02],
              [0.29, 0.22, 0],
            ]
          : [
              [0, 0, 0],
              [0.15, 0.03, -0.03],
              [0.22, 0.16, -0.02],
              [0.2, 0.27, 0],
            ];
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  const segments = 36,
    sides = 12,
    frames = curve.computeFrenetFrames(segments, false);
  const positions: number[] = [],
    indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments,
      center = curve.getPointAt(t);
    const r = id === 'foxy' ? 0.043 + 0.064 * Math.sin(Math.PI * t) : id === 'cat' ? 0.048 : 0.034;
    for (let j = 0; j <= sides; j++) {
      const a = (j / sides) * Math.PI * 2;
      const v = center
        .clone()
        .addScaledVector(frames.normals[i], Math.cos(a) * r)
        .addScaledVector(frames.binormals[i], Math.sin(a) * r);
      positions.push(v.x, v.y, v.z);
      if (i < segments && j < sides) {
        const n = i * (sides + 1) + j;
        indices.push(n, n + sides + 1, n + 1, n + 1, n + sides + 1, n + sides + 2);
      }
    }
  }
  // Join a hemisphere to the last tube ring, so the end has no separate ball or seam.
  const end = curve.getPointAt(1),
    tangent = curve.getTangentAt(1);
  const tipRadius = id === 'foxy' ? 0.043 : id === 'cat' ? 0.048 : 0.034;
  for (let cap = 1; cap <= 6; cap++) {
    const angle = ((cap / 6) * Math.PI) / 2;
    const center = end.clone().addScaledVector(tangent, Math.sin(angle) * tipRadius);
    const r = Math.cos(angle) * tipRadius;
    for (let j = 0; j <= sides; j++) {
      const a = (j / sides) * Math.PI * 2;
      const v = center
        .clone()
        .addScaledVector(frames.normals[segments], Math.cos(a) * r)
        .addScaledVector(frames.binormals[segments], Math.sin(a) * r);
      positions.push(v.x, v.y, v.z);
      if (j < sides) {
        const n = (segments + cap - 1) * (sides + 1) + j;
        indices.push(n, n + sides + 1, n + 1, n + 1, n + sides + 1, n + sides + 2);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.normalizeNormals();
  const normals = geometry.getAttribute('normal');
  for (let j = 0; j <= sides; j++)
    normals.setXYZ((segments + 6) * (sides + 1) + j, tangent.x, tangent.y, tangent.z);
  const tipStart = 26 * sides * 6;
  geometry.addGroup(0, tipStart, 0);
  geometry.addGroup(tipStart, indices.length - tipStart, id === 'foxy' ? 1 : 0);
  tail.add(new THREE.Mesh(geometry, [fur, cream]));
  if (['bunny', 'bear', 'panda'].includes(id)) {
    tail.clear();
    oval(
      tail,
      id === 'panda' ? detail : fur,
      [-0.15, 0.015, -0.072],
      id === 'bunny' ? [0.079, 0.079, 0.079] : [0.045, 0.045, 0.045],
    );
    geometry.dispose();
  }
  const tip = points[points.length - 1];
  if (id === 'lion') oval(tail, detail, tip, [0.061, 0.066, 0.059]);
  const eyes = [head.getObjectByName('eye-left')!, head.getObjectByName('eye-right')!];
  root.userData.nodes = {
    rig,
    body,
    head,
    paws,
    tail,
    eyes,
    pupils: eyes.map((eye) => eye.getObjectByName('pupil')!),
    closedEyes: [
      head.getObjectByName('closed-eye-left')!,
      head.getObjectByName('closed-eye-right')!,
    ],
    ears: [head.getObjectByName('ear-left')!, head.getObjectByName('ear-right')!],
    arms: [body.getObjectByName('left-arm')!, body.getObjectByName('right-arm')!],
    feet: [paws.getObjectByName('foot-left')!, paws.getObjectByName('foot-right')!],
    mouth,
    smile,
  };
  return root;
}
