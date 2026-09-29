import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { extname, resolve, sep } from 'node:path';
import { browserExecutable } from './browser-runtime.mjs';
import { createHash } from 'node:crypto';
const catalog = JSON.parse(await readFile('public/markers/catalog.json', 'utf8'));
for (const entry of [...catalog.images, { image: catalog.target, sha256: catalog.sha256 }]) {
  const bytes = await readFile(`public/markers/${entry.image}`);
  if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256)
    throw new Error(`Marker changed without recompiling targets: ${entry.image}`);
}
const root = resolve('.');
const server = createServer(async (req, res) => {
  const path = resolve(root, '.' + decodeURIComponent(req.url?.split('?')[0] ?? '/'));
  if (!path.startsWith(root + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    res.setHeader(
      'Content-Type',
      extname(path) === '.js'
        ? 'text/javascript'
        : extname(path) === '.mind'
          ? 'application/octet-stream'
          : 'image/png',
    );
    res.end(await readFile(path));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  executablePath: browserExecutable(),
  args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const results = [];
try {
  for (const [index, id] of ['cat', 'dog', 'lion'].entries()) {
    const page = await browser.newPage();
    await page.goto(`${base}/public/markers/${id}.png`);
    const result = await page.evaluate(
      async ({ base, index, id }) => {
        const { Controller } = await import(
          `${base}/node_modules/mind-ar/dist/mindar-image.prod.js`
        );
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const image = await new Promise((r, j) => {
          const img = new Image();
          img.onload = () => r(img);
          img.onerror = j;
          img.src = `${base}/public/markers/${id}.png`;
        });
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#aaa';
        ctx.fillRect(0, 0, 640, 480);
        ctx.save();
        ctx.translate(320, 240);
        ctx.rotate(0.07);
        ctx.drawImage(image, -260, -189, 520, 378);
        ctx.restore();
        const start = performance.now();
        let controller;
        const found = await new Promise(async (resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error(`${id} tracking timed out`)), 30000);
          controller = new Controller({
            inputWidth: 640,
            inputHeight: 480,
            warmupTolerance: 2,
            onUpdate: (data) => {
              if (data.type === 'updateMatrix' && data.worldMatrix) {
                clearTimeout(timeout);
                resolve({
                  index: data.targetIndex,
                  matrix: data.worldMatrix,
                  ms: Math.round(performance.now() - start),
                });
              }
            },
          });
          try {
            await controller.addImageTargets(`${base}/public/markers/targets.mind`);
            controller.dummyRun(canvas);
            controller.processVideo(canvas);
          } catch (e) {
            clearTimeout(timeout);
            reject(e);
          }
        });
        controller.stopProcessVideo();
        await new Promise((r) => setTimeout(r, 100));
        const { featurePoints } = await controller.detect(canvas);
        const mistaken = [];
        for (let other = 0; other < 3; other++) {
          if (other === index) continue;
          const match = await controller.match(featurePoints, other);
          if (match.modelViewTransform) mistaken.push(other);
        }
        controller.dispose();
        controller.worker.terminate();
        if (found.index !== index) throw new Error(`${id} matched wrong index ${found.index}`);
        if (mistaken.length)
          throw new Error(`${id} also matched incorrect targets: ${mistaken.join(', ')}`);
        return {
          id,
          index: found.index,
          pose: found.matrix.length === 16,
          elapsedMs: found.ms,
          singleTargetFalseMatches: mistaken,
        };
      },
      { base, index, id },
    );
    results.push(result);
    console.log('PASS', result);
    await page.close();
  }
  await writeFile(
    'TRACKING_TEST_RESULTS.json',
    JSON.stringify(
      {
        method:
          'Real MindAR controller; scaled and rotated generated target images; desktop Chromium, NOT physical iPad validation',
        results,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  server.close();
}
