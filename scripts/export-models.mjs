import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

// GLTFExporter uses FileReader for binary buffers, which Node does not expose.
globalThis.FileReader = class {
  result = null;
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = `data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;
      this.onloadend?.();
    });
  }
};
await mkdir('.test-artifacts', { recursive: true });
await mkdir('public/models', { recursive: true });
const source = await readFile('src/characters/models.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
});
const modulePath = resolve('.test-artifacts/character-models.mjs');
await writeFile(modulePath, compiled.outputText.replace("'./toyFactory'", "'./toy-factory.mjs'").replace("'./authoredCat'", "'./authored-cat.mjs'"));
await writeFile(resolve('.test-artifacts/authored-cat.mjs'), ts.transpileModule(await readFile('src/characters/authoredCat.ts','utf8'), {
  compilerOptions: {target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}
}).outputText);
const factorySource = await readFile('src/characters/toyFactory.ts', 'utf8');
await writeFile(
  resolve('.test-artifacts/toy-factory.mjs'),
  ts.transpileModule(factorySource, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText,
);
const { makeCharacter, animateCharacter, disposeCharacter } = await import(
  pathToFileURL(modulePath).href
);
const report = [];
for (const id of ['foxy', 'cat', 'dog', 'lion', 'bunny', 'bear', 'panda', 'elephant']) {
  if (id === 'cat') {
    const data = await readFile('public/models/cat-studio.glb');
    const gltf = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
    const info = JSON.parse(await readFile('public/models/cat-master-info.json', 'utf8'));
    await writeFile('public/models/cat.glb', data);
    report.push({ id, bytes: data.length, meshes: gltf.meshes.length, triangles: info.triangles,
      source: info.source, pipeline: info.pipeline, approval: info.approval, animations: info.clips });
    console.log('Preserved CAT production GLB; no primitive export');
    continue;
  }
  const model = makeCharacter(id),
    nodes = model.userData.nodes;
  const moving = [
    nodes.rig,
    nodes.body,
    nodes.head,
    nodes.tail,
    ...nodes.eyes,
    ...nodes.pupils,
    ...nodes.closedEyes,
    ...nodes.ears,
    ...nodes.arms,
    ...nodes.feet,
    nodes.mouth,
    nodes.smile,
  ];
  const clips = [];
  for (const action of ['idle', 'happy', 'wave', 'jump', 'run', 'sleep', 'roar']) {
    const duration = action === 'idle' ? 4.4 : Math.PI * 2;
    const frames = Math.ceil(duration * 24),
      times = [],
      values = moving.map(() => ({ position: [], quaternion: [], scale: [] }));
    for (let frame = 0; frame <= frames; frame++) {
      const time = (frame / frames) * duration;
      times.push(time);
      animateCharacter(model, time, action);
      moving.forEach((node, i) => {
        node.position.toArray(values[i].position, values[i].position.length);
        node.quaternion.toArray(values[i].quaternion, values[i].quaternion.length);
        const size = node.visible ? node.scale : new THREE.Vector3(0.001, 0.001, 0.001);
        size.toArray(values[i].scale, values[i].scale.length);
      });
    }
    const tracks = moving.flatMap((node, i) => [
      new THREE.VectorKeyframeTrack(`${node.uuid}.position`, times, values[i].position),
      new THREE.QuaternionKeyframeTrack(`${node.uuid}.quaternion`, times, values[i].quaternion),
      new THREE.VectorKeyframeTrack(`${node.uuid}.scale`, times, values[i].scale),
    ]);
    clips.push(new THREE.AnimationClip(action, duration, tracks));
  }
  animateCharacter(model, 0.3, 'idle');
  // glTF has no visibility property: keep both eye expressions and encode hidden groups by scale.
  moving.forEach((node) => {
    if (!node.visible) node.scale.setScalar(0.001);
    node.visible = true;
  });
  nodes.mouth.visible = true;
  nodes.mouth.scale.setScalar(0.001);
  nodes.smile.visible = true;
  // Runtime node cache contains circular object references; GLB extras contain only metadata.
  model.userData = {
    kind: id,
    design: 'Magic Animals original animated storybook character',
    version: 4,
  };
  let triangles = 0,
    meshes = 0;
  model.traverse((object) => {
    if (object.isMesh) {
      meshes++;
      triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
    }
  });
  const result = await new GLTFExporter().parseAsync(model, {
    binary: true,
    animations: clips,
    onlyVisible: false,
  });
  await writeFile(`public/models/${id}.glb`, Buffer.from(result));
  report.push({
    id,
    bytes: result.byteLength,
    meshes,
    triangles,
    animations: clips.map((c) => c.name),
  });
  disposeCharacter(model);
  console.log(
    `Exported ${id}.glb: ${Math.round(result.byteLength / 1024)} KiB, ${triangles} triangles`,
  );
}
await writeFile(
  'public/models/catalog.json',
  JSON.stringify(
    {
      format: 'glTF 2.0',
      source: 'src/characters/models.ts',
      note: 'CAT uses its Blender production candidate. The other seven remain legacy transform-animated prototypes pending CAT approval.',
      models: report,
    },
    null,
    2,
  ),
);
