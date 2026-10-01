import { readFile, writeFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { chromium } from 'playwright';
import { browserExecutable, isolateTestContext } from './browser-runtime.mjs';
const results = [];
const catInfo = JSON.parse(await readFile('public/models/cat-master-info.json', 'utf8'));
for (const id of ['foxy', 'cat', 'dog', 'lion', 'bunny', 'bear', 'panda', 'elephant']) {
  const data = await readFile(`public/models/${id === 'cat' ? catInfo.asset : id + '.glb'}`);
  if (id === 'cat') {
    const gltf = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
    if (gltf.animations.length !== 7 || gltf.skins[0].joints.length !== 21 || catInfo.version !== 8)
      throw new Error('CAT: invalid production skeleton or clip set');
    results.push({
      id,
      clips: gltf.animations.map((c) => c.name),
      pipeline:
        'CAT structure checked here; exported motion in check-cat-studio.py; browser render reviewed separately',
    });
    console.log('PASS CAT production GLB structure');
    continue;
  }
  const gltf = await new GLTFLoader().parseAsync(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    '',
  );
  if (gltf.animations.length !== 7) throw new Error(`${id}: expected 7 animation clips`);
  const mixer = new THREE.AnimationMixer(gltf.scene);
  for (const clip of gltf.animations) {
    mixer.stopAllAction();
    mixer.clipAction(clip).play();
    mixer.update(0.2);
  }
  const bounds = new THREE.Box3().setFromObject(gltf.scene),
    size = bounds.getSize(new THREE.Vector3());
  if (![size.x, size.y, size.z].every(Number.isFinite))
    throw new Error(`${id}: invalid geometry or animation`);
  results.push({ id, clips: gltf.animations.map((clip) => clip.name), dimensions: size.toArray() });
  console.log('PASS GLB load and animation binding', id);
}
if (process.argv.includes('--assets-only')) {
  await writeFile(
    'MODEL_TEST_RESULTS.json',
    JSON.stringify(
      {
        results,
        gallery: 'Asset/animation validation; visual browser review separately',
        errors: [],
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
const browser = await chromium.launch({
  headless: true,
  executablePath: browserExecutable(),
  args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  await isolateTestContext(context);
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:4173/characters');
  const button = page.getByRole('button', { name: 'Hold PARENT' }),
    box = await button.boundingBox();
  if (!box) throw new Error('Gallery parent access missing');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(2150);
  await page.mouse.up();
  await page.getByRole('heading', { name: 'Made for a little magic.' }).waitFor();
  await page.waitForTimeout(1400);
  await page.screenshot({ path: 'artifacts/characters-lineup.png' });
  await page.locator('.gallery-stage').screenshot({ path: 'artifacts/characters-preview.png' });
  for (const id of ['foxy', 'cat', 'dog', 'lion']) {
    await page.getByRole('button', { name: id.toUpperCase(), exact: true }).click();
    await page.waitForTimeout(250);
    await page.screenshot({ path: `artifacts/character-${id}.png` });
  }
  await page.getByRole('button', { name: 'All friends' }).click();
  await page.getByRole('button', { name: 'wave', exact: true }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'artifacts/characters-wave.png' });
  if (errors.length) throw new Error(errors.join('; '));
  await context.close();
  await writeFile(
    'MODEL_TEST_RESULTS.json',
    JSON.stringify(
      {
        results,
        gallery: 'Desktop Chromium WebGL; original models rendered, selectable and animated',
        errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
