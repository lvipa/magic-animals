import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { extname, resolve, sep } from 'node:path';
import { browserExecutable } from './browser-runtime.mjs';
import { writeMarkerCatalog } from './marker-catalog.mjs';

const root = resolve('.');
const server = createServer(async (req, res) => {
  const path = resolve(root, '.' + decodeURIComponent(req.url?.split('?')[0] ?? '/'));
  if (!path.startsWith(root + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(path);
    res.setHeader('Content-Type', extname(path) === '.js' ? 'text/javascript' : 'image/png');
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const port = server.address().port;
const browser = await chromium.launch({ headless: true, executablePath: browserExecutable() });
try {
  const page = await browser.newPage();
  page.on('console', (message) => console.log('browser:', message.text()));
  await page.goto(`http://127.0.0.1:${port}/public/markers/cat.png`);
  const bytes = await page.evaluate(async (base) => {
    const { Compiler } = await import(`${base}/node_modules/mind-ar/dist/mindar-image.prod.js`);
    const paths = ['cat', 'dog', 'lion'];
    const images = await Promise.all(
      paths.map(
        (id) =>
          new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = `${base}/public/markers/${id}.png`;
          }),
      ),
    );
    const compiler = new Compiler();
    await compiler.compileImageTargets(images, (progress) => {
      if (Math.round(progress) % 25 === 0) console.log(`compile ${progress.toFixed(0)}%`);
    });
    return [...new Uint8Array(await compiler.exportData())];
  }, `http://127.0.0.1:${port}`);
  await writeFile('public/markers/targets.mind', Buffer.from(bytes));
  await writeMarkerCatalog();
  console.log(`Compiled ${bytes.length} bytes for CAT, DOG, LION`);
} finally {
  await browser.close();
  server.close();
}
